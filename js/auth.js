const fallbackAccounts = {
  'superadmin': { password: 'admin123', role: 'Super Admin', fullName: 'Super Admin' },
  'mainheadadmin': { password: 'admin123', role: 'Main Head Admin', fullName: 'Main Head Admin' },
  'office': { password: 'office123', role: 'Office', fullName: 'Office' },
  'branchheadadmin': { password: 'branch123', role: 'Branch Head Admin', fullName: 'Branch Head Admin' },
  'technician': { password: 'tech123', role: 'Technician', fullName: 'Technician' }
};

function resolveAppPath(targetPath) {
  const cleaned = String(targetPath || '').replace(/^\.\//, '').replace(/^\.\.\//, '');
  const currentPath = window.location.pathname.replace(/\/+$/, '');
  const isInsidePagesFolder = currentPath.includes('/pages/') || currentPath.endsWith('/pages');

  if (isInsidePagesFolder) {
    return cleaned.startsWith('pages/') ? `../${cleaned}` : `../${cleaned}`;
  }

  return cleaned;
}

const loginForm = document.getElementById('loginForm');
const contactAdminLink = document.getElementById('contactAdminLink');
const contactAdminBackdrop = document.getElementById('contactAdminBackdrop');
const contactAdminForm = document.getElementById('contactAdminForm');

function closeContactAdminForm() {
  if (!contactAdminBackdrop) return;
  contactAdminBackdrop.classList.remove('visible');
  contactAdminBackdrop.setAttribute('aria-hidden', 'true');
}

if (contactAdminLink && contactAdminBackdrop && contactAdminForm) {
  contactAdminLink.addEventListener('click', (event) => {
    event.preventDefault();
    contactAdminBackdrop.classList.add('visible');
    contactAdminBackdrop.setAttribute('aria-hidden', 'false');
    document.getElementById('contactAdminName').focus();
  });

  document.getElementById('contactAdminClose').addEventListener('click', closeContactAdminForm);
  document.getElementById('contactAdminCancel').addEventListener('click', closeContactAdminForm);
  contactAdminBackdrop.addEventListener('click', (event) => {
    if (event.target === contactAdminBackdrop) closeContactAdminForm();
  });

  contactAdminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(contactAdminForm);
    const config = window.GS_CONFIG || {};
    const appScriptUrl = String(config.appScriptUrl || '').trim();
    if (!appScriptUrl) {
      showAppPopup('Contact admin is not configured yet.');
      return;
    }

    const submitButton = contactAdminForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await fetch(appScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'contactAdmin',
          requesterName: String(formData.get('name') || '').trim(),
          requesterContact: String(formData.get('contact') || '').trim(),
          message: String(formData.get('message') || '').trim()
        }).toString()
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok === false) throw new Error('Contact request failed');
      closeContactAdminForm();
      contactAdminForm.reset();
      showAppPopup('Your message was sent to the administrators.');
    } catch (error) {
      console.error(error);
      showAppPopup('Your message could not be sent. Please try again later.');
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function authenticateAccount(username, password) {
  const config = window.GS_CONFIG || {};
  const hasValidConfig = config.sheetId && config.sheetId !== 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';

  if (hasValidConfig && typeof DATA !== 'undefined' && DATA.fetchAccounts) {
    try {
      const rows = await DATA.fetchAccounts();
      const account = rows.find((row) => {
        const sheetUsername = String(row.username || row.userName || row.accountusername || '').trim().toLowerCase();
        const sheetPassword = String(row.password || row.pass || row.userpassword || '').trim();
        return sheetUsername === username && sheetPassword === password;
      });

      if (account) {
        const status = String(account.status || account.accountStatus || '').trim().toLowerCase();
        if (status === 'inactive' || status === 'disabled' || status === 'deactivated') {
          return null;
        }

        const role = String(account.accountType || account.accounttype || account.role || account.userType || '').trim();
        const fullName = String(account.fullName || account.fullname || account.name || account.username || '').trim();
        const assignedBranch = String(account.branch || account.branchLocation || account.branchName || account.location || '').trim();
        return {
          username,
          password,
          role: role || 'User',
          fullName: fullName || username,
          branch: assignedBranch
        };
      }
    } catch (error) {
      console.error('Account sheet authentication failed:', error);
    }
  }

  const fallbackAccount = fallbackAccounts[username];
  if (!fallbackAccount || fallbackAccount.password !== password) {
    return null;
  }

  return {
    username,
    password,
    role: fallbackAccount.role,
    fullName: fallbackAccount.fullName || fallbackAccount.role || username,
    branch: ''
  };
}

if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const username = String(formData.get('username') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '').trim();

    if (!username || !password) {
      showAppPopup('Please enter a username and password.');
      return;
    }

    const account = await authenticateAccount(username, password);

    if (!account) {
      showAppPopup('Invalid username or password.');
      return;
    }

    localStorage.setItem('unitflowRole', account.role);
    localStorage.setItem('unitflowUser', username);
    localStorage.setItem('unitflowFullName', account.fullName || username);
    localStorage.setItem('unitflowBranch', account.branch || '');

    window.location.href = resolveAppPath('index.html');
  });
}
