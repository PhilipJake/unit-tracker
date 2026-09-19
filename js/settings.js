const permissionRoles = ['Super Admin', 'Administrator', 'Office', 'Main Head Admin', 'Branch Head Admin', 'Technician'];
const pageAccessRoles = ['Super Admin', 'Administrator', 'Office', 'Main Head Admin', 'Branch Head Admin', 'Technician'];
const permissionsTableBody = document.getElementById('permissionsTableBody');
const pageAccessGrid = document.getElementById('pageAccessGrid');
const settingsStatus = document.getElementById('settingsStatus');
const savePermissionsBtn = document.getElementById('savePermissionsBtn');
const resetPermissionsBtn = document.getElementById('resetPermissionsBtn');
const settingsMessageModalBackdrop = document.getElementById('settingsMessageModalBackdrop');
const settingsMessageModalBody = document.getElementById('settingsMessageModalBody');
const closeSettingsMessageModalBtn = document.getElementById('closeSettingsMessageModalBtn');
const okSettingsMessageModalBtn = document.getElementById('okSettingsMessageModalBtn');

function cloneDefaultPermissions() {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
}

function renderPermissions(permissions = getRolePermissions()) {
  permissionsTableBody.innerHTML = permissionRoles.map((role) => `
    <article class="permissions-role-card">
      <div class="permissions-role-heading"><strong>${role}</strong><span>${role === 'Super Admin' ? 'Locked' : role === 'Administrator' ? 'Can manage access' : 'Workspace role'}</span></div>
      <div class="permissions-action-grid">
        ${['view', 'create', 'edit', 'delete', 'export'].map((action) => `<label class="permission-toggle"><span class="permission-action-name">${action}</span><input type="checkbox" data-role="${role}" data-action="${action}" ${permissions[role][action] ? 'checked' : ''} ${role === 'Super Admin' ? 'disabled' : ''}><span>${permissions[role][action] ? 'Allowed' : 'Off'}</span></label>`).join('')}
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
  permissions['Super Admin'].view = true;
  return permissions;
}

function getFormPageAccess() {
  const access = JSON.parse(JSON.stringify(DEFAULT_PAGE_ACCESS));
  document.querySelectorAll('[data-page-role][data-page]').forEach((input) => {
    access[input.dataset.pageRole][input.dataset.page] = input.checked;
  });
  return access;
}

async function savePermissions() {
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
        pageAccess: JSON.stringify(pageAccess)
      }).toString()
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error || 'Permission save failed');

    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    showSettingsStatus('Permissions saved to Google Sheets');
    showSettingsMessage('Permissions saved successfully.', 'Permissions saved');
  } catch (error) {
    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    showSettingsStatus('Saved locally; Google Sheets was unavailable.', 'notice');
    showSettingsMessage('Permissions were saved locally, but could not be saved to Google Sheets.', 'Save warning');
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
    localStorage.setItem('unitflowPageAccess', JSON.stringify(result.pageAccess));
    renderPermissions(result.permissions);
    renderPageAccess(result.pageAccess);
  } catch (error) {
    showSettingsStatus('Using local permissions; Google Sheets was unavailable.', 'notice');
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
});