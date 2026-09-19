const UI = {
  summaryCards: document.getElementById('summaryCards'),
  unitTableBody: document.getElementById('unitTableBody'),
  branchPulseList: document.getElementById('branchPulseList'),
  syncStatus: document.getElementById('syncStatus'),
  branchCodeChartSection: document.getElementById('branchCodeChartSection'),
  branchCodePie: document.getElementById('branchCodePie'),
  branchCodeLegend: document.getElementById('branchCodeLegend')
};

function renderSummary(units, registeredBranches = []) {
  const total = units.length;
  const now = new Date();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

  const activeTracking = units.filter((unit) => {
    const status = normalizeStatus(unit.status);
    const returnedDate = unit.dateReleased || unit.dateReturn || unit.dateReceived;
    if (!returnedDate) return false;

    const parsedDate = new Date(returnedDate);
    if (Number.isNaN(parsedDate.getTime())) return false;

    const ageMs = now.getTime() - parsedDate.getTime();
    const isReturnedWithinTwoWeeks = ageMs <= twoWeeksMs && (status.includes('returned') || status.includes('released'));
    const isUnderObservation = status.includes('observation') || status.includes('for observation');
    return isReturnedWithinTwoWeeks || isUnderObservation;
  }).length;

  const needsAttention = units.filter((unit) => {
    const status = normalizeStatus(unit.status);
    const returnedDate = unit.dateReleased || unit.dateReturn || unit.dateReceived;
    if (!returnedDate) return false;

    const parsedDate = new Date(returnedDate);
    if (Number.isNaN(parsedDate.getTime())) return false;

    const ageMs = now.getTime() - parsedDate.getTime();
    const isOverdue = ageMs > twoWeeksMs;
    const hasNotBeenReleased = !(status.includes('released') || status.includes('returned') || status.includes('pending'));
    return isOverdue && hasNotBeenReleased;
  }).length;

  const branches = new Set(
    registeredBranches
      .map((branch) => branch.branchName || branch.branch || branch.branchCode || branch.location)
      .map((branch) => normalizeBranchName(branch))
      .filter(Boolean)
  ).size;

  const cards = [
    { label: 'Total units', value: total, dark: true, icon: '◫', meta: 'From last month' },
    { label: 'Active tracking', value: activeTracking, dark: false, icon: '◉', meta: 'Currently in service' },
    { label: 'Needs attention', value: needsAttention, dark: false, icon: '!', meta: 'Due for an update' },
    { label: 'Branches', value: branches, dark: false, icon: '⌂', meta: 'Across your workspace' }
  ];

  UI.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <div class="summary-card ${card.dark ? 'dark' : ''}">
          <div class="card-top">
            <span>${escapeHtml(card.label)}</span>
            <span class="card-icon">${card.icon}</span>
          </div>
          <div>
            <div class="card-value">${card.value}</div>
            <div class="card-meta ${card.dark ? '' : 'trend-up'}">${card.meta}</div>
          </div>
        </div>
      `
    )
    .join('');
}

function normalizeBranchName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getUnitBranchCode(unit, branchCodeByName) {
  const branchName = unit.uploadedBranch || unit.branch || unit.currentLocation || '';
  const mappedCode = branchCodeByName[normalizeBranchName(branchName)];
  return String(mappedCode || unit.branchCode || branchName || 'Unassigned').trim() || 'Unassigned';
}

function renderBranchCodeChart(units, registeredBranches = []) {
  const chartRoles = ['Super Admin', 'Administrator', 'Office', 'Main Head Admin', 'Technician'];
  const currentRole = localStorage.getItem('unitflowRole');

  if (!UI.branchCodeChartSection || !UI.branchCodePie || !UI.branchCodeLegend || !chartRoles.includes(currentRole)) return;

  UI.branchCodeChartSection.hidden = false;

  const branchCodeByName = registeredBranches.reduce((codes, branch) => {
    const branchName = branch.branchName || branch.branchname || branch.name || branch.location || '';
    const branchCode = branch.branchCode || branch.branchcode || branch.branchType || branch.branchtype || branch.code || '';
    if (branchName && branchCode) {
      codes[normalizeBranchName(branchName)] = String(branchCode).trim();
    }
    return codes;
  }, {});

  const branchCounts = units.reduce((counts, unit) => {
    const branchCode = getUnitBranchCode(unit, branchCodeByName);
    counts[branchCode] = (counts[branchCode] || 0) + 1;
    return counts;
  }, {});
  const entries = Object.entries(branchCounts).sort(([, left], [, right]) => right - left);

  if (!entries.length) {
    UI.branchCodePie.style.background = '#e3e6e2';
    UI.branchCodePie.setAttribute('aria-label', 'No registered units by branch code');
    UI.branchCodeLegend.innerHTML = '<div class="empty-state">No registered units available.</div>';
    return;
  }

  const colors = ['#1b6d4c', '#3f78b5', '#7956a8', '#279b9b', '#8a6a4a'];
  const branchCodeColors = {
    bnb: '#f7d75d',
    ez: '#84cc16',
    '1lr': '#ef4444'
  };
  const total = units.length;
  let offset = 0;
  const segments = entries.map(([branchCode, count], index) => {
    const start = offset;
    offset += (count / total) * 100;
    const color = branchCodeColors[normalizeBranchName(branchCode)] || colors[index % colors.length];
    return `${color} ${start}% ${offset}%`;
  });

  UI.branchCodePie.style.background = `conic-gradient(${segments.join(', ')})`;
  UI.branchCodePie.setAttribute('aria-label', `${total} registered units across ${entries.length} branch codes`);
  UI.branchCodeLegend.innerHTML = entries
    .map(([branchCode, count], index) => {
      const percentage = Math.round((count / total) * 100);
      const color = branchCodeColors[normalizeBranchName(branchCode)] || colors[index % colors.length];
      return `
        <div class="branch-code-legend-row">
          <span class="branch-code-legend-label">
            <span class="branch-code-swatch" style="background: ${color};"></span>
            <span>${escapeHtml(branchCode)}</span>
          </span>
          <strong>${count} <small>${percentage}%</small></strong>
        </div>
      `;
    })
    .join('');
}

function renderTable(units) {
  if (!units.length) {
    UI.unitTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">No matching records found.</td>
      </tr>
    `;
    return;
  }

  const recentUnits = units
    .map((unit, index) => ({ unit, index }))
    .sort((left, right) => {
      const leftDate = getActivityDateKey(left.unit);
      const rightDate = getActivityDateKey(right.unit);

      if (leftDate === rightDate) return left.index - right.index;
      if (!leftDate) return 1;
      if (!rightDate) return -1;
      return rightDate.localeCompare(leftDate);
    })
    .slice(0, 5)
    .map(({ unit }) => unit);

  UI.unitTableBody.innerHTML = recentUnits
    .map(
      (unit) => `
        <tr>
          <td>${escapeHtml(unit.unitCode || '—')}</td>
          <td>${escapeHtml(unit.clientName || '—')}</td>
          <td><span class="badge ${statusClass(unit.status)}">${escapeHtml(unit.status || 'Unknown')}</span></td>
          <td>${escapeHtml(unit.currentLocation || unit.uploadedBranch || unit.branchLocation || unit.location || '—')}</td>
        </tr>
      `
    )
    .join('');
}

function getActivityDateKey(unit) {
  const activityDate = unit.dateReleased || unit.dateReturn || unit.dateReceived || unit.datePurchase;
  if (!activityDate) return '';

  if (typeof getManilaDateKey === 'function') {
    return getManilaDateKey(activityDate) || '';
  }

  const parsedDate = new Date(activityDate);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString().slice(0, 10);
}

function renderBranchPulse(units) {
  const branchCounts = {};

  units.forEach((unit) => {
    const branch = unit.uploadedBranch || 'Unknown';
    branchCounts[branch] = (branchCounts[branch] || 0) + 1;
  });

  const entries = Object.entries(branchCounts).slice(0, 5);

  if (!entries.length) {
    UI.branchPulseList.innerHTML = '<div class="empty-state">No branches available.</div>';
    return;
  }

  const maxCount = Math.max(...entries.map(([, value]) => value), 1);

  UI.branchPulseList.innerHTML = entries
    .map(([branch, count]) => {
      const percentage = Math.max(20, Math.round((count / maxCount) * 100));
      return `
        <div class="branch-row">
          <div class="branch-head">
            <span>${escapeHtml(branch)}</span>
            <span>${count}</span>
          </div>
          <div class="branch-bar">
            <div class="branch-fill" style="width: ${percentage}%;"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function buildBranchOptions(units) {
  const uniqueBranches = [...new Set(units.map((unit) => unit.uploadedBranch).filter(Boolean))].sort();
  return uniqueBranches;
}

function setSyncStatus(message, isLive = true) {
  UI.syncStatus.textContent = message;
  const dot = UI.syncStatus.parentElement.querySelector('.dot');
  if (dot) {
    dot.classList.toggle('live', isLive);
  }
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function statusClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized.includes('in stock')) return 'in-stock';
  if (normalized.includes('assigned')) return 'assigned';
  if (normalized.includes('released')) return 'released';
  if (normalized.includes('returned')) return 'returned';
  if (normalized.includes('pending')) return 'pending-return';

  return 'in-stock';
}

function formatCurrency(value) {
  const cleaned = Number(String(value || '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(cleaned)) return value || '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(cleaned);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
