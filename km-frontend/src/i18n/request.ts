import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { FEATURES } from '@/config/features';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import en from '../../messages/en.json';

type Messages = { [key: string]: string | Messages };

/** English underneath, the chosen language on top: untranslated keys fall back to English */
function withEnglishFallback(base: Messages, overlay: Messages): Messages {
    const out: Messages = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
        const b = base[key];
        out[key] = typeof value === 'object' && typeof b === 'object' ? withEnglishFallback(b, value) : value;
    }
    return out;
}

// The language comes from the visitor's choice (cookie), not the URL. With the feature off,
// everyone gets English and no cookie is read, so pages stay static.
export default getRequestConfig(async () => {
    let locale: Locale = DEFAULT_LOCALE;
    if (FEATURES.I18N) {
        const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
        if (isLocale(chosen)) locale = chosen;
    }

    const messages =
        locale === DEFAULT_LOCALE
            ? en
            : withEnglishFallback(en as Messages, (await import(`../../messages/${locale}.json`)).default as Messages);

    return { locale, messages, timeZone: 'Asia/Kolkata' };
});
