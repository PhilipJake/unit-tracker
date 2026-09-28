(function () {
let trashTableBody = null;
let trashSearchInput = null;
let trashMessageModalBackdrop = null;
let trashMessageModalBody = null;
let trashToast = null;
let trashRows = [];
let trashToastTimer = null;
let trashRefreshTimer = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showTrashMessage(message) {
  trashMessageModalBody.textContent = message;
  trashMessageModalBackdrop.classList.add('visible');
  trashMessageModalBackdrop.setAttribute('aria-hidden', 'false');
}

function closeTrashMessage() {
  trashMessageModalBackdrop.classList.remove('visible');
  trashMessageModalBackdrop.setAttribute('aria-hidden', 'true');
}

function showTrashToast(message) {
  if (!trashToast) return;
  trashToast.textContent = message;
  trashToast.classList.add('visible');
  window.clearTimeout(trashToastTimer);
  trashToastTimer = window.setTimeout(() => trashToast.classList.remove('visible'), 4000);
}

function formatTrashDate(value) {
  if (!value) return '—';
  const rawValue = String(value).trim();
  const googleDate = rawValue.match(/^Date\((\d+)\)$/);
  const date = googleDate ? new Date(Number(googleDate[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' }).format(date);
}

function branchClass(branch) {
  const normalized = String(branch || '').toLowerCase();
  if (normalized.includes('bnb')) return 'bnb';
  if (normalized.includes('ez')) return 'ez';
  if (normalized.includes('1lr')) return 'one-lr';
  return 'bnb';
}

function renderTrashBranch(branch) {
  const text = String(branch || '').trim();
  if (!text) return '—';
  const cleaned = text.replace(/\s*[\/+|,-]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^([A-Za-z0-9]+)\s+(.+)$/);
  if (!match) return `<span class="line">${escapeHtml(cleaned)}</span>`;
  return `<span class="line">${escapeHtml(match[1])}</span><span class="line">${escapeHtml(match[2])}</span>`;
}

function renderTrashRows() {
  const searchTerm = String(trashSearchInput.value || '').trim().toLowerCase();
  const rows = trashRows.filter((row) => {
    const searchable = [row.unitCode, row.clientName, row.branchLocation, row.uploadedBranch, row.currentLocation, row.deletedBy].join(' ').toLowerCase();
    return !searchTerm || searchable.includes(searchTerm);
  });

  if (!rows.length) {
    trashTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No deleted units found.</td></tr>';
    return;
  }

  const canRestore = canManageAction('edit');
  const canArchive = canManageAction('delete');
  trashTableBody.innerHTML = rows.map((row) => `
    <tr data-unit-code="${escapeHtml(row.unitCode)}" data-source="${escapeHtml(row.source || 'trash')}">
      <td><strong>${escapeHtml(row.unitCode || '—')}</strong></td>
      <td>${escapeHtml(row.clientName || '—')}</td>
      <td><span class="branch-tag ${branchClass(row.branchLocation || row.uploadedBranch || row.currentLocation)}"><span class="center-stack">${renderTrashBranch(row.branchLocation || row.uploadedBranch || row.currentLocation)}</span></span></td>
      <td class="date-column">${escapeHtml(formatTrashDate(row.deletedAt))}</td>
      <td>${escapeHtml(row.deletedBy || '—')}</td>
      <td class="table-actions">
        <button class="restore" type="button" ${canRestore ? '' : 'disabled'}>Restore</button>
        ${row.source === 'units' ? `<button class="archive" type="button" ${canArchive ? '' : 'disabled'}>Delete Permanently</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function updateTrash(action, unitCode, source) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl) throw new Error('Apps Script URL is not configured.');

  const response = await fetch(appScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ action, unitCode, source, actorRole: getCurrentRole(), actorName: getLoggedInUserName() }).toString()
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || (result && result.ok === false)) throw new Error((result && result.error) || `Request failed with status ${response.status}.`);
}

async function loadTrash() {
  const status = document.getElementById('trashSyncStatus');
  try {
    if (status) status.textContent = 'Syncing…';
    trashRows = await DATA.fetchTrash();
    renderTrashRows();
    if (status) status.textContent = 'Live sync';
  } catch (error) {
    console.error(error);
    trashTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">Unable to load deleted units.</td></tr>';
    if (status) status.textContent = 'Sync unavailable';
  }
}

function initTrashPage() {
  const currentTableBody = document.getElementById('trashTableBody');
  if (!currentTableBody) return;
  if (trashTableBody === currentTableBody) {
    loadTrash();
    return;
  }

  trashTableBody = currentTableBody;
  trashSearchInput = document.getElementById('trashSearchInput');
  trashMessageModalBackdrop = document.getElementById('trashMessageModalBackdrop');
  trashMessageModalBody = document.getElementById('trashMessageModalBody');
  trashToast = document.getElementById('trashToast');

  trashSearchInput.addEventListener('input', renderTrashRows);
  document.getElementById('closeTrashMessageBtn').addEventListener('click', closeTrashMessage);
  document.getElementById('okTrashMessageBtn').addEventListener('click', closeTrashMessage);
  trashTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    const row = button && button.closest('tr');
    if (!button || !row) return;
    const unitCode = row.dataset.unitCode;
    const source = row.dataset.source || 'trash';
    const action = button.classList.contains('archive') ? 'archiveUnit' : 'restoreUnit';
    if (action === 'restoreUnit' && !button.classList.contains('restore')) return;
    const confirmationMessage = action === 'restoreUnit'
      ? `Restore unit ${unitCode}?`
      : `Move unit ${unitCode} to the recovery archive? Its full row will be copied to the Trash sheet.`;
    showAppPopup(confirmationMessage, async () => {
      try {
        await updateTrash(action, unitCode, source);
        showTrashToast(action === 'restoreUnit' ? 'Unit restored successfully.' : 'Unit archived successfully.');
        await loadTrash();
      } catch (error) {
        console.error(error);
        showTrashMessage(error.message || 'The trash action failed.');
      }
    });
  });
  loadTrash();
  if (window.location.pathname.endsWith('/trash.html') && !trashRefreshTimer) {
    trashRefreshTimer = window.setInterval(loadTrash, window.GS_CONFIG?.refreshMs || 15000);
  }
}

function disposeTrashPage() {
  if (!trashRefreshTimer) return;
  window.clearInterval(trashRefreshTimer);
  trashRefreshTimer = null;
}

window.UnitflowTrashView = { init: initTrashPage, dispose: disposeTrashPage };

if (window.location.pathname.endsWith('/trash.html')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTrashPage, { once: true });
  } else {
    initTrashPage();
  }
}
})();
