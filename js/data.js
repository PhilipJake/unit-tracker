const DATA = {
  async fetchSheet({ sheetId, gid } = {}) {
    const config = window.GS_CONFIG || {};
    const resolvedSheetId = sheetId || config.sheetId;
    const resolvedGid = gid ?? config.gid ?? '0';

    if (!resolvedSheetId || resolvedSheetId === 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE') {
      throw new Error('Add your Google Sheet ID in gs/config.js before loading the app.');
    }

    const url = `https://docs.google.com/spreadsheets/d/${resolvedSheetId}/export?format=csv&gid=${resolvedGid}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Google Sheet request failed with status ${response.status}.`);
    }

    const csvText = await response.text();
    return parseCsv(csvText);
  },

  async fetchUnits() {
    const config = window.GS_CONFIG || {};
    const rows = await DATA.fetchSheet({ gid: config.gid || '0' });
    return applyRoleDataFilter(rows);
  },

  async fetchAccounts() {
    const config = window.GS_CONFIG || {};
    return DATA.fetchSheet({ gid: config.accountsGid || config.gid || '0' });
  },

  async fetchBranches() {
    const config = window.GS_CONFIG || {};
    return DATA.fetchSheet({ gid: config.branchesGid || config.gid || '0' });
  },

  async fetchMessages() {
    const config = window.GS_CONFIG || {};
    const url = `${config.appScriptUrl}?action=messages`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Messages request failed with status ${response.status}.`);
    }

    const result = await response.json();
    return Array.isArray(result.rows) ? result.rows : [];
  }
};

function applyRoleDataFilter(rows) {
  const role = localStorage.getItem('unitflowRole');
  if (role !== 'Branch Head Admin') {
    return rows;
  }

  const assignedBranch = String(localStorage.getItem('unitflowBranch') || '').trim();
  if (!assignedBranch) {
    return [];
  }

  const normalizedAssignedBranch = normalizeBranchToken(assignedBranch);

  return rows.filter((row) => {
    const branchCandidates = [
      row.uploadedBranch,
      row.branchLocation,
      row.currentLocation,
      row.branch,
      row.branchName,
      row.location,
      row.branchname,
      row.branch,
      row.name
    ];

    return branchCandidates.some((candidate) => {
      const normalizedCandidate = normalizeBranchToken(candidate || '');
      return normalizedCandidate === normalizedAssignedBranch || normalizedCandidate.includes(normalizedAssignedBranch);
    });
  });
}

function normalizeBranchToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');

  if (!lines.length) {
    return [];
  }

  const headers = parseCsvRow(lines[0]).map((header) => normalizeHeader(header));
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvRow(lines[index]);
    if (values.length === 0 || values.every((value) => !String(value).trim())) {
      continue;
    }

    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });

    const normalized = normalizeRow(row);
    if (normalized.unitCode || normalized.clientName || normalized.status) {
      rows.push(normalized);
    }
  }

  return rows;
}

function parseCsvRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeRow(rawRow) {
  const row = {};

  Object.entries(rawRow).forEach(([key, value]) => {
    row[key] = String(value || '').trim();
  });

  const unitCode = findValue(row, ['unit code', 'unitcode', 'code']);
  const clientName = findValue(row, ['client name', 'clientname', 'client']);
  const contactInfo = findValue(row, ['contact info', 'contactinfo', 'contact number', 'phone', 'mobile']);
  const unitBrand = findValue(row, ['unit brand', 'unitbrand', 'brand']);
  const unitProblem = findValue(row, ['unit problem', 'unitproblem', 'problem']);
  const unitPrice = findValue(row, ['unit price', 'price']);
  const specs = findValue(row, ['specs', 'unit specs', 'unitspecs', 'processor', 'storage size', 'storage']);
  const uploadedBranch = findValue(row, ['uploaded branch', 'uploadedbranch', 'branch']);
  const currentLocation = findValue(row, ['current location', 'currentlocation', 'location']);
  const dateReceived = findValue(row, ['date received', 'datereceived', 'received date']);
  const dateReleased = findValue(row, ['date released', 'datereleased', 'released date', 'return date', 'returndate', 'date return', 'datereturn']);
  const status = findValue(row, ['status']);
  const accountType = findValue(row, ['account type', 'accounttype', 'role', 'user type', 'usertype']);
  const username = findValue(row, ['username', 'user name', 'user', 'login']);
  const password = findValue(row, ['password', 'pass', 'pwd']);
  const fullName = findValue(row, ['full name', 'fullname', 'name']);
  const email = findValue(row, ['email']);
  const branch = findValue(row, ['branch', 'branch location', 'branchlocation']);
  const branchName = findValue(row, ['branch name', 'branchname', 'name']);
  const branchCode = findValue(row, ['branch code', 'branchcode', 'branch type', 'branchtype', 'code']);
  const manager = findValue(row, ['manager', 'head admin', 'headadmin', 'branch manager', 'branchmanager']);
  const runningDays = computeRunningDays(dateReleased || dateReceived);

  return {
    ...row,
    unitCode: unitCode || '',
    clientName: clientName || '',
    contactInfo: contactInfo || '',
    unitBrand: unitBrand || '',
    unitProblem: unitProblem || '',
    unitPrice: unitPrice || '',
    specs: specs || '',
    uploadedBranch: uploadedBranch || '',
    currentLocation: currentLocation || '',
    dateReceived: dateReceived || '',
    dateReleased: dateReleased || '',
    runningDays: runningDays || '',
    status: status || row.status || 'Unknown',
    accountType: accountType || '',
    username: username || row.username || '',
    password: password || row.password || '',
    fullName: fullName || row.fullname || row.name || '',
    email: email || row.email || '',
    branch: branch || row.branch || '',
    branchName: branchName || '',
    branchCode: branchCode || '',
    manager: manager || '',
  };
}

function computeRunningDays(dateValue) {
  if (!dateValue) return '';

  const targetDateKey = getManilaDateKey(dateValue);
  if (!targetDateKey) return '';

  const nowDateKey = getManilaDateKey(new Date());
  const nowAtMidnight = dateKeyToUtcMidnight(nowDateKey);
  const targetAtMidnight = dateKeyToUtcMidnight(targetDateKey);
  const diffDays = Math.max(0, Math.floor((nowAtMidnight - targetAtMidnight) / (1000 * 60 * 60 * 24)));

  return String(diffDays);
}

function getManilaDateKey(dateValue) {
  const value = String(dateValue || '').trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    const [month, day, year] = value.split('/').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(parsed);
  const dateParts = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function dateKeyToUtcMidnight(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function findValue(row, keys) {
  for (const key of keys) {
    if (row[key]) {
      return row[key];
    }
  }

  return '';
}
