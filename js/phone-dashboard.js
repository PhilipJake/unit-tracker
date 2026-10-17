const phoneDashboardSyncStatus = document.getElementById('phoneDashboardSyncStatus');
const phoneDashboardRecentRows = document.getElementById('phoneDashboardRecentRows');
const phoneDashboardBranchList = document.getElementById('phoneDashboardBranchList');
let phoneDashboardLoadInProgress = false;

function getPhoneDashboardValue(row, header, property) {
  const normalizedHeader = header.toLowerCase();
  const normalizedProperty = property.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return String(row[header] ?? row[normalizedHeader] ?? row[property] ?? row[normalizedProperty] ?? '').trim();
}

function escapePhoneDashboardHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderPhoneDashboard(rows, branches) {
  const normalizedRows = rows.filter((row) => branches.some((branch) => (
    branch.toLowerCase() === getPhoneDashboardValue(row, 'Branch', 'branch').toLowerCase()
  )));
  const currentUserBranch = String(localStorage.getItem('unitflowBranch') || '').trim().toLowerCase();
  const canSelectAnyBranch = ['Super Admin', 'Administrator'].includes(localStorage.getItem('unitflowRole'));
  const visibleRows = canSelectAnyBranch || !currentUserBranch
    ? normalizedRows
    : normalizedRows.filter((row) => getPhoneDashboardValue(row, 'Branch', 'branch').toLowerCase() === currentUserBranch);
  const statuses = visibleRows.map((row) => getPhoneDashboardValue(row, 'Status', 'status').toLowerCase());
  const warehouseCount = visibleRows.filter((row) => {
    const status = getPhoneDashboardValue(row, 'Status', 'status').toLowerCase();
    const transferred = getPhoneDashboardValue(row, 'Date Transferred to Warehouse', 'dateTransferredToWarehouse');
    const leftWarehouse = getPhoneDashboardValue(row, 'Date Left Warehouse', 'dateLeftWarehouse');
    return status === 'warehouse' || status === 'in warehouse' || Boolean(transferred && !leftWarehouse);
  }).length;

  document.getElementById('phoneDashboardTotal').textContent = String(visibleRows.length);
  document.getElementById('phoneDashboardForRelease').textContent = String(statuses.filter((status) => status === 'for release').length);
  document.getElementById('phoneDashboardReleased').textContent = String(statuses.filter((status) => status === 'released').length);
  document.getElementById('phoneDashboardWarehouse').textContent = String(warehouseCount);
  document.getElementById('phoneDashboardBranchSummary').textContent = canSelectAnyBranch
    ? `Across ${branches.length} enabled ${branches.length === 1 ? 'branch' : 'branches'}`
    : (localStorage.getItem('unitflowBranch') || 'Assigned branch');

  const dateForSort = (row) => {
    const value = getPhoneDashboardValue(row, 'Date of Purchase', 'dateOfPurchase');
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : '';
  };
  const recentRows = [...visibleRows].sort((left, right) => dateForSort(right).localeCompare(dateForSort(left))).slice(0, 8);
  phoneDashboardRecentRows.innerHTML = recentRows.length
    ? recentRows.map((row) => `<tr>
        <td>${escapePhoneDashboardHtml(getPhoneDashboardValue(row, 'Code', 'code') || '—')}</td>
        <td>${escapePhoneDashboardHtml(getPhoneDashboardValue(row, 'Client Name', 'clientName') || '—')}</td>
        <td>${escapePhoneDashboardHtml(getPhoneDashboardValue(row, 'Status', 'status') || 'Unknown')}</td>
        <td>${escapePhoneDashboardHtml(getPhoneDashboardValue(row, 'Branch', 'branch') || '—')}</td>
        <td>${escapePhoneDashboardHtml(dateForSort(row) || '—')}</td>
      </tr>`).join('')
    : '<tr><td colspan="5">No phone records are available for your branch.</td></tr>';

  const branchCounts = branches
    .filter((branch) => canSelectAnyBranch || !currentUserBranch || branch.toLowerCase() === currentUserBranch)
    .map((branch) => ({
      name: branch,
      count: visibleRows.filter((row) => getPhoneDashboardValue(row, 'Branch', 'branch').toLowerCase() === branch.toLowerCase()).length
    }));
  phoneDashboardBranchList.innerHTML = branchCounts.length
    ? branchCounts.map(({ name, count }) => `<div class="branch-row"><div class="branch-head"><span>${escapePhoneDashboardHtml(name)}</span><strong>${count}</strong></div></div>`).join('')
    : '<div class="empty-state">No Apple Product branches are enabled.</div>';
}

async function loadPhoneDashboard() {
  if (phoneDashboardLoadInProgress) return;
  phoneDashboardLoadInProgress = true;
  phoneDashboardSyncStatus.textContent = 'Syncing…';
  try {
    const [rows, branches] = await Promise.all([
      DATA.fetchAppleProducts(),
      DATA.fetchAppleProductBranches()
    ]);
    localStorage.setItem('unitflowAppleProductBranches', JSON.stringify(branches));
    renderPhoneDashboard(rows, branches);
    phoneDashboardSyncStatus.textContent = 'Live sync';
  } catch (error) {
    console.error('Unable to load the phone dashboard:', error);
    phoneDashboardSyncStatus.textContent = 'Could not load data';
    phoneDashboardRecentRows.innerHTML = `<tr><td colspan="5">${escapePhoneDashboardHtml(error.message || 'Unable to load phone data.')}</td></tr>`;
    phoneDashboardBranchList.innerHTML = '<div class="empty-state">Unable to load branch data.</div>';
  } finally {
    phoneDashboardLoadInProgress = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fullName = localStorage.getItem('unitflowFullName') || localStorage.getItem('unitflowUser') || 'User';
  document.getElementById('phoneDashboardGreeting').textContent = `Welcome, ${fullName}.`;
  document.getElementById('phoneDashboardDate').textContent = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila'
  }).format(new Date());

  loadPhoneDashboard();
  const intervalMs = window.GS_CONFIG?.refreshMs || 15000;
  window.setInterval(loadPhoneDashboard, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadPhoneDashboard();
  });
});
