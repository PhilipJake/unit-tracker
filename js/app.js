const state = {
  allUnits: [],
  filters: {
    search: '',
    status: 'all',
    branch: 'all'
  }
};

function setOverviewHeader() {
  const dateElement = document.getElementById('overviewDate');
  const greetingElement = document.getElementById('overviewGreeting');

  if (dateElement) {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila'
    });
    dateElement.textContent = formatter.format(now);
  }

  if (greetingElement) {
    const fullName = localStorage.getItem('unitflowFullName') || localStorage.getItem('unitflowUser') || 'User';
    greetingElement.textContent = `Welcome, ${fullName}.`;
  }
}

async function loadUnits() {
  try {
    setSyncStatus('Syncing…');
    const [rows, registeredBranches] = await Promise.all([
      DATA.fetchUnits(),
      DATA.fetchBranches()
    ]);
    state.allUnits = rows;

    renderSummary(rows, registeredBranches);
    renderTable(rows);
    renderBranchPulse(rows);
    setSyncStatus('Live sync', true);
  } catch (error) {
    console.error(error);
    setSyncStatus('Could not load live data', false);
    renderSummary([], []);
    renderTable([]);
    UI.branchPulseList.innerHTML = '<div class="empty-state">Unable to load live spreadsheet data.</div>';
  }
}

function startPolling() {
  const intervalMs = window.GS_CONFIG?.refreshMs || 15000;
  setInterval(() => {
    loadUnits();
  }, intervalMs);
}

document.addEventListener('DOMContentLoaded', () => {
  setOverviewHeader();
  loadUnits();
  startPolling();
});
