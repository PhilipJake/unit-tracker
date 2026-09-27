const accountsTableBody = document.getElementById('accountsTableBody');
const accountModalBackdrop = document.getElementById('accountModalBackdrop');
const openAccountModalBtn = document.getElementById('openAccountModalBtn');
const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
const cancelAccountModalBtn = document.getElementById('cancelAccountModalBtn');
const accountForm = document.getElementById('accountForm');
const accountBranchField = document.getElementById('accountBranch');
const accountStatusGroup = document.getElementById('accountStatusGroup');
const accountStatusField = document.getElementById('accountStatus');
const accountPasswordField = document.getElementById('accountPassword');
const toggleAccountPasswordVisibilityButton = document.getElementById('toggleAccountPasswordVisibility');
const accountTypeSelect = document.getElementById('accountTypeSelect');
const accountModalTitle = document.getElementById('accountModalTitle');
const saveAccountButton = document.getElementById('saveAccountButton');
const accountPreviewAvatar = document.getElementById('accountPreviewAvatar');
const accountPreviewName = document.getElementById('accountPreviewName');
const accountPreviewRole = document.getElementById('accountPreviewRole');
const accountPreviewBranch = document.getElementById('accountPreviewBranch');
const accountsSearchInput = document.getElementById('accountsSearchInput');
const accountRoleFilter = document.getElementById('accountRoleFilter');
const accountStatusFilter = document.getElementById('accountStatusFilter');
const accountResultCount = document.getElementById('accountResultCount');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
let activeEditUsername = '';
let pendingConfirmAction = null;
let loadedAccounts = [];
const builtInAccountRoleOrder = ['Super Admin', 'Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];

function showPopupMessage(message, onConfirm = null) {
  if (!messageModalBackdrop || !messageModalBody) return;

  pendingConfirmAction = onConfirm;
  messageModalBody.textContent = message;
  messageModalBackdrop.classList.add('visible');
  messageModalBackdrop.setAttribute('aria-hidden', 'false');
  if (okMessageModalBtn) okMessageModalBtn.textContent = onConfirm ? 'Yes' : 'OK';
}

function closePopupMessage() {
  if (!messageModalBackdrop) return;
  pendingConfirmAction = null;
  if (okMessageModalBtn) okMessageModalBtn.textContent = 'OK';
  messageModalBackdrop.classList.remove('visible');
  messageModalBackdrop.setAttribute('aria-hidden', 'true');
}

function getAllowedAccountTypesForRole() {
  const currentRole = localStorage.getItem('unitflowRole');
  const builtInRoles = ['Super Admin', 'Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
  const customRoles = typeof getRolePermissions === 'function'
    ? Object.keys(getRolePermissions()).filter((role) => !builtInRoles.includes(role))
    : [];

  if (currentRole === 'Super Admin') {
    return [...builtInRoles, ...customRoles];
  }

  if (currentRole === 'Administrator') {
    return ['Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician', ...customRoles];
  }

  if (currentRole === 'Main Head Admin') {
    return ['Branch Head Admin', 'Office', 'Technician'];
  }

  return ['Branch Head Admin', 'Office', 'Technician'];
}

function applyAccountTypeOptions() {
  if (!accountTypeSelect) return;

  const allowedTypes = getAllowedAccountTypesForRole();
  const existingTypes = new Set(Array.from(accountTypeSelect.options).map((option) => option.value));
  allowedTypes.forEach((role) => {
    if (existingTypes.has(role)) return;
    const option = new Option(role, role);
    accountTypeSelect.add(option);
  });
  const currentValue = accountTypeSelect.value || '';

  Array.from(accountTypeSelect.options).forEach((option) => {
    if (option.value === '') return;
    const isAllowed = allowedTypes.includes(option.value);
    option.hidden = !isAllowed;
    option.disabled = !isAllowed;
  });

  if (!allowedTypes.includes(currentValue)) {
    accountTypeSelect.value = '';
  }
}

function applyAccountStatusOptions() {
  if (!accountStatusGroup || !accountStatusField) return;
  const canManageStatus = ['Super Admin', 'Administrator', 'Main Head Admin'].includes(localStorage.getItem('unitflowRole'));
  accountStatusGroup.hidden = !canManageStatus;
  accountStatusField.disabled = !canManageStatus;
}

function setAccountPasswordVisibility(isVisible, animate = false) {
  if (!accountPasswordField || !toggleAccountPasswordVisibilityButton) return;
  const visibleIcon = toggleAccountPasswordVisibilityButton.querySelector('[data-password-visible-icon]');
  const hiddenIcon = toggleAccountPasswordVisibilityButton.querySelector('[data-password-hidden-icon]');
  visibleIcon.classList.remove('password-eye-animated');
  hiddenIcon.classList.remove('password-eye-animated');
  accountPasswordField.type = isVisible ? 'text' : 'password';
  toggleAccountPasswordVisibilityButton.setAttribute('aria-label', `${isVisible ? 'Hide' : 'Show'} password`);
  toggleAccountPasswordVisibilityButton.setAttribute('title', `${isVisible ? 'Hide' : 'Show'} password`);
  toggleAccountPasswordVisibilityButton.setAttribute('aria-pressed', String(isVisible));
  if (isVisible) {
    visibleIcon.setAttribute('hidden', '');
    hiddenIcon.removeAttribute('hidden');
  } else {
    visibleIcon.removeAttribute('hidden');
    hiddenIcon.setAttribute('hidden', '');
  }

  if (animate) {
    const icon = isVisible ? hiddenIcon : visibleIcon;
    void icon.offsetWidth;
    icon.classList.add('password-eye-animated');
  }
}

async function loadBranchOptions() {
  if (!accountBranchField) return;

  accountBranchField.innerHTML = '<option value="" disabled selected>Select branch</option>';
  accountBranchField.insertAdjacentHTML('beforeend', '<option value="Main Office">Main Office</option>');
  accountBranchField.insertAdjacentHTML('beforeend', '<option value="Technical">Technical</option>');

  try {
    const branches = await DATA.fetchBranches();
    const branchNames = [...new Set(branches.map((row) => row.branchName || row.branchname || row.name || '').filter(Boolean))];

    branchNames.forEach((branchName) => {
      const option = document.createElement('option');
      option.value = branchName;
      option.textContent = branchName;
      accountBranchField.appendChild(option);
    });
  } catch (error) {
    console.error('Unable to load branches for account form:', error);
  }
}

function isProtectedSuperAdminAccount(accountType, currentRole) {
  const normalizedRole = normalizeAccountRole(currentRole);
  const normalizedAccountType = normalizeAccountRole(accountType);
  return ['main head admin', 'administrator'].includes(normalizedRole) && normalizedAccountType === 'super admin';
}

function getAccountRoleRank(role) {
  const ranks = {
    'branch head admin': 1,
    office: 2,
    technician: 2,
    'main head admin': 3,
    administrator: 4,
    'super admin': 5
  };
  return ranks[normalizeAccountRole(role)] || 0;
}

function cannotEditHigherRole(accountType, currentRole) {
  return getAccountRoleRank(currentRole) < getAccountRoleRank(accountType);
}

function getDisplayedAccountType(accountType, currentRole) {
  if (normalizeAccountRole(currentRole) === 'administrator', 'Main Head Admin', 'Office' && normalizeAccountRole(accountType) === 'super admin') {
    return 'Administrator';
  }

  return accountType;
}

function getDisplayedAccountUsername(username, accountType, currentRole) {
  const isSuperAdminAccount = normalizeAccountRole(accountType) === 'super admin';
  const isSuperAdminViewer = normalizeAccountRole(currentRole) === 'super admin';

  return isSuperAdminAccount && !isSuperAdminViewer ? 'Protected account' : username;
}

function normalizeAccountRole(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatAccountCreatedDate(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const isoDateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|\s)/);
  if (isoDateMatch) return `${isoDateMatch[2]}/${isoDateMatch[3]}/${isoDateMatch[1]}`;

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return rawValue;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(parsedDate);
}

async function loadAccounts() {
  try {
    const rows = await DATA.fetchAccounts();
    const currentRole = localStorage.getItem('unitflowRole');
    loadedAccounts = normalizeAccountRole(currentRole) === 'main head admin'
      ? rows.filter((row) => !['super admin', 'administrator'].includes(normalizeAccountRole(row.accountType || row.role || row.userType || '')))
      : rows;
    renderAccountRoleFilter();
    renderAccountsDirectory();
  } catch (error) {
    console.error(error);
    accountsTableBody.innerHTML = '<div class="member-list-empty">Unable to load accounts. Check the Accounts sheet configuration.</div>';
  }
}

function accountRoleOrder(role) {
  const index = builtInAccountRoleOrder.indexOf(role);
  return index === -1 ? builtInAccountRoleOrder.length : index;
}

function renderAccountRoleFilter() {
  if (!accountRoleFilter) return;
  const currentFilter = accountRoleFilter.value || 'all';
  const roles = [...new Set(loadedAccounts.map((row) => String(row.accountType || row.role || row.userType || '').trim()).filter(Boolean))]
    .sort((first, second) => accountRoleOrder(first) - accountRoleOrder(second) || first.localeCompare(second));
  accountRoleFilter.replaceChildren(new Option('All roles', 'all'));
  roles.forEach((role) => accountRoleFilter.add(new Option(role, role)));
  accountRoleFilter.value = roles.includes(currentFilter) ? currentFilter : 'all';
}

function getMemberInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] || '?').slice(0, 2)).toUpperCase();
}

function updateAccountPreview() {
  const fullName = String(accountForm?.elements.namedItem('accountFullName')?.value || '').trim();
  const accountRole = String(accountTypeSelect?.value || '').trim();
  const branchName = String(accountBranchField?.value || '').trim();
  if (accountPreviewName) accountPreviewName.textContent = fullName || 'New member';
  if (accountPreviewAvatar) accountPreviewAvatar.textContent = getMemberInitials(fullName || 'New member');
  if (accountPreviewRole) accountPreviewRole.textContent = accountRole || 'Choose an account type';
  if (accountPreviewBranch) accountPreviewBranch.textContent = branchName || 'Unassigned';
}

function renderAccountsDirectory() {
  if (!accountsTableBody) return;
  const query = String(accountsSearchInput?.value || '').trim().toLowerCase();
  const selectedRole = accountRoleFilter?.value || 'all';
  const selectedStatus = accountStatusFilter?.value || 'all';
  const currentRole = localStorage.getItem('unitflowRole');
  const filteredAccounts = loadedAccounts.filter((row) => {
    const username = String(row.username || row.userName || row.accountUsername || '').trim();
    const fullName = String(row.fullName || row.name || row.full_name || '').trim();
    const role = String(row.accountType || row.role || row.userType || '').trim();
    const status = String(row.status || 'Active').trim();
    const branch = String(row.branch || row.branchLocation || '').trim();
    const searchable = [username, fullName, role, row.email, branch, status].join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (selectedRole === 'all' || role === selectedRole)
      && (selectedStatus === 'all' || normalizeAccountStatus(status) === selectedStatus);
  });

  accountResultCount.textContent = `${filteredAccounts.length} ${filteredAccounts.length === 1 ? 'member' : 'members'}`;
  if (!filteredAccounts.length) {
    accountsTableBody.innerHTML = `<div class="member-list-empty">${loadedAccounts.length ? 'No members match these filters.' : 'No accounts found in the Accounts sheet.'}</div>`;
    return;
  }

  const roles = [...new Set(filteredAccounts.map((row) => String(row.accountType || row.role || row.userType || '').trim()))]
    .sort((first, second) => accountRoleOrder(first) - accountRoleOrder(second) || first.localeCompare(second));
  accountsTableBody.innerHTML = roles.map((role) => {
    const roleMembers = filteredAccounts.filter((row) => String(row.accountType || row.role || row.userType || '').trim() === role);
    const memberRows = roleMembers.map((row) => {
      const username = String(row.username || row.userName || row.accountUsername || '').trim();
      const fullName = String(row.fullName || row.name || row.full_name || username).trim();
      const email = String(row.email || '').trim();
      const branch = String(row.branch || row.branchLocation || '').trim();
      const status = String(row.status || 'Active').trim();
      const isProtected = isProtectedSuperAdminAccount(role, currentRole);
      const canEdit = canManageAction('edit', currentRole) && !isProtected;
      const canDelete = canManageAction('delete', currentRole) && !isProtected;
      const displayedName = getDisplayedAccountUsername(fullName, role, currentRole) === 'Protected account' ? 'Protected account' : fullName;
      const isActive = !['inactive', 'disabled', 'deactivated'].includes(normalizeAccountStatus(status));
      const metadata = [email, branch].filter(Boolean).map(escapeHtml);
      return `
        <article class="account-member-row" data-account-username="${escapeHtml(username)}">
          <div class="account-member-avatar" aria-hidden="true">${escapeHtml(getMemberInitials(displayedName))}</div>
          <div class="account-member-identity">
            <strong>${escapeHtml(displayedName || '—')}</strong>
            <span>${metadata.length ? metadata.join('<span class="member-meta-separator">·</span>') : 'No email or branch listed'}</span>
          </div>
          <span class="account-member-status ${isActive ? 'is-active' : ''}"><i aria-hidden="true"></i>${escapeHtml(status)}</span>
          <div class="account-member-actions">
            <button class="edit" type="button" ${canEdit ? '' : 'disabled title="Edit permission is disabled"'}>Edit</button>
            <button class="delete" type="button" ${canDelete ? '' : 'disabled title="Delete permission is disabled"'}>Delete</button>
          </div>
        </article>
      `;
    }).join('');
    return `
      <section class="account-role-group" aria-label="${escapeHtml(role)} members">
        <header><span>${escapeHtml(role)}</span><span>${roleMembers.length}</span></header>
        <div>${memberRows}</div>
      </section>
    `;
  }).join('');
}

function openAccountModal(mode = 'create', account = null) {
  if (!accountModalBackdrop) return;

  const currentRole = localStorage.getItem('unitflowRole');
  if (!canManageAction(mode === 'edit' ? 'edit' : 'create', currentRole)) {
    return;
  }

  if (mode === 'edit' && account) {
    activeEditUsername = String(account.username || account.userName || account.accountUsername || '').trim();
    accountForm.dataset.mode = 'edit';
    accountForm.dataset.createdAt = account.created || account.createdAt || account.dateCreated || account['created at'] || '';
    accountForm.dataset.originalBranch = account.branch || account.branchLocation || account.branchName || '';
    populateAccountForm(account);
  } else {
    activeEditUsername = '';
    accountForm.dataset.mode = 'create';
    delete accountForm.dataset.createdAt;
    delete accountForm.dataset.originalBranch;
    accountForm.reset();
    if (accountStatusField) accountStatusField.value = 'Active';
  }

  setAccountPasswordVisibility(false);
  if (accountModalTitle) accountModalTitle.textContent = mode === 'edit' ? 'Edit member' : 'Create member';
  if (saveAccountButton) saveAccountButton.textContent = mode === 'edit' ? 'Save changes' : 'Create member';
  applyAccountTypeOptions();
  applyAccountStatusOptions();
  updateAccountPreview();
  accountModalBackdrop.classList.add('visible');
  accountModalBackdrop.setAttribute('aria-hidden', 'false');
}

function populateAccountForm(account) {
  if (!accountForm) return;

  accountForm.reset();
  const fields = {
    accountUsername: account.username || account.userName || account.accountUsername || '',
    accountPassword: account.password || '',
    accountTypeSelect: account.accountType || account.role || account.userType || '',
    accountFullName: account.fullName || account.fullname || account.name || '',
    accountEmail: account.email || '',
    accountBranch: account.branch || account.branchLocation || account.branchName || ''
  };

  Object.entries(fields).forEach(([key, value]) => {
    const field = accountForm.elements.namedItem(key);
    if (field) field.value = value;
  });

  if (accountStatusField) {
    accountStatusField.value = account.status || account.accountStatus || 'Active';
  }
}

function closeAccountModal() {
  if (!accountModalBackdrop) return;
  accountModalBackdrop.classList.remove('visible');
  accountModalBackdrop.setAttribute('aria-hidden', 'true');
  activeEditUsername = '';
  if (accountForm) {
    accountForm.dataset.mode = 'create';
    delete accountForm.dataset.createdAt;
    accountForm.reset();
  }
  setAccountPasswordVisibility(false);
  if (accountModalTitle) accountModalTitle.textContent = 'Create member';
  if (saveAccountButton) saveAccountButton.textContent = 'Create member';
  updateAccountPreview();
}

async function saveAccountToSheet(event) {
  event.preventDefault();

  if (!accountForm) return;

  const currentRole = localStorage.getItem('unitflowRole');
  const formData = new FormData(accountForm);
  const username = String(formData.get('accountUsername') || '').trim();
  const password = String(formData.get('accountPassword') || '').trim();
  const accountType = String(formData.get('accountTypeSelect') || '').trim();
  const fullName = String(formData.get('accountFullName') || '').trim();
  const email = String(formData.get('accountEmail') || '').trim();
  const branch = String(formData.get('accountBranch') || '').trim();
  const isEditMode = accountForm.dataset.mode === 'edit';
  const originalBranch = String(accountForm.dataset.originalBranch || '').trim();

  if (!canManageAction(isEditMode ? 'edit' : 'create', currentRole)) {
    showPopupMessage(`You do not have permission to ${isEditMode ? 'edit' : 'create'} accounts.`);
    return;
  }

  if (!username || !password || !accountType || !fullName || !email) {
    showPopupMessage('Please complete all required account fields.');
    return;
  }

  if (currentRole === 'Administrator' && accountType === 'Super Admin') {
    showPopupMessage('Administrator cannot create or save a Super Admin account.');
    return;
  }

  if (currentRole === 'Main Head Admin' && accountType === 'Super Admin') {
    showPopupMessage('Main Head Admin cannot edit or save a Super Admin account.');
    return;
  }

  if (isEditMode && !['Super Admin', 'Administrator', 'Main Head Admin'].includes(currentRole || '')) {
    try {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === (activeEditUsername || username));
      const previousType = String(account ? (account.accountType || account.role || account.userType || '') : '').trim();

      if (previousType && previousType !== accountType) {
        showPopupMessage('Only Super Admin and Main Head Admin can change an account type.');
        return;
      }
    } catch (error) {
      console.error('Unable to validate account type change:', error);
      showPopupMessage('Only Super Admin and Main Head Admin can change an account type.');
      return;
    }
  }

  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';

  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    showPopupMessage('Please deploy the Apps Script and paste its Web App URL into gs/config.js before saving.');
    return;
  }

  const bodyValues = {
    action: isEditMode ? 'updateaccount' : 'accounts',
    username,
    password,
    accountType,
    fullName,
    email,
    branch,
    branchName: branch,
    accountBranch: branch,
    createdAt: isEditMode && accountForm.dataset.createdAt ? accountForm.dataset.createdAt : new Date().toISOString(),
    originalUsername: activeEditUsername || username,
    originalBranch,
    actorRole: currentRole || ''
  };

  if (!isEditMode || ['Super Admin', 'Administrator', 'Main Head Admin'].includes(currentRole)) {
    bodyValues.status = accountStatusField ? accountStatusField.value : 'Active';
  }

  const body = new URLSearchParams(bodyValues).toString();

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || (result && result.ok === false)) {
      const message = result && result.error ? result.error : 'Account save failed';
      throw new Error(message);
    }

    showPopupMessage(isEditMode ? 'Account updated successfully.' : 'Account saved successfully to the spreadsheet.');
    closeAccountModal();
    loadAccounts();
  } catch (error) {
    console.error(error);
    showPopupMessage('Account save failed. Please confirm the Apps Script Web App URL is correct.');
  }
}

async function deleteAccountFromSheet(username) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    showPopupMessage('Please deploy the Apps Script and paste its Web App URL into gs/config.js before deleting.');
    return;
  }

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        action: 'deleteAccount',
        username,
        actorRole: localStorage.getItem('unitflowRole') || ''
      }).toString()
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || (result && result.ok === false)) {
      const message = result && result.error ? result.error : 'Account delete failed';
      throw new Error(message);
    }

    showPopupMessage('Account deleted successfully.');
    loadAccounts();
  } catch (error) {
    console.error(error);
    showPopupMessage('Account delete failed. Please confirm the Apps Script URL is correct.');
  }
}

function normalizeAccountStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

if (openAccountModalBtn) {
  openAccountModalBtn.addEventListener('click', async () => {
    const currentRole = localStorage.getItem('unitflowRole');
    if (!canManageAction('create', currentRole)) return;
    await loadBranchOptions();
    openAccountModal('create');
  });
}

if (closeAccountModalBtn) {
  closeAccountModalBtn.addEventListener('click', closeAccountModal);
}

if (cancelAccountModalBtn) {
  cancelAccountModalBtn.addEventListener('click', closeAccountModal);
}

if (accountModalBackdrop) {
  accountModalBackdrop.addEventListener('click', (event) => {
    if (event.target === accountModalBackdrop) {
      closeAccountModal();
    }
  });
}

if (closeMessageModalBtn) {
  closeMessageModalBtn.addEventListener('click', closePopupMessage);
}

if (okMessageModalBtn) {
  okMessageModalBtn.addEventListener('click', () => {
    const confirmAction = pendingConfirmAction;
    closePopupMessage();
    if (confirmAction) confirmAction();
  });
}

if (messageModalBackdrop) {
  messageModalBackdrop.addEventListener('click', (event) => {
    if (event.target === messageModalBackdrop) {
      closePopupMessage();
    }
  });
}

if (accountForm) {
  accountForm.addEventListener('submit', saveAccountToSheet);
}

if (accountsTableBody) {
  accountsTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const currentRole = localStorage.getItem('unitflowRole');
    if (currentRole === 'Office') {
      return;
    }

    const row = button.closest('.account-member-row');
    const username = row && row.dataset.accountUsername ? row.dataset.accountUsername : '';
    if (!username) return;

    if (button.classList.contains('edit')) {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === username);
      if (account) {
        const accountType = String(account.accountType || account.role || account.userType || '').trim();

        if (cannotEditHigherRole(accountType, currentRole)) {
          showPopupMessage(`${currentRole} cannot edit an account with the ${accountType} role.`);
          return;
        }

        await loadBranchOptions();
        openAccountModal('edit', account);
      } else {
        showPopupMessage('Account not found in the live spreadsheet.');
      }
    }

    if (button.classList.contains('delete')) {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === username);
      const accountType = account ? String(account.accountType || account.role || account.userType || '').trim() : '';

      if (isProtectedSuperAdminAccount(accountType, currentRole)) {
        showPopupMessage(`${currentRole} cannot delete a Super Admin account.`);
        return;
      }

      showPopupMessage(`Delete account ${username}?`, async () => {
        await deleteAccountFromSheet(username);
      });
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && messageModalBackdrop && messageModalBackdrop.classList.contains('visible')) {
    closePopupMessage();
    return;
  }

  if (event.key === 'Escape' && accountModalBackdrop && accountModalBackdrop.classList.contains('visible')) {
    closeAccountModal();
  }
});

if (accountTypeSelect) {
  accountTypeSelect.addEventListener('change', () => {
    applyAccountTypeOptions();
    updateAccountPreview();
  });
}

if (toggleAccountPasswordVisibilityButton) {
  toggleAccountPasswordVisibilityButton.addEventListener('click', () => {
    setAccountPasswordVisibility(accountPasswordField.type === 'password', true);
  });
}

if (accountForm) {
  accountForm.elements.namedItem('accountFullName').addEventListener('input', updateAccountPreview);
}
if (accountBranchField) accountBranchField.addEventListener('change', updateAccountPreview);

if (accountsSearchInput) accountsSearchInput.addEventListener('input', renderAccountsDirectory);
if (accountRoleFilter) accountRoleFilter.addEventListener('change', renderAccountsDirectory);
if (accountStatusFilter) accountStatusFilter.addEventListener('change', renderAccountsDirectory);

document.addEventListener('DOMContentLoaded', () => {
  applyAccountTypeOptions();
  applyAccountStatusOptions();
  loadAccounts();
});
