// Loading screen for every admin page: white, the Jonah George logo and a
// short line of text. Load it first thing in <body>. Pages call jgLoaded()
// once they're ready; with data-auto (the Sveltia editor at /admin/) it goes
// away by itself as soon as the editor shows its sign-in or its screens.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    #jg-loading { position: fixed; inset: 0; z-index: 100000; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 28px; background: #fff; transition: opacity 0.3s; }
    #jg-loading.done { opacity: 0; pointer-events: none; }
    #jg-loading img { width: 174px; height: auto; }
    #jg-loading p { margin: 0; font: 13px/1.4 -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.01em; color: #6b6b6b; }
    #jg-loading p::after { content: ''; display: inline-block; width: 1.2em; text-align: left; animation: jg-dots 1.2s steps(4) infinite; }
    @keyframes jg-dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }
  `;
  document.head.append(style);

  const box = document.createElement('div');
  box.id = 'jg-loading';
  box.setAttribute('role', 'status');
  box.innerHTML = '<img src="/admin/logo.svg" alt="Jonah George" /><p>Loading the admin panel for you</p>';
  document.body.prepend(box);

  window.jgLoaded = () => {
    if (box.classList.contains('done')) return;
    box.classList.add('done');
    setTimeout(() => box.remove(), 300);
  };

  if (document.currentScript?.hasAttribute('data-auto')) {
    const ready = () => [...document.body.children].some((el) => el !== box && el.tagName !== 'SCRIPT' && el.querySelector('button, input'));
    const watch = new MutationObserver(() => ready() && (watch.disconnect(), window.jgLoaded()));
    watch.observe(document.body, { childList: true, subtree: true });
    setTimeout(window.jgLoaded, 20000);
  }
})();
