import { dictionaries, DictionaryKey } from './dictionaries';

/**
 * i18n helper — locale dikunci ke "id" (Indonesia).
 * Fitur multi-bahasa (ID/EN) telah dihapus.
 */

type Params = Record<string, string | number>;

function translate(key: DictionaryKey, params?: Params): string {
  let text: string = dictionaries.id[key] ?? key;

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }

  return text;
}

/**
 * Hook untuk Client Components.
 * Mengembalikan fungsi t() yang selalu menggunakan kamus Bahasa Indonesia.
 */
export function useI18n() {
  return { t: translate };
}

/**
 * @deprecated Gunakan useI18n() langsung.
 */
export const useI18nStore = {
  getState: () => ({ t: translate }),
};
