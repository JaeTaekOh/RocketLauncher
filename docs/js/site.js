(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  const tabs = $$('.tab');
  const panels = $$('.panel');
  function select(id, focus, updateHash) {
    tabs.forEach((tab) => {
      const on = tab.dataset.tab === id;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    panels.forEach((p) => { p.hidden = p.id !== 'panel-' + id; });
    if (updateHash) {
      try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (e) {}
    }
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.tab, false, true));
    tab.addEventListener('keydown', (e) => {
      const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length]
        : e.key === 'ArrowLeft' ? tabs[(i - 1 + tabs.length) % tabs.length]
        : e.key === 'Home' ? tabs[0]
        : e.key === 'End' ? tabs[tabs.length - 1]
        : null;
      if (next) { e.preventDefault(); select(next.dataset.tab, true, true); }
    });
  });
  const fromHash = (location.hash || '').replace('#', '');
  const first = tabs.some((t) => t.dataset.tab === fromHash) ? fromHash : (tabs[0] && tabs[0].dataset.tab);
  if (first) select(first, false, false);

  function textOf(el) {
    return (el.getAttribute('data-raw') || el.textContent).replace(/^\n/, '').replace(/\n$/, '');
  }
  $$('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pre = $('#' + btn.getAttribute('data-copy')) || btn.parentElement.querySelector('pre');
      const text = pre ? textOf(pre) : '';
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      const label = btn.querySelector('.t');
      const copyWord = (window.RLSiteI18n && window.RLSiteI18n.t) ? window.RLSiteI18n.t('copy') : 'Copy';
      const copiedWord = (window.RLSiteI18n && window.RLSiteI18n.t) ? window.RLSiteI18n.t('copied') : 'Copied';
      btn.classList.add('ok');
      if (label) label.textContent = copiedWord;
      setTimeout(() => { btn.classList.remove('ok'); if (label) label.textContent = copyWord; }, 1400);
    });
  });
})();
