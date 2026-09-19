const trashTableBody = document.getElementById('trashTableBody');
const trashSearchInput = document.getElementById('trashSearchInput');
const trashMessageModalBackdrop = document.getElementById('trashMessageModalBackdrop');
const trashMessageModalBody = document.getElementById('trashMessageModalBody');
let trashRows = [];

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

function formatTrashDate(value) {
  if (!value) return '—';
  const rawValue = String(value).trim();
  const googleDate = rawValue.match(/^Date\((\d+)\)$/);
  const date = googleDate ? new Date(Number(googleDate[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderTrashRows() {
  const searchTerm = String(trashSearchInput.value || '').trim().toLowerCase();
  const rows = trashRows.filter((row) => {
    const searchable = [row.unitCode, row.clientName, row.branchLocation, row.uploadedBranch, row.currentLocation].join(' ').toLowerCase();
    return !searchTerm || searchable.includes(searchTerm);
  });

  if (!rows.length) {
    trashTableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No deleted units found.</td></tr>';
    return;
  }

  const canRestore = canManageAction('edit');
  const canPurge = canManageAction('delete');
  trashTableBody.innerHTML = rows.map((row) => `
    <tr data-unit-code="${escapeHtml(row.unitCode)}">
      <td><strong>${escapeHtml(row.unitCode || '—')}</strong></td>
      <td>${escapeHtml(row.clientName || '—')}</td>
      <td>${escapeHtml(row.branchLocation || row.uploadedBranch || row.currentLocation || '—')}</td>
      <td>${escapeHtml(formatTrashDate(row.deletedAt))}</td>
      <td>${escapeHtml(formatTrashDate(row.expiresAt))}</td>
      <td class="table-actions">
        <button class="restore" type="button" ${canRestore ? '' : 'disabled'}>Restore</button>
        <button class="purge delete" type="button" ${canPurge ? '' : 'disabled'}><span>Delete</span><span>Permanently</span></button>
      </td>
    </tr>
  `).join('');
}

async function updateTrash(action, unitCode) {
  const appScriptUrl = window.GS_CONFIG ? window.GS_CONFIG.appScriptUrl : '';
  if (!appScriptUrl) throw new Error('Apps Script URL is not configured.');

  const response = await fetch(appScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ action, unitCode, actorRole: getCurrentRole(), actorName: getLoggedInUserName() }).toString()
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

document.addEventListener('DOMContentLoaded', () => {
  trashSearchInput.addEventListener('input', renderTrashRows);
  document.getElementById('closeTrashMessageBtn').addEventListener('click', closeTrashMessage);
  document.getElementById('okTrashMessageBtn').addEventListener('click', closeTrashMessage);
  trashTableBody.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    const row = button && button.closest('tr');
    if (!button || !row) return;
    const unitCode = row.dataset.unitCode;
    const action = button.classList.contains('restore') ? 'restoreUnit' : 'purgeUnit';
    const prompt = action === 'restoreUnit' ? `Restore unit ${unitCode}?` : `Permanently delete unit ${unitCode}? This cannot be undone.`;
    if (!window.confirm(prompt)) return;
    try {
      await updateTrash(action, unitCode);
      showTrashMessage(action === 'restoreUnit' ? 'Unit restored successfully.' : 'Unit permanently deleted.');
      await loadTrash();
    } catch (error) {
      console.error(error);
      showTrashMessage(error.message || 'The trash action failed.');
    }
  });
  loadTrash();
  setInterval(loadTrash, window.GS_CONFIG?.refreshMs || 15000);
});
