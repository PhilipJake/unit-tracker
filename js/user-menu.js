const ACCESS_RULES = {
  'Super Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
    isReadOnly: false
  },
  Administrator: {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
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
  return normalized === 'index.html' ? '../index.html' : currentPath.endsWith('messages.html') ? 'pages/messages.html' : currentPath.endsWith('unit-registry.html') ? 'pages/unit-registry.html' : currentPath.endsWith('branches.html') ? 'pages/branches.html' : currentPath.endsWith('accounts.html') ? 'pages/accounts.html' : currentPath.endsWith('settings.html') ? 'pages/settings.html' : '../index.html';
}

const DEFAULT_ROLE_PERMISSIONS = {
  'Super Admin': { view: true, create: true, edit: true, delete: true, export: true },
  Administrator: { view: true, create: true, edit: true, delete: true, export: true },
  'Main Head Admin': { view: true, create: true, edit: true, delete: false, export: true },
  'Branch Head Admin': { view: true, create: true, edit: true, delete: false, export: false },
  Office: { view: true, create: false, edit: false, delete: false, export: false },
  Technician: { view: true, create: true, edit: true, delete: false, export: false }
};

const PAGE_ACCESS_OPTIONS = {
  Overview: '../index.html',
  Messages: 'pages/messages.html',
  'Unit registry': 'pages/unit-registry.html',
  Branches: 'pages/branches.html',
  Accounts: 'pages/accounts.html'
};

const DEFAULT_PAGE_ACCESS = {
  'Super Admin': Object.keys(PAGE_ACCESS_OPTIONS).reduce((access, page) => ({ ...access, [page]: true }), {}),
  Administrator: Object.keys(PAGE_ACCESS_OPTIONS).reduce((access, page) => ({ ...access, [page]: true }), {}),
  'Main Head Admin': { Overview: true, Messages: true, 'Unit registry': true, Branches: true, Accounts: true },
  'Branch Head Admin': { Overview: true, Messages: true, 'Unit registry': true, Branches: false, Accounts: false },
  Office: { Overview: true, Messages: true, 'Unit registry': true, Branches: true, Accounts: true },
  Technician: { Overview: true, Messages: true, 'Unit registry': true, Branches: false, Accounts: false }
};

function getRolePermissions() {
  try {
    const saved = JSON.parse(localStorage.getItem('unitflowRolePermissions') || '{}');
    const permissions = Object.keys(DEFAULT_ROLE_PERMISSIONS).reduce((rolePermissions, role) => {
      rolePermissions[role] = { ...DEFAULT_ROLE_PERMISSIONS[role], ...(saved[role] || {}) };
      return rolePermissions;
    }, {});
    permissions['Super Admin'] = { ...DEFAULT_ROLE_PERMISSIONS['Super Admin'] };
    return permissions;
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  }
}

function canManageAction(action, role = getCurrentRole()) {
  const permissions = getRolePermissions();
  return Boolean(permissions[role] && permissions[role][action]);
}

function getPageAccess() {
  try {
    const saved = JSON.parse(localStorage.getItem('unitflowPageAccess') || '{}');
    const access = Object.keys(DEFAULT_PAGE_ACCESS).reduce((pageAccess, role) => {
      pageAccess[role] = { ...DEFAULT_PAGE_ACCESS[role], ...(saved[role] || {}) };
      return pageAccess;
    }, {});
    access['Super Admin'] = { ...DEFAULT_PAGE_ACCESS['Super Admin'] };
    return access;
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_PAGE_ACCESS));
  }
}

function isPermissionManager(role = getCurrentRole()) {
  return ['Super Admin', 'Administrator'].includes(role);
}

function isAllowedPage(targetHref, allowedPages) {
  if (!targetHref) return false;
  const resolvedHref = new URL(targetHref, window.location.href).pathname;
  return allowedPages.some((allowedPage) => resolvedHref.endsWith(allowedPage.replace(/^\.\//, '').replace(/^\.\.\//, '')));
}

function getAllowedPagesForRole(role) {
  const pageAccess = getPageAccess()[role] || DEFAULT_PAGE_ACCESS.Technician;
  const pages = Object.entries(PAGE_ACCESS_OPTIONS)
    .filter(([page]) => pageAccess[page])
    .map(([, path]) => path);

  if (isPermissionManager(role)) {
    pages.push('pages/settings.html');
  }

  return pages;
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

  const settingsLink = document.getElementById('settingsLink');
  if (settingsLink) {
    const canAccessSettings = isPermissionManager(role);
    settingsLink.style.display = canAccessSettings ? '' : 'none';
    settingsLink.setAttribute('aria-hidden', String(!canAccessSettings));
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

  const createButtons = document.querySelectorAll('#openUnitModalBtn, #openBranchModalBtn, #openAccountModalBtn');
  createButtons.forEach((button) => {
    button.style.display = canManageAction('create', role) ? '' : 'none';
  });

  const exportButton = document.getElementById('exportUnitCsvBtn');
  if (exportButton) {
    exportButton.style.display = canManageAction('export', role) ? '' : 'none';
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
