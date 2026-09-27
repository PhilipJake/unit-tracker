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
const branchesSearchInput = document.getElementById('branchesSearchInput');
const branchTypeFilter = document.getElementById('branchTypeFilter');
const branchStatusFilter = document.getElementById('branchStatusFilter');
const branchResultCount = document.getElementById('branchResultCount');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
let activeEditBranchName = '';
let activeBranchRecord = null;
let pendingConfirmAction = null;
let loadedBranches = [];
const builtInBranchTypeOrder = ['BNB', 'EZ', '1LR'];

function getBranchTypeLabel(type) {
  const definition = getBranchTypeDefinitions().find((item) => item.code.toUpperCase() === String(type).toUpperCase());
  return definition && definition.fullName ? `${type} — ${definition.fullName}` : type;
}

function getBranchTypeColor(type) {
  const definition = getBranchTypeDefinitions().find((item) => item.code.toUpperCase() === String(type).toUpperCase());
  return normalizeHexColor(definition && definition.color);
}

function renderBranchTypeOptions() {
  if (!branchTypeSelect) return;
  const selectedType = branchTypeSelect.value;
  const types = [...new Set([
    ...getBranchTypeDefinitions().map((definition) => definition.code),
    ...loadedBranches.map(getBranchType).filter(Boolean)
  ])].sort((first, second) => getBranchTypeOrder(first) - getBranchTypeOrder(second) || first.localeCompare(second));
  branchTypeSelect.replaceChildren(new Option('Select branch type', ''));
  types.forEach((type) => branchTypeSelect.add(new Option(getBranchTypeLabel(type), type)));
  branchTypeSelect.value = types.includes(selectedType) ? selectedType : '';
}

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
    loadedBranches = await DATA.fetchBranches();
    renderBranchTypeOptions();
    renderBranchTypeFilter();
    renderBranchesDirectory();
  } catch (error) {
    console.error(error);
    branchesTableBody.innerHTML = '<div class="member-list-empty">Unable to load branches. Check the Branches sheet configuration.</div>';
  }
}

function getBranchName(row) {
  return String(row.branchName || row.branchname || row.name || '').trim();
}

function getBranchType(row) {
  const branchName = getBranchName(row);
  return String(row.branchType || row.branchtype || row.type || branchName.split(/\s+/)[0] || 'Other').trim();
}

function getBranchTypeOrder(type) {
  const index = builtInBranchTypeOrder.indexOf(type.toUpperCase());
  return index < 0 ? builtInBranchTypeOrder.length : index;
}

function renderBranchTypeFilter() {
  if (!branchTypeFilter) return;
  const selectedType = branchTypeFilter.value || 'all';
  const types = [...new Set(loadedBranches.map(getBranchType).filter(Boolean))]
    .concat(getBranchTypeDefinitions().map((definition) => definition.code))
    .filter((type, index, allTypes) => allTypes.indexOf(type) === index)
    .sort((first, second) => getBranchTypeOrder(first) - getBranchTypeOrder(second) || first.localeCompare(second));
  branchTypeFilter.replaceChildren(new Option('All types', 'all'));
  types.forEach((type) => branchTypeFilter.add(new Option(getBranchTypeLabel(type), type)));
  branchTypeFilter.value = types.includes(selectedType) ? selectedType : 'all';
}

function getBranchInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : (words[0] || '?').slice(0, 2)).toUpperCase();
}

function renderBranchesDirectory() {
  if (!branchesTableBody) return;
  const query = String(branchesSearchInput?.value || '').trim().toLowerCase();
  const selectedType = branchTypeFilter?.value || 'all';
  const selectedStatus = branchStatusFilter?.value || 'all';
  const currentRole = localStorage.getItem('unitflowRole');
  const filteredBranches = loadedBranches.filter((row) => {
    const branchName = getBranchName(row);
    const branchType = getBranchType(row);
    const location = String(row.location || row.branchLocation || row.branchlocation || '').trim();
    const manager = String(row.manager || row.branchManager || row.headAdmin || row.headadmin || row.head || '').trim();
    const status = String(row.status || 'Active').trim();
    const searchable = [branchName, branchType, location, manager, status].join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (selectedType === 'all' || branchType === selectedType)
      && (selectedStatus === 'all' || normalizeBranchStatus(status) === selectedStatus);
  });

  branchResultCount.textContent = `${filteredBranches.length} ${filteredBranches.length === 1 ? 'branch' : 'branches'}`;
  if (!filteredBranches.length) {
    branchesTableBody.innerHTML = `<div class="member-list-empty">${loadedBranches.length ? 'No branches match these filters.' : 'No branches found in the Branches sheet.'}</div>`;
    return;
  }

  const branchTypes = [...new Set(filteredBranches.map(getBranchType))]
    .sort((first, second) => getBranchTypeOrder(first) - getBranchTypeOrder(second) || first.localeCompare(second));
  const canEdit = canManageAction('edit', currentRole);
  const canDelete = canManageAction('delete', currentRole);
  branchesTableBody.innerHTML = branchTypes.map((type) => {
    const groupBranches = filteredBranches.filter((row) => getBranchType(row) === type);
    const rows = groupBranches.map((row) => {
      const branchName = getBranchName(row);
      const location = String(row.location || row.branchLocation || row.branchlocation || '').trim();
      const manager = String(row.manager || row.branchManager || row.headAdmin || row.headadmin || row.head || '').trim();
      const status = String(row.status || 'Active').trim();
      const isActive = !['inactive', 'disabled', 'deactivated'].includes(normalizeBranchStatus(status));
      const details = [location, manager ? `Manager: ${manager}` : ''].filter(Boolean).map(escapeHtml);
      return `
        <article class="account-member-row branch-directory-row" data-branch-name="${escapeHtml(branchName)}">
          <div class="account-member-avatar" aria-hidden="true">${escapeHtml(getBranchInitials(branchName || type))}</div>
          <div class="account-member-identity">
            <strong>${escapeHtml(branchName || 'Unnamed branch')}</strong>
            <span>${details.length ? details.join('<span class="member-meta-separator">·</span>') : 'No location or manager listed'}</span>
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
      <section class="account-role-group branch-type-group" aria-label="${escapeHtml(type)} branches">
        <header><span class="branch-type-label"><i aria-hidden="true" style="background-color: ${getBranchTypeColor(type)}"></i>${escapeHtml(getBranchTypeLabel(type))}</span><span>${groupBranches.length}</span></header>
        <div>${rows}</div>
      </section>
    `;
  }).join('');
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

if (branchesSearchInput) branchesSearchInput.addEventListener('input', renderBranchesDirectory);
if (branchTypeFilter) branchTypeFilter.addEventListener('change', renderBranchesDirectory);
if (branchStatusFilter) branchStatusFilter.addEventListener('change', renderBranchesDirectory);

if (branchesTableBody) {
  branchesTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    if (localStorage.getItem('unitflowRole') === 'Office') {
      return;
    }

    const row = button.closest('.branch-directory-row');
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
  renderBranchTypeOptions();
  loadBranchTypeDefinitions().then(() => {
    renderBranchTypeOptions();
    renderBranchTypeFilter();
  });
  loadBranches();
  loadHeadAdminOptions();
});
