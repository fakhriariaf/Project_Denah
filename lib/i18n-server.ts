/**
 * Server-side i18n helper.
 * Locale dikunci ke "id" (Indonesia) — fitur multi-bahasa telah dihapus.
 * Gunakan di async Server Components / Route Handlers.
 * Untuk Client Components, gunakan useI18n() dari @/lib/i18n.
 */
import { dictionaries, DictionaryKey } from "./dictionaries";

export async function getI18n() {
  function t(
    key: DictionaryKey,
    params?: Record<string, string | number>
  ): string {
    let text: string = dictionaries.id[key] ?? key;

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`{{${k}}}`, "g"), String(v));
      });
    }
    return text;
  }

  return { t, locale: "id" as const };
}
