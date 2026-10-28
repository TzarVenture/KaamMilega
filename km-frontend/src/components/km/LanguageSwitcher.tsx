'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import { LOCALES, LOCALE_NAMES, type Locale } from '@/i18n/config';
import { useChangeLocale } from '@/i18n/useChangeLocale';

/** Navbar menu (desktop) */
export function LanguageMenu() {
    const t = useTranslations('language');
    const current = useLocale() as Locale;
    const { change, pending } = useChangeLocale();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t('label')}
                disabled={pending}
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-km-heading transition-colors py-2 px-2.5 rounded-lg hover:bg-slate-50 disabled:opacity-60"
            >
                <span lang={current}>{LOCALE_NAMES[current]}</span>
                <CaretDownIcon weight="bold" size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {open && (
                <div role="menu" className="absolute right-0 mt-1 w-36 bg-km-surface-card border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                    {LOCALES.map((locale) => (
                        <button
                            key={locale}
                            type="button"
                            role="menuitemradio"
                            aria-checked={locale === current}
                            lang={locale}
                            onClick={() => {
                                setOpen(false);
                                if (locale !== current) change(locale);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors cursor-pointer ${
                                locale === current ? 'font-semibold text-km-heading' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {LOCALE_NAMES[locale]}
                            {locale === current && <CheckIcon size={14} weight="bold" aria-hidden="true" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Inline choice for drawers and small screens */
export function LanguageList() {
    const t = useTranslations('language');
    const current = useLocale() as Locale;
    const { change, pending } = useChangeLocale();

    return (
        <div role="radiogroup" aria-label={t('label')} className="flex flex-wrap gap-2">
            {LOCALES.map((locale) => (
                <button
                    key={locale}
                    type="button"
                    role="radio"
                    aria-checked={locale === current}
                    lang={locale}
                    disabled={pending}
                    onClick={() => locale !== current && change(locale)}
                    className={`px-3 h-9 rounded-lg border text-sm transition-colors cursor-pointer ${
                        locale === current
                            ? 'border-km-primary text-km-heading font-semibold bg-km-surface-card'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    {LOCALE_NAMES[locale]}
                </button>
            ))}
        </div>
    );
}
