// Site languages chosen by the client (Q71, plus Bengali added later). Text lives in
// km-frontend/messages/<locale>.json; English is the base, so a key missing from another language
// shows in English. This is also the order languages are listed in on every page.
export const LOCALES = ['hi', 'mr', 'gu', 'bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie holding the visitor's choice (set by the language switcher) */
export const LOCALE_COOKIE = 'km_locale';

/** Each language named in its own script, for the switcher */
export const LOCALE_NAMES: Record<Locale, string> = {
    hi: 'हिन्दी',
    mr: 'मराठी',
    gu: 'ગુજરાતી',
    bn: 'বাংলা',
    en: 'English',
};

/**
 * Locale for Intl number and date formatting: the language with Latin digits. Marathi and Bengali
 * default to their own digits (२०२६, ২০২৬); prices, OTPs and phone numbers stay 0-9 everywhere,
 * as in other Indian apps.
 */
export function formatLocale(locale: Locale): string {
    return `${locale}-IN-u-nu-latn`;
}

export function isLocale(value: unknown): value is Locale {
    return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
