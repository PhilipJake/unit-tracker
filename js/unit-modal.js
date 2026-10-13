const backdrop = document.getElementById('unitModalBackdrop');
const openBtn = document.getElementById('openUnitModalBtn');
const closeBtn = document.getElementById('closeUnitModalBtn');
const cancelBtn = document.getElementById('cancelUnitModalBtn');
const unitForm = document.getElementById('unitForm');
const unitSubmitButton = document.getElementById('saveUnitButton');
const unitCardGrid = document.getElementById('unitCardGrid');
const unitModalTitle = document.getElementById('unitModalTitle');
const unitModalDescription = document.getElementById('unitModalDescription');
const unitDetailsBackdrop = document.getElementById('unitDetailsBackdrop');
const unitDetailsContent = document.getElementById('unitDetailsContent');
const closeUnitDetailsBtn = document.getElementById('closeUnitDetailsBtn');
const messageModalBackdrop = document.getElementById('messageModalBackdrop');
const messageModalBody = document.getElementById('messageModalBody');
const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
const okMessageModalBtn = document.getElementById('okMessageModalBtn');
const unitSearchInput = document.getElementById('unitSearchInput') || document.querySelector('.search-box input');
const clearUnitSearchButton = document.getElementById('clearUnitSearchBtn');
const unitStatusFilter = document.getElementById('unitStatusFilter');
const unitBranchFilter = document.getElementById('unitBranchFilter');
const currentLocationSelect = document.getElementById('currentLocation');
const technicianNotesField = document.getElementById('technicianNotes');
const urgentField = document.getElementById('isUrgent');
const dateReleasedField = document.getElementById('dateReleased');
const otherInclusionOption = document.getElementById('otherInclusionOption');
const otherInclusionText = document.getElementById('otherInclusionText');
const unitToast = document.getElementById('unitToast');
let activeEditCode = '';
let activeEditRowIndex = null;
let pendingConfirmAction = null;
let registryRowsCache = [];
let registryRowsLoaded = false;
let unitsMainView = null;
let trashMainView = null;
let trashSupportNodes = [];
let unitToastTimer = null;
let unitDetailsReturnFocus = null;
const contactInfoPrefix = '+63 ';
const canSetForDiagnose = ['Super Admin', 'Administrator', 'Technician'];

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

function openUnitDetails(unit, trigger) {
  if (!unitDetailsBackdrop || !unitDetailsContent) return;

  const unitCode = unit.unitCode || unit.code || '—';
  const clientName = unit.clientName || 'Unnamed client';
  const status = unit.status || 'Unknown';
  const branch = unit.uploadedBranch || unit.branchLocation || '—';
  const isUrgent = ['true', '1', 'yes', 'urgent'].includes(String(unit.isUrgent || unit.urgent || '').trim().toLowerCase());
  const fields = [
    ['Client & contact', [
      ['Client name', clientName],
      ['Contact information', unit.contactInfo],
      ['Priority', isUrgent ? 'Urgent' : 'Standard']
    ]],
    ['Unit details', [
      ['Unit code', unitCode],
      ['Status', status],
      ['Branch location', branch],
      ['Current location', unit.currentLocation || branch],
      ['Unit brand', unit.unitBrand || unit.unitBrandName || unit.brand],
      ['Unit specifications', unit.specs || unit.unitSpecs],
      ['Unit price', unit.unitPrice ? formatCurrency(unit.unitPrice) : '—'],
      ['Warranty', unit.warranty]
    ]],
    ['Service & history', [
      ['Date purchased', formatDateDisplay(unit.dateReceived || unit.datePurchase || '')],
      ['Date of return', formatDateDisplay(unit.dateReturn || '')],
      ['Date released', formatDateDisplay(unit.dateReleased || '')],
      ['Released by', unit.releasedBy],
      ['Running days', computeRunningDays(unit.dateReturn || unit.dateReceived, normalizeSearchText(status) === 'released' ? unit.dateReleased : '')],
      ['Previous status', unit.previousStatus],
      ['Date sent to warehouse', formatWarehouseDateDisplay(unit.warehouseDateIn)],
      ['Date left warehouse', formatWarehouseDateDisplay(unit.warehouseDateOut)],
      ['Days in warehouse', computeRunningDays(unit.warehouseDateIn, unit.warehouseDateOut)]
    ]],
    ['Notes & inclusions', [
      ['Unit problem', unit.unitProblem || unit.problem],
      ['Inclusions', unit.inclusion],
      ['Technical notes', unit.technicianNotes]
    ]]
  ];

  if (unit.deletedAt || unit.deletedBy) {
    fields.push(['Recovery record', [
      ['Deleted at', formatDateDisplay(unit.deletedAt)],
      ['Deleted by', unit.deletedBy]
    ]]);
  }

  const sections = fields.map(([title, items]) => {
    const visibleItems = items.filter(([, value]) => String(value ?? '').trim() && String(value).trim() !== '—');
    if (!visibleItems.length) return '';
    const sectionClass = {
      'Client & contact': 'unit-detail-client',
      'Unit details': 'unit-detail-unit',
      'Service & history': 'unit-detail-service',
      'Notes & inclusions': 'unit-detail-notes',
      'Recovery record': 'unit-detail-recovery'
    }[title] || '';
    return `<section class="unit-detail-section ${sectionClass}">
      <h3>${escapeHtml(title)}</h3>
      <dl>${visibleItems.map(([label, value]) => `<div class="unit-detail-field"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
    </section>`;
  });

  unitDetailsContent.innerHTML = `
    <header class="unit-details-heading">
      <div class="unit-details-avatar" aria-hidden="true">${escapeHtml(String(clientName).trim().charAt(0).toUpperCase() || 'U')}</div>
      <div class="unit-details-identity">
        <span class="unit-details-eyebrow">UNIT PROFILE</span>
        <h2 id="unitDetailsTitle">${escapeHtml(clientName)}</h2>
        <span class="unit-details-code">Unit ${escapeHtml(unitCode)}</span>
      </div>
      <span class="badge ${statusClass(status)}"><span class="center-stack">${escapeHtml(status)}</span></span>
    </header>
    <div class="unit-details-sections">
      <div class="unit-details-column">${sections[0] || ''}${sections[2] || ''}</div>
      <div class="unit-details-column">${sections[1] || ''}</div>
    </div>
    <div class="unit-details-bottom${sections[4] ? ' has-recovery' : ''}">
      ${sections[3] || ''}
      ${sections[4] || ''}
    </div>
    <footer class="unit-details-footer">
      <span>Client unit record</span>
      <button class="action-btn primary" type="button" data-close-unit-details>Close</button>
    </footer>`;

  unitDetailsReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  unitDetailsBackdrop.classList.add('visible');
  unitDetailsBackdrop.setAttribute('aria-hidden', 'false');
  unitDetailsBackdrop.querySelector('.unit-details-modal').focus();
}

function closeUnitDetails() {
  if (!unitDetailsBackdrop) return;
  unitDetailsBackdrop.classList.remove('visible');
  unitDetailsBackdrop.setAttribute('aria-hidden', 'true');
  if (unitDetailsReturnFocus instanceof HTMLElement && unitDetailsReturnFocus.isConnected) {
    unitDetailsReturnFocus.focus();
  }
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

  const statusField = unitForm && unitForm.elements.namedItem('status');
  const diagnoseOption = statusField ? [...statusField.options].find((option) => option.value === 'For Diagnose') : null;
  const canDiagnose = canSetForDiagnose.includes(localStorage.getItem('unitflowRole'));
  if (diagnoseOption) {
    diagnoseOption.disabled = !canDiagnose;
  }

  if (mode === 'edit' && unit) {
    activeEditCode = String(unit.unitCode || unit.code || '').trim();
    unitForm.dataset.mode = 'edit';
    if (unitModalTitle) unitModalTitle.textContent = 'Edit Unit';
    if (unitModalDescription) unitModalDescription.textContent = 'Update client, equipment, and service information.';
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
    if (unitModalDescription) unitModalDescription.textContent = 'Add client and equipment details to the registry.';
    if (unitSubmitButton) unitSubmitButton.textContent = 'Save Unit';
    unitForm.reset();
    unitForm.dataset.originalStatus = '';
    if (statusField) {
      statusField.required = true;
      statusField.value = canDiagnose ? 'For Diagnose' : 'Transferred to Technical';
    }
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
  if (unitModalDescription) unitModalDescription.textContent = 'Add client and equipment details to the registry.';
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
    contactInfo: formatContactInfoValue(unit.contactInfo || ''),
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
  unitForm.dataset.originalStatus = String(unit.status || '');

  Object.entries(fields).forEach(([key, value]) => {
    const field = unitForm.elements.namedItem(key);
    if (field) {
      field.value = value;
    }
  });

  const statusField = unitForm.elements.namedItem('status');
  if (statusField) {
    statusField.required = statusField.value !== '';
  }

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
    status: String(raw.status || (form.dataset.mode === 'edit' ? form.dataset.originalStatus : '') || '').trim(),
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
    actorName: getLoggedInUserName(),
    uploadedBranch
  };
}

async function transferUnitStatus(unit, rowIndex, role, nextStatus, nextLocation, successMessage) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl || appScriptUrl === 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE') {
    showPopupMessage('Please configure the Apps Script URL before moving a unit.');
    return;
  }

  const unitCode = String(unit.unitCode || unit.code || '').trim();
  const body = new URLSearchParams({
    action: 'updateUnit',
    originalUnitCode: unitCode,
    originalRowIndex: '-1',
    unitCode,
    clientName: unit.clientName || '',
    unitBrand: unit.unitBrand || '',
    unitSpecs: unit.specs || '',
    unitPrice: unit.unitPrice || '',
    status: nextStatus,
    branchLocation: unit.branchLocation || unit.uploadedBranch || '',
    uploadedBranch: unit.uploadedBranch || unit.branchLocation || '',
    currentLocation: nextLocation || unit.currentLocation || '',
    dateReceived: unit.dateReceived || '',
    dateReturn: unit.dateReturn || '',
    dateReleased: unit.dateReleased || '',
    warranty: unit.warranty || '',
    unitProblem: unit.unitProblem || '',
    inclusion: unit.inclusion || '',
    technicianNotes: unit.technicianNotes || '',
    isUrgent: unit.isUrgent || '',
    actorRole: role || '',
    actorName: getLoggedInUserName()
  }).toString();

  try {
    const response = await fetch(appScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || (result && result.ok === false)) {
      throw new Error(result && result.error ? result.error : `HTTP ${response.status}`);
    }
    const today = getManilaDateKey(new Date());
    registryRowsCache = registryRowsCache.map((cachedUnit) => {
      if (String(cachedUnit.unitCode || cachedUnit.code || '').trim().toLowerCase() !== unitCode.toLowerCase()) return cachedUnit;

      const previousLocation = normalizeSearchText(cachedUnit.currentLocation);
      const currentLocation = nextLocation || cachedUnit.currentLocation || cachedUnit.branchLocation || cachedUnit.uploadedBranch || '';
      const isInWarehouse = normalizeSearchText(currentLocation) === 'warehouse';
      const wasInWarehouse = previousLocation === 'warehouse';
      return {
        ...cachedUnit,
        status: nextStatus,
        currentLocation,
        dateReleased: nextStatus === 'Released' ? cachedUnit.dateReleased || today : cachedUnit.dateReleased || '',
        releasedBy: nextStatus === 'Released' ? getLoggedInUserName() : cachedUnit.releasedBy || '',
        warehouseDateIn: isInWarehouse ? (wasInWarehouse ? cachedUnit.warehouseDateIn || today : today) : cachedUnit.warehouseDateIn || '',
        warehouseDateOut: isInWarehouse ? '' : (wasInWarehouse ? today : cachedUnit.warehouseDateOut || ''),
        previousStatus: normalizeSearchText(nextStatus) === 'for warehouse' && normalizeSearchText(cachedUnit.status) !== 'for warehouse'
          ? cachedUnit.status
          : wasInWarehouse && !isInWarehouse && normalizeSearchText(nextStatus) === normalizeSearchText(cachedUnit.previousStatus)
            ? ''
            : cachedUnit.previousStatus || ''
      };
    });
    showUnitToast(successMessage);
    renderUnitCards(registryRowsCache);
    return true;
  } catch (error) {
    console.error('Unit status transfer failed:', error);
    showPopupMessage(`Transfer failed: ${error.message || 'Unknown Apps Script error'}`);
    return false;
  }
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

  const requestedStatus = normalizeSearchText(unitForm.elements.namedItem('status')?.value || '');
  const currentUnit = registryRowsCache.find((unit) => String(unit.unitCode || unit.code || '').trim().toLowerCase() === activeEditCode.toLowerCase());
  const wasReleased = normalizeSearchText(currentUnit?.status || '') === 'released';
  if (requestedStatus === 'released' && !wasReleased && !canManageAction('release', role)) {
    showPopupMessage('You do not have permission to release units.');
    return;
  }

  const payload = normalizeSavedUnitPayload(form);
  if (payload.status === 'For Diagnose' && !canSetForDiagnose.includes(role)) {
    showPopupMessage('Only Super Admin, Administrator, and Technician roles can set For Diagnose.');
    return;
  }
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

function showTrashView() {
  if (!unitsMainView) unitsMainView = document.querySelector('.workspace > main.content');
  if (!trashMainView) {
    const template = document.getElementById('trashViewTemplate');
    if (!template) return;
    const fragment = template.content.cloneNode(true);
    trashMainView = fragment.querySelector('main.content');
    trashSupportNodes = [...fragment.querySelectorAll('[data-trash-view-support]')];
  }

  if (unitsMainView && unitsMainView.isConnected) unitsMainView.replaceWith(trashMainView);
  trashSupportNodes.forEach((node) => {
    if (!node.isConnected) document.body.append(node);
  });
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) breadcrumb.innerHTML = 'Workspace <span>/</span> Trash';
  document.title = 'Trash | Unitflow';
  window.UnitflowTrashView?.init();
}

function showUnitsView() {
  if (trashMainView && trashMainView.isConnected && unitsMainView) trashMainView.replaceWith(unitsMainView);
  trashSupportNodes.forEach((node) => node.remove());
  window.UnitflowTrashView?.dispose();
  const breadcrumb = document.querySelector('.breadcrumb');
  if (breadcrumb) breadcrumb.innerHTML = 'Workspace <span>/</span> Units';
  document.title = 'Units';
  if (registryRowsLoaded) renderUnitCards(registryRowsCache);
  else loadRegistryUnits();
}

function syncRegistryViewLinks() {
  const currentUrl = new URL(window.location.href);
  const currentView = currentUrl.searchParams.get('view') || 'monitoring';
  const unitsLink = document.querySelector('[data-unit-menu] .nav-group-header > .nav-item');
  const isMonitoringView = currentUrl.pathname.endsWith('units.html') && currentView === 'monitoring';
  if (unitsLink) {
    unitsLink.classList.toggle('active', isMonitoringView);
    if (isMonitoringView) unitsLink.setAttribute('aria-current', 'page');
    else unitsLink.removeAttribute('aria-current');
  }

  document.querySelectorAll('[data-unit-menu] .nav-submenu a[href]').forEach((link) => {
    const linkUrl = new URL(link.href, currentUrl);
    const isActive = linkUrl.pathname.endsWith('units.html')
      && linkUrl.pathname === currentUrl.pathname
      && (linkUrl.searchParams.get('view') || 'monitoring') === currentView;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initRegistryViewNavigation() {
  const viewLinks = document.querySelectorAll('[data-unit-menu] .nav-group-header > .nav-item[href], [data-unit-menu] .nav-submenu a[href]');
  if (!unitCardGrid || !viewLinks.length) return;

  const renderCurrentView = () => {
    syncRegistryViewLinks();
    if (new URLSearchParams(window.location.search).get('view') === 'trash') showTrashView();
    else showUnitsView();
  };

  viewLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const targetUrl = new URL(link.href, window.location.href);
      if (!targetUrl.pathname.endsWith('units.html') || targetUrl.pathname !== window.location.pathname || !targetUrl.searchParams.has('view')) return;

      event.preventDefault();
      if (targetUrl.search === window.location.search) {
        syncRegistryViewLinks();
        return;
      }
      window.history.pushState({}, '', `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
      renderCurrentView();
    });
  });

  window.addEventListener('popstate', renderCurrentView);
  syncRegistryViewLinks();
  if (new URLSearchParams(window.location.search).get('view') === 'trash') showTrashView();
}

function initUnitModal() {
  initRegistryViewNavigation();

  if (openBtn) {
    openBtn.addEventListener('click', () => openUnitModal('create'));
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeUnitModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeUnitModal);
  }

  if (closeUnitDetailsBtn) {
    closeUnitDetailsBtn.addEventListener('click', closeUnitDetails);
  }

  if (unitDetailsBackdrop) {
    unitDetailsBackdrop.addEventListener('click', (event) => {
      if (event.target === unitDetailsBackdrop || event.target.closest('[data-close-unit-details]')) {
        closeUnitDetails();
      }
    });
  }

  if (closeMessageModalBtn) {
    closeMessageModalBtn.addEventListener('click', closePopupMessage);
  }

  if (okMessageModalBtn) {
    okMessageModalBtn.addEventListener('click', async () => {
      if (pendingConfirmAction) {
        const action = pendingConfirmAction;
        closePopupMessage();
        await action();
        return;
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
      syncUnitSearchClearButton();
      renderUnitCards(registryRowsCache);
    });
  }

  if (clearUnitSearchButton && unitSearchInput) {
    clearUnitSearchButton.addEventListener('click', () => {
      unitSearchInput.value = '';
      syncUnitSearchClearButton();
      renderUnitCards(registryRowsCache);
      unitSearchInput.focus();
    });
  }

  if (unitStatusFilter) {
    const requestedStatus = new URLSearchParams(window.location.search).get('status');
    unitStatusFilter.value = requestedStatus && [...unitStatusFilter.options].some((option) => option.value === requestedStatus)
      ? requestedStatus
      : 'all';
    unitStatusFilter.addEventListener('change', () => {
      renderUnitCards(registryRowsCache);
    });
  }

  if (unitBranchFilter) {
    unitBranchFilter.addEventListener('change', () => {
      renderUnitCards(registryRowsCache);
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
    if (event.key === 'Escape' && unitDetailsBackdrop && unitDetailsBackdrop.classList.contains('visible')) {
      closeUnitDetails();
      return;
    }
    if (event.key === 'Escape' && backdrop && backdrop.classList.contains('visible')) {
      closeUnitModal();
    }
  });

  if (unitCardGrid) {
    unitCardGrid.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      const row = (button || event.target).closest('[data-unit-code]');
      if (!row) return;

      const selectedRowIndex = Number(row.dataset.rowIndex);
      const unit = Number.isInteger(selectedRowIndex) && selectedRowIndex >= 0 ? registryRowsCache[selectedRowIndex] : null;
      if (!button || button.hasAttribute('data-open-unit')) {
        if (unit) openUnitDetails(unit, button || row);
        return;
      }

      const unitCode = row.dataset.unitCode || '';

      if (!unitCode || !row) return;

      const currentRole = localStorage.getItem('unitflowRole');
      if (button.classList.contains('edit') && !canManageAction('edit', currentRole)) return;
      if (button.classList.contains('delete') && !canManageAction('delete', currentRole)) return;
      const workflowActions = ['for-release', 'for-warehouse', 'for-replacement', 'for-repair', 'pull-out', 'released', 'replaced', 'repaired', 'warehouse-transfer', 'return-tracking'];
      if (workflowActions.some((action) => button.classList.contains(action))) {
        const canEditWorkflow = canManageAction('edit', currentRole);
        if ((button.classList.contains('for-warehouse') || button.classList.contains('warehouse-transfer') || button.classList.contains('return-tracking'))
          && (!canEditWorkflow || !canManageAction('warehouse', currentRole))) return;
        if (button.classList.contains('for-release')
          && (!canEditWorkflow || !canManageAction('release', currentRole))) return;
        if (button.classList.contains('pull-out')
          && (!canEditWorkflow || !canManageAction('pullOut', currentRole))) return;
        if (button.classList.contains('for-replacement')
          && (!canEditWorkflow || !canManageAction('forReplacement', currentRole))) return;
        if ((button.classList.contains('for-repair') || button.classList.contains('repaired'))
          && (!canEditWorkflow || !canManageAction('repair', currentRole))) return;
        if (button.classList.contains('replaced') && !canEditWorkflow) return;
        if (button.classList.contains('replaced') && !canManageAction('forReplacement', currentRole)) return;
        if (button.classList.contains('released') && !canManageAction('release', currentRole)) return;

        const rows = await DATA.fetchUnits();
        const unit = Number.isInteger(selectedRowIndex) && selectedRowIndex >= 0
          ? rows[selectedRowIndex]
          : rows.find((item) => String(item.unitCode || item.code || '').trim().toLowerCase() === unitCode.toLowerCase());

        if (!unit) {
          showPopupMessage('Unit not found in the live spreadsheet.');
          return;
        }

        activeEditRowIndex = Number.isInteger(selectedRowIndex) && selectedRowIndex >= 0 ? selectedRowIndex : null;

        const statusMoves = [
          { action: 'for-release', status: 'For Release', message: 'Unit moved to For Release successfully.' },
          { action: 'pull-out', status: 'Pull Out', message: 'Unit moved to Pull Out successfully.' },
          { action: 'for-warehouse', status: 'For Warehouse', message: 'Unit moved to For Warehouse successfully.' },
          { action: 'for-replacement', status: 'For Replacement', message: 'Unit moved to For Replacement successfully.' },
          { action: 'for-repair', status: 'For Repair', message: 'Unit moved to For Repair successfully.' },
          { action: 'released', status: 'Released', message: 'Unit released successfully.' },
          { action: 'repaired', status: 'For Observation', message: 'Unit returned to Units successfully.' },
          { action: 'replaced', status: 'Replaced', message: 'Unit marked as Replaced.' },
          { action: 'warehouse-transfer', status: 'Warehouse', location: 'Warehouse', message: 'Unit moved to Warehouse successfully.' },
          { action: 'return-tracking', status: unit.previousStatus || 'For Observation', location: unit.uploadedBranch || unit.branchLocation, message: 'Unit returned to Tracking successfully.' }
        ];
        const move = statusMoves.find(({ action }) => button.classList.contains(action));
        if (move) {
          showPopupMessage(`Update unit ${unitCode} to ${move.status}?`, async () => {
            const moved = await transferUnitStatus(unit, selectedRowIndex, currentRole, move.status, move.location || unit.currentLocation, move.message);
            if (moved && (move.action === 'repaired' || move.action === 'return-tracking')) {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'monitoring');
              window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
              syncRegistryViewLinks();
              renderUnitCards(registryRowsCache);
            }
          });
        }
        return;
      }

      if (button.classList.contains('edit')) {
        const rows = await DATA.fetchUnits();
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
            const dateReleased = result && result.dateReleased ? result.dateReleased : getManilaDateKey(new Date());
            registryRowsCache = registryRowsCache.map((cachedUnit) => (
              String(cachedUnit.unitCode || cachedUnit.code || '').trim().toLowerCase() === unitCode.toLowerCase()
                ? { ...cachedUnit, status: 'Released', dateReleased }
                : cachedUnit
            ));
            showUnitToast('Unit released successfully.');
            renderUnitCards(registryRowsCache);
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

  if (typeof loadRegistryUnits === 'function' && new URLSearchParams(window.location.search).get('view') !== 'trash') {
    loadRegistryUnits();
  }

  scheduleRegistryMidnightRefresh();
}

async function loadRegistryUnits() {
  if (!unitCardGrid) return;

  try {
    const rows = await DATA.fetchUnits();
    registryRowsCache = Array.isArray(rows) ? rows : [];
    registryRowsLoaded = true;
    renderUnitCards(registryRowsCache);
  } catch (error) {
    console.error(error);
    registryRowsLoaded = true;
    unitCardGrid.innerHTML = '<div class="empty-state">Unable to load live spreadsheet data.</div>';
  }
}

function scheduleRegistryMidnightRefresh() {
  const now = new Date();
  const manilaDateKey = getManilaDateKey(now);
  const [year, month, day] = manilaDateKey.split('-').map(Number);
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - (8 * 60 * 60 * 1000);
  const delayMs = Math.max(1000, nextMidnightUtc - now.getTime());

  setTimeout(() => {
    renderUnitCards(registryRowsCache);
    scheduleRegistryMidnightRefresh();
  }, delayMs);
}

function normalizeSearchText(value) {
  return String(value || '').trim().toLowerCase();
}

function syncUnitSearchClearButton() {
  if (!clearUnitSearchButton || !unitSearchInput) return;
  clearUnitSearchButton.hidden = !unitSearchInput.value;
}

function syncUnitBranchFilterOptions(rows) {
  if (!unitBranchFilter) return;

  const selectedBranch = unitBranchFilter.value;
  const branchesByKey = new Map();
  rows.forEach((unit) => {
    const branch = String(unit.uploadedBranch || unit.branchLocation || '').trim();
    const key = normalizeSearchText(branch);
    if (key && key !== '—' && !branchesByKey.has(key)) branchesByKey.set(key, branch);
  });

  const branches = [...branchesByKey.values()].sort((first, second) => first.localeCompare(second));
  unitBranchFilter.replaceChildren(new Option('All branches', 'all'));
  branches.forEach((branch) => unitBranchFilter.add(new Option(branch, branch)));
  unitBranchFilter.value = branches.some((branch) => branch === selectedBranch) ? selectedBranch : 'all';
}

function renderUnitCards(rows) {
  if (!unitCardGrid) return;

  syncUnitSearchClearButton();
  syncUnitBranchFilterOptions(rows);
  const searchTerm = normalizeSearchText(unitSearchInput ? unitSearchInput.value : '');
  const selectedStatus = normalizeSearchText(unitStatusFilter ? unitStatusFilter.value : 'all');
  const selectedBranch = normalizeSearchText(unitBranchFilter ? unitBranchFilter.value : 'all');
  const requestedView = normalizeSearchText(new URLSearchParams(window.location.search).get('view') || 'monitoring');
  const isReleasedView = requestedView === 'released';
  const isWarehouseView = requestedView === 'warehouse';
  const filteredRows = rows.map((unit, rowIndex) => ({ unit, rowIndex })).filter(({ unit }) => {
    const unitCode = normalizeSearchText(unit.unitCode || unit.code || '');
    const clientName = normalizeSearchText(unit.clientName || '');
    const status = normalizeSearchText(unit.status || '');
    const branch = normalizeSearchText(unit.uploadedBranch || unit.branchLocation || '');
    const currentLocation = normalizeSearchText(unit.currentLocation || '');
    const matchesSearch = !searchTerm || unitCode.includes(searchTerm) || clientName.includes(searchTerm);
    const matchesView = requestedView === 'monitoring'
      ? status !== 'deleted'
      : requestedView === 'diagnose'
        ? status === 'for diagnose' || status === 'for diagnosis'
        : requestedView === 'for-release'
        ? status === 'for release'
        : requestedView === 'released'
          ? status === 'released'
          : requestedView === 'replaced'
            ? status === 'for replacement'
            : requestedView === 'for-repair'
              ? status === 'for repair'
            : requestedView === 'warehouse'
              ? status === 'for warehouse' || status === 'warehouse' || currentLocation === 'warehouse'
              : requestedView === 'pull-out'
                ? status === 'pull out'
                : true;
    const matchesStatus = selectedStatus === 'all' || status === selectedStatus;
    const matchesBranch = selectedBranch === 'all' || branch === selectedBranch;
    return matchesSearch && matchesView && matchesStatus && matchesBranch;
  });

  if (!filteredRows.length) {
    unitCardGrid.innerHTML = '<div class="empty-state">No matching units found.</div>';
    return;
  }

  const currentRole = localStorage.getItem('unitflowRole');

  unitCardGrid.innerHTML = filteredRows
    .map(({ unit, rowIndex }) => {
      const code = unit.unitCode || '—';
      const specs = unit.specs || '—';
      const brand = unit.unitBrand || unit.unitBrandName || unit.brand || '—';
      const client = unit.clientName || '—';
      const isUnitUrgent = ['true', '1', 'yes', 'urgent'].includes(String(unit.isUrgent || unit.urgent || '').trim().toLowerCase());
      const status = unit.status || 'Unknown';
      const normalizedStatus = normalizeSearchText(status);
      const branch = unit.uploadedBranch || unit.branchLocation || unit.currentLocation || '—';
      const canEdit = canManageAction('edit', currentRole);
      const canDelete = canManageAction('delete', currentRole);
      const canRelease = canManageAction('release', currentRole);
      const canEditActions = canManageAction('edit', currentRole);
      const canWarehouse = canManageAction('warehouse', currentRole);
      const canPullOut = canManageAction('pullOut', currentRole);
      const canForReplacement = canManageAction('forReplacement', currentRole);
      const canRepair = canManageAction('repair', currentRole);
      const currentLocation = normalizeSearchText(unit.currentLocation || branch);
      const baseActionButtons = `<div class="unit-action-row">
              <button class="edit" type="button" ${canEdit ? '' : 'disabled title="Edit permission is disabled"'}>Edit</button>
              <button class="delete" type="button" ${canDelete ? '' : 'disabled title="Delete permission is disabled"'}>Delete</button>
            </div>`;
      const diagnosisActions = `<div class="unit-action-row">
              <button class="for-release" type="button" ${canEditActions && canRelease ? '' : 'disabled title="Released permission is disabled"'}>For Release</button>
              <button class="for-repair" type="button" ${canEditActions && canRepair ? '' : 'disabled title="Repair permission is disabled"'}>For Repair</button>
            </div>
            <div class="unit-action-row">
              <button class="for-replacement" type="button" ${canEditActions && canForReplacement ? '' : 'disabled title="For Replacement permission is disabled"'}>For Replacement</button>
              <button class="for-warehouse" type="button" ${canEditActions && canWarehouse && normalizedStatus !== 'for warehouse' && currentLocation !== 'warehouse' ? '' : 'disabled title="Warehouse permission is disabled or unit is already assigned to the warehouse"'}>For Warehouse</button>
            </div>
            <div class="unit-action-row">
              <button class="pull-out" type="button" ${canEditActions && canPullOut ? '' : 'disabled title="Pullout permission is disabled"'}>Pull Out</button>
            </div>`;
      const actionButtonsByStatus = {
        'for diagnose': diagnosisActions,
        'for diagnosis': diagnosisActions,
        'for observation': diagnosisActions,
        'transferred to technical': diagnosisActions,
        'for release': `<div class="unit-action-row"><button class="released" type="button" ${canRelease ? '' : 'disabled title="Released permission is disabled"'}>Released</button></div>`,
        'pull out': `<div class="unit-action-row"><button class="released" type="button" ${canRelease ? '' : 'disabled title="Released permission is disabled"'}>Released</button></div>`,
        'for repair': `<div class="unit-action-row"><button class="repaired" type="button" ${canEditActions && canRepair ? '' : 'disabled title="Repair permission is disabled"'}>Repaired</button></div>`,
        'for replacement': `<div class="unit-action-row"><button class="replaced" type="button" ${canEditActions && canForReplacement ? '' : 'disabled title="For Replacement permission is disabled"'}>Replaced</button></div>`,
        'for warehouse': `<div class="unit-action-row"><button class="warehouse-transfer" type="button" ${canEditActions && canWarehouse ? '' : 'disabled title="Warehouse permission is disabled"'}>Warehouse</button></div>`,
        warehouse: `<div class="unit-action-row"><button class="return-tracking" type="button" ${canEditActions && canWarehouse ? '' : 'disabled title="Warehouse permission is disabled"'}>Return to Tracking</button></div>`
      };
      const actionStatus = normalizedStatus === 'for warehouse'
        ? normalizedStatus
        : currentLocation === 'warehouse' ? 'warehouse' : normalizedStatus;
      let actionButtons = `${baseActionButtons}${actionButtonsByStatus[actionStatus] || ''}`;
      if (requestedView === 'for-release' || requestedView === 'pull-out') {
        actionButtons = `<div class="unit-action-row"><button class="released" type="button" ${canRelease ? '' : 'disabled title="Released permission is disabled"'}>Released</button></div>`;
      } else if (requestedView === 'for-repair') {
        actionButtons = `<div class="unit-action-row"><button class="repaired" type="button" ${canEditActions && canRepair ? '' : 'disabled title="Repair permission is disabled"'}>Repaired</button></div>`;
      } else if (requestedView === 'replaced') {
        actionButtons = `<div class="unit-action-row"><button class="replaced" type="button" ${canEditActions && canForReplacement ? '' : 'disabled title="For Replacement permission is disabled"'}>Replaced</button></div>`;
      } else if (isWarehouseView) {
        actionButtons = normalizedStatus === 'for warehouse'
          ? `<div class="unit-action-row"><button class="warehouse-transfer" type="button" ${canEditActions && canWarehouse ? '' : 'disabled title="Warehouse permission is disabled"'}>Warehouse</button></div>`
          : normalizedStatus === 'warehouse' || currentLocation === 'warehouse'
            ? `<div class="unit-action-row"><button class="return-tracking" type="button" ${canEditActions && canWarehouse ? '' : 'disabled title="Warehouse permission is disabled"'}>Return to Tracking</button></div>`
            : '';
      }
      const actionCell = isReleasedView ? '' : `<div class="unit-record-actions"><div class="table-actions unit-registry-actions">${actionButtons}</div></div>`;

      return `
        <article class="unit-record-card${isUnitUrgent ? ' is-urgent' : ''}" data-unit-code="${escapeHtml(code)}" data-row-index="${rowIndex}">
          <button class="unit-record-card-main" type="button" data-open-unit aria-label="View details for ${escapeHtml(client)}, unit ${escapeHtml(code)}">
            <span class="unit-record-card-heading">
              <span class="unit-record-avatar" aria-hidden="true">${escapeHtml(String(client).trim().charAt(0).toUpperCase() || 'U')}</span>
              <span class="unit-record-identity">
                <span class="unit-record-client">${escapeHtml(client)}</span>
                <span class="unit-record-code">${escapeHtml(code)}</span>
              </span>
              <span class="badge ${statusClass(status)}">${escapeHtml(status)}</span>
            </span>
            <span class="unit-record-specs">${escapeHtml(brand)} <span aria-hidden="true">·</span> ${escapeHtml(specs)}</span>
            <span class="unit-record-facts">
              <span><small>Branch</small><strong>${escapeHtml(branch)}</strong></span>
              <span><small>Current location</small><strong>${escapeHtml(unit.currentLocation || branch || '—')}</strong></span>
            </span>
            ${isUnitUrgent ? '<span class="unit-record-urgent">Urgent attention</span>' : ''}
            <span class="unit-record-open-label">View full record <span aria-hidden="true">→</span></span>
          </button>
          ${actionCell}
        </article>
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

function formatWarehouseDateDisplay(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '—';

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[2]}/${isoDate[3]}/${isoDate[1]}`;
  return formatDateDisplay(trimmed);
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
  if (normalized === 'for observation' || normalized === 'transferred to technical' || normalized === 'for diagnose') return 'observation';
  if (normalized === 'for replacement') return 'urgent';
  if (normalized === 'for release' || normalized === 'pull out') return 'pending-return';
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
