try {
  const isLoginPage = window.location.pathname.replace(/\/+$/, '').endsWith('/login.html');
  if (isLoginPage) {
    document.documentElement.dataset.theme = 'light';
  } else {
    const username = String(localStorage.getItem('unitflowUser') || '').trim().toLowerCase();
    const saved = username ? localStorage.getItem(`unitflowDarkMode:${username}`) : null;
    const isDark = saved === null
      ? localStorage.getItem('unitflowDarkMode') === 'true'
      : saved === 'true';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }
} catch (error) {
  document.documentElement.dataset.theme = 'light';
}
