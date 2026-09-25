const UI = {
  summaryCards: document.getElementById('summaryCards'),
  unitTableBody: document.getElementById('unitTableBody'),
  branchPulseList: document.getElementById('branchPulseList'),
  syncStatus: document.getElementById('syncStatus'),
  branchCodeChartSection: document.getElementById('branchCodeChartSection'),
  branchCodePie: document.getElementById('branchCodePie'),
  branchCodeLegend: document.getElementById('branchCodeLegend'),
  branchCodeTotal: document.getElementById('branchCodeTotal'),
  activityChart: document.getElementById('activityChart'),
  activityChartSummary: document.getElementById('activityChartSummary'),
  activityChartPeriod: document.getElementById('activityChartPeriod'),
  activityChartLegend: document.getElementById('activityChartLegend')
};

function renderSummary(units, registeredBranches = []) {
  const total = units.length;
  const now = new Date();
  const attentionDays = 14;
  const activeStatuses = new Set(['for observation', 'transferred to technical', 'for replacement', 'for release']);

  const activeTracking = units.filter((unit) => {
    const status = normalizeStatus(unit.status);
    const currentLocation = normalizeStatus(unit.currentLocation || unit.branchLocation || unit.uploadedBranch);
    return activeStatuses.has(status) || (status === 'in service' && currentLocation === 'warehouse');
  }).length;

  const needsAttention = units.filter((unit) => {
    const status = normalizeStatus(unit.status);
    if (status === 'released') return false;
    const receivedDateKey = getActivityDateKey({ dateReceived: unit.dateReturn || unit.dateReceived });
    if (!receivedDateKey) return false;
    const receivedAt = typeof dateKeyToUtcMidnight === 'function'
      ? dateKeyToUtcMidnight(receivedDateKey)
      : new Date(`${receivedDateKey}T00:00:00`).getTime();
    const ageDays = Math.floor((Date.now() - receivedAt) / (24 * 60 * 60 * 1000));
    return ageDays >= attentionDays;
  }).length;

  const branches = new Set(
    registeredBranches
      .map((branch) => branch.branchName || branch.branch || branch.branchCode || branch.location)
      .map((branch) => normalizeBranchName(branch))
      .filter(Boolean)
  ).size;

  const cards = [
    { label: 'Total units', value: total, dark: true, icon: '◫', meta: 'From last month' },
    { label: 'Active tracking', value: activeTracking, dark: false, icon: '◉', meta: 'Open workflow units' },
    { label: 'Needs attention', value: needsAttention, dark: false, icon: '!', meta: '14+ days without release or urgent' },
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
  return String(mappedCode || branchName || 'Unassigned').trim() || 'Unassigned';
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
    UI.branchCodeTotal.textContent = '0';
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
  UI.branchCodeTotal.textContent = total;
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

function renderActivityChart(units) {
  if (!UI.activityChart || !UI.activityChartSummary) return;

  const today = new Date();
  const activityDateKeys = units
    .flatMap((unit) => {
      const dates = [getActivityDateKey({ dateReceived: unit.dateReturn || unit.dateReceived })];
      if (normalizeStatus(unit.status) === 'released') {
        dates.push(getActivityDateKey({ dateReleased: unit.dateReleased }));
      }
      return dates;
    })
    .filter(Boolean)
    .sort();
  const chartDate = activityDateKeys.length
    ? new Date(`${activityDateKeys[activityDateKeys.length - 1]}T12:00:00`)
    : today;
  const firstActivityDate = activityDateKeys.length
    ? new Date(`${activityDateKeys[0]}T12:00:00`)
    : chartDate;
  const lastDay = new Date(chartDate.getFullYear(), chartDate.getMonth(), chartDate.getDate(), 12);
  const firstDay = new Date(firstActivityDate.getFullYear(), firstActivityDate.getMonth(), firstActivityDate.getDate(), 12);
  const maxChartDays = 366;
  if (Math.floor((lastDay - firstDay) / (24 * 60 * 60 * 1000)) + 1 > maxChartDays) {
    firstDay.setTime(lastDay.getTime());
    firstDay.setDate(firstDay.getDate() - (maxChartDays - 1));
  }
  const dayCount = Math.max(1, Math.floor((lastDay - firstDay) / (24 * 60 * 60 * 1000)) + 1);
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return typeof getManilaDateKey === 'function'
      ? getManilaDateKey(date)
      : date.toISOString().slice(0, 10);
  });
  const dayLabels = days.map((day) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  if (UI.activityChartPeriod) {
    UI.activityChartPeriod.textContent = `${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  const dayIndexes = new Map(days.map((day, index) => [day, index]));
  const received = Array(days.length).fill(0);
  const released = Array(days.length).fill(0);

  units.forEach((unit) => {
    const receivedDate = getActivityDateKey({ dateReceived: unit.dateReturn || unit.dateReceived });
    const releasedDate = getActivityDateKey({ dateReleased: unit.dateReleased });
    const receivedIndex = dayIndexes.get(receivedDate);
    const releasedIndex = dayIndexes.get(releasedDate);
    const isReleased = normalizeStatus(unit.status) === 'released';
    if (receivedDate && receivedIndex !== undefined) {
      received[receivedIndex] += 1;
    }
    if (isReleased && releasedDate && releasedIndex !== undefined) {
      released[releasedIndex] += 1;
    }
  });
  received.forEach((value, index) => {
    if (index > 0) received[index] += received[index - 1];
  });
  released.forEach((value, index) => {
    if (index > 0) released[index] += released[index - 1];
  });
  const maxValue = 10;
  const chartWidth = 560;
  const chartHeight = 190;
  const padding = { top: 14, right: 12, bottom: 30, left: 38 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const xIndexRatio = (index) => index / Math.max(days.length - 1, 1);
  const point = (value, index) => ({
    x: padding.left + xIndexRatio(index) * plotWidth,
    y: padding.top + plotHeight - (Math.min(value, maxValue) / maxValue) * plotHeight
  });
  const gridLines = [0, 0.33, 0.66, 1].map((ratio) => {
    const y = padding.top + plotHeight - ratio * plotHeight;
    return `<line x1="${padding.left}" y1="${y}" x2="${chartWidth - padding.right}" y2="${y}" />`;
  }).join('');
  const scaleLabels = [0, 5, 10].map((value) => {
    const y = padding.top + plotHeight - (value / maxValue) * plotHeight + 3;
    return `<text x="${padding.left - 9}" y="${y}" text-anchor="end">${value}</text>`;
  }).join('');
  const labelStep = Math.max(1, Math.ceil(days.length / 6));
  const labelIndexes = [...new Set([0, ...Array.from({ length: 5 }, (_, index) => (index + 1) * labelStep).filter((index) => index < days.length), days.length - 1])];
  const labels = labelIndexes.map((index) => `<text x="${padding.left + xIndexRatio(index) * plotWidth}" y="${chartHeight - 7}" text-anchor="middle">${dayLabels[index]}</text>`).join('');
  const pathFor = (values) => values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value > 0)
    .map(({ value, index }, pointIndex, points) => {
      const coordinates = point(value, index);
      return `${pointIndex === 0 ? 'M' : 'L'} ${coordinates.x} ${coordinates.y}`;
    })
    .join(' ');
  const circles = (values, color) => values.map((value, index) => {
    if (value <= 0) return '';
    const coordinates = point(value, index);
    return `<circle class="activity-point" style="fill: ${color};" cx="${coordinates.x}" cy="${coordinates.y}" r="3.5" />`;
  }).join('');
  const receivedColor = '#3f78b5';
  const releasedColor = '#d87932';
  const activityLines = `
    <path class="activity-line" style="stroke: ${receivedColor};" d="${pathFor(received)}" />
    <path class="activity-line" style="stroke: ${releasedColor};" d="${pathFor(released)}" />
    ${circles(received, receivedColor)}
    ${circles(released, releasedColor)}
  `;

  UI.activityChart.innerHTML = `
    <svg viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none" aria-hidden="true">
      <g class="activity-grid">${gridLines}</g>
      <line class="activity-axis" x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${chartWidth - padding.right}" y2="${padding.top + plotHeight}" />
      <g class="activity-scale-labels">${scaleLabels}</g>
      ${activityLines}
      <g class="activity-labels">${labels}</g>
    </svg>
  `;

  const receivedTotal = received[received.length - 1] || 0;
  const releasedTotal = released[released.length - 1] || 0;
  if (receivedTotal + releasedTotal === 0) {
    UI.activityChart.innerHTML = '<div class="activity-chart-empty">No recorded activity.</div>';
  }
  UI.activityChartSummary.innerHTML = `
    <div><strong>${receivedTotal}</strong><span>received</span></div>
    <div><strong>${releasedTotal}</strong><span>released</span></div>
  `;
  if (UI.activityChartLegend) {
    UI.activityChartLegend.innerHTML = `
      <span><i class="activity-dot" style="background: ${receivedColor};"></i>Received</span>
      <span><i class="activity-dot" style="background: ${releasedColor};"></i>Released</span>
    `;
  }
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

  if (normalized === 'released') return 'released';
  if (normalized === 'for observation' || normalized === 'transferred to technical') return 'observation';
  if (normalized === 'for replacement') return 'urgent';
  if (normalized === 'for release') return 'pending-return';
  if (normalized === 'in service') return 'in-stock';

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
