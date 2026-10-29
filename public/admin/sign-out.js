// "Log out" at the bottom of the admin pages: forgets this browser's sign-in
// and goes back to the password screen.
(() => {
  const add = () => {
    let user;
    try {
      user = JSON.parse(localStorage.getItem('sveltia-cms.user'));
    } catch {}
    if (!user?.token) return;
    const box = document.createElement('div');
    box.className = 'jg-signout';
    box.innerHTML = '<button type="button">Log out</button>';
    box.querySelector('button').onclick = () => {
      localStorage.removeItem('sveltia-cms.user');
      sessionStorage.removeItem('jg-after-signin');
      location.replace('/admin/');
    };
    const style = document.createElement('style');
    style.textContent = `.jg-signout { display: flex; justify-content: center; padding: 48px 16px 32px; }
      .jg-signout button { border: 0; padding: 4px 8px; background: none; color: #6b6b6b; font-family: inherit; font-size: 13px; line-height: 1.3; text-decoration: underline; cursor: pointer; }
      .jg-signout button:hover { color: #000; }`;
    document.head.append(style);
    document.body.append(box);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add);
  else add();
})();
