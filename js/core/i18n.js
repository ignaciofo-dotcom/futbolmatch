/* Localization manager. Spanish is the fallback. Resolves keys and refreshes [data-i18n] nodes. */
window.I18N = (function () {
  let lang = window.CONFIG.defaultLanguage;
  const data = window.I18N_DATA;

  function t(key, params) {
    const entry = data[key];
    let str = entry ? (entry[lang] != null ? entry[lang] : entry.es) : key;
    if (params) for (const k in params) str = str.replace('{' + k + '}', params[k]);
    return str;
  }

  function setLang(l) {
    lang = (l === 'en') ? 'en' : 'es';
    document.documentElement.lang = lang;
    refresh();
    window.Bus.emit('langChanged', lang);
  }

  function refresh(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  return { t, setLang, refresh, get lang() { return lang; } };
})();
