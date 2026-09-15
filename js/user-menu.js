const ACCESS_RULES = {
  'Super Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: false
  },
  Administrator: {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: false
  },
  'Main Head Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: false
  },
  'Office': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: true
  },
  'Branch Head Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html'],
    isReadOnly: false
  },
  Technician: {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html'],
    isReadOnly: false
  }
};

function getCurrentRole() {
  const role = localStorage.getItem('unitflowRole');
  return role && ACCESS_RULES[role] ? role : 'Technician';
}

function getCurrentPagePath() {
  const currentPath = window.location.pathname;
  const normalized = currentPath.split('/').pop();
  return normalized === 'index.html' ? '../index.html' : currentPath.endsWith('messages.html') ? 'pages/messages.html' : currentPath.endsWith('unit-registry.html') ? 'pages/unit-registry.html' : currentPath.endsWith('branches.html') ? 'pages/branches.html' : currentPath.endsWith('accounts.html') ? 'pages/accounts.html' : '../index.html';
}

function isAllowedPage(targetHref, allowedPages) {
  if (!targetHref) return false;
  const resolvedHref = new URL(targetHref, window.location.href).pathname;
  return allowedPages.some((allowedPage) => resolvedHref.endsWith(allowedPage.replace(/^\.\//, '').replace(/^\.\.\//, '')));
}

function getAllowedPagesForRole(role) {
  const config = ACCESS_RULES[role] || ACCESS_RULES.Technician;
  return config.pages || [];
}

function resolveRoutePath(targetPath) {
  const cleaned = String(targetPath || '').replace(/^\.\//, '').replace(/^\.\.\//, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const isInsidePagesFolder = currentPath.includes('/pages/') || currentPath.endsWith('/pages');

  if (isInsidePagesFolder) {
    return cleaned.startsWith('pages/') ? `../${cleaned}` : `../${cleaned}`;
  }

  return cleaned;
}

function applyRoleRestrictions() {
  const role = getCurrentRole();
  const allowedPages = getAllowedPagesForRole(role);
  const currentPagePath = getCurrentPagePath();

  const manageBranchLink = document.getElementById('manageBranchLink');
  if (manageBranchLink) {
    const canAccessBranches = allowedPages.some((page) => page.endsWith('pages/branches.html') || page.endsWith('branches.html'));
    manageBranchLink.style.display = canAccessBranches ? '' : 'none';
    manageBranchLink.setAttribute('aria-hidden', String(!canAccessBranches));
  }

  const viewAllUnitsLink = document.getElementById('viewAllUnitsLink');
  if (viewAllUnitsLink) {
    viewAllUnitsLink.href = resolveRoutePath('pages/unit-registry.html');
  }

  if (!allowedPages.some((page) => currentPagePath.endsWith(page.replace(/^\.\//, '').replace(/^\.\.\//, '')))) {
    const fallbackPage = allowedPages[0] || 'index.html';
    window.location.href = resolveRoutePath(fallbackPage);
    return;
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    const href = item.getAttribute('href') || '';
    const isAllowed = isAllowedPage(href, allowedPages);

    item.classList.toggle('disabled', !isAllowed);
    item.setAttribute('aria-disabled', String(!isAllowed));

    if (isAllowed) {
      item.style.display = '';
      item.style.pointerEvents = '';
      item.style.opacity = '';
      item.title = '';
      return;
    }

    item.style.display = 'none';
    item.style.pointerEvents = 'none';
    item.style.opacity = '0';
    item.title = 'Not available for this role';
  });

  if (role === 'Office') {
    document.querySelectorAll('.action-btn.primary, #openUnitModalBtn, #openBranchModalBtn, #openAccountModalBtn').forEach((element) => {
      element.style.display = 'none';
    });

    const exportButton = document.getElementById('exportUnitCsvBtn');
    if (exportButton) {
      exportButton.style.display = 'none';
    }

    document.querySelectorAll('.table-actions button.edit, .table-actions button.delete').forEach((button) => {
      button.disabled = true;
      button.style.display = 'none';
    });
  }
}

async function updateMessageNavCount() {
  const counters = document.querySelectorAll('[data-message-nav-count]');
  if (!counters.length || typeof DATA === 'undefined' || typeof DATA.fetchMessages !== 'function') return;

  try {
    const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
    const rows = await DATA.fetchMessages();
    const unreadCount = rows.filter((message) => {
      const recipients = [message.Recipient || message.recipient, message.Cc || message.cc, message.Bcc || message.bcc]
        .join(',')
        .split(',')
        .map((recipient) => String(recipient || '').trim().toLowerCase())
        .filter(Boolean);
      const read = String(message.Read || message.read || '').trim().toLowerCase();
      return recipients.includes(username) && !['true', 'yes', '1'].includes(read);
    }).length;

    counters.forEach((counter) => {
      counter.hidden = unreadCount === 0;
      counter.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    });
  } catch (error) {
    console.warn('Unable to load unread message count:', error);
  }
}

function getLoggedInUserName() {
  const fullName = localStorage.getItem('unitflowFullName');
  if (fullName && fullName.trim()) return fullName.trim();

  const username = localStorage.getItem('unitflowUser');
  if (!username) return 'Technician';
  return username.charAt(0).toUpperCase() + username.slice(1);
}

function logoutUser() {
  localStorage.removeItem('unitflowRole');
  localStorage.removeItem('unitflowUser');
  localStorage.removeItem('unitflowFullName');
  localStorage.removeItem('unitflowBranch');
  window.location.href = resolveRoutePath('pages/login.html');
}

function initUserMenu() {
  if (!localStorage.getItem('unitflowRole')) {
    window.location.href = resolveRoutePath('pages/login.html');
    return;
  }

  const userNameElement = document.getElementById('topbarUserName');
  const userMenuButton = document.getElementById('userMenuButton');
  const userDropdown = document.getElementById('userDropdown');
  const logoutButton = document.getElementById('logoutButton');

  applyRoleRestrictions();
  updateMessageNavCount();
  const refreshMs = Number((window.GS_CONFIG && window.GS_CONFIG.refreshMs) || 15000);
  window.setInterval(updateMessageNavCount, Math.max(5000, refreshMs));

  if (userNameElement) {
    userNameElement.textContent = getLoggedInUserName();
  }

  if (userMenuButton && userDropdown) {
    userMenuButton.addEventListener('click', () => {
      const expanded = userMenuButton.getAttribute('aria-expanded') === 'true';
      userMenuButton.setAttribute('aria-expanded', String(!expanded));
      userDropdown.hidden = expanded;
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', logoutUser);
  }

  document.addEventListener('click', (event) => {
    if (userMenuButton && userDropdown && !userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
      userMenuButton.setAttribute('aria-expanded', 'false');
      userDropdown.hidden = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', initUserMenu);
