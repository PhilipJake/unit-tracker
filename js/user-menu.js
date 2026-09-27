const ACCESS_RULES = {
  'Super Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html', 'pages/trash.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
    isReadOnly: false
  },
  Administrator: {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html', 'pages/trash.html', 'pages/branches.html', 'pages/accounts.html', 'pages/settings.html'],
    isReadOnly: false
  },
  'Main Head Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html', 'pages/trash.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: false
  },
  'Office': {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html', 'pages/branches.html', 'pages/accounts.html'],
    isReadOnly: true
  },
  'Branch Head Admin': {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html'],
    isReadOnly: false
  },
  Technician: {
    pages: ['../index.html', 'pages/messages.html', 'pages/units.html'],
    isReadOnly: false
  }
};

function getCurrentRole() {
  const role = localStorage.getItem('unitflowRole');
  return role && role.trim() ? role.trim() : 'Technician';
}

const DEFAULT_ROLE_COLORS = {
  'Super Admin': '#21A675',
  Administrator: '#3388CC',
  'Main Head Admin': '#E3A83D',
  'Branch Head Admin': '#D36C60',
  Office: '#597D8C',
  Technician: '#84919A'
};
const DEFAULT_CUSTOM_ROLE_COLOR = '#84919A';
const ROLE_COLOR_SWATCHES = [
  '#16B99A', '#2CCB7D', '#3498DB', '#9B59B6', '#E91E63', '#F1C40F', '#E67E22', '#E74C3C', '#95A5A6', '#607D8B',
  '#128F76', '#239B56', '#2874A6', '#7D3C98', '#B71540', '#B7950B', '#A04000', '#922B21', '#7B8788', '#455A64'
];
const DEFAULT_BRANCH_TYPE_DEFINITIONS = [
  { code: 'BNB', fullName: 'Bytes and Bots Gadget Center', color: '#21A675' },
  { code: 'EZ', fullName: '', color: '#3388CC' },
  { code: '1LR', fullName: '', color: '#E3A83D' }
];

function normalizeHexColor(value, fallback = DEFAULT_CUSTOM_ROLE_COLOR) {
  const color = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : fallback;
}

function normalizeRoleColors(colors) {
  const normalized = { ...DEFAULT_ROLE_COLORS };
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) return normalized;
  Object.entries(colors).forEach(([role, color]) => {
    if (String(role).trim()) normalized[role] = normalizeHexColor(color);
  });
  return normalized;
}

function getRoleColors() {
  try {
    return normalizeRoleColors(JSON.parse(localStorage.getItem('unitflowRoleColors') || '{}'));
  } catch (error) {
    return normalizeRoleColors({});
  }
}

function setRoleColors(colors) {
  const normalized = normalizeRoleColors(colors);
  localStorage.setItem('unitflowRoleColors', JSON.stringify(normalized));
  return normalized;
}

function normalizeBranchTypeDefinitions(definitions) {
  if (!Array.isArray(definitions)) return [];
  const seenCodes = new Set();
  return definitions.reduce((result, definition) => {
    const code = String(definition && definition.code || '').trim().toUpperCase();
    if (!code || seenCodes.has(code)) return result;
    seenCodes.add(code);
    const defaultType = DEFAULT_BRANCH_TYPE_DEFINITIONS.find((item) => item.code === code);
    result.push({
      code,
      fullName: String(definition.fullName || '').trim(),
      color: normalizeHexColor(definition.color, defaultType ? defaultType.color : DEFAULT_CUSTOM_ROLE_COLOR)
    });
    return result;
  }, []);
}

function getBranchTypeDefinitions() {
  try {
    const saved = localStorage.getItem('unitflowBranchTypes');
    const definitions = saved === null ? [] : normalizeBranchTypeDefinitions(JSON.parse(saved));
    return definitions.length ? definitions : [...DEFAULT_BRANCH_TYPE_DEFINITIONS];
  } catch (error) {
    return [...DEFAULT_BRANCH_TYPE_DEFINITIONS];
  }
}

function setBranchTypeDefinitions(definitions) {
  const normalized = normalizeBranchTypeDefinitions(definitions);
  localStorage.setItem('unitflowBranchTypes', JSON.stringify(normalized));
  return normalized;
}

async function loadBranchTypeDefinitions() {
  const config = window.GS_CONFIG || {};
  if (!config.appScriptUrl || config.appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    return getBranchTypeDefinitions();
  }
  try {
    const response = await fetch(`${config.appScriptUrl}?action=branchtypes`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || result.ok === false || !Array.isArray(result.branchTypes)) throw new Error(result.error || 'Branch type load failed');
    return setBranchTypeDefinitions(result.branchTypes.length ? result.branchTypes : DEFAULT_BRANCH_TYPE_DEFINITIONS);
  } catch (error) {
    console.warn('Unable to load branch types from Google Sheets:', error);
    return getBranchTypeDefinitions();
  }
}

async function saveBranchTypeDefinitions(definitions) {
  const normalized = setBranchTypeDefinitions(definitions);
  const config = window.GS_CONFIG || {};
  if (!config.appScriptUrl || config.appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') return false;
  const response = await fetch(config.appScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({
      action: 'savebranchtypes',
      actorRole: getCurrentRole(),
      branchTypes: JSON.stringify(normalized)
    }).toString()
  });
  const result = await response.json();
  if (!response.ok || result.ok === false) throw new Error(result.error || 'Branch type save failed');
  return true;
}

function getCustomRolePermissionDefaults() {
  return { view: true, create: false, edit: false, delete: false, export: false, release: false, warehouse: false, pullOut: false, forReplacement: false };
}

function getCustomRolePageDefaults() {
  return { Overview: true, Messages: true, 'Unit registry': true, Trash: false, Branches: false, Accounts: false };
}

function getCurrentPagePath() {
  const currentPath = window.location.pathname;
  const normalized = currentPath.split('/').pop();
  return normalized === 'index.html' ? '../index.html' : currentPath.endsWith('messages.html') ? 'pages/messages.html' : currentPath.endsWith('units.html') ? 'pages/units.html' : currentPath.endsWith('trash.html') ? 'pages/trash.html' : currentPath.endsWith('branches.html') ? 'pages/branches.html' : currentPath.endsWith('accounts.html') ? 'pages/accounts.html' : currentPath.endsWith('settings.html') ? 'pages/settings.html' : '../index.html';
}

const DEFAULT_ROLE_PERMISSIONS = {
  'Super Admin': { view: true, create: true, edit: true, delete: true, export: true, release: true, warehouse: true, pullOut: true, forReplacement: true },
  Administrator: { view: true, create: true, edit: true, delete: true, export: true, release: true, warehouse: true, pullOut: true, forReplacement: true },
  'Main Head Admin': { view: true, create: true, edit: true, delete: true, export: true, release: false, warehouse: true, pullOut: true, forReplacement: true },
  'Branch Head Admin': { view: true, create: true, edit: true, delete: false, export: false, release: false, warehouse: true, pullOut: true, forReplacement: true },
  Office: { view: true, create: false, edit: false, delete: false, export: true, release: false, warehouse: false, pullOut: false, forReplacement: false },
  Technician: { view: true, create: true, edit: true, delete: false, export: false, release: true, warehouse: true, pullOut: true, forReplacement: true }
};

const PAGE_ACCESS_OPTIONS = {
  Overview: '../index.html',
  Messages: 'pages/messages.html',
  'Unit registry': 'pages/units.html',
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
    const roleNames = new Set([...Object.keys(DEFAULT_ROLE_PERMISSIONS), ...Object.keys(saved)]);
    const permissions = [...roleNames].reduce((rolePermissions, role) => {
      const defaults = DEFAULT_ROLE_PERMISSIONS[role] || getCustomRolePermissionDefaults();
      rolePermissions[role] = { ...defaults, ...(saved[role] || {}), view: true };
      return rolePermissions;
    }, {});
    permissions['Super Admin'] = { ...DEFAULT_ROLE_PERMISSIONS['Super Admin'] };
    return permissions;
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  }
}

function canManageAction(action, role = getCurrentRole()) {
  if (action === 'view') return true;
  const permissions = getEffectiveRolePermissions(role);
  return Boolean(permissions[role] && permissions[role][action]);
}

function canAccessUnitView(view, role = getCurrentRole()) {
  const permissionByView = {
    'for-release': 'release',
    released: 'release',
    warehouse: 'warehouse',
    'pull-out': 'pullOut',
    replaced: 'forReplacement'
  };
  const permission = permissionByView[view];
  return !permission || canManageAction(permission, role);
}

function getUserPermissionOverrides() {
  try {
    return JSON.parse(localStorage.getItem('unitflowUserPermissionOverrides') || '{}');
  } catch (error) {
    return {};
  }
}

function getEffectiveRolePermissions(role = getCurrentRole()) {
  const permissions = getRolePermissions();
  const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
  const override = getUserPermissionOverrides()[username];
  if (role !== 'Super Admin' && override && override.enabled && override.permissions) {
    permissions[role] = { ...permissions[role], ...override.permissions };
  }
  return permissions;
}

function getPageAccess() {
  try {
    const saved = JSON.parse(localStorage.getItem('unitflowPageAccess') || '{}');
    const roleNames = new Set([...Object.keys(DEFAULT_PAGE_ACCESS), ...Object.keys(saved)]);
    const access = [...roleNames].reduce((pageAccess, role) => {
      const defaults = DEFAULT_PAGE_ACCESS[role] || getCustomRolePageDefaults();
      pageAccess[role] = { ...defaults, ...(saved[role] || {}) };
      return pageAccess;
    }, {});
    access['Super Admin'] = { ...DEFAULT_PAGE_ACCESS['Super Admin'] };
    return access;
  } catch (error) {
    return JSON.parse(JSON.stringify(DEFAULT_PAGE_ACCESS));
  }
}

function getEffectivePageAccess(role = getCurrentRole()) {
  const access = getPageAccess();
  const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
  const override = getUserPermissionOverrides()[username];
  if (role !== 'Super Admin' && override && override.enabled && override.pageAccess) {
    access[role] = { ...access[role], ...override.pageAccess };
  }
  return access;
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
  const pageAccess = getEffectivePageAccess(role)[role] || DEFAULT_PAGE_ACCESS.Technician;
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
  const currentView = new URLSearchParams(window.location.search).get('view') || 'monitoring';

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
    viewAllUnitsLink.href = resolveRoutePath('pages/units.html?view=monitoring');
  }

  if (!allowedPages.some((page) => currentPagePath.endsWith(page.replace(/^\.\//, '').replace(/^\.\.\//, '')))) {
    const fallbackPage = allowedPages[0] || 'index.html';
    window.location.href = resolveRoutePath(fallbackPage);
    return;
  }

  if (window.location.pathname.endsWith('units.html') && !canAccessUnitView(currentView, role)) {
    window.location.href = resolveRoutePath('pages/units.html?view=monitoring');
    return;
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    const href = item.getAttribute('href') || '';
    const linkUrl = new URL(href, window.location.href);
    const isAllowed = isAllowedPage(href, allowedPages)
      && (!linkUrl.pathname.endsWith('/units.html') || canAccessUnitView(linkUrl.searchParams.get('view') || 'monitoring', role));

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

function initUnitsMenu() {
  const currentPath = window.location.pathname;
  const isUnitsPage = currentPath.endsWith('units.html');
  const trashExpansionKey = 'unitflowExpandUnitsMenuOnTrash';
  const shouldExpandOnTrash = currentPath.endsWith('trash.html')
    && sessionStorage.getItem(trashExpansionKey) === 'true';
  if (shouldExpandOnTrash) sessionStorage.removeItem(trashExpansionKey);
  const savedState = localStorage.getItem('unitflowUnitsMenuCollapsed');
  const defaultCollapsed = savedState === null ? true : savedState === 'true';

  document.querySelectorAll('[data-unit-menu]').forEach((menu) => {
    const submenu = menu.querySelector('.nav-submenu');
    const toggle = menu.querySelector('[data-unit-menu-toggle]');
    if (!submenu || !toggle) return;

    const setCollapsed = (collapsed) => {
      menu.classList.toggle('is-collapsed', collapsed);
      submenu.hidden = collapsed;
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} Units menu`);
      toggle.title = `${collapsed ? 'Expand' : 'Collapse'} Units menu`;
      toggle.textContent = '';
    };

    const currentView = new URLSearchParams(window.location.search).get('view');
    const links = menu.querySelectorAll('.nav-item');
    links.forEach((link) => {
      const linkUrl = new URL(link.href, window.location.href);
      const isActive = isUnitsPage
        ? linkUrl.pathname.endsWith('units.html') && linkUrl.search === `?view=${currentView || 'monitoring'}`
        : linkUrl.pathname === window.location.pathname;
      link.classList.toggle('active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    setCollapsed(isUnitsPage ? defaultCollapsed : !shouldExpandOnTrash);
    const unitsLink = menu.querySelector('.nav-group-header > .nav-item');
    if (unitsLink) {
      unitsLink.addEventListener('click', () => {
        setCollapsed(false);
        localStorage.setItem('unitflowUnitsMenuCollapsed', 'false');
      });
    }
    submenu.querySelectorAll('a[href]').forEach((link) => {
      const linkUrl = new URL(link.href, window.location.href);
      if (!linkUrl.pathname.endsWith('/trash.html')) return;
      link.addEventListener('click', () => {
        if (!menu.classList.contains('is-collapsed')) {
          sessionStorage.setItem(trashExpansionKey, 'true');
        }
      });
    });
    toggle.addEventListener('click', () => {
      const collapsed = !menu.classList.contains('is-collapsed');
      setCollapsed(collapsed);
      localStorage.setItem('unitflowUnitsMenuCollapsed', String(collapsed));
    });
  });
}

function preventCurrentPageReload() {
  const currentUrl = new URL(window.location.href);
  document.querySelectorAll('.nav a.nav-item[href]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const linkUrl = new URL(link.href, currentUrl);
      if (linkUrl.pathname === currentUrl.pathname && linkUrl.search === currentUrl.search && linkUrl.hash === currentUrl.hash) {
        event.preventDefault();
      }
    });
  });
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

function getLoggedInUserInitials() {
  const words = getLoggedInUserName().trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] || '?').slice(0, 2)).toUpperCase();
}

function logoutUser() {
  localStorage.removeItem('unitflowRole');
  localStorage.removeItem('unitflowUser');
  localStorage.removeItem('unitflowFullName');
  localStorage.removeItem('unitflowBranch');
  window.location.href = resolveRoutePath('pages/login.html');
}

function getDarkModeStorageKey(username = localStorage.getItem('unitflowUser')) {
  return `unitflowDarkMode:${String(username || '').trim().toLowerCase()}`;
}

function applyDarkMode(enabled, saveToServer = true) {
  const isEnabled = Boolean(enabled);
  document.documentElement.dataset.theme = isEnabled ? 'dark' : 'light';
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) toggle.checked = isEnabled;
  localStorage.setItem('unitflowDarkMode', String(isEnabled));
  const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
  if (username) localStorage.setItem(getDarkModeStorageKey(username), String(isEnabled));
  if (saveToServer && username) saveDarkModePreference(username, isEnabled);
}

function requestDarkModePreference(username) {
  const config = window.GS_CONFIG || {};
  if (!config.appScriptUrl) return Promise.reject(new Error('Apps Script URL is not configured'));

  return new Promise((resolve, reject) => {
    const callbackName = `unitflowDarkModeCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      delete window[callbackName];
      script.remove();
      reject(new Error('Dark mode preference request timed out'));
    }, 10000);

    window[callbackName] = (result) => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      if (!result || result.ok === false) {
        reject(new Error((result && result.error) || 'Dark mode preference request failed'));
        return;
      }
      resolve(Boolean(result.darkMode));
    };

    script.onerror = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
      reject(new Error('Dark mode preference request failed'));
    };
    script.src = `${config.appScriptUrl}?action=userpreferences&username=${encodeURIComponent(username)}&callback=${encodeURIComponent(callbackName)}`;
    document.head.appendChild(script);
  });
}

async function loadDarkModePreference(username) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  if (!normalizedUsername) return;
  try {
    const isDark = await requestDarkModePreference(normalizedUsername);
    applyDarkMode(isDark, false);
  } catch (error) {
    const cached = localStorage.getItem(getDarkModeStorageKey(normalizedUsername));
    if (cached !== null) applyDarkMode(cached === 'true', false);
    console.warn('Unable to load the saved dark mode preference:', error);
  }
}

function saveDarkModePreference(username, isDark) {
  const config = window.GS_CONFIG || {};
  if (!config.appScriptUrl) return;
  const body = new URLSearchParams({
    action: 'saveuserpreferences',
    username,
    darkMode: String(Boolean(isDark))
  });
  fetch(config.appScriptUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: body.toString()
  }).catch((error) => console.warn('Unable to save the dark mode preference:', error));
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
  const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
  const cachedDarkMode = username ? localStorage.getItem(getDarkModeStorageKey(username)) : null;
  applyDarkMode(cachedDarkMode === null
    ? (!username && localStorage.getItem('unitflowDarkMode') === 'true')
    : cachedDarkMode === 'true', false);
  if (username) loadDarkModePreference(username);
  if (!localStorage.getItem('unitflowRole')) {
    window.location.href = resolveRoutePath('pages/login.html');
    return;
  }

  const userNameElement = document.getElementById('topbarUserName');
  const userMenuButton = document.getElementById('userMenuButton');
  const userAvatarElement = userMenuButton && userMenuButton.querySelector('.user-avatar');
  const userDropdown = document.getElementById('userDropdown');
  const logoutButton = document.getElementById('logoutButton');
  let changePasswordButton = document.getElementById('changePasswordButton');
  let darkModeToggle = document.getElementById('darkModeToggle');

  if (userDropdown && !changePasswordButton) {
    changePasswordButton = document.createElement('button');
    changePasswordButton.type = 'button';
    changePasswordButton.id = 'changePasswordButton';
    changePasswordButton.textContent = 'Change Password';
    userDropdown.insertBefore(changePasswordButton, logoutButton || null);
  }

  if (userDropdown && !darkModeToggle) {
    const themeRow = document.createElement('div');
    themeRow.className = 'user-theme-row';
    themeRow.innerHTML = '<span id="darkModeLabel">Dark mode</span><label class="user-theme-switch"><input id="darkModeToggle" type="checkbox" role="switch" aria-labelledby="darkModeLabel"><span aria-hidden="true"></span></label>';
    userDropdown.insertBefore(themeRow, logoutButton || null);
    darkModeToggle = themeRow.querySelector('#darkModeToggle');
  }

  if (darkModeToggle) {
    darkModeToggle.checked = localStorage.getItem('unitflowDarkMode') === 'true';
    darkModeToggle.addEventListener('change', () => applyDarkMode(darkModeToggle.checked));
  }

  initNavToggle();
  applyRoleRestrictions();
  updateMessageNavCount();
  const refreshMs = Number((window.GS_CONFIG && window.GS_CONFIG.refreshMs) || 15000);
  window.setInterval(updateMessageNavCount, Math.max(5000, refreshMs));

  if (userNameElement) {
    userNameElement.textContent = getLoggedInUserName();
  }
  if (userAvatarElement) {
    userAvatarElement.textContent = getLoggedInUserInitials();
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

function bootUserMenu() {
  initUserMenu();
  preventCurrentPageReload();
  initUnitsMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootUserMenu);
} else {
  bootUserMenu();
}
