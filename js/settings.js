const builtInRoleHierarchy = ['Super Admin', 'Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
let roleHierarchy = [...builtInRoleHierarchy];
const permissionActions = ['view', 'create', 'edit', 'delete', 'export', 'release', 'warehouse', 'pullOut', 'forReplacement', 'repair'];
const permissionActionLabels = { release: 'Released', pullOut: 'Pullout', forReplacement: 'For Replacement', repair: 'Repair' };
const permissionActionDescriptions = {
  view: 'View unit information across this workspace.',
  create: 'Add new units, branches, or accounts.',
  edit: 'Change unit, branch, or account details.',
  delete: 'Move units, branches, or accounts to trash.',
  export: 'Download unit registry data.',
  release: 'Move units through For Release and Released.',
  warehouse: 'Open Warehouse and move units in or out.',
  pullOut: 'Open Pullout and move units to Pull Out.',
  forReplacement: 'Open For Replacement and mark replacements.',
  repair: 'Open For Repair and mark units repaired.'
};
const roleSelector = document.getElementById('roleSelector');
const roleCount = document.getElementById('roleCount');
const selectedRoleTitle = document.getElementById('selectedRoleTitle');
const selectedRoleDescription = document.getElementById('selectedRoleDescription');
const selectedRoleLock = document.getElementById('selectedRoleLock');
const deleteRoleButton = document.getElementById('deleteRoleButton');
const roleColorPicker = document.getElementById('roleColorPicker');
const roleColorCurrent = document.getElementById('roleColorCurrent');
const roleColorPalette = document.getElementById('roleColorPalette');
const memberCount = document.getElementById('memberCount');
const permissionsTabButton = document.getElementById('permissionsTabButton');
const membersTabButton = document.getElementById('membersTabButton');
const rolePermissionsTab = document.getElementById('rolePermissionsTab');
const memberManagementTab = document.getElementById('memberManagementTab');
const memberEmptyState = document.getElementById('memberEmptyState');
const addRoleButton = document.getElementById('addRoleButton');
const roleCreateForm = document.getElementById('roleCreateForm');
const newRoleName = document.getElementById('newRoleName');
const roleCreateError = document.getElementById('roleCreateError');
const cancelCreateRoleButton = document.getElementById('cancelCreateRoleButton');
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
const settingsToast = document.getElementById('settingsToast');
const closeSettingsMessageModalBtn = document.getElementById('closeSettingsMessageModalBtn');
const okSettingsMessageModalBtn = document.getElementById('okSettingsMessageModalBtn');
const cancelSettingsMessageModalBtn = document.getElementById('cancelSettingsMessageModalBtn');
const settingsViewTitle = document.getElementById('settingsViewTitle');
const settingsViewDescription = document.getElementById('settingsViewDescription');
const rolesManagerPanel = document.getElementById('rolesManagerPanel');
const branchTypesManagerPanel = document.getElementById('branchTypesManagerPanel');
const rolesSettingsTab = document.getElementById('rolesSettingsTab');
const branchTypesSettingsTab = document.getElementById('branchTypesSettingsTab');
const branchTypeSelector = document.getElementById('branchTypeSelector');
const branchTypeCount = document.getElementById('branchTypeCount');
const selectedBranchTypeTitle = document.getElementById('selectedBranchTypeTitle');
const selectedBranchTypeDescription = document.getElementById('selectedBranchTypeDescription');
const branchTypeShortcut = document.getElementById('branchTypeShortcut');
const branchTypeFullName = document.getElementById('branchTypeFullName');
const branchTypeColor = document.getElementById('branchTypeColor');
const branchTypeColorCurrent = document.getElementById('branchTypeColorCurrent');
const branchTypeColorPalette = document.getElementById('branchTypeColorPalette');
const branchTypePreview = document.getElementById('branchTypePreview');
const addBranchTypeButton = document.getElementById('addBranchTypeButton');
const branchTypeCreateForm = document.getElementById('branchTypeCreateForm');
const newBranchTypeCode = document.getElementById('newBranchTypeCode');
const branchTypeCreateError = document.getElementById('branchTypeCreateError');
const cancelCreateBranchTypeButton = document.getElementById('cancelCreateBranchTypeButton');
const deleteBranchTypeButton = document.getElementById('deleteBranchTypeButton');
const saveBranchTypeButton = document.getElementById('saveBranchTypeButton');
const branchTypeSaveStatus = document.getElementById('branchTypeSaveStatus');
let managedAccounts = [];
let roleAssignments = [];
let userPermissionOverrides = {};
let rolePermissionsState = getRolePermissions();
let roleColorsState = getRoleColors();
let pageAccessState = getPageAccess();
let selectedRole = getCurrentRole();
let selectedSettingsTab = 'permissions';
let branchTypeDefinitions = getBranchTypeDefinitions();
let selectedBranchType = branchTypeDefinitions[0]?.code || '';
let branchTypeDefinitionsChanged = false;
let pendingSettingsConfirmation = null;
let settingsToastTimer = null;

function setSettingsView(view) {
  const showBranchTypes = view === 'branchTypes';
  rolesManagerPanel.hidden = showBranchTypes;
  branchTypesManagerPanel.hidden = !showBranchTypes;
  rolesSettingsTab.classList.toggle('active', !showBranchTypes);
  branchTypesSettingsTab.classList.toggle('active', showBranchTypes);
  rolesSettingsTab.setAttribute('aria-selected', String(!showBranchTypes));
  branchTypesSettingsTab.setAttribute('aria-selected', String(showBranchTypes));
  settingsViewTitle.textContent = showBranchTypes ? 'Branch Types' : 'Roles';
  settingsViewDescription.textContent = showBranchTypes
    ? 'Manage the shortcuts and full names used by branches.'
    : 'Manage workspace permissions by role or member.';
}

function renderColorSwatches(palette, selectedColor) {
  palette.innerHTML = ROLE_COLOR_SWATCHES.map((color) => `
    <button class="color-palette-swatch" type="button" data-color="${color}" aria-label="${color}" aria-pressed="${color === selectedColor}" style="--swatch-color: ${color}"></button>
  `).join('');
}

function renderRoleColorControl() {
  const color = normalizeHexColor(roleColorsState[selectedRole]);
  roleColorPicker.value = color;
  roleColorCurrent.style.backgroundColor = color;
  roleColorCurrent.setAttribute('aria-label', `Current role color ${color}`);
  renderColorSwatches(roleColorPalette, color);
}

function selectRoleColor(color) {
  roleColorsState[selectedRole] = normalizeHexColor(color);
  renderRoleColorControl();
  renderRoleSelector();
}

function renderBranchTypeColorControl(definition) {
  const color = normalizeHexColor(definition && definition.color);
  branchTypeColor.value = color;
  branchTypeColor.disabled = !definition;
  branchTypeColorCurrent.style.backgroundColor = color;
  branchTypeColorCurrent.setAttribute('aria-label', `Current branch type color ${color}`);
  renderColorSwatches(branchTypeColorPalette, color);
}

function selectBranchTypeColor(color) {
  const definition = branchTypeDefinitions.find((type) => type.code === selectedBranchType);
  if (!definition) return;
  definition.color = normalizeHexColor(color);
  branchTypeDefinitionsChanged = true;
  renderBranchTypeColorControl(definition);
  branchTypeSelector.querySelectorAll('[data-branch-type-select]').forEach((button) => {
    if (button.dataset.branchTypeSelect === selectedBranchType) {
      button.querySelector('.role-selector-dot').style.backgroundColor = definition.color;
    }
  });
}

function renderBranchTypeSelector() {
  branchTypeCount.textContent = String(branchTypeDefinitions.length);
  branchTypeSelector.innerHTML = branchTypeDefinitions.map((type) => `
    <button class="role-selector-item ${type.code === selectedBranchType ? 'active' : ''}" type="button" data-branch-type-select="${type.code}" aria-pressed="${type.code === selectedBranchType}">
      <span class="role-selector-dot" aria-hidden="true" style="background-color: ${normalizeHexColor(type.color)}"></span><span>${type.code}</span>
    </button>
  `).join('');
  renderSelectedBranchType();
}

function renderSelectedBranchType() {
  const definition = branchTypeDefinitions.find((type) => type.code === selectedBranchType);
  const hasSelection = Boolean(definition);
  selectedBranchTypeTitle.textContent = hasSelection ? definition.code : 'No branch types';
  selectedBranchTypeDescription.textContent = hasSelection
    ? (definition.fullName || 'Add a full name to show what this shortcut stands for.')
    : 'Create a shortcut to start a branch type.';
  branchTypeShortcut.value = definition ? definition.code : '';
  branchTypeShortcut.disabled = !definition;
  branchTypeFullName.value = definition ? definition.fullName : '';
  branchTypeFullName.disabled = !definition;
  renderBranchTypeColorControl(definition);
  deleteBranchTypeButton.hidden = !definition;
  saveBranchTypeButton.disabled = !definition;
  branchTypePreview.textContent = definition
    ? `${definition.code}${definition.fullName ? ` — ${definition.fullName}` : ''}`
    : '';
  branchTypeSelector.querySelectorAll('[data-branch-type-select]').forEach((button) => {
    const isSelected = button.dataset.branchTypeSelect === selectedBranchType;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

function openBranchTypeCreateForm() {
  branchTypeCreateError.textContent = '';
  branchTypeCreateForm.hidden = false;
  addBranchTypeButton.hidden = true;
  newBranchTypeCode.value = '';
  newBranchTypeCode.focus();
}

function closeBranchTypeCreateForm() {
  branchTypeCreateForm.hidden = true;
  addBranchTypeButton.hidden = false;
  branchTypeCreateError.textContent = '';
}

function createBranchType(code) {
  if (selectedBranchType && !captureSelectedBranchType()) return;
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(normalizedCode)) {
    branchTypeCreateError.textContent = 'Use 1–12 letters or numbers for the shortcut.';
    return;
  }
  if (branchTypeDefinitions.some((type) => type.code.toLowerCase() === normalizedCode.toLowerCase())) {
    branchTypeCreateError.textContent = 'A branch type with that shortcut already exists.';
    return;
  }
  branchTypeDefinitions.push({ code: normalizedCode, fullName: '', color: DEFAULT_CUSTOM_ROLE_COLOR });
  branchTypeDefinitionsChanged = true;
  selectedBranchType = normalizedCode;
  closeBranchTypeCreateForm();
  renderBranchTypeSelector();
  branchTypeFullName.focus();
  branchTypeSaveStatus.textContent = 'Type created. Save changes to apply.';
}

function captureSelectedBranchType() {
  const definition = branchTypeDefinitions.find((type) => type.code === selectedBranchType);
  if (!definition) return true;
  const code = String(branchTypeShortcut.value || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{1,12}$/.test(code)) {
    branchTypeSaveStatus.textContent = 'Use 1–12 letters or numbers for the shortcut.';
    branchTypeSaveStatus.dataset.state = 'notice';
    return false;
  }
  if (branchTypeDefinitions.some((type) => type !== definition && type.code.toLowerCase() === code.toLowerCase())) {
    branchTypeSaveStatus.textContent = 'That shortcut is already in use.';
    branchTypeSaveStatus.dataset.state = 'notice';
    return false;
  }
  if (code !== definition.code && !managedBranchesLoaded) {
    branchTypeSaveStatus.textContent = 'Branch usage is unavailable; reload before changing this shortcut.';
    branchTypeSaveStatus.dataset.state = 'notice';
    return false;
  }
  if (code !== definition.code && managedBranches.some((branch) => getBranchRecordType(branch).toUpperCase() === definition.code)) {
    branchTypeSaveStatus.textContent = 'Reassign branches using this shortcut before changing it.';
    branchTypeSaveStatus.dataset.state = 'notice';
    return false;
  }
  const fullName = String(branchTypeFullName.value || '').trim();
  const color = normalizeHexColor(branchTypeColor.value);
  if (definition.code !== code || definition.fullName !== fullName || definition.color !== color) branchTypeDefinitionsChanged = true;
  definition.code = code;
  definition.fullName = fullName;
  definition.color = color;
  selectedBranchType = code;
  return true;
}

async function saveSelectedBranchType() {
  if (!captureSelectedBranchType()) return;
  try {
    const synced = await saveBranchTypeDefinitions(branchTypeDefinitions);
    branchTypeSaveStatus.textContent = synced ? 'Branch type saved.' : 'Saved in this browser. Configure Apps Script to share it.';
    branchTypeSaveStatus.dataset.state = synced ? 'success' : 'notice';
    showSettingsToast(synced ? 'Changes Saved Successfully' : 'Changes saved in this browser only');
    renderBranchTypeSelector();
  } catch (error) {
    branchTypeSaveStatus.textContent = 'Saved in this browser; Google Sheets could not be updated.';
    branchTypeSaveStatus.dataset.state = 'notice';
    showSettingsToast('Changes saved locally; database unavailable');
    renderBranchTypeSelector();
    console.error('Unable to save branch types to Google Sheets:', error);
  }
}

function deleteSelectedBranchType() {
  if (branchTypeDefinitions.length < 2) {
    showSettingsMessage('Keep at least one branch type so new branches can be assigned a type.', 'Cannot delete the last type');
    return;
  }
  if (!managedBranchesLoaded) {
    branchTypeSaveStatus.textContent = 'Branch usage is unavailable; reload before deleting a type.';
    branchTypeSaveStatus.dataset.state = 'notice';
    return;
  }
  const inUse = managedBranches.some((branch) => getBranchRecordType(branch).toUpperCase() === selectedBranchType);
  if (inUse) {
    showSettingsMessage(`${selectedBranchType} is assigned to one or more branches. Reassign those branches before deleting this type.`, 'Branch type is in use');
    return;
  }
  showSettingsConfirmation(
    `Delete the ${selectedBranchType} branch type?`,
    'Delete branch type',
    async () => {
      branchTypeDefinitions = branchTypeDefinitions.filter((type) => type.code !== selectedBranchType);
      branchTypeDefinitionsChanged = true;
      selectedBranchType = branchTypeDefinitions[0]?.code || '';
      renderBranchTypeSelector();
      await saveSelectedBranchType();
    }
  );
}

let managedBranches = [];
let managedBranchesLoaded = false;

function getBranchRecordType(branch) {
  const name = String(branch.branchName || branch.branchname || branch.name || '').trim();
  return String(branch.branchCode || branch.branchcode || branch.branchType || branch.branchtype || branch.type || name.split(/\s+/)[0] || '').trim();
}

function syncRoleHierarchy() {
  const customRoles = [...new Set([...Object.keys(rolePermissionsState), ...Object.keys(pageAccessState)])]
    .filter((role) => !builtInRoleHierarchy.includes(role))
    .sort((first, second) => first.localeCompare(second));
  roleHierarchy = [...builtInRoleHierarchy, ...customRoles];
  if (!roleHierarchy.includes(selectedRole)) selectedRole = 'Administrator';
}

function createCustomRolePermissions() {
  return { view: true, create: false, edit: false, delete: false, export: false, release: false, warehouse: false, pullOut: false, forReplacement: false, repair: false };
}

function createCustomRolePageAccess() {
  return { Overview: true, Messages: true, 'Unit registry': true, Trash: false, Branches: false, Accounts: false };
}

function cloneDefaultPermissions() {
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
}

function renderActionToggles(permissions, role, member = false) {
  return permissionActions.map((action) => {
    const allowed = action === 'view' || Boolean(permissions[action]);
    const locked = action === 'view' || role === 'Super Admin';
    const label = permissionActionLabels[action] || action[0].toUpperCase() + action.slice(1);
    const dataAttributes = member
      ? `data-member-action="${action}"`
      : `data-role="${role}" data-action="${action}"`;
    return `<label class="role-permission-row"><span class="role-permission-copy"><strong>${label}</strong><small>${permissionActionDescriptions[action]}</small></span><span class="role-permission-control"><span>${allowed ? 'Allowed' : 'Off'}</span><input type="checkbox" ${dataAttributes} ${allowed ? 'checked' : ''} ${locked ? 'disabled' : ''}></span></label>`;
  }).join('');
}

function renderRoleSelector() {
  roleCount.textContent = String(roleHierarchy.length);
  roleSelector.innerHTML = roleHierarchy.map((role) => `
    <button class="role-selector-item ${role === selectedRole ? 'active' : ''}" type="button" data-role-select="${role}" aria-pressed="${role === selectedRole}">
      <span class="role-selector-dot" aria-hidden="true" style="background-color: ${normalizeHexColor(roleColorsState[role])}"></span><span>${role}</span>
      ${role === 'Super Admin' ? '<span class="role-selector-lock" aria-label="Protected role">Locked</span>' : ''}
    </button>
  `).join('');
}

function openRoleCreateForm() {
  roleCreateError.textContent = '';
  roleCreateForm.hidden = false;
  addRoleButton.hidden = true;
  newRoleName.value = '';
  newRoleName.focus();
}

function closeRoleCreateForm() {
  roleCreateForm.hidden = true;
  addRoleButton.hidden = false;
  roleCreateError.textContent = '';
}

function deleteSelectedRole() {
  if (builtInRoleHierarchy.includes(selectedRole)) return;
  const assignedAccounts = roleAssignments.filter((account) => account.role === selectedRole);
  if (assignedAccounts.length) {
    showSettingsMessage(`Reassign all ${assignedAccounts.length} account${assignedAccounts.length === 1 ? '' : 's'} using ${selectedRole} before deleting this role.`, 'Role is in use');
    return;
  }
  showSettingsConfirmation(
    `Delete the ${selectedRole} role?`,
    'Delete role',
    async () => {
      delete rolePermissionsState[selectedRole];
      delete pageAccessState[selectedRole];
      delete roleColorsState[selectedRole];
      Object.keys(userPermissionOverrides).forEach((username) => {
        if (userPermissionOverrides[username].role === selectedRole) delete userPermissionOverrides[username];
      });
      selectedRole = 'Administrator';
      syncRoleHierarchy();
      renderRoleSelector();
      renderSelectedRole();
      await savePermissions();
    }
  );
}

function createRole(name) {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) {
    roleCreateError.textContent = 'Enter a role name.';
    return;
  }
  if (roleHierarchy.some((role) => role.toLowerCase() === normalizedName.toLowerCase())) {
    roleCreateError.textContent = 'A role with that name already exists.';
    return;
  }

  rolePermissionsState[normalizedName] = createCustomRolePermissions();
  roleColorsState[normalizedName] = DEFAULT_CUSTOM_ROLE_COLOR;
  pageAccessState[normalizedName] = createCustomRolePageAccess();
  selectedRole = normalizedName;
  syncRoleHierarchy();
  closeRoleCreateForm();
  renderRoleSelector();
  renderSelectedRole();
  setSettingsTab('permissions');
  showSettingsStatus('Role created. Save changes to apply.', 'notice');
}

function renderSelectedRole() {
  const locked = selectedRole === 'Super Admin';
  selectedRoleTitle.textContent = selectedRole;
  renderRoleColorControl();
  selectedRoleDescription.textContent = locked
    ? 'This protected role always has full workspace access.'
    : `Configure page access and unit actions for ${selectedRole}.`;
  selectedRoleLock.hidden = !locked;
  deleteRoleButton.hidden = builtInRoleHierarchy.includes(selectedRole);
  roleSelector.querySelectorAll('[data-role-select]').forEach((button) => {
    const isSelected = button.dataset.roleSelect === selectedRole;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  renderPermissions(rolePermissionsState[selectedRole]);
  renderPageAccess(pageAccessState[selectedRole]);
  renderManagedMemberOptions();
  renderMemberPermissions();
  updateResetButton();
}

function renderPermissions(permissions = rolePermissionsState[selectedRole]) {
  permissionsTableBody.innerHTML = renderActionToggles(permissions, selectedRole);
}

function renderPageAccess(access = pageAccessState[selectedRole]) {
  pageAccessGrid.innerHTML = Object.keys(PAGE_ACCESS_OPTIONS).map((page) => `
    <label class="page-access-option">
      <span><strong>${page}</strong><small>Allow this role to open ${page}.</small></span>
      <input type="checkbox" data-page-role="${selectedRole}" data-page="${page}" ${access[page] ? 'checked' : ''} ${selectedRole === 'Super Admin' ? 'disabled' : ''}>
    </label>
  `).join('');
}

function setSettingsTab(tab) {
  selectedSettingsTab = tab;
  const showMembers = tab === 'members';
  rolePermissionsTab.hidden = showMembers;
  memberManagementTab.hidden = !showMembers;
  permissionsTabButton.classList.toggle('active', !showMembers);
  membersTabButton.classList.toggle('active', showMembers);
  permissionsTabButton.setAttribute('aria-selected', String(!showMembers));
  membersTabButton.setAttribute('aria-selected', String(showMembers));
  updateResetButton();
}

function updateResetButton() {
  if (selectedSettingsTab === 'members') {
    resetPermissionsBtn.textContent = 'Clear member override';
    const member = getSelectedMember();
    resetPermissionsBtn.disabled = !member || member.role === 'Super Admin' || !userPermissionOverrides[member.username.toLowerCase()];
  } else {
    resetPermissionsBtn.textContent = 'Reset this role';
    resetPermissionsBtn.disabled = selectedRole === 'Super Admin';
  }
}

function captureSelectedRoleSettings() {
  if (!rolePermissionsState[selectedRole]) return;
  document.querySelectorAll('[data-role][data-action]').forEach((input) => {
    rolePermissionsState[selectedRole][input.dataset.action] = input.checked;
  });
  document.querySelectorAll('[data-page-role][data-page]').forEach((input) => {
    pageAccessState[selectedRole][input.dataset.page] = input.checked;
  });
  rolePermissionsState[selectedRole].view = true;
  if (selectedRole === 'Super Admin') {
    rolePermissionsState[selectedRole] = { ...DEFAULT_ROLE_PERMISSIONS['Super Admin'] };
    pageAccessState[selectedRole] = { ...DEFAULT_PAGE_ACCESS['Super Admin'] };
  }
}

function selectRole(role) {
  if (!roleHierarchy.includes(role) || role === selectedRole) return;
  captureSelectedRoleSettings();
  captureMemberOverrides();
  selectedRole = role;
  renderRoleSelector();
  renderSelectedRole();
}

function getSelectedMember() {
  return managedAccounts.find((account) => account.username.toLowerCase() === memberAccountSelect.value) || null;
}

function renderManagedMemberOptions() {
  const previousSelection = memberAccountSelect.value;
  const roleMembers = managedAccounts.filter((account) => account.role === selectedRole);
  memberCount.textContent = String(roleMembers.length);
  memberAccountSelect.replaceChildren(new Option(roleMembers.length ? 'Select a member' : 'No active members in this role', ''));
  roleMembers.forEach((account) => {
    memberAccountSelect.add(new Option(account.fullName, account.username.toLowerCase()));
  });
  memberAccountSelect.value = roleMembers.some((account) => account.username.toLowerCase() === previousSelection)
    ? previousSelection
    : '';
  memberEmptyState.hidden = roleMembers.length > 0;
}

function renderMemberPermissions() {
  if (!memberAccountSelect || !memberOverrideEnabled || !memberPermissionEditor) return;
  const member = getSelectedMember();
  if (!member) {
    memberOverrideEnabled.checked = false;
    memberOverrideEnabled.disabled = true;
    memberPermissionEditor.hidden = true;
    memberEmptyState.hidden = managedAccounts.some((account) => account.role === selectedRole);
    updateResetButton();
    return;
  }

  const locked = member.role === 'Super Admin';
  memberEmptyState.hidden = true;
  const override = userPermissionOverrides[member.username.toLowerCase()];
  memberOverrideEnabled.disabled = locked;
  memberOverrideEnabled.checked = Boolean(!locked && override && override.enabled);
  memberPermissionEditor.hidden = locked || !memberOverrideEnabled.checked;

  if (memberPermissionEditor.hidden) return;
  const rolePermissions = rolePermissionsState[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician;
  const rolePageAccess = pageAccessState[member.role] || DEFAULT_PAGE_ACCESS.Technician;
  const permissions = { ...rolePermissions, ...(override && override.permissions) };
  const pageAccess = { ...rolePageAccess, ...(override && override.pageAccess) };
  memberPageAccessGrid.innerHTML = Object.keys(PAGE_ACCESS_OPTIONS).map((page) => `
    <label class="page-access-option"><span><strong>${page}</strong><small>Allow this member to open ${page}.</small></span><input type="checkbox" data-member-page="${page}" ${pageAccess[page] ? 'checked' : ''}></label>
  `).join('');
  memberActionPermissions.innerHTML = renderActionToggles(permissions, member.role, true);
  updateResetButton();
}

async function loadManagedAccounts() {
  try {
    const rows = await DATA.fetchAccounts();
    const uniqueAccounts = new Map();
    rows.forEach((row) => {
      const username = String(row.username || row.userName || row.accountUsername || '').trim();
      const role = String(row.accountType || row.role || row.userType || '').trim();
      const status = String(row.status || 'Active').trim().toLowerCase();
      if (!username || !role) return;
      uniqueAccounts.set(username.toLowerCase(), {
        username,
        role,
        fullName: String(row.fullName || row.name || username).trim(),
        status
      });
    });
    roleAssignments = [...uniqueAccounts.values()];
    managedAccounts = roleAssignments.filter((account) => !['inactive', 'disabled', 'deactivated'].includes(account.status)).sort((first, second) => {
      const firstRoleOrder = roleHierarchy.indexOf(first.role);
      const secondRoleOrder = roleHierarchy.indexOf(second.role);
      const firstOrder = firstRoleOrder === -1 ? roleHierarchy.length : firstRoleOrder;
      const secondOrder = secondRoleOrder === -1 ? roleHierarchy.length : secondRoleOrder;
      return firstOrder - secondOrder || first.fullName.localeCompare(second.fullName);
    });
    renderManagedMemberOptions();
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
  const permissions = { ...(rolePermissionsState[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician), ...(existing.permissions || {}) };
  const pageAccess = { ...(pageAccessState[member.role] || DEFAULT_PAGE_ACCESS.Technician), ...(existing.pageAccess || {}) };
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

function showSettingsToast(message) {
  if (!settingsToast) return;
  settingsToast.textContent = message;
  settingsToast.classList.add('visible');
  window.clearTimeout(settingsToastTimer);
  settingsToastTimer = window.setTimeout(() => settingsToast.classList.remove('visible'), 4000);
}

function showSettingsMessage(message, title = 'Notice') {
  const titleElement = document.getElementById('settingsMessageModalTitle');
  if (!settingsMessageModalBackdrop || !settingsMessageModalBody) return;
  pendingSettingsConfirmation = null;
  if (titleElement) titleElement.textContent = title;
  settingsMessageModalBody.textContent = message;
  cancelSettingsMessageModalBtn.hidden = true;
  okSettingsMessageModalBtn.textContent = 'OK';
  settingsMessageModalBackdrop.classList.add('visible');
  settingsMessageModalBackdrop.setAttribute('aria-hidden', 'false');
}

function showSettingsConfirmation(message, title, onConfirm) {
  const titleElement = document.getElementById('settingsMessageModalTitle');
  if (!settingsMessageModalBackdrop || !settingsMessageModalBody) return;
  if (titleElement) titleElement.textContent = title;
  settingsMessageModalBody.textContent = message;
  pendingSettingsConfirmation = onConfirm;
  cancelSettingsMessageModalBtn.hidden = false;
  okSettingsMessageModalBtn.textContent = 'Delete';
  settingsMessageModalBackdrop.classList.add('visible');
  settingsMessageModalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeSettingsMessage() {
  if (!settingsMessageModalBackdrop) return;
  pendingSettingsConfirmation = null;
  cancelSettingsMessageModalBtn.hidden = true;
  okSettingsMessageModalBtn.textContent = 'OK';
  settingsMessageModalBackdrop.classList.remove('visible');
  settingsMessageModalBackdrop.setAttribute('aria-hidden', 'true');
}

function confirmSettingsMessage() {
  const confirmAction = pendingSettingsConfirmation;
  closeSettingsMessage();
  if (confirmAction) confirmAction();
}

function getFormPermissions() {
  captureSelectedRoleSettings();
  return JSON.parse(JSON.stringify(rolePermissionsState));
}

function getFormPageAccess() {
  captureSelectedRoleSettings();
  return JSON.parse(JSON.stringify(pageAccessState));
}

async function savePermissions() {
  captureSelectedRoleSettings();
  captureMemberOverrides();
  const permissions = getFormPermissions();
  const pageAccess = getFormPageAccess();
  const roleColors = normalizeRoleColors(roleColorsState);
  roleColorsState = roleColors;
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
        roleColors: JSON.stringify(roleColors),
        userPermissions: JSON.stringify(userPermissionOverrides)
      }).toString()
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error || 'Permission save failed');

    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    setRoleColors(roleColors);
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    showSettingsStatus('Permissions saved');
    showSettingsToast('Changes Saved Successfully');
  } catch (error) {
    localStorage.setItem('unitflowRolePermissions', JSON.stringify(permissions));
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    setRoleColors(roleColors);
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    showSettingsStatus('The database was unavailable', 'notice');
    showSettingsToast('Changes saved locally; database unavailable');
    console.error('Unable to save permissions to Google Sheets:', error);
  }
}

function resetPermissions() {
  if (selectedSettingsTab === 'members') {
    const member = getSelectedMember();
    if (!member) return;
    delete userPermissionOverrides[member.username.toLowerCase()];
    renderMemberPermissions();
    showSettingsStatus('Member overrides cleared. Save to apply.', 'notice');
    return;
  }

  if (selectedRole === 'Super Admin') return;
  rolePermissionsState[selectedRole] = { ...(DEFAULT_ROLE_PERMISSIONS[selectedRole] || createCustomRolePermissions()) };
  pageAccessState[selectedRole] = { ...(DEFAULT_PAGE_ACCESS[selectedRole] || createCustomRolePageAccess()) };
  renderSelectedRole();
  showSettingsStatus('Role defaults restored. Save to apply.', 'notice');
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
    roleColorsState = setRoleColors(result.roleColors || roleColorsState);
    localStorage.setItem('unitflowPageAccess', JSON.stringify(pageAccess));
    localStorage.setItem('unitflowUserPermissionOverrides', JSON.stringify(userPermissionOverrides));
    rolePermissionsState = getRolePermissions();
    pageAccessState = getPageAccess();
    syncRoleHierarchy();
    renderSelectedRole();
  } catch (error) {
    showSettingsStatus('The database was unavailable', 'notice');
    console.error('Unable to load permissions from Google Sheets:', error);
  }
}

async function loadManagedBranches() {
  try {
    managedBranches = await DATA.fetchBranches();
    managedBranchesLoaded = true;
  } catch (error) {
    managedBranches = [];
    console.warn('Unable to load branches for branch type management:', error);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!isPermissionManager()) return;
  syncRoleHierarchy();
  renderRoleSelector();
  renderSelectedRole();
  renderBranchTypeSelector();
  setSettingsView('roles');
  setSettingsTab('permissions');
  savePermissionsBtn.addEventListener('click', savePermissions);
  resetPermissionsBtn.addEventListener('click', resetPermissions);
  closeSettingsMessageModalBtn.addEventListener('click', closeSettingsMessage);
  okSettingsMessageModalBtn.addEventListener('click', confirmSettingsMessage);
  cancelSettingsMessageModalBtn.addEventListener('click', closeSettingsMessage);
  settingsMessageModalBackdrop.addEventListener('click', (event) => {
    if (event.target === settingsMessageModalBackdrop) closeSettingsMessage();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSettingsMessage();
  });
  roleSelector.addEventListener('click', (event) => {
    const button = event.target.closest('[data-role-select]');
    if (button) selectRole(button.dataset.roleSelect);
  });
  document.querySelector('.role-editor-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-settings-tab]');
    if (button) setSettingsTab(button.dataset.settingsTab);
  });
  document.querySelector('.settings-view-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-settings-view]');
    if (button) setSettingsView(button.dataset.settingsView);
  });
  addRoleButton.addEventListener('click', openRoleCreateForm);
  cancelCreateRoleButton.addEventListener('click', closeRoleCreateForm);
  deleteRoleButton.addEventListener('click', deleteSelectedRole);
  roleCreateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createRole(newRoleName.value);
  });
  roleColorPicker.addEventListener('input', () => {
    selectRoleColor(roleColorPicker.value);
  });
  roleColorPalette.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-color]');
    if (swatch) selectRoleColor(swatch.dataset.color);
  });
  branchTypeSelector.addEventListener('click', (event) => {
    if (!captureSelectedBranchType()) return;
    const button = event.target.closest('[data-branch-type-select]');
    if (!button || button.dataset.branchTypeSelect === selectedBranchType) return;
    selectedBranchType = button.dataset.branchTypeSelect;
    renderBranchTypeSelector();
  });
  addBranchTypeButton.addEventListener('click', openBranchTypeCreateForm);
  cancelCreateBranchTypeButton.addEventListener('click', closeBranchTypeCreateForm);
  branchTypeCreateForm.addEventListener('submit', (event) => {
    event.preventDefault();
    createBranchType(newBranchTypeCode.value);
  });
  const updateBranchTypePreview = () => {
    branchTypePreview.textContent = `${branchTypeShortcut.value.trim().toUpperCase()}${branchTypeFullName.value.trim() ? ` — ${branchTypeFullName.value.trim()}` : ''}`;
  };
  branchTypeShortcut.addEventListener('input', updateBranchTypePreview);
  branchTypeFullName.addEventListener('input', updateBranchTypePreview);
  branchTypeColor.addEventListener('input', () => {
    selectBranchTypeColor(branchTypeColor.value);
  });
  branchTypeColorPalette.addEventListener('click', (event) => {
    const swatch = event.target.closest('[data-color]');
    if (swatch) selectBranchTypeColor(swatch.dataset.color);
  });
  saveBranchTypeButton.addEventListener('click', saveSelectedBranchType);
  deleteBranchTypeButton.addEventListener('click', deleteSelectedBranchType);
  permissionsTableBody.addEventListener('change', (event) => {
    const input = event.target.closest('[data-role][data-action]');
    if (!input) return;
    rolePermissionsState[selectedRole][input.dataset.action] = input.dataset.action === 'view' || input.checked;
    if (input.previousElementSibling) input.previousElementSibling.textContent = input.checked ? 'Allowed' : 'Off';
  });
  pageAccessGrid.addEventListener('change', captureSelectedRoleSettings);
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
        permissions: { ...(rolePermissionsState[member.role] || DEFAULT_ROLE_PERMISSIONS.Technician) },
        pageAccess: { ...(pageAccessState[member.role] || DEFAULT_PAGE_ACCESS.Technician) }
      };
    }
    renderMemberPermissions();
  });
  memberPermissionEditor.addEventListener('change', (event) => {
    const input = event.target.closest('[data-member-action], [data-member-page]');
    if (!input) return;
    captureMemberOverrides();
    if (input.matches('[data-member-action]') && input.previousElementSibling) {
      input.previousElementSibling.textContent = input.checked ? 'Allowed' : 'Off';
    }
  });

  loadPermissionsFromServer();
  loadManagedBranches();
  loadBranchTypeDefinitions().then((definitions) => {
    if (branchTypeDefinitionsChanged) return;
    branchTypeDefinitions = definitions.length ? definitions : getBranchTypeDefinitions();
    selectedBranchType = branchTypeDefinitions.some((type) => type.code === selectedBranchType)
      ? selectedBranchType
      : (branchTypeDefinitions[0]?.code || '');
    renderBranchTypeSelector();
  });
  await loadManagedAccounts();
});