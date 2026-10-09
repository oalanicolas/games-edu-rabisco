/* AI Race — languages. English lives in the code as every string's fallback, so an English visit
 * downloads nothing extra. Spanish, Simplified Chinese and Japanese are small JSON files in i18n/, fetched only
 * for a visit in that language (index.html starts the fetch in <head>, before the app loads). A key
 * missing from a file falls back to English. No DOM here: the build imports it through model.js. */
export const LANGS = [
  { code: 'en', name: 'English', short: 'EN', html: 'en', intl: 'en-US' },
  { code: 'es', name: 'Español', short: 'ES', html: 'es', intl: 'es' },
  { code: 'zh', name: '简体中文', short: '中文', html: 'zh-Hans', intl: 'zh-CN' },
  { code: 'ja', name: '日本語', short: '日本語', html: 'ja', intl: 'ja-JP' }
];

let dict = {};
export let lang = 'en';

export function useStrings(code, strings) {
  lang = code !== 'en' && strings && LANGS.some((l) => l.code === code) ? code : 'en';
  dict = lang === 'en' ? {} : strings;
}

/** t('key', 'English with {vars}', { vars }): the translation when there is one, else the English. */
export function t(key, en, vars) {
  const s = Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export const intlLocale = () => LANGS.find((l) => l.code === lang).intl;

/** "today", "yesterday", "3 days ago". */
export const ago = (d) => (d === 0 ? t('when.today', 'today') : d === 1 ? t('when.yesterday', 'yesterday')
  : t('when.days', '{n} days ago', { n: d }));
