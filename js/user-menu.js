const ACCESS_RULES = {
  'Super Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/trash.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
    isReadOnly: false
  },
  Administrator: {
    pages: ['../index.html', 'pages/messages.html', 'pages/unit-registry.html', 'pages/trash.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
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
  return normalized === 'index.html' ? '../index.html' : currentPath.endsWith('messages.html') ? 'pages/messages.html' : currentPath.endsWith('unit-registry.html') ? 'pages/unit-registry.html' : currentPath.endsWith('trash.html') ? 'pages/trash.html' : currentPath.endsWith('branches.html') ? 'pages/branches.html' : currentPath.endsWith('accounts.html') ? 'pages/accounts.html' : currentPath.endsWith('settings.html') ? 'pages/settings.html' : '../index.html';
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
  Trash: 'pages/trash.html',
  Branches: 'pages/branches.html',
  Accounts: 'pages/accounts.html'
};

const DEFAULT_PAGE_ACCESS = {
  'Super Admin': Object.keys(PAGE_ACCESS_OPTIONS).reduce((access, page) => ({ ...access, [page]: true }), {}),
  Administrator: Object.keys(PAGE_ACCESS_OPTIONS).reduce((access, page) => ({ ...access, [page]: true }), {}),
  'Main Head Admin': { Overview: true, Messages: true, 'Unit registry': true, Trash: false, Branches: true, Accounts: true },
  'Branch Head Admin': { Overview: true, Messages: true, 'Unit registry': true, Branches: false, Accounts: false },
  Office: { Overview: true, Messages: true, 'Unit registry': true, Trash: false, Branches: true, Accounts: true },
  Technician: { Overview: true, Messages: true, 'Unit registry': true, Trash: false, Branches: false, Accounts: false }
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

function closeChangePasswordModal(backdrop) {
  backdrop.classList.remove('visible');
  backdrop.setAttribute('aria-hidden', 'true');
}

let passwordToastTimer = null;

function showPasswordToast(message) {
  let toast = document.getElementById('passwordToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'passwordToast';
    toast.className = 'message-toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(passwordToastTimer);
  passwordToastTimer = window.setTimeout(() => toast.classList.remove('visible'), 4000);
}

function openChangePasswordModal() {
  let backdrop = document.getElementById('changePasswordBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.id = 'changePasswordBackdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.innerHTML = `
      <div class="modal message-modal" role="dialog" aria-modal="true" aria-labelledby="changePasswordTitle">
        <div class="modal-header">
          <h3 id="changePasswordTitle">Change Password</h3>
          <button class="modal-close" id="closeChangePasswordButton" type="button" aria-label="Close change password form">×</button>
        </div>
        <form class="modal-body unit-form" id="changePasswordForm" autocomplete="off">
          <div class="field-group"><label for="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" required /></div>
          <div class="field-group"><label for="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" minlength="6" required /></div>
          <div class="field-group"><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" minlength="6" required /></div>
          <div class="modal-actions"><button type="button" class="action-btn" id="cancelChangePasswordButton">Cancel</button><button type="submit" class="action-btn primary">Update password</button></div>
        </form>
      </div>`;
    document.body.appendChild(backdrop);

    const close = () => closeChangePasswordModal(backdrop);
    document.getElementById('closeChangePasswordButton').addEventListener('click', close);
    document.getElementById('cancelChangePasswordButton').addEventListener('click', close);
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) close();
    });
    document.getElementById('changePasswordForm').addEventListener('submit', submitPasswordChange);
  }

  backdrop.classList.add('visible');
  backdrop.setAttribute('aria-hidden', 'false');
  document.getElementById('currentPassword').focus();
}

async function submitPasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const currentPassword = String(formData.get('currentPassword') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  const submitButton = form.querySelector('button[type="submit"]');

  if (newPassword.length < 6) {
    showPasswordToast('Your new password must be at least 6 characters long.');
    return;
  }
  if (newPassword === currentPassword) {
    showPasswordToast('Your new password must be different from your current password.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showPasswordToast('The new passwords do not match.');
    return;
  }

  const appScriptUrl = String((window.GS_CONFIG && window.GS_CONFIG.appScriptUrl) || '').trim();
  if (!appScriptUrl) {
    showPasswordToast('Password changes are not configured yet.');
    return;
  }

  submitButton.disabled = true;
  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'changePassword',
        username: String(localStorage.getItem('unitflowUser') || '').trim(),
        currentPassword,
        newPassword
      }).toString()
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.ok === false) {
      throw new Error(result && result.error ? result.error : 'Unable to change password');
    }
    closeChangePasswordModal(document.getElementById('changePasswordBackdrop'));
    form.reset();
    showPasswordToast('Password Changed Successfully');
  } catch (error) {
    showPasswordToast(error.message || 'Your password could not be changed.');
  } finally {
    submitButton.disabled = false;
  }
}

function initNavToggle() {
  document.querySelectorAll('.sidebar').forEach((sidebar) => {
    if (sidebar.querySelector('.nav-toggle')) {
      return;
    }

    const nav = sidebar.querySelector('.nav');
    if (!nav) {
      return;
    }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle navigation');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';

    sidebar.insertBefore(toggle, nav);

    const syncMenuState = () => {
      if (window.innerWidth > 760) {
        sidebar.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    };

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = sidebar.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    nav.querySelectorAll('.nav-item').forEach((item) => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 760) {
          sidebar.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    });

    window.addEventListener('resize', syncMenuState);
    document.addEventListener('click', (event) => {
      if (window.innerWidth <= 760 && sidebar.classList.contains('nav-open') && !sidebar.contains(event.target)) {
        sidebar.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });
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
  let changePasswordButton = document.getElementById('changePasswordButton');

  if (userDropdown && !changePasswordButton) {
    changePasswordButton = document.createElement('button');
    changePasswordButton.type = 'button';
    changePasswordButton.id = 'changePasswordButton';
    changePasswordButton.textContent = 'Change Password';
    userDropdown.insertBefore(changePasswordButton, logoutButton || null);
  }

  initNavToggle();
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

  if (changePasswordButton) {
    changePasswordButton.addEventListener('click', openChangePasswordModal);
  }

  document.addEventListener('click', (event) => {
    if (userMenuButton && userDropdown && !userMenuButton.contains(event.target) && !userDropdown.contains(event.target)) {
      userMenuButton.setAttribute('aria-expanded', 'false');
      userDropdown.hidden = true;
    }
  });
}

document.addEventListener('DOMContentLoaded', initUserMenu);
