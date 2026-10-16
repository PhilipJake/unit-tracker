const appleProductCardGrid = document.getElementById('appleProductCardGrid');
const appleProductsSyncStatus = document.getElementById('appleProductsSyncStatus');
const appleProductSearch = document.getElementById('appleProductSearch');
const appleProductBranchFilter = document.getElementById('appleProductBranchFilter');
const appleProductCount = document.getElementById('appleProductCount');
const addAppleProductButton = document.getElementById('addAppleProductButton');
const appleProductModalBackdrop = document.getElementById('appleProductModalBackdrop');
const appleProductForm = document.getElementById('appleProductForm');
const appleProductFormError = document.getElementById('appleProductFormError');
const appleProductBranchInput = document.getElementById('appleProductBranch');
const saveAppleProductButton = document.getElementById('saveAppleProductButton');
const appleProductDetailsBackdrop = document.getElementById('appleProductDetailsBackdrop');
const appleProductDetailsContent = document.getElementById('appleProductDetailsContent');
let appleProductRows = [];
let appleProductBranches = [];
let appleProductLoadInProgress = false;
let appleProductsLoaded = false;
let editingAppleProduct = null;
let appleProductDetailsReturnFocus = null;

function getAppleProductBranchAssignments() {
  try {
    const branches = JSON.parse(localStorage.getItem('unitflowAppleProductBranches') || '[]');
    return Array.isArray(branches) ? branches.map((branch) => String(branch || '').trim()).filter(Boolean) : [];
  } catch (error) {
    console.error('Unable to read Apple Product branch assignments:', error);
    return [];
  }
}

function isAppleProductManager() {
  return ['Super Admin', 'Administrator'].includes(localStorage.getItem('unitflowRole'));
}

function canManageAppleProduct(action) {
  return typeof canManageAction !== 'function' || canManageAction(action);
}

function getAppleProductValue(row, header, property) {
  const normalizedHeader = header.toLowerCase();
  const normalizedProperty = property.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const fallbackProperty = property === 'code' ? row.unitCode : '';
  return String(row[header] ?? row[normalizedHeader] ?? row[property] ?? row[normalizedProperty] ?? fallbackProperty ?? '').trim();
}

function escapeAppleProductHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function formatAppleProductDate(value) {
  const text = String(value || '').trim();
  if (!text) return '—';
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : text;
}

function getAppleProductDateInputValue(value) {
  const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function getAppleProductStatusClass(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'released') return 'released';
  if (normalized === 'for replacement') return 'urgent';
  if (normalized === 'for release' || normalized === 'pull out') return 'pending-return';
  if (normalized === 'for observation' || normalized === 'transferred to technical' || normalized === 'for diagnose') return 'observation';
  return 'in-stock';
}

function openAppleProductDetails(product, trigger) {
  if (!appleProductDetailsBackdrop || !appleProductDetailsContent) return;

  const code = getAppleProductValue(product, 'Code', 'code') || '—';
  const clientName = getAppleProductValue(product, 'Client Name', 'clientName') || 'Unnamed client';
  const status = getAppleProductValue(product, 'Status', 'status') || 'Unknown';
  const fields = [
    ['Client & contact', [
      ['Client name', clientName],
      ['Contact information', getAppleProductValue(product, 'Contact Info', 'contactInfo')],
      ['Address', getAppleProductValue(product, 'Address', 'address')]
    ]],
    ['Phone details', [
      ['Code', code],
      ['Status', status],
      ['Branch', getAppleProductValue(product, 'Branch', 'branch')],
      ['Serial number', getAppleProductValue(product, 'Serial Number', 'serialNumber')],
      ['IMEI', getAppleProductValue(product, 'IMEI', 'imei')]
    ]],
    ['Purchase & returns', [
      ['Date of purchase', formatAppleProductDate(getAppleProductValue(product, 'Date of Purchase', 'dateOfPurchase'))],
      ['Date of return', formatAppleProductDate(getAppleProductValue(product, 'Date of Return', 'dateOfReturn'))],
      ['Date transferred to warehouse', formatAppleProductDate(getAppleProductValue(product, 'Date Transferred to Warehouse', 'dateTransferredToWarehouse'))],
      ['Date left warehouse', formatAppleProductDate(getAppleProductValue(product, 'Date Left Warehouse', 'dateLeftWarehouse'))]
    ]],
    ['Complaint', [['Complaint', getAppleProductValue(product, 'Complaint', 'complaint')]]]
  ];

  const sections = fields.map(([title, items]) => {
    const visibleItems = items.filter(([, value]) => String(value || '').trim() && String(value).trim() !== '—');
    if (!visibleItems.length) return '';
    const sectionClass = {
      'Client & contact': 'unit-detail-client',
      'Phone details': 'unit-detail-unit',
      'Purchase & returns': 'unit-detail-service',
      Complaint: 'unit-detail-notes'
    }[title] || '';
    return `<section class="unit-detail-section ${sectionClass}">
      <h3>${escapeAppleProductHtml(title)}</h3>
      <dl>${visibleItems.map(([label, value]) => `<div class="unit-detail-field"><dt>${escapeAppleProductHtml(label)}</dt><dd>${escapeAppleProductHtml(value)}</dd></div>`).join('')}</dl>
    </section>`;
  });

  appleProductDetailsContent.innerHTML = `
    <header class="unit-details-heading">
      <div class="unit-details-avatar" aria-hidden="true">${escapeAppleProductHtml(clientName.trim().charAt(0).toUpperCase() || 'P')}</div>
      <div class="unit-details-identity">
        <span class="unit-details-eyebrow">PHONE PROFILE</span>
        <h2 id="appleProductDetailsTitle">${escapeAppleProductHtml(clientName)}</h2>
        <span class="unit-details-code">Phone ${escapeAppleProductHtml(code)}</span>
      </div>
      <span class="badge ${getAppleProductStatusClass(status)}"><span class="center-stack">${escapeAppleProductHtml(status)}</span></span>
    </header>
    <div class="unit-details-sections">
      <div class="unit-details-column">${sections[0] || ''}${sections[2] || ''}</div>
      <div class="unit-details-column">${sections[1] || ''}</div>
    </div>
    ${sections[3] ? `<div class="unit-details-bottom">${sections[3]}</div>` : ''}
    <footer class="unit-details-footer">
      <span>Apple Product record</span>
      <button class="action-btn primary" type="button" data-close-apple-product-details>Close</button>
    </footer>`;

  appleProductDetailsReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
  appleProductDetailsBackdrop.classList.add('visible');
  appleProductDetailsBackdrop.setAttribute('aria-hidden', 'false');
  appleProductDetailsBackdrop.querySelector('.unit-details-modal').focus();
}

function closeAppleProductDetails() {
  if (!appleProductDetailsBackdrop) return;
  appleProductDetailsBackdrop.classList.remove('visible');
  appleProductDetailsBackdrop.setAttribute('aria-hidden', 'true');
  if (appleProductDetailsReturnFocus instanceof HTMLElement && appleProductDetailsReturnFocus.isConnected) {
    appleProductDetailsReturnFocus.focus();
  }
}

function getVisibleAppleProductRows() {
  const query = appleProductSearch.value.trim().toLowerCase();
  const selectedBranch = appleProductBranchFilter.value;
  return appleProductRows.filter((row) => {
    const branch = getAppleProductValue(row, 'Branch', 'branch');
    const searchable = Object.values(row).join(' ').toLowerCase();
    return appleProductBranches.some((enabledBranch) => enabledBranch.toLowerCase() === branch.toLowerCase())
      && (!selectedBranch || branch.toLowerCase() === selectedBranch.toLowerCase())
      && (!query || searchable.includes(query));
  });
}

function renderAppleProductRows() {
  if (!appleProductsLoaded) {
    appleProductCount.textContent = '';
    appleProductCardGrid.innerHTML = '<div class="empty-state">Loading phones…</div>';
    return;
  }

  const rows = getVisibleAppleProductRows();
  appleProductCount.textContent = `${rows.length} ${rows.length === 1 ? 'product' : 'products'}`;
  if (!rows.length) {
    appleProductCardGrid.innerHTML = `<div class="empty-state">${appleProductRows.length ? 'No Apple Products match these filters.' : 'No Apple Products have been added yet.'}</div>`;
    return;
  }

  const canEdit = canManageAppleProduct('edit');
  appleProductCardGrid.innerHTML = rows.map((row, rowIndex) => {
    const code = getAppleProductValue(row, 'Code', 'code') || '—';
    const client = getAppleProductValue(row, 'Client Name', 'clientName') || '—';
    const branch = getAppleProductValue(row, 'Branch', 'branch') || '—';
    const serial = getAppleProductValue(row, 'Serial Number', 'serialNumber') || '—';
    const imei = getAppleProductValue(row, 'IMEI', 'imei') || '—';
    const status = getAppleProductValue(row, 'Status', 'status') || 'Unknown';
    return `
      <article class="unit-record-card apple-product-card" data-product-code="${escapeAppleProductHtml(code)}" data-row-index="${rowIndex}">
        <button class="unit-record-card-main" type="button" data-open-product="${rowIndex}" aria-label="View details for ${escapeAppleProductHtml(client)}, phone ${escapeAppleProductHtml(code)}">
          <span class="unit-record-card-heading">
            <span class="unit-record-avatar" aria-hidden="true">${escapeAppleProductHtml(client.trim().charAt(0).toUpperCase() || 'P')}</span>
            <span class="unit-record-identity">
              <span class="unit-record-client">${escapeAppleProductHtml(client)}</span>
              <span class="unit-record-code">${escapeAppleProductHtml(code)}</span>
            </span>
            <span class="badge ${getAppleProductStatusClass(status)}"><span class="center-stack">${escapeAppleProductHtml(status)}</span></span>
          </span>
          <span class="unit-record-specs">${escapeAppleProductHtml(serial)} <span aria-hidden="true">·</span> ${escapeAppleProductHtml(imei)}</span>
          <span class="unit-record-facts">
            <span><small>Branch</small><strong>${escapeAppleProductHtml(branch)}</strong></span>
            <span><small>Client contact</small><strong>${escapeAppleProductHtml(getAppleProductValue(row, 'Contact Info', 'contactInfo') || '—')}</strong></span>
          </span>
          <span class="unit-record-open-label">View full record <span aria-hidden="true">→</span></span>
        </button>
        ${canEdit ? `<div class="unit-record-actions"><div class="table-actions unit-registry-actions"><div class="unit-action-row"><button class="edit" type="button" data-edit-product="${rowIndex}">Edit</button></div></div></div>` : ''}
      </article>
    `;
  }).join('');
}

function configureAppleProductBranches() {
  const assignedBranch = String(localStorage.getItem('unitflowBranch') || '').trim();
  const canSelectAnyBranch = isAppleProductManager();
  appleProductBranches = canSelectAnyBranch
    ? getAppleProductBranchAssignments()
    : getAppleProductBranchAssignments().filter((branch) => branch.toLowerCase() === assignedBranch.toLowerCase());

  const options = canSelectAnyBranch
    ? [new Option('All enabled branches', ''), ...appleProductBranches.map((branch) => new Option(branch, branch))]
    : appleProductBranches.map((branch) => new Option(branch, branch));
  appleProductBranchFilter.replaceChildren(...options);
  appleProductBranchFilter.disabled = !canSelectAnyBranch;

  appleProductBranchInput.replaceChildren(...appleProductBranches.map((branch) => new Option(branch, branch)));
  appleProductBranchInput.disabled = false;
  if (!canSelectAnyBranch && appleProductBranches.length) appleProductBranchInput.value = appleProductBranches[0];
  addAppleProductButton.hidden = !appleProductBranches.length || !canManageAppleProduct('create');
  if (!appleProductBranches.length) {
    appleProductsSyncStatus.textContent = 'Branch not enabled';
  }
}

async function loadAppleProducts() {
  if (appleProductLoadInProgress) return;
  appleProductLoadInProgress = true;
  appleProductsSyncStatus.textContent = 'Syncing…';
  const branchRequest = DATA.fetchAppleProductBranches()
    .then((branches) => ({ branches }))
    .catch((error) => ({ error }));

  try {
    appleProductRows = await DATA.fetchAppleProducts();
    appleProductsLoaded = true;
    if (appleProductBranches.length) {
      appleProductsSyncStatus.textContent = 'Live sync';
      renderAppleProductRows();
    }

    const branchResult = await branchRequest;
    if (branchResult.error) {
      if (!appleProductBranches.length) throw branchResult.error;
      console.error('Unable to refresh Apple Product branches:', branchResult.error);
      appleProductsSyncStatus.textContent = 'Branch list refresh failed';
      return;
    }

    localStorage.setItem('unitflowAppleProductBranches', JSON.stringify(branchResult.branches));
    configureAppleProductBranches();
    appleProductsSyncStatus.textContent = appleProductBranches.length ? 'Live sync' : 'Branch not enabled';
    renderAppleProductRows();
  } catch (error) {
    console.error('Unable to load Apple Products:', error);
    appleProductsLoaded = true;
    appleProductsSyncStatus.textContent = 'Could not load data';
    appleProductCardGrid.innerHTML = `<div class="empty-state">${escapeAppleProductHtml(error.message || 'Unable to load Apple Products.')}</div>`;
  } finally {
    appleProductLoadInProgress = false;
  }
}

function setAppleProductFormValue(name, value) {
  const field = appleProductForm.elements.namedItem(name);
  if (field) field.value = value;
}

function openAppleProductForm(product = null) {
  editingAppleProduct = product ? {
    code: getAppleProductValue(product, 'Code', 'code'),
    branch: getAppleProductValue(product, 'Branch', 'branch')
  } : null;
  appleProductForm.reset();
  appleProductFormError.textContent = '';
  configureAppleProductBranches();
  document.getElementById('appleProductModalTitle').textContent = editingAppleProduct ? 'Edit Phone' : 'Add Phone';
  document.getElementById('appleProductModalDescription').textContent = editingAppleProduct
    ? 'Update the phone and client details.'
    : 'Enter the phone and client details.';
  document.getElementById('appleProductEditorAvatar').textContent = product
    ? (getAppleProductValue(product, 'Client Name', 'clientName').charAt(0).toUpperCase() || 'P')
    : 'P';
  saveAppleProductButton.textContent = editingAppleProduct ? 'Save Changes' : 'Save Phone';
  if (product) {
    setAppleProductFormValue('code', editingAppleProduct.code);
    setAppleProductFormValue('clientName', getAppleProductValue(product, 'Client Name', 'clientName'));
    setAppleProductFormValue('address', getAppleProductValue(product, 'Address', 'address'));
    setAppleProductFormValue('contactInfo', getAppleProductValue(product, 'Contact Info', 'contactInfo'));
    setAppleProductFormValue('status', getAppleProductValue(product, 'Status', 'status'));
    setAppleProductFormValue('serialNumber', getAppleProductValue(product, 'Serial Number', 'serialNumber'));
    setAppleProductFormValue('imei', getAppleProductValue(product, 'IMEI', 'imei'));
    setAppleProductFormValue('branch', editingAppleProduct.branch);
    setAppleProductFormValue('dateOfPurchase', getAppleProductDateInputValue(getAppleProductValue(product, 'Date of Purchase', 'dateOfPurchase')));
    setAppleProductFormValue('dateOfReturn', getAppleProductDateInputValue(getAppleProductValue(product, 'Date of Return', 'dateOfReturn')));
    setAppleProductFormValue('dateTransferredToWarehouse', getAppleProductDateInputValue(getAppleProductValue(product, 'Date Transferred to Warehouse', 'dateTransferredToWarehouse')));
    setAppleProductFormValue('dateLeftWarehouse', getAppleProductDateInputValue(getAppleProductValue(product, 'Date Left Warehouse', 'dateLeftWarehouse')));
    setAppleProductFormValue('complaint', getAppleProductValue(product, 'Complaint', 'complaint'));
  } else {
    const preferredBranch = appleProductBranchFilter.value || appleProductBranches[0] || '';
    if (appleProductBranches.includes(preferredBranch)) appleProductBranchInput.value = preferredBranch;
  }
  appleProductModalBackdrop.classList.add('visible');
  appleProductModalBackdrop.setAttribute('aria-hidden', 'false');
  document.getElementById('appleProductCode').focus();
}

function closeAppleProductForm() {
  appleProductModalBackdrop.classList.remove('visible');
  appleProductModalBackdrop.setAttribute('aria-hidden', 'true');
  editingAppleProduct = null;
}

async function submitAppleProduct(event) {
  event.preventDefault();
  const formData = new FormData(appleProductForm);
  const product = Object.fromEntries(formData.entries());
  if (!product.branch || !appleProductBranches.some((branch) => branch.toLowerCase() === product.branch.toLowerCase())) {
    appleProductFormError.textContent = 'Select a branch enabled for Apple Products.';
    return;
  }

  saveAppleProductButton.disabled = true;
  appleProductFormError.textContent = '';
  try {
    if (editingAppleProduct) {
      await DATA.updateAppleProduct(editingAppleProduct, product, {
        actorRole: localStorage.getItem('unitflowRole') || '',
        actorBranch: localStorage.getItem('unitflowBranch') || ''
      });
    } else {
      await DATA.createAppleProduct(product);
    }
    closeAppleProductForm();
    await loadAppleProducts();
  } catch (error) {
    appleProductFormError.textContent = error.message || 'Unable to save this Apple Product.';
    console.error('Unable to save Apple Product:', error);
  } finally {
    saveAppleProductButton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  configureAppleProductBranches();
  renderAppleProductRows();
  loadAppleProducts();
  appleProductSearch.addEventListener('input', renderAppleProductRows);
  appleProductBranchFilter.addEventListener('change', renderAppleProductRows);
  addAppleProductButton.addEventListener('click', () => openAppleProductForm());
  document.getElementById('closeAppleProductModalButton').addEventListener('click', closeAppleProductForm);
  document.getElementById('cancelAppleProductButton').addEventListener('click', closeAppleProductForm);
  appleProductModalBackdrop.addEventListener('click', (event) => {
    if (event.target === appleProductModalBackdrop) closeAppleProductForm();
  });
  appleProductCardGrid.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    const rowIndex = Number(button && (button.dataset.editProduct ?? button.dataset.openProduct));
    const product = getVisibleAppleProductRows()[rowIndex];
    if (!product) return;
    if (button && button.hasAttribute('data-edit-product')) {
      if (canManageAppleProduct('edit')) openAppleProductForm(product);
      return;
    }
    if (!button || button.hasAttribute('data-open-product')) {
      openAppleProductDetails(product, button || event.target.closest('.apple-product-card'));
    }
  });
  document.getElementById('closeAppleProductDetailsButton').addEventListener('click', closeAppleProductDetails);
  appleProductDetailsBackdrop.addEventListener('click', (event) => {
    if (event.target === appleProductDetailsBackdrop || event.target.closest('[data-close-apple-product-details]')) {
      closeAppleProductDetails();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && appleProductDetailsBackdrop.classList.contains('visible')) closeAppleProductDetails();
  });
  appleProductForm.addEventListener('submit', submitAppleProduct);
});
