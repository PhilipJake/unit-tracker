const accountsTableBody = document.getElementById('accountsTableBody');
const accountModalBackdrop = document.getElementById('accountModalBackdrop');
const openAccountModalBtn = document.getElementById('openAccountModalBtn');
const closeAccountModalBtn = document.getElementById('closeAccountModalBtn');
const cancelAccountModalBtn = document.getElementById('cancelAccountModalBtn');
const accountForm = document.getElementById('accountForm');
const accountBranchField = document.getElementById('accountBranch');
const accountTypeSelect = document.getElementById('accountTypeSelect');
let activeEditUsername = '';

function getAllowedAccountTypesForRole() {
  const currentRole = localStorage.getItem('unitflowRole');

  if (currentRole === 'Super Admin') {
    return ['Super Admin', 'Main Head Admin', 'Branch Head Admin', 'Office', 'Technician'];
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

async function loadBranchOptions() {
  if (!accountBranchField) return;

  accountBranchField.innerHTML = '<option value="">Select branch</option>';

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
    const fallback = document.createElement('option');
    fallback.value = 'Main Office';
    fallback.textContent = 'Main Office';
    accountBranchField.appendChild(fallback);
  }
}

function isProtectedSuperAdminAccount(accountType, currentRole) {
  return currentRole === 'Main Head Admin' && String(accountType || '').trim() === 'Super Admin';
}

async function loadAccounts() {
  try {
    const rows = await DATA.fetchAccounts();

    if (!rows.length) {
      accountsTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No accounts found in the Accounts sheet.</td></tr>';
      return;
    }

    const currentRole = localStorage.getItem('unitflowRole');
    const isOfficeRole = currentRole === 'Office';

    accountsTableBody.innerHTML = rows
      .map((row) => {
        const username = row.username || row.userName || row.accountUsername || '';
        const fullName = row.fullName || row.name || row.full_name || '';
        const accountType = row.accountType || row.role || row.userType || '';
        const email = row.email || '';
        const branch = row.branch || row.branchLocation || '';
        const created = row.created || row.createdAt || row.dateCreated || '';
        const status = row.status || 'Active';
        const isProtected = isProtectedSuperAdminAccount(accountType, currentRole);

        const statusClass = normalizeAccountStatus(status) === 'inactive' ? 'released' : 'in-stock';

        return `
          <tr data-account-username="${escapeHtml(username || '')}">
            <td>${escapeHtml(username || '—')}</td>
            <td>${escapeHtml(fullName || '—')}</td>
            <td>${escapeHtml(accountType || '—')}</td>
            <td>${escapeHtml(email || '—')}</td>
            <td>${escapeHtml(branch || '—')}</td>
            <td>${escapeHtml(created || '—')}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(status || 'Active')}</span></td>
            <td class="table-actions">
              ${isOfficeRole || isProtected ? '<span class="view-only">View only</span>' : '<button class="edit">Edit</button><button class="delete">Delete</button>'}
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

  if (localStorage.getItem('unitflowRole') === 'Office') {
    return;
  }

  if (mode === 'edit' && account) {
    activeEditUsername = String(account.username || account.userName || account.accountUsername || '').trim();
    accountForm.dataset.mode = 'edit';
    populateAccountForm(account);
  } else {
    activeEditUsername = '';
    accountForm.dataset.mode = 'create';
    accountForm.reset();
  }

  applyAccountTypeOptions();
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
}

function closeAccountModal() {
  if (!accountModalBackdrop) return;
  accountModalBackdrop.classList.remove('visible');
  accountModalBackdrop.setAttribute('aria-hidden', 'true');
  activeEditUsername = '';
  if (accountForm) {
    accountForm.dataset.mode = 'create';
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

  if (!username || !password || !accountType || !fullName || !email) {
    alert('Please complete all required account fields.');
    return;
  }

  if (currentRole === 'Main Head Admin' && accountType === 'Super Admin') {
    alert('Main Head Admin cannot edit or save a Super Admin account.');
    return;
  }

  if (isEditMode && !['Super Admin', 'Main Head Admin'].includes(currentRole || '')) {
    try {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === (activeEditUsername || username));
      const previousType = String(account ? (account.accountType || account.role || account.userType || '') : '').trim();

      if (previousType && previousType !== accountType) {
        alert('Only Super Admin and Main Head Admin can change an account type.');
        return;
      }
    } catch (error) {
      console.error('Unable to validate account type change:', error);
      alert('Only Super Admin and Main Head Admin can change an account type.');
      return;
    }
  }

  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';

  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    alert('Please deploy the Apps Script and paste its Web App URL into gs/config.js before saving.');
    return;
  }

  const body = new URLSearchParams({
    action: isEditMode ? 'updateaccount' : 'accounts',
    username,
    password,
    accountType,
    fullName,
    email,
    branch,
    branchName: branch,
    accountBranch: branch,
    status: 'Active',
    createdAt: new Date().toISOString(),
    originalUsername: activeEditUsername || username
  }).toString();

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

    alert(isEditMode ? 'Account updated successfully.' : 'Account saved successfully to the spreadsheet.');
    closeAccountModal();
    loadAccounts();
  } catch (error) {
    console.error(error);
    alert('Account save failed. Please confirm the Apps Script Web App URL is correct.');
  }
}

async function deleteAccountFromSheet(username) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    alert('Please deploy the Apps Script and paste its Web App URL into gs/config.js before deleting.');
    return;
  }

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ action: 'deleteAccount', username }).toString()
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || (result && result.ok === false)) {
      const message = result && result.error ? result.error : 'Account delete failed';
      throw new Error(message);
    }

    alert('Account deleted successfully.');
    loadAccounts();
  } catch (error) {
    console.error(error);
    alert('Account delete failed. Please confirm the Apps Script URL is correct.');
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
    if (localStorage.getItem('unitflowRole') === 'Office') {
      return;
    }
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

if (accountForm) {
  accountForm.addEventListener('submit', saveAccountToSheet);
}

if (accountsTableBody) {
  accountsTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (localStorage.getItem('unitflowRole') === 'Office') {
      return;
    }

    const row = button.closest('tr');
    const username = row && row.dataset.accountUsername ? row.dataset.accountUsername : '';
    if (!username) return;

    if (button.classList.contains('edit')) {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === username);
      if (account) {
        const currentRole = localStorage.getItem('unitflowRole');
        const accountType = String(account.accountType || account.role || account.userType || '').trim();

        if (currentRole === 'Main Head Admin' && accountType === 'Super Admin') {
          alert('Main Head Admin cannot edit a Super Admin account.');
          return;
        }

        await loadBranchOptions();
        openAccountModal('edit', account);
      } else {
        alert('Account not found in the live spreadsheet.');
      }
    }

    if (button.classList.contains('delete')) {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((item) => String(item.username || item.userName || item.accountUsername || '').trim() === username);
      const accountType = account ? String(account.accountType || account.role || account.userType || '').trim() : '';
      const currentRole = localStorage.getItem('unitflowRole');

      if (currentRole === 'Main Head Admin' && accountType === 'Super Admin') {
        alert('Main Head Admin cannot delete a Super Admin account.');
        return;
      }

      const confirmed = window.confirm(`Delete account ${username}?`);
      if (!confirmed) return;
      await deleteAccountFromSheet(username);
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && accountModalBackdrop && accountModalBackdrop.classList.contains('visible')) {
    closeAccountModal();
  }
});

if (accountTypeSelect) {
  accountTypeSelect.addEventListener('change', applyAccountTypeOptions);
}

document.addEventListener('DOMContentLoaded', () => {
  applyAccountTypeOptions();
  loadAccounts();
});
