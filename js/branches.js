const branchesTableBody = document.getElementById('branchesTableBody');
const branchModalBackdrop = document.getElementById('branchModalBackdrop');
const openBranchModalBtn = document.getElementById('openBranchModalBtn');
const closeBranchModalBtn = document.getElementById('closeBranchModalBtn');
const cancelBranchModalBtn = document.getElementById('cancelBranchModalBtn');
const branchForm = document.getElementById('branchForm');
const branchTypeSelect = document.getElementById('branchType');
const branchLocationInput = document.getElementById('branchLocation');
const branchNameInput = document.getElementById('branchName');
const branchModalTitle = document.getElementById('branchModalTitle');
const branchSubmitButton = document.getElementById('saveBranchButton');
const headAdminSelect = document.getElementById('headAdminSelect');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
let activeEditBranchName = '';
let activeBranchRecord = null;
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

async function loadBranches() {
  try {
    const rows = await DATA.fetchBranches();

    if (!rows.length) {
      branchesTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No branches found in the Branches sheet.</td></tr>';
      return;
    }

    const currentRole = localStorage.getItem('unitflowRole');
    branchesTableBody.innerHTML = rows
      .map((row) => {
        const branchName = row.branchName || row.branchname || row.name || '';
        const manager = row.manager || row.branchManager || row.headAdmin || row.headadmin || row.head || '';
        const status = row.status || 'Active';

        const badgeClass = normalizeBranchStatus(status) === 'inactive' ? 'released' : 'in-stock';

        const canEdit = canManageAction('edit', currentRole);
        const canDelete = canManageAction('delete', currentRole);

        return `
          <tr data-branch-name="${escapeHtml(branchName)}">
            <td>${escapeHtml(branchName || '—')}</td>
            <td class="branch-manager-cell">${escapeHtml(manager || '—')}</td>
            <td class="branch-status-cell"><span class="badge ${badgeClass}">${escapeHtml(status || 'Active')}</span></td>
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
    branchesTableBody.innerHTML = '<tr><td colspan="4" class="empty-state">Unable to load branches from the spreadsheet. Please check the Branches sheet and Google Sheet ID.</td></tr>';
  }
}

async function loadHeadAdminOptions() {
  if (!headAdminSelect) return;

  try {
    const accounts = await DATA.fetchAccounts();
    const filtered = accounts.filter((row) => {
      const role = String(row.accountType || row.accounttype || row.role || row.userType || '').trim();
      return role && !['Super Admin', 'Office'].includes(role);
    });

    if (!filtered.length) {
      headAdminSelect.innerHTML = '<option value="">No head admin assigned</option>';
      return;
    }

    headAdminSelect.innerHTML = filtered
      .map((account) => {
        const name = account.fullName || account.fullname || account.name || account.username || account.userName || 'Unknown';
        const role = account.accountType || account.accounttype || account.role || account.userType || 'Account';
        return `<option value="${escapeHtml(name)}">${escapeHtml(name)}${role ? ` — ${escapeHtml(role)}` : ''}</option>`;
      })
      .join('');

    headAdminSelect.insertAdjacentHTML('beforeend', '<option value="">Select head admin</option>');
    headAdminSelect.value = '';
  } catch (error) {
    console.error(error);
    headAdminSelect.innerHTML = '<option value="">Unable to load head admins</option>';
  }
}

function syncBranchName() {
  if (!branchTypeSelect || !branchLocationInput || !branchNameInput) return;

  const branchType = String(branchTypeSelect.value || '').trim();
  const location = String(branchLocationInput.value || '').trim();

  if (!branchType && !location) {
    branchNameInput.value = '';
    return;
  }

  const cleanedLocation = location
    .replace(/\s+/g, ' ')
    .trim();

  if (!branchType || !cleanedLocation) {
    branchNameInput.value = branchType ? `${branchType}` : '';
    return;
  }

  branchNameInput.value = `${branchType} ${cleanedLocation}`;
  branchNameInput.setAttribute('readonly', 'readonly');
}

function openBranchModal(mode = 'create', branch = null) {
  if (!branchModalBackdrop) return;

  const currentRole = localStorage.getItem('unitflowRole');
  if (!canManageAction(mode === 'edit' ? 'edit' : 'create', currentRole)) {
    return;
  }

  activeBranchRecord = branch || null;

  if (mode === 'edit' && branch) {
    activeEditBranchName = String(branch.branchName || branch.branchname || branch.name || '').trim();
    branchForm.dataset.mode = 'edit';
    if (branchModalTitle) branchModalTitle.textContent = 'Edit Branch';
    if (branchSubmitButton) branchSubmitButton.textContent = 'Update Branch';
    populateBranchForm(branch);
  } else {
    activeEditBranchName = '';
    branchForm.dataset.mode = 'create';
    if (branchModalTitle) branchModalTitle.textContent = 'Add Branch';
    if (branchSubmitButton) branchSubmitButton.textContent = 'Save Branch';
    if (branchForm) branchForm.reset();
  }

  if (branchTypeSelect) {
    branchTypeSelect.disabled = branchForm && branchForm.dataset.mode === 'edit';
  }
  if (branchLocationInput) {
    branchLocationInput.readOnly = !!(branchForm && branchForm.dataset.mode === 'edit');
  }

  branchModalBackdrop.classList.add('visible');
  branchModalBackdrop.setAttribute('aria-hidden', 'false');
  syncBranchName();
  loadHeadAdminOptions();
}

function closeBranchModal() {
  if (!branchModalBackdrop) return;
  branchModalBackdrop.classList.remove('visible');
  branchModalBackdrop.setAttribute('aria-hidden', 'true');
  activeEditBranchName = '';
  activeBranchRecord = null;
  if (branchForm) {
    branchForm.dataset.mode = 'create';
    branchForm.reset();
  }
  if (branchTypeSelect) {
    branchTypeSelect.disabled = false;
  }
  if (branchLocationInput) {
    branchLocationInput.readOnly = false;
  }
  if (branchModalTitle) branchModalTitle.textContent = 'Add Branch';
  if (branchSubmitButton) branchSubmitButton.textContent = 'Save Branch';
}

function populateBranchForm(branch) {
  if (!branchForm) return;

  const formData = new FormData(branchForm);
  const fields = {
    branchType: branch.branchCode || branch.branchcode || branch.branchType || branch.branchtype || branch.code || '',
    branchName: branch.branchName || branch.branchname || branch.name || '',
    branchLocation: branch.location || branch.branchLocation || branch.address || '',
    headAdminSelect: branch.manager || branch.branchManager || branch.headAdmin || branch.headadmin || branch.head || ''
  };

  Object.entries(fields).forEach(([key, value]) => {
    const field = branchForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  if (branchNameInput) {
    branchNameInput.value = fields.branchName;
    branchNameInput.setAttribute('readonly', 'readonly');
  }
}

async function saveBranchToSheet(event) {
  event.preventDefault();

  if (!branchForm) return;

  const formData = new FormData(branchForm);
  const branchTypeFromForm = String(formData.get('branchType') || '').trim();
  const branchLocationFromForm = String(formData.get('branchLocation') || '').trim();
  const headAdminFromForm = String(formData.get('headAdminSelect') || '').trim();

  const branchType = branchTypeFromForm || (activeBranchRecord && (activeBranchRecord.branchCode || activeBranchRecord.branchcode || activeBranchRecord.branchType || activeBranchRecord.branchtype || activeBranchRecord.code)) || '';
  const branchName = String(formData.get('branchName') || '').trim();
  const branchLocation = branchLocationFromForm || (activeBranchRecord && (activeBranchRecord.location || activeBranchRecord.branchLocation || activeBranchRecord.address)) || '';
  const headAdmin = headAdminFromForm || (activeBranchRecord && (activeBranchRecord.manager || activeBranchRecord.branchManager || activeBranchRecord.headAdmin || activeBranchRecord.headadmin || activeBranchRecord.head)) || '';
  const isEditMode = branchForm.dataset.mode === 'edit';

  if (!canManageAction(isEditMode ? 'edit' : 'create', localStorage.getItem('unitflowRole'))) {
    showPopupMessage(`You do not have permission to ${isEditMode ? 'edit' : 'create'} branches.`);
    return;
  }

  if (!branchType || !branchName || !branchLocation) {
    showPopupMessage('Please complete the branch type, name, and location.');
    return;
  }

  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';

  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    showPopupMessage('Please deploy the Apps Script and paste its Web App URL into gs/config.js before saving.');
    return;
  }

  const body = new URLSearchParams({
    action: isEditMode ? 'updateBranch' : 'branches',
    branchType,
    branchName,
    branchCode: branchType,
    location: branchLocation,
    manager: headAdmin,
    status: 'Active',
    originalBranchName: activeEditBranchName || branchName
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
      const message = result && result.error ? result.error : 'Branch save failed';
      throw new Error(message);
    }

    await syncAccountBranchAssignment(headAdmin, branchName);

    showPopupMessage(isEditMode ? 'Branch updated successfully to the spreadsheet.' : 'Branch saved successfully to the spreadsheet.');
    closeBranchModal();
    loadBranches();
  } catch (error) {
    console.error(error);
    showPopupMessage('Branch save failed. Please confirm the Apps Script Web App URL is correct.');
  }
}

async function syncAccountBranchAssignment(accountName, branchName) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    return;
  }

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        action: 'updateAccountBranch',
        fullName: accountName,
        branch: branchName
      }).toString()
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || (result && result.ok === false)) {
      console.warn('Account branch sync failed:', result || response.statusText);
    }
  } catch (error) {
    console.warn('Account branch sync request failed:', error);
  }
}

function normalizeBranchStatus(value) {
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

if (openBranchModalBtn) {
  openBranchModalBtn.addEventListener('click', () => {
    const currentRole = localStorage.getItem('unitflowRole');
    if (!canManageAction('create', currentRole)) return;
    openBranchModal('create');
  });
}

if (closeBranchModalBtn) {
  closeBranchModalBtn.addEventListener('click', closeBranchModal);
}

if (cancelBranchModalBtn) {
  cancelBranchModalBtn.addEventListener('click', closeBranchModal);
}

if (branchModalBackdrop) {
  branchModalBackdrop.addEventListener('click', (event) => {
    if (event.target === branchModalBackdrop) {
      closeBranchModal();
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

if (branchTypeSelect) {
  branchTypeSelect.addEventListener('change', syncBranchName);
}

if (branchLocationInput) {
  branchLocationInput.addEventListener('input', syncBranchName);
}

if (branchForm) {
  branchForm.addEventListener('submit', saveBranchToSheet);
}

if (branchesTableBody) {
  branchesTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (localStorage.getItem('unitflowRole') === 'Office') {
      return;
    }

    const row = button.closest('tr');
    const branchName = row && row.dataset.branchName ? row.dataset.branchName : '';
    if (!branchName) return;

    if (button.classList.contains('edit')) {
      const rows = await DATA.fetchBranches();
      const branch = rows.find((item) => String(item.branchName || item.branchname || item.name || '').trim() === branchName);
      if (branch) {
        openBranchModal('edit', branch);
      } else {
        showPopupMessage('Branch not found in the live spreadsheet.');
      }
    }

    if (button.classList.contains('delete')) {
      showPopupMessage(`Delete branch ${branchName}?`, async () => {
        const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
        if (!appScriptUrl) {
          showPopupMessage('Please configure the Apps Script URL before deleting a branch.');
          return;
        }

        try {
          const response = await fetch(appScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'deleteBranch', branchName }).toString()
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || (result && result.ok === false)) {
            throw new Error(result && result.error ? result.error : 'Branch delete failed');
          }
          showPopupMessage('Branch deleted successfully.');
          loadBranches();
        } catch (error) {
          console.error('Delete branch failed:', error);
          showPopupMessage('Delete failed. Please confirm the Apps Script URL is correct.');
        }
      });
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && messageModalBackdrop && messageModalBackdrop.classList.contains('visible')) {
    closePopupMessage();
    return;
  }

  if (event.key === 'Escape' && branchModalBackdrop && branchModalBackdrop.classList.contains('visible')) {
    closeBranchModal();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  loadBranches();
  loadHeadAdminOptions();
});
