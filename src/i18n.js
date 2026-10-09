// Languages: Thai (the game's first language) and English.
//
// Every piece of text the player can see is written in place as L(thai, english), so the two stay
// side by side in the code and nothing hides in a far-off dictionary. The language is picked once,
// when the page loads (?lang=th|en, then the saved choice, then the system language), and changing
// it reloads the game, so data tables built at load time (items, skills, dialogue) are always in the
// right language.
//
// Static text in index.html carries its English in data-en (innerHTML), data-en-placeholder and
// data-en-title; applyHtml() swaps it in.
const KEY = 'moonmire-lang';

function pick() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'th' || q === 'en') return q;
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* storage blocked: fall through */ }
  const sys = (navigator.languages?.[0] || navigator.language || 'en').toLowerCase();
  return sys.startsWith('th') ? 'th' : 'en';
}

export const LANG = pick();
export const EN = LANG === 'en';

// the text in the current language (an English that is missing falls back to the Thai)
export const L = (th, en) => (EN && en != null ? en : th);

export function setLang(lang) {
  if (lang === LANG) return;
  try { localStorage.setItem(KEY, lang); } catch { /* the choice just won't stick */ }
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.replace(u.toString());
}

export function applyHtml(root = document) {
  document.documentElement.lang = LANG;
  if (!EN) return;
  for (const el of root.querySelectorAll('[data-en]')) el.innerHTML = el.dataset.en;
  for (const el of root.querySelectorAll('[data-en-placeholder]')) el.placeholder = el.dataset.enPlaceholder;
  for (const el of root.querySelectorAll('[data-en-title]')) el.title = el.dataset.enTitle;
}
