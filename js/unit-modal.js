const backdrop = document.getElementById('unitModalBackdrop');
const openBtn = document.getElementById('openUnitModalBtn');
const closeBtn = document.getElementById('closeUnitModalBtn');
const cancelBtn = document.getElementById('cancelUnitModalBtn');
const unitForm = document.getElementById('unitForm');
const unitSubmitButton = document.getElementById('saveUnitButton');
const unitRegistryTableBody = document.getElementById('unitRegistryTableBody');
const unitModalTitle = document.getElementById('unitModalTitle');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
const unitSearchInput = document.getElementById('unitSearchInput') || document.querySelector('.search-box input');
const currentLocationSelect = document.getElementById('currentLocation');
const unitRegistryTableWrap = document.querySelector('.table-wrap');
let activeEditCode = '';
let pendingConfirmAction = null;
let registryRowsCache = [];

function showPopupMessage(message, onConfirm = null) {
  if (!messageModalBackdrop || !messageModalBody) return alert(message);

  pendingConfirmAction = onConfirm || null;
  messageModalBody.textContent = message;
  messageModalBackdrop.classList.add('visible');
  messageModalBackdrop.setAttribute('aria-hidden', 'false');

  if (okMessageModalBtn) {
    okMessageModalBtn.textContent = onConfirm ? 'Yes' : 'OK';
  }
}

function closePopupMessage() {
  if (!messageModalBackdrop) return;
  pendingConfirmAction = null;
  if (okMessageModalBtn) {
    okMessageModalBtn.textContent = 'OK';
  }
  messageModalBackdrop.classList.remove('visible');
  messageModalBackdrop.setAttribute('aria-hidden', 'true');
}

function openUnitModal(mode = 'create', unit = null) {
  if (!backdrop) return;

  if (mode === 'edit' && unit) {
    activeEditCode = String(unit.unitCode || unit.code || '').trim();
    unitForm.dataset.mode = 'edit';
    if (unitModalTitle) unitModalTitle.textContent = 'Edit Unit';
    if (unitSubmitButton) unitSubmitButton.textContent = 'Update Unit';
    populateUnitForm(unit);

    const unitPriceField = unitForm.elements.namedItem('unitPrice');
    if (unitPriceField) {
      unitPriceField.hidden = false;
      unitPriceField.disabled = true;
      unitPriceField.setAttribute('readonly', 'readonly');
      unitPriceField.style.background = '#f4f6f8';
      unitPriceField.style.cursor = 'not-allowed';
    }

    const role = localStorage.getItem('unitflowRole');
    const savedBranch = String(unit.uploadedBranch || unit.branchLocation || unit.currentLocation || '').trim();
    const branchField = unitForm.elements.namedItem('branchLocation');

    if (branchField && savedBranch) {
      branchField.value = savedBranch;
      branchField.setAttribute('readonly', 'readonly');
    }
    setCurrentLocationOptions(savedBranch, unit.currentLocation || savedBranch);
  } else {
    activeEditCode = '';
    unitForm.dataset.mode = 'create';
    if (unitModalTitle) unitModalTitle.textContent = 'Add Unit';
    if (unitSubmitButton) unitSubmitButton.textContent = 'Save Unit';
    unitForm.reset();

    const unitPriceField = unitForm.elements.namedItem('unitPrice');
    if (unitPriceField) {
      unitPriceField.hidden = false;
      unitPriceField.disabled = false;
      unitPriceField.removeAttribute('readonly');
      unitPriceField.style.background = '';
      unitPriceField.style.cursor = '';
    }

    const role = localStorage.getItem('unitflowRole');
    const assignedBranch = String(localStorage.getItem('unitflowBranch') || '').trim();
    const branchField = unitForm.elements.namedItem('branchLocation');
    if (branchField) {
      branchField.value = assignedBranch;
      branchField.setAttribute('readonly', 'readonly');
    }
    setCurrentLocationOptions(assignedBranch, assignedBranch);
  }

  backdrop.classList.add('visible');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeUnitModal() {
  if (!backdrop) return;
  backdrop.classList.remove('visible');
  backdrop.setAttribute('aria-hidden', 'true');
  activeEditCode = '';
  if (unitForm) {
    unitForm.dataset.mode = 'create';
    unitForm.reset();
  }
  if (unitModalTitle) unitModalTitle.textContent = 'Add Unit';
  if (unitSubmitButton) unitSubmitButton.textContent = 'Save Unit';
}

function populateUnitForm(unit) {
  if (!unitForm) return;

  const inclusionValues = String(unit.inclusion || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const inclusionOptions = unitForm.querySelectorAll('input[name="inclusionOption"]');
  inclusionOptions.forEach((input) => {
    input.checked = inclusionValues.includes(input.value);
  });

  const inclusionHidden = document.getElementById('inclusion');
  if (inclusionHidden) {
    inclusionHidden.value = inclusionValues.join(', ');
  }

  const uploadedBranch = unit.uploadedBranch || unit.branchLocation || '';
  const savedCurrentLocation = unit.currentLocation || unit.branchLocation || uploadedBranch || '';

  const fields = {
    unitCode: unit.unitCode || unit.code || '',
    unitSpecs: unit.unitSpecs || unit.specs || '',
    unitBrand: unit.unitBrand || unit.brand || '',
    clientName: unit.clientName || '',
    warranty: unit.warranty || '',
    datePurchase: unit.dateReceived || unit.datePurchase || '',
    dateReturn: unit.dateReleased || unit.dateReturn || '',
    unitProblem: unit.unitProblem || unit.problem || '',
    status: unit.status || '',
    branchLocation: unit.branchLocation || unit.currentLocation || unit.uploadedBranch || '',
    currentLocation: savedCurrentLocation === uploadedBranch ? '__branch_location__' : savedCurrentLocation,
    uploadedBranch,
    unitPrice: unit.unitPrice || ''
  };

  Object.entries(fields).forEach(([key, value]) => {
    const field = unitForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  setCurrentLocationOptions(uploadedBranch, savedCurrentLocation);
}

function setCurrentLocationOptions(branchLocation, selectedLocation = '') {
  if (!currentLocationSelect) return;

  const locations = [branchLocation, 'BNB Rosales', 'Warehouse']
    .map((value) => String(value || '').trim())
    .filter((value, index, values) => {
      return value && values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index;
    });

  currentLocationSelect.innerHTML = locations.length
    ? locations.map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join('')
    : '<option value="">Select current location</option>';

  const selected = String(selectedLocation || '').trim();
  currentLocationSelect.value = locations.find((location) => location.toLowerCase() === selected.toLowerCase()) || locations[0] || '';
}

function syncInclusionField() {
  const options = unitForm.querySelectorAll('input[name="inclusionOption"]');
  const selectedValues = Array.from(options)
    .filter((input) => input.checked)
    .map((input) => input.value.trim())
    .filter(Boolean);

  const hiddenInput = document.getElementById('inclusion');
  if (hiddenInput) {
    hiddenInput.value = selectedValues.join(', ');
  }
}

function normalizeSavedUnitPayload(form) {
  const hidden = form.elements.namedItem('inclusion');
  const raw = Object.fromEntries(new FormData(form).entries());
  raw.inclusion = String(hidden ? hidden.value : '').trim();

  const role = localStorage.getItem('unitflowRole');
  const assignedBranch = String(localStorage.getItem('unitflowBranch') || '').trim();
  const branchFromRecord = String(raw.uploadedBranch || raw.branchLocation || '').trim();

  if (role === 'Branch Head Admin' && assignedBranch) {
    raw.branchLocation = assignedBranch;
    raw.uploadedBranch = assignedBranch;
  } else if (branchFromRecord) {
    raw.branchLocation = branchFromRecord;
    raw.uploadedBranch = branchFromRecord;
  }

  const branchLocation = String(raw.branchLocation || '').trim();
  const uploadedBranch = String(raw.uploadedBranch || raw.branchLocation || '').trim();
  const currentLocationValue = String(raw.currentLocation || '').trim();
  const currentLocation = currentLocationValue === '__branch_location__'
    ? uploadedBranch
    : currentLocationValue || uploadedBranch;
  const dateReceived = String(raw.datePurchase || raw.dateReceived || '').trim();
  const dateReleased = String(raw.dateReturn || raw.dateReleased || '').trim();

  return {
    action: 'units',
    unitCode: String(raw.unitCode || '').trim(),
    clientName: String(raw.clientName || '').trim(),
    unitBrand: String(raw.unitBrand || '').trim(),
    unitSpecs: String(raw.unitSpecs || '').trim(),
    unitPrice: String(raw.unitPrice || '').trim(),
    status: String(raw.status || '').trim(),
    branchLocation,
    currentLocation,
    dateReceived,
    dateReleased,
    warranty: String(raw.warranty || '').trim(),
    unitProblem: String(raw.unitProblem || '').trim(),
    inclusion: String(raw.inclusion || '').trim(),
    uploadedBranch
  };
}

async function saveUnitToSheet(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const config = window.GS_CONFIG || {};
  const sheetId = config.sheetId || '';
  const appScriptUrl = config.appScriptUrl || '';
  const role = localStorage.getItem('unitflowRole');
  const assignedBranch = String(localStorage.getItem('unitflowBranch') || '').trim();

  if (!sheetId || sheetId === 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE') {
    showPopupMessage('Please update the Google Sheet ID in gs/config.js before saving.');
    return;
  }

  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    showPopupMessage('Please deploy the Apps Script and paste its Web App URL into gs/config.js before saving.');
    return;
  }

  if (role === 'Branch Head Admin' && !assignedBranch) {
    showPopupMessage('This Branch Head Admin account has no assigned branch. Please assign a branch before adding a unit.');
    return;
  }

  const payload = normalizeSavedUnitPayload(form);
  const requestAction = form.dataset.mode === 'edit' ? 'updateUnit' : 'units';
  const body = new URLSearchParams({
    ...payload,
    action: requestAction,
    originalUnitCode: activeEditCode || payload.unitCode || ''
  }).toString();

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || (result && result.ok === false)) {
      const message = result && result.error ? result.error : await response.text().catch(() => '');
      throw new Error(message || `HTTP ${response.status}`);
    }

    showPopupMessage(form.dataset.mode === 'edit' ? 'Unit updated successfully to Google Sheets.' : 'Unit saved successfully to Google Sheets.');
    form.reset();
    closeUnitModal();

    if (typeof loadRegistryUnits === 'function') {
      await loadRegistryUnits();
      await DATA.fetchUnits();
    }
  } catch (error) {
    console.error('Save unit failed:', error);
    showPopupMessage('Save failed. Please confirm the Apps Script web app URL and Google Sheet ID are correct.');
  }
}

function initUnitModal() {
  if (openBtn) {
    openBtn.addEventListener('click', () => openUnitModal('create'));
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeUnitModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeUnitModal);
  }

  if (closeMessageModalBtn) {
    closeMessageModalBtn.addEventListener('click', closePopupMessage);
  }

  if (okMessageModalBtn) {
    okMessageModalBtn.addEventListener('click', async () => {
      if (pendingConfirmAction) {
        const action = pendingConfirmAction;
        pendingConfirmAction = null;
        okMessageModalBtn.textContent = 'OK';
        await action();
      }
      closePopupMessage();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) {
        closeUnitModal();
      }
    });
  }

  if (messageModalBackdrop) {
    messageModalBackdrop.addEventListener('click', (event) => {
      if (event.target === messageModalBackdrop) {
        closePopupMessage();
      }
    });
  }

  if (unitForm) {
    const inclusionOptions = unitForm.querySelectorAll('input[name="inclusionOption"]');

    inclusionOptions.forEach((option) => {
      option.addEventListener('change', () => {
        syncInclusionField();
      });
    });

    unitForm.addEventListener('submit', saveUnitToSheet);
  }

  if (unitSearchInput) {
    unitSearchInput.addEventListener('input', () => {
      renderRegistryTable(registryRowsCache);
    });
  }

  const exportButton = document.getElementById('exportUnitCsvBtn');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const role = localStorage.getItem('unitflowRole');
      const allowedRoles = ['Super Admin', 'Main Head Admin', 'Office'];

      if (!allowedRoles.includes(role || '')) {
        showPopupMessage('You do not have permission to export the unit registry.');
        return;
      }

      const rows = registryRowsCache || [];
      const searchTerm = normalizeSearchText(unitSearchInput ? unitSearchInput.value : '');
      const filteredRows = !searchTerm
        ? rows
        : rows.filter((unit) => {
            const unitCode = normalizeSearchText(unit.unitCode || unit.code || '');
            const clientName = normalizeSearchText(unit.clientName || '');
            return unitCode.includes(searchTerm) || clientName.includes(searchTerm);
          });

      if (!filteredRows.length) {
        showPopupMessage('There are no matching units to export.');
        return;
      }

      const headers = [
        'Unit Code',
        'Unit Specs',
        'Unit Price',
        'Unit Brand',
        'Client Name',
        'Warranty',
        'Date of Purchase',
        'Date of Return',
        'Running Days',
        'Unit Problem',
        'Status',
        'Branch Location',
        'Inclusion'
      ];

      const rowsCsv = filteredRows.map((unit) => [
        unit.unitCode || '',
        unit.specs || '',
        unit.unitPrice || '',
        unit.unitBrand || '',
        unit.clientName || '',
        unit.warranty || '',
        unit.dateReceived || unit.datePurchase || '',
        unit.dateReleased || unit.dateReturn || '',
        unit.runningDays || '',
        unit.unitProblem || '',
        unit.status || '',
        unit.uploadedBranch || unit.branchLocation || '',
        unit.inclusion || ''
      ]);

      const csvContent = [headers, ...rowsCsv]
        .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'unit-registry-export.csv';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showPopupMessage('Unit registry exported successfully.');
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop && backdrop.classList.contains('visible')) {
      closeUnitModal();
    }
  });

  if (unitRegistryTableBody) {
    unitRegistryTableBody.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      const row = button.closest('tr');
      const unitCode = (row && row.dataset.unitCode) ? row.dataset.unitCode : (row && row.cells && row.cells[0] ? row.cells[0].textContent.trim() : '');

      if (!unitCode || !row) return;

      if (button.classList.contains('edit')) {
        const rows = await DATA.fetchUnits();
        const unit = rows.find((item) => String(item.unitCode || '').trim() === unitCode) || rows.find((item) => String(item.code || '').trim() === unitCode) || rows.find((item) => String(item.unitCode || item.code || '').trim().toLowerCase() === unitCode.toLowerCase());
        if (unit) {
          openUnitModal('edit', unit);
        } else {
          showPopupMessage('Unit not found in the live spreadsheet.');
        }
      }

      if (button.classList.contains('delete')) {
        const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
        if (!appScriptUrl) {
          showPopupMessage('Please configure the Apps Script URL before deleting a unit.');
          return;
        }

        showPopupMessage(`Delete unit ${unitCode}?`, async () => {
          try {
            const response = await fetch(appScriptUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              body: new URLSearchParams({ action: 'deleteUnit', unitCode }).toString()
            });

            const result = await response.json().catch(() => null);

            if (!response.ok || (result && result.ok === false)) {
              const message = result && result.error ? result.error : await response.text().catch(() => '');
              throw new Error(message || `HTTP ${response.status}`);
            }

            showPopupMessage('Unit deleted successfully.');
            if (typeof loadRegistryUnits === 'function') {
              await loadRegistryUnits();
            }
          } catch (error) {
            console.error('Delete unit failed:', error);
            showPopupMessage('Delete failed. Please confirm the Apps Script URL is correct.');
          }
        });
      }
    });
  }

  if (typeof loadRegistryUnits === 'function') {
    loadRegistryUnits();
  }

  scheduleRegistryMidnightRefresh();
}

async function loadRegistryUnits() {
  if (!unitRegistryTableBody) return;

  try {
    const rows = await DATA.fetchUnits();
    registryRowsCache = Array.isArray(rows) ? rows : [];
    renderRegistryTable(registryRowsCache);
  } catch (error) {
    console.error(error);
    unitRegistryTableBody.innerHTML = '<tr><td colspan="14" class="empty-state">Unable to load live spreadsheet data.</td></tr>';
  }
}

function scheduleRegistryMidnightRefresh() {
  const now = new Date();
  const manilaDateKey = getManilaDateKey(now);
  const [year, month, day] = manilaDateKey.split('-').map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - (8 * 60 * 60 * 1000);
  const delayMs = Math.max(1000, nextMidnightUtc - now.getTime());

  setTimeout(() => {
    renderRegistryTable(registryRowsCache);
    scheduleRegistryMidnightRefresh();
  }, delayMs);
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function renderRegistryTable(rows) {
  if (!unitRegistryTableBody) return;

  const searchTerm = normalizeSearchText(unitSearchInput ? unitSearchInput.value : '');
  const filteredRows = !searchTerm
    ? rows
    : rows.filter((unit) => {
        const unitCode = normalizeSearchText(unit.unitCode || unit.code || '');
        const clientName = normalizeSearchText(unit.clientName || '');
        return unitCode.includes(searchTerm) || clientName.includes(searchTerm);
      });

  if (unitRegistryTableWrap) {
    unitRegistryTableWrap.classList.toggle('is-scrollable', rows.length > 5);
  }

  if (!filteredRows.length) {
    unitRegistryTableBody.innerHTML = '<tr><td colspan="14" class="empty-state">No matching units found.</td></tr>';
    return;
  }

  const currentRole = localStorage.getItem('unitflowRole');

  unitRegistryTableBody.innerHTML = filteredRows
    .map((unit) => {
      const code = unit.unitCode || '—';
      const specs = unit.specs || '—';
      const price = unit.unitPrice || '—';
      const brand = unit.unitBrand || unit.unitBrandName || unit.brand || '—';
      const client = unit.clientName || '—';
      const warranty = unit.warranty || '—';
      const datePurchase = formatDateDisplay(unit.dateReceived || unit.datePurchase || '');
      const dateReturn = formatDateDisplay(unit.dateReleased || unit.dateReturn || '');
      const runningDays = computeRunningDays(unit.dateReleased || unit.dateReturn || unit.dateReceived) || '—';
      const problem = unit.unitProblem || unit.problem || '—';
      const status = unit.status || 'Unknown';
      const branch = unit.uploadedBranch || unit.branchLocation || unit.currentLocation || '—';
      const inclusion = unit.inclusion || '—';
      const isOfficeRole = currentRole === 'Office';

      return `
        <tr data-unit-code="${escapeHtml(code)}">
          <td><span class="center-stack">${renderStackedText(code)}</span></td>
          <td>${escapeHtml(specs)}</td>
          <td><span class="center-stack">${renderStackedText(price ? formatCurrency(price) : '—')}</span></td>
          <td>${escapeHtml(brand)}</td>
          <td>${escapeHtml(client)}</td>
          <td><span class="center-stack">${renderStackedText(warranty)}</span></td>
          <td><span class="center-stack">${renderStackedText(datePurchase)}</span></td>
          <td><span class="center-stack">${renderStackedText(dateReturn)}</span></td>
          <td><span class="center-stack">${renderStackedText(runningDays)}</span></td>
          <td>${escapeHtml(problem)}</td>
          <td><span class="badge ${statusClass(status)}"><span class="center-stack">${renderStackedText(status)}</span></span></td>
          <td><span class="branch-tag ${branchClass(branch)}"><span class="center-stack">${renderBranchLocation(branch)}</span></span></td>
          <td><span class="center-stack">${renderInclusionText(inclusion)}</span></td>
          <td class="table-actions">
            ${isOfficeRole ? '<span class="view-only">View only</span>' : '<button class="edit">Edit</button><button class="delete">Delete</button>'}
          </td>
        </tr>
      `;
    })
    .join('');
}

function formatDateDisplay(value) {
  if (!value) return '—';

  const trimmed = String(value).trim();
  if (!trimmed) return '—';

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return trimmed;
  }

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

function renderStackedText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '—') return '—';
  return text
    .split(/\s+/)
    .map((word) => `<span class="line">${escapeHtml(word)}</span>`)
    .join('');
}

function renderBranchLocation(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '—') return '—';

  const cleaned = text.replace(/\s*[\/|,-]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^([A-Za-z0-9]+)\s+(.+)$/);

  if (match) {
    const code = match[1].trim();
    const location = match[2].trim();
    return `<span class="line">${escapeHtml(code)}</span><span class="line">${escapeHtml(location)}</span>`;
  }

  return `<span class="line">${escapeHtml(cleaned)}</span>`;
}

function renderInclusionText(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '—') return '—';

  const items = text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (!items.length) return '—';

  return items
    .map((item) => `<span class="line">${escapeHtml(item)}</span>`)
    .join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusClass(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized.includes('urgent')) return 'urgent';
  if (normalized.includes('observation')) return 'observation';
  if (normalized.includes('released')) return 'released';
  if (normalized.includes('returned')) return 'returned';
  if (normalized.includes('pending')) return 'pending-return';

  return 'in-stock';
}

function branchClass(branch) {
  const normalized = String(branch || '').toLowerCase();

  if (normalized.includes('bnb')) return 'bnb';
  if (normalized.includes('ez')) return 'ez';
  if (normalized.includes('1lr')) return 'one-lr';

  return 'bnb';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUnitModal);
} else {
  initUnitModal();
}

function formatCurrency(value) {
  const cleaned = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(cleaned)) return value || '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(cleaned);
}
