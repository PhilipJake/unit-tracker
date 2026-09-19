const accountsTableBody = document.getElementById('accountsTableBody');
const accountModalBackdrop = document.getElementById('accountModalBackdrop');
const openAccountModalBtn = document.getElementById('openAccountModalBtn');
const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
const cancelAccountModalBtn = document.getElementById('cancelAccountModalBtn');
const accountForm = document.getElementById('accountForm');
const accountBranchField = document.getElementById('accountBranch');
const accountStatusGroup = document.getElementById('accountStatusGroup');
const accountStatusField = document.getElementById('accountStatus');
const accountTypeSelect = document.getElementById('accountTypeSelect');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
let activeEditUsername = '';
let pendingConfirmAction = null;

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

  if (currentRole === 'Super Admin') {
    return ['Super Admin', 'Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
  }

  if (currentRole === 'Administrator') {
    return ['Administrator', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
  }

  if (currentRole === 'Main Head Admin') {
    return ['Branch Head Admin', 'Office', 'Technician'];
  }

  return ['Branch Head Admin', 'Office', 'Technician'];
}

function applyAccountTypeOptions() {
  if (!accountTypeSelect) return;

  const allowedTypes = getAllowedAccountTypesForRole();
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
  const isSuperAdmin = localStorage.getItem('unitflowRole') === 'Super Admin';
  accountStatusGroup.hidden = !isSuperAdmin;
  accountStatusField.disabled = !isSuperAdmin;
}

async function loadBranchOptions() {
  if (!accountBranchField) return;

  accountBranchField.innerHTML = '<option value="">Select branch</option>';
  accountBranchField.insertAdjacentHTML('beforeend', '<option value="Main Office">Main Office</option>');

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

    if (!rows.length) {
      accountsTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No accounts found in the Accounts sheet.</td></tr>';
      return;
    }

    const currentRole = localStorage.getItem('unitflowRole');
    accountsTableBody.innerHTML = rows
      .map((row) => {
        const username = row.username || row.userName || row.accountUsername || '';
        const fullName = row.fullName || row.name || row.full_name || '';
        const accountType = row.accountType || row.role || row.userType || '';
        const email = row.email || '';
        const branch = row.branch || row.branchLocation || '';
        const created = formatAccountCreatedDate(row.created || row.createdAt || row.dateCreated || row['created at'] || '');
        const status = row.status || 'Active';
        const isProtected = isProtectedSuperAdminAccount(accountType, currentRole);
        const canEdit = canManageAction('edit', currentRole) && !isProtected;
        const canDelete = canManageAction('delete', currentRole) && !isProtected;
        const displayedAccountType = getDisplayedAccountType(accountType, currentRole);
        const displayedUsername = getDisplayedAccountUsername(username, accountType, currentRole);

        const statusClass = normalizeAccountStatus(status) === 'inactive' ? 'released' : 'in-stock';

        return `
          <tr data-account-username="${escapeHtml(username || '')}">
            <td>${escapeHtml(displayedUsername || '—')}</td>
            <td>${escapeHtml(fullName || '—')}</td>
            <td>${escapeHtml(displayedAccountType || '—')}</td>
            <td>${escapeHtml(email || '—')}</td>
            <td class="account-branch-cell">${escapeHtml(branch || '—')}</td>
            <td>${escapeHtml(created || '—')}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(status || 'Active')}</span></td>
            <td class="table-actions">
              <button class="edit" type="button" ${canEdit ? '' : 'disabled title="Edit permission is disabled"'}>Edit</button>
              <button class="delete" type="button" ${canDelete ? '' : 'disabled title="Delete permission is disabled"'}>Delete</button>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (error) {
    console.error(error);
    accountsTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">Unable to load accounts from the spreadsheet. Please check the Accounts sheet and Google Sheet ID.</td></tr>';
  }
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

  applyAccountTypeOptions();
  applyAccountStatusOptions();
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

  if (!isEditMode || currentRole === 'Super Admin') {
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

    const row = button.closest('tr');
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
  accountTypeSelect.addEventListener('change', applyAccountTypeOptions);
}

document.addEventListener('DOMContentLoaded', () => {
  applyAccountTypeOptions();
  applyAccountStatusOptions();
  loadAccounts();
});
