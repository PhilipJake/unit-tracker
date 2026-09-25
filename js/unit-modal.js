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
const unitStatusFilter = document.getElementById('unitStatusFilter');
const currentLocationSelect = document.getElementById('currentLocation');
const technicianNotesField = document.getElementById('technicianNotes');
const urgentField = document.getElementById('isUrgent');
const dateReleasedField = document.getElementById('dateReleased');
const otherInclusionOption = document.getElementById('otherInclusionOption');
const otherInclusionText = document.getElementById('otherInclusionText');
const unitRegistryTableWrap = document.querySelector('.table-wrap');
const unitToast = document.getElementById('unitToast');
let activeEditCode = '';
let activeEditRowIndex = null;
let pendingConfirmAction = null;
let registryRowsCache = [];
let unitToastTimer = null;
const contactInfoPrefix = '+63 ';

function formatContactInfoValue(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '').replace(/^63/, '').slice(0, 10);
  return `${contactInfoPrefix}${digits}`;
}

function showPopupMessage(message, onConfirm = null) {
  if (!messageModalBackdrop || !messageModalBody) return showAppPopup(message, onConfirm);

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

function showUnitToast(message) {
  if (!unitToast) return;
  unitToast.textContent = message;
  unitToast.classList.add('visible');
  window.clearTimeout(unitToastTimer);
  unitToastTimer = window.setTimeout(() => unitToast.classList.remove('visible'), 4000);
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
    setTechnicianNotesAccess(unit.technicianNotes || '');
    setUrgentAccess(unit.isUrgent || unit.urgent || '');
  } else {
    activeEditCode = '';
    unitForm.dataset.mode = 'create';
    if (unitModalTitle) unitModalTitle.textContent = 'Add Unit';
    if (unitSubmitButton) unitSubmitButton.textContent = 'Save Unit';
    unitForm.reset();
    syncOtherInclusionField();
    const contactInfoField = unitForm.elements.namedItem('contactInfo');
    if (contactInfoField) contactInfoField.value = contactInfoPrefix;

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
    setTechnicianNotesAccess('');
    setUrgentAccess('');
  }

  backdrop.classList.add('visible');
  backdrop.setAttribute('aria-hidden', 'false');
}

function closeUnitModal() {
  if (!backdrop) return;
  backdrop.classList.remove('visible');
  backdrop.setAttribute('aria-hidden', 'true');
  activeEditCode = '';
  activeEditRowIndex = null;
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
    input.checked = input.value === 'Other'
      ? inclusionValues.some((value) => /^other(?::|$)/i.test(value))
      : inclusionValues.includes(input.value);
  });

  const inclusionHidden = document.getElementById('inclusion');
  if (inclusionHidden) {
    inclusionHidden.value = inclusionValues
      .filter((value) => !/^other(?::|$)/i.test(value))
      .concat(inclusionValues.find((value) => /^other(?::|$)/i.test(value)) ? ['Other'] : [])
      .join(', ');
  }
  const otherValue = inclusionValues.find((value) => /^other(?::|$)/i.test(value));
  if (otherInclusionText) otherInclusionText.value = otherValue ? otherValue.replace(/^other:\s*/i, '') : '';
  syncOtherInclusionField();

  const uploadedBranch = unit.uploadedBranch || unit.branchLocation || '';
  const savedCurrentLocation = unit.currentLocation || unit.branchLocation || uploadedBranch || '';

  const fields = {
    unitCode: unit.unitCode || unit.code || '',
    unitSpecs: unit.unitSpecs || unit.specs || '',
    unitBrand: unit.unitBrand || unit.brand || '',
    clientName: unit.clientName || '',
    contactInfo: unit.contactInfo || '',
    warranty: unit.warranty || '',
    datePurchase: unit.dateReceived || unit.datePurchase || '',
    dateReturn: unit.dateReturn || '',
    dateReleased: unit.dateReleased || '',
    unitProblem: unit.unitProblem || unit.problem || '',
    technicianNotes: unit.technicianNotes || '',
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

  const contactInfoField = unitForm.elements.namedItem('contactInfo');
  if (contactInfoField) {
    contactInfoField.value = formatContactInfoValue(unit.contactInfo || '');
  }

  setCurrentLocationOptions(uploadedBranch, savedCurrentLocation);
}

function setTechnicianNotesAccess(value) {
  if (!technicianNotesField) return;

  const role = localStorage.getItem('unitflowRole');
  const canEdit = ['Technician', 'Administrator', 'Super Admin'].includes(role);
  technicianNotesField.value = value;
  technicianNotesField.readOnly = !canEdit;
  technicianNotesField.setAttribute('aria-readonly', String(!canEdit));
  technicianNotesField.style.background = canEdit ? '' : '#f4f6f8';
  technicianNotesField.style.cursor = canEdit ? '' : 'not-allowed';
}

function setUrgentAccess(value) {
  if (!urgentField) return;
  const isUrgent = ['true', '1', 'yes', 'urgent'].includes(String(value).trim().toLowerCase());
  urgentField.checked = isUrgent;
  urgentField.disabled = unitForm.dataset.mode === 'edit' && isUrgent;
  urgentField.setAttribute('aria-disabled', String(urgentField.disabled));
}

function setCurrentLocationOptions(branchLocation, selectedLocation = '') {
  if (!currentLocationSelect) return;

  const locations = [branchLocation, 'Technical Hub', 'Warehouse']
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

  if (otherInclusionOption && otherInclusionOption.checked) {
    const specification = String(otherInclusionText ? otherInclusionText.value : '').trim();
    const otherIndex = selectedValues.indexOf('Other');
    if (otherIndex >= 0) selectedValues[otherIndex] = specification ? `Other: ${specification}` : 'Other';
  }
  const hiddenInput = document.getElementById('inclusion');
  if (hiddenInput) {
    hiddenInput.value = selectedValues.join(', ');
  }

}

function syncOtherInclusionField() {
  if (!otherInclusionOption || !otherInclusionText) return;
  otherInclusionText.hidden = !otherInclusionOption.checked;
  otherInclusionText.required = otherInclusionOption.checked;
  if (!otherInclusionOption.checked) otherInclusionText.value = '';
  syncInclusionField();
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
  const dateReturn = String(raw.dateReturn || '').trim();
  const dateReleased = String(raw.dateReleased || '').trim();

  return {
    action: 'units',
    unitCode: String(raw.unitCode || '').trim(),
    clientName: String(raw.clientName || '').trim(),
    contactInfo: String(raw.contactInfo || '').replace(/\s+/g, '').trim().replace(/^\+63$/, ''),
    unitBrand: String(raw.unitBrand || '').trim(),
    unitSpecs: String(raw.unitSpecs || '').trim(),
    unitPrice: String(raw.unitPrice || '').trim(),
    status: String(raw.status || '').trim(),
    branchLocation,
    currentLocation,
    dateReceived,
    dateReturn,
    dateReleased,
    warranty: String(raw.warranty || '').trim(),
    unitProblem: String(raw.unitProblem || '').trim(),
    inclusion: String(raw.inclusion || '').trim(),
    technicianNotes: String(raw.technicianNotes || '').trim(),
    isUrgent: urgentField && urgentField.checked ? 'TRUE' : '',
    actorRole: role || '',
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
    showPopupMessage('Please update the spreadsheet ID in gs/config.js before saving.');
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
    originalUnitCode: activeEditCode || payload.unitCode || '',
    originalRowIndex: activeEditRowIndex === null ? '' : String(activeEditRowIndex)
  }).toString();

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body
    });

    const responseText = await response.text();
    let result = null;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      result = null;
    }

    if (!response.ok || (result && result.ok === false)) {
      const message = result && result.error ? result.error : responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(message || `HTTP ${response.status}`);
    }

    showPopupMessage(form.dataset.mode === 'edit' ? 'Unit updated successfully' : 'Unit saved successfully');
    form.reset();
    closeUnitModal();

    if (typeof loadRegistryUnits === 'function') {
      await loadRegistryUnits();
    }
  } catch (error) {
    console.error('Save unit failed:', error);
    showPopupMessage(`Save failed: ${error.message || 'Unknown Apps Script error'}`);
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
    const contactInfoInput = unitForm.elements.namedItem('contactInfo');

    if (contactInfoInput) {
      contactInfoInput.addEventListener('input', () => {
        contactInfoInput.value = formatContactInfoValue(contactInfoInput.value);
      });

      contactInfoInput.addEventListener('focus', () => {
        if (!contactInfoInput.value) contactInfoInput.value = contactInfoPrefix;
      });
    }

    inclusionOptions.forEach((option) => {
      option.addEventListener('change', () => {
        if (option === otherInclusionOption) syncOtherInclusionField();
        else syncInclusionField();
      });
    });
    if (otherInclusionText) otherInclusionText.addEventListener('input', syncInclusionField);

    unitForm.addEventListener('submit', saveUnitToSheet);
  }

  if (unitSearchInput) {
    unitSearchInput.addEventListener('input', () => {
      renderRegistryTable(registryRowsCache);
    });
  }

  if (unitStatusFilter) {
    unitStatusFilter.value = 'all';
    unitStatusFilter.addEventListener('change', () => {
      renderRegistryTable(registryRowsCache);
    });
  }

  const exportButton = document.getElementById('exportUnitCsvBtn');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const role = localStorage.getItem('unitflowRole');
      if (!canManageAction('export', role)) {
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
        'Branch Location',
        'Unit Code',
        'Unit Specs',
        'Unit Price',
        'Unit Brand',
        'Client Name',
        'Contact Info',
        'Warranty',
        'Date Purchased',
        'Date of Return',
        'Date Released',
        'Running Days',
        'Unit Problem',
        'Status',
        'Inclusion',
        'Technician Notes'
      ];

      const rowsCsv = filteredRows.map((unit) => [
        unit.uploadedBranch || unit.branchLocation || unit.currentLocation || '',
        unit.unitCode || '',
        unit.specs || '',
        unit.unitPrice || '',
        unit.unitBrand || '',
        unit.clientName || '',
        unit.contactInfo || '',
        unit.warranty || '',
        unit.dateReceived || unit.datePurchase || '',
        unit.dateReturn || '',
        unit.dateReleased || '',
        unit.runningDays || '',
        unit.unitProblem || '',
        unit.status || '',
        unit.inclusion || '',
        unit.technicianNotes || ''
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

      const currentRole = localStorage.getItem('unitflowRole');
      if (button.classList.contains('edit') && !canManageAction('edit', currentRole)) return;
      if (button.classList.contains('delete') && !canManageAction('delete', currentRole)) return;

      if (button.classList.contains('edit')) {
        const rows = await DATA.fetchUnits();
        const selectedRowIndex = Number(row.dataset.rowIndex);
        const unit = Number.isInteger(selectedRowIndex) && selectedRowIndex >= 0
          ? rows[selectedRowIndex]
          : rows.find((item) => String(item.unitCode || '').trim() === unitCode) || rows.find((item) => String(item.code || '').trim() === unitCode) || rows.find((item) => String(item.unitCode || item.code || '').trim().toLowerCase() === unitCode.toLowerCase());
        if (unit) {
          activeEditRowIndex = Number.isInteger(selectedRowIndex) && selectedRowIndex >= 0 ? selectedRowIndex : null;
          openUnitModal('edit', unit);
        } else {
          showPopupMessage('Unit not found in the live spreadsheet.');
        }
      }

      if (button.classList.contains('release')) {
        if (!canManageAction('release', currentRole)) return;
        const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
        if (!appScriptUrl) {
          showPopupMessage('Please configure the Apps Script URL before releasing a unit.');
          return;
        }

        showPopupMessage(`Mark unit ${unitCode} as Released?`, async () => {
          try {
            const response = await fetch(appScriptUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
              body: new URLSearchParams({ action: 'releaseUnit', unitCode, actorRole: currentRole || '', actorName: getLoggedInUserName() }).toString()
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || (result && result.ok === false)) {
              throw new Error(result && result.error ? result.error : `HTTP ${response.status}`);
            }
            showUnitToast('Unit released successfully.');
            await loadRegistryUnits();
          } catch (error) {
            console.error('Release unit failed:', error);
            showPopupMessage('Release failed. Please confirm the Apps Script URL is correct.');
          }
        });
      }

      if (button.classList.contains('delete')) {
        const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
        if (!appScriptUrl) {
          showPopupMessage('Please configure the Apps Script URL before deleting a unit.');
          return;
        }

        showAppPopup(`Delete unit ${unitCode}?`, async () => {
          try {
            const response = await fetch(appScriptUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
              },
              body: new URLSearchParams({ action: 'deleteUnit', unitCode, actorRole: currentRole || '', actorName: getLoggedInUserName() }).toString()
            });

            const result = await response.json().catch(() => null);

            if (!response.ok || (result && result.ok === false)) {
              const message = result && result.error ? result.error : await response.text().catch(() => '');
              throw new Error(message || `HTTP ${response.status}`);
            }

            showUnitToast('Unit deleted successfully.');
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
    unitRegistryTableBody.innerHTML = '<tr><td colspan="18" class="empty-state">Unable to load live spreadsheet data.</td></tr>';
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
  const selectedStatus = normalizeSearchText(unitStatusFilter ? unitStatusFilter.value : 'all');
  const filteredRows = rows.map((unit, rowIndex) => ({ unit, rowIndex })).filter(({ unit }) => {
    const unitCode = normalizeSearchText(unit.unitCode || unit.code || '');
    const clientName = normalizeSearchText(unit.clientName || '');
    const status = normalizeSearchText(unit.status || '');
    const matchesSearch = !searchTerm || unitCode.includes(searchTerm) || clientName.includes(searchTerm);
    const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  if (unitRegistryTableWrap) {
    unitRegistryTableWrap.classList.toggle('is-scrollable', rows.length > 5);
  }

  if (!filteredRows.length) {
    unitRegistryTableBody.innerHTML = '<tr><td colspan="18" class="empty-state">No matching units found.</td></tr>';
    return;
  }

  const currentRole = localStorage.getItem('unitflowRole');

  unitRegistryTableBody.innerHTML = filteredRows
    .map(({ unit, rowIndex }) => {
      const code = unit.unitCode || '—';
      const specs = unit.specs || '—';
      const price = unit.unitPrice || '—';
      const brand = unit.unitBrand || unit.unitBrandName || unit.brand || '—';
      const client = unit.clientName || '—';
      const contactInfo = unit.contactInfo || '—';
      const warranty = unit.warranty || '—';
      const datePurchase = formatDateDisplay(unit.dateReceived || unit.datePurchase || '');
      const dateReturn = formatDateDisplay(unit.dateReturn || '');
      const dateReleased = formatDateDisplay(unit.dateReleased || '');
      const problem = unit.unitProblem || unit.problem || '—';
      const status = unit.status || 'Unknown';
      const isReleased = normalizeSearchText(status) === 'released';
      const runningDays = computeRunningDays(unit.dateReturn || unit.dateReceived, isReleased ? unit.dateReleased : '') || '—';
      const branch = unit.uploadedBranch || unit.branchLocation || unit.currentLocation || '—';
      const inclusion = unit.inclusion || '—';
      const isOfficeRole = currentRole === 'Office';
      const canEdit = canManageAction('edit', currentRole);
      const canDelete = canManageAction('delete', currentRole);
      const canRelease = canManageAction('release', currentRole) && normalizeSearchText(status) !== 'released';

      return `
        <tr data-unit-code="${escapeHtml(code)}" data-row-index="${rowIndex}">
          <td><span class="branch-tag ${branchClass(branch)}"><span class="center-stack">${renderBranchLocation(branch)}</span></span></td>
          <td class="unit-client-cell">${escapeHtml(client)}</td>
          <td><span class="center-stack">${renderStackedText(unit.currentLocation || branch || '—')}</span></td>
          <td><span class="center-stack">${renderStackedText(code)}</span></td>
          <td>${escapeHtml(specs)}</td>
          <td><span class="center-stack">${renderStackedText(price ? formatCurrency(price) : '—')}</span></td>
          <td class="unit-brand-cell">${escapeHtml(brand)}</td>
          <td>${escapeHtml(contactInfo)}</td>
          <td><span class="center-stack">${renderStackedText(warranty)}</span></td>
          <td><span class="center-stack">${renderStackedText(datePurchase)}</span></td>
          <td><span class="center-stack">${renderStackedText(dateReturn)}</span></td>
          <td><span class="center-stack">${renderStackedText(dateReleased)}</span></td>
          <td class="unit-running-days-cell"><span class="center-stack">${renderStackedText(runningDays)}</span></td>
          <td>${escapeHtml(problem)}</td>
          <td><span class="badge ${statusClass(status)}"><span class="center-stack">${renderStackedText(status)}</span></span></td>
          <td><span class="center-stack">${renderInclusionText(inclusion)}</span></td>
          <td>${escapeHtml(unit.technicianNotes || '—')}</td>
          <td class="table-actions">
            <button class="edit" type="button" ${canEdit ? '' : 'disabled title="Edit permission is disabled"'}>Edit</button>
            ${canRelease ? '<button class="release" type="button">Released</button>' : ''}
            <button class="delete" type="button" ${canDelete ? '' : 'disabled title="Delete permission is disabled"'}>Delete</button>
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

  if (normalized === 'released') return 'released';
  if (normalized === 'for observation' || normalized === 'transferred to technical') return 'observation';
  if (normalized === 'for replacement') return 'urgent';
  if (normalized === 'for release') return 'pending-return';
  if (normalized === 'in service') return 'in-stock';

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
