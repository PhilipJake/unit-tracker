const roleHierarchy = ['Super Admin', 'Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
const permissionRoles = [...roleHierarchy];
const pageAccessRoles = [...roleHierarchy];
const permissionActions = ['view', 'create', 'edit', 'delete', 'export', 'release', 'warehouse', 'pullOut', 'forReplacement'];
const permissionActionLabels = { release: 'Released', pullOut: 'Pullout', forReplacement: 'For Replacement' };
const permissionsTableBody = document.getElementById('permissionsTableBody');
const pageAccessGrid = document.getElementById('pageAccessGrid');
const memberAccountSelect = document.getElementById('memberAccountSelect');
const memberOverrideEnabled = document.getElementById('memberOverrideEnabled');
const memberPermissionEditor = document.getElementById('memberPermissionEditor');
const memberPageAccessGrid = document.getElementById('memberPageAccessGrid');
const memberActionPermissions = document.getElementById('memberActionPermissions');
const settingsStatus = document.getElementById('settingsStatus');
const savePermissionsBtn = document.getElementById('savePermissionsBtn');
const resetPermissionsBtn = document.getElementById('resetPermissionsBtn');
const settingsMessageModalBackdrop = document.getElementById('settingsMessageModalBackdrop');
const settingsMessageModalBody = document.getElementById('settingsMessageModalBody');
const closeSettingsMessageModalBtn = document.getElementById('closeSettingsMessageModalBtn');
const okSettingsMessageModalBtn = document.getElementById('okSettingsMessageModalBtn');
let managedAccounts = [];
let userPermissionOverrides = {};

function cloneDefaultPermissions() {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
}

function renderActionToggles(permissions, attributes, role = '') {
  return permissionActions.map((action) => {
    const allowed = action === 'view' || Boolean(permissions[action]);
    const locked = action === 'view' || role === 'Super Admin';
    const label = permissionActionLabels[action] || action[0].toUpperCase() + action.slice(1);
    const dataAttribute = Object.entries(attributes).map(([key, value]) => `data-${key}="${value === true ? action : value}"`).join(' ');
    return `<label class="permission-toggle"><span class="permission-action-name">${label}</span><input type="checkbox" ${dataAttribute} ${allowed ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${allowed ? 'Allowed' : 'Off'}</span></label>`;
  }).join('');
}

function renderPermissions(permissions = getRolePermissions()) {
  permissionsTableBody.innerHTML = permissionRoles.map((role) => `
    <article class="permissions-role-card">
      <div class="permissions-role-heading"><strong>${role}</strong><span>${role === 'Super Admin' ? 'Locked' : role === 'Administrator' ? 'Can manage access' : 'Workspace role'}</span></div>
      <div class="permissions-action-grid">
        ${renderActionToggles(permissions[role], { role, action: true }, role)}
      </div>
    </article>
  `).join('');
}

function renderPageAccess(access = getPageAccess()) {
  pageAccessGrid.innerHTML = pageAccessRoles.map((role) => `
    <article class="page-access-card">
      <div><strong>${role}</strong><span>${role === 'Super Admin' ? 'Locked' : ['Administrator'].includes(role) ? 'Can manage access' : 'Workspace role'}</span></div>
      <div class="page-access-options">
        ${Object.keys(PAGE_ACCESS_OPTIONS).map((page) => `<label class="permission-toggle"><input type="checkbox" data-page-role="${role}" data-page="${page}" ${access[role][page] ? 'checked' : ''} ${role === 'Super Admin' ? 'disabled' : ''}><span>${page}</span></label>`).join('')}
      </div>
    </article>
  `).join('');
}

function getSelectedMember() {
  return managedAccounts.find((account) => account.username.toLowerCase() === memberAccountSelect.value) || null;
}

function renderMemberPermissions() {
  if (!memberAccountSelect || !memberOverrideEnabled || !memberPermissionEditor) return;
  const member = getSelectedMember();
  if (!member) {
    memberOverrideEnabled.checked = false;
    memberOverrideEnabled.disabled = true;
    memberPermissionEditor.hidden = true;
    return;
  }

  const locked = member.role === 'Super Admin';
  const override = userPermissionOverrides[member.username.toLowerCase()];
  memberOverrideEnabled.disabled = locked;
  memberOverrideEnabled.checked = Boolean(!locked && override && override.enabled);
  memberPermissionEditor.hidden = locked || !memberOverrideEnabled.checked;

  if (memberPermissionEditor.hidden) return;
  const rolePermissions = getRolePermissions()[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician;
  const rolePageAccess = getPageAccess()[member.role] || DEFAULT_PAGE_ACCESS.Technician;
  const permissions = { ...rolePermissions, ...(override && override.permissions) };
  const pageAccess = { ...rolePageAccess, ...(override && override.pageAccess) };
  memberPageAccessGrid.innerHTML = Object.keys(PAGE_ACCESS_OPTIONS).map((page) => `
    <label class="permission-toggle"><input type="checkbox" data-member-page="${page}" ${pageAccess[page] ? 'checked' : ''}><span>${page}</span></label>
  `).join('');
  memberActionPermissions.innerHTML = `
    <article class="permissions-role-card">
      <div class="permissions-role-heading"><strong>${member.fullName}</strong><span>Overrides ${member.role}</span></div>
      <div class="permissions-action-grid">
        ${renderActionToggles(permissions, { 'member-action': true })}
      </div>
    </article>
  `;
}

async function loadManagedAccounts() {
  try {
    const rows = await DATA.fetchAccounts();
    const uniqueAccounts = new Map();
    rows.forEach((row) => {
      const username = String(row.username || row.userName || row.accountUsername || '').trim();
      const role = String(row.accountType || row.role || row.userType || '').trim();
      const status = String(row.status || 'Active').trim().toLowerCase();
      if (!username || !role || ['inactive', 'disabled', 'deactivated'].includes(status)) return;
      uniqueAccounts.set(username.toLowerCase(), {
        username,
        role,
        fullName: String(row.fullName || row.name || username).trim()
      });
    });
    managedAccounts = [...uniqueAccounts.values()].sort((first, second) => {
      const firstRoleOrder = roleHierarchy.indexOf(first.role);
      const secondRoleOrder = roleHierarchy.indexOf(second.role);
      const firstOrder = firstRoleOrder === -1 ? roleHierarchy.length : firstRoleOrder;
      const secondOrder = secondRoleOrder === -1 ? roleHierarchy.length : secondRoleOrder;
      return firstOrder - secondOrder || first.fullName.localeCompare(second.fullName);
    });
    memberAccountSelect.replaceChildren(new Option('Select an account', ''));
    const accountRoles = [...new Set([
      ...roleHierarchy,
      ...managedAccounts.map((account) => account.role).filter((role) => !roleHierarchy.includes(role)).sort()
    ])];
    accountRoles.forEach((role) => {
      const roleAccounts = managedAccounts.filter((account) => account.role === role);
      if (!roleAccounts.length) return;
      const group = document.createElement('optgroup');
      group.label = role;
      roleAccounts.forEach((account) => {
        group.appendChild(new Option(account.fullName, account.username.toLowerCase()));
      });
      memberAccountSelect.appendChild(group);
    });
    const currentUsername = String(localStorage.getItem('unitflowUser') || '').toLowerCase();
    memberAccountSelect.value = managedAccounts.some((account) => account.username.toLowerCase() === currentUsername)
      ? currentUsername
      : '';
    if (!managedAccounts.length) memberAccountSelect.replaceChildren(new Option('No active accounts found', ''));
  } catch (error) {
    memberAccountSelect.replaceChildren(new Option('Unable to load accounts', ''));
    console.error('Unable to load accounts for member permissions:', error);
  }
  renderMemberPermissions();
}

function captureMemberOverrides() {
  const member = getSelectedMember();
  if (!member || member.role === 'Super Admin' || !memberOverrideEnabled.checked) return;
  const username = member.username.toLowerCase();
  const existing = userPermissionOverrides[username] || {};
  const permissions = { ...(getRolePermissions()[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician), ...(existing.permissions || {}) };
  const pageAccess = { ...(existing.pageAccess || getPageAccess()[member.role]) };
  memberPermissionEditor.querySelectorAll('[data-member-action]').forEach((input) => {
    permissions[input.dataset.memberAction] = input.checked;
  });
  memberPermissionEditor.querySelectorAll('[data-member-page]').forEach((input) => {
    pageAccess[input.dataset.memberPage] = input.checked;
  });
  permissions.view = true;
  userPermissionOverrides[username] = { enabled: true, role: member.role, permissions, pageAccess };
}

function showSettingsStatus(message, state = 'success') {
  settingsStatus.textContent = message;
  settingsStatus.dataset.state = state;
  window.setTimeout(() => {
    if (settingsStatus.textContent === message) settingsStatus.textContent = '';
  }, 2600);
}

function showSettingsMessage(message, title = 'Notice') {
  const titleElement = document.getElementById('settingsMessageModalTitle');
  if (!settingsMessageModalBackdrop || !settingsMessageModalBody) return;
  if (titleElement) titleElement.textContent = title;
  settingsMessageModalBody.textContent = message;
  settingsMessageModalBackdrop.classList.add('visible');
  settingsMessageModalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeSettingsMessage() {
  if (!settingsMessageModalBackdrop) return;
  settingsMessageModalBackdrop.classList.remove('visible');
  settingsMessageModalBackdrop.setAttribute('aria-hidden', 'true');
}

function getFormPermissions() {
  const permissions = cloneDefaultPermissions();
  document.querySelectorAll('[data-role][data-action]').forEach((input) => {
    permissions[input.dataset.role][input.dataset.action] = input.checked;
  });
  permissionRoles.forEach((role) => { permissions[role].view = true; });
  return permissions;
}

function getFormPageAccess() {
  const access = JSON.parse(JSON.stringify(DEFAULT_PAGE_ACCESS));
  document.querySelectorAll('[data-page-role][data-page]').forEach((input) => {
    access[input.dataset.pageRole][input.dataset.page] = input.checked;
  });
  access['Super Admin'] = { ...DEFAULT_PAGE_ACCESS['Super Admin'] };
  return access;
}

async function savePermissions() {
  captureMemberOverrides();
  const permissions = getFormPermissions();
  const pageAccess = getFormPageAccess();
  const config = window.GS_CONFIG || {};

  try {
    const response = await fetch(config.appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({
        action: 'savepermissions',
        actorRole: getCurrentRole(),
        permissions: JSON.stringify(permissions),
        pageAccess: JSON.stringify(pageAccess),
        userPermissions: JSON.stringify(userPermissionOverrides)
      }).toString()
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error || 'Permission save failed');

    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    showSettingsStatus('Permissions saved');
    showSettingsMessage('Permissions saved', 'Permissions saved');
  } catch (error) {
    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    showSettingsStatus('The database was unavailable', 'notice');
    showSettingsMessage('The database was unavailable', 'Save warning');
    console.error('Unable to save permissions to Google Sheets:', error);
  }
}

function resetPermissions() {
  renderPermissions(cloneDefaultPermissions());
  renderPageAccess(JSON.parse(JSON.stringify(DEFAULT_PAGE_ACCESS)));
  showSettingsStatus('Defaults restored. Save to apply.', 'notice');
}

async function loadPermissionsFromServer() {
  const config = window.GS_CONFIG || {};
  if (!config.appScriptUrl) return;

  try {
    const response = await fetch(`${config.appScriptUrl}?action=permissions`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || result.ok === false || !result.permissions || !result.pageAccess) throw new Error(result.error || 'Permission load failed');

    localStorage.setItem('unitflowRolePermissions', JSON.stringify(result.permissions));
    const pageAccess = { ...result.pageAccess, 'Super Admin': { ...DEFAULT_PAGE_ACCESS['Super Admin'] } };
    userPermissionOverrides = result.userPermissions || {};
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    renderPermissions(result.permissions);
    renderPageAccess(pageAccess);
  } catch (error) {
    showSettingsStatus('The database was unavailable', 'notice');
    console.error('Unable to load permissions from Google Sheets:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!isPermissionManager()) return;
  renderPermissions();
  renderPageAccess();
  await loadPermissionsFromServer();
  savePermissionsBtn.addEventListener('click', savePermissions);
  resetPermissionsBtn.addEventListener('click', resetPermissions);
  closeSettingsMessageModalBtn.addEventListener('click', closeSettingsMessage);
  okSettingsMessageModalBtn.addEventListener('click', closeSettingsMessage);
  settingsMessageModalBackdrop.addEventListener('click', (event) => {
    if (event.target === settingsMessageModalBackdrop) closeSettingsMessage();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettingsMessage();
  });
  memberAccountSelect.addEventListener('change', renderMemberPermissions);
  memberOverrideEnabled.addEventListener('change', () => {
    const member = getSelectedMember();
    if (!member) return;
    const username = member.username.toLowerCase();
    if (!memberOverrideEnabled.checked) {
      delete userPermissionOverrides[username];
    } else if (!userPermissionOverrides[username]) {
      userPermissionOverrides[username] = {
        enabled: true,
        role: member.role,
        permissions: { ...(getRolePermissions()[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician) },
        pageAccess: { ...(getPageAccess()[member.role] || DEFAULT_PAGE_ACCESS.Technician) }
      };
    }
    renderMemberPermissions();
  });
  memberPermissionEditor.addEventListener('change', (event) => {
    if (event.target.matches('[data-member-action], [data-member-page]')) captureMemberOverrides();
  });
  await loadManagedAccounts();
});