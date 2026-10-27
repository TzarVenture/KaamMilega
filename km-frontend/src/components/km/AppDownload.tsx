'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircleIcon } from '@phosphor-icons/react';
import QRCode from 'qrcode';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { getCurrentUser } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { APP_AVAILABLE, APP_LINKS } from '@/config/appLinks';

// Pieces shared by the InstantMilega page and the "Get the app" dialog. Before the app is
// published (no store links configured) they show "Coming soon" and collect numbers to notify.

export type AppInterest = 'hire' | 'work';

/** Last 10 digits of the signed-in user's mobile, to prefill the form */
function ownMobile(): string {
    const digits = (getCurrentUser()?.mobile || '').replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '';
}

interface NotifyFormProps {
    interest: AppInterest;
    /** Trade the visitor came for (e.g. from the home page search), kept with the sign-up */
    trade?: string;
    /** `onDark` for navy sections */
    tone?: 'onLight' | 'onDark';
    id?: string;
}

export function AppNotifyForm({ interest, trade, tone = 'onLight', id = 'app-notify-mobile' }: NotifyFormProps) {
    const t = useTranslations('appDownload');
    const [mobile, setMobile] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedFor, setSavedFor] = useState('');

    // After mount: reading the stored session during render would differ from the server HTML
    useEffect(() => {
        const own = ownMobile();
        if (own) setMobile((m) => m || own);
    }, []);

    const valid = /^[6-9]\d{9}$/.test(mobile);
    const onDark = tone === 'onDark';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid || saving) return;
        setSaving(true);
        try {
            await api.post('/app-waitlist', { mobile, interest, trade: trade || undefined });
            setSavedFor(mobile);
        } catch (err) {
            notify.error(err, t('saveError'));
        } finally {
            setSaving(false);
        }
    };

    if (savedFor) {
        return (
            <p
                role="status"
                className={`flex items-start gap-2 text-sm ${onDark ? 'text-white' : 'text-km-text-primary'}`}
            >
                <CheckCircleIcon size={18} weight="fill" className="text-emerald-500 shrink-0 mt-px" aria-hidden="true" />
                <span>{t('saved', { mobile: savedFor })}</span>
            </p>
        );
    }

    return (
        <form onSubmit={submit} className="w-full max-w-md" noValidate>
            <label htmlFor={id} className={`block text-sm font-medium mb-2 ${onDark ? 'text-white/85' : 'text-km-text-secondary'}`}>
                {t('notifyLabel')}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
                <div
                    className={`flex items-center w-full sm:flex-1 h-12 rounded-xl px-3.5 border transition-colors ${
                        onDark
                            ? 'bg-white/10 border-white/20 focus-within:border-white/60'
                            : 'bg-km-surface-card border-km-border focus-within:border-km-link'
                    }`}
                >
                    <span className={`text-sm font-medium mr-2 ${onDark ? 'text-white/70' : 'text-km-text-secondary'}`}>+91</span>
                    <input
                        id={id}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        maxLength={10}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder={t('mobilePlaceholder')}
                        className={`w-full bg-transparent text-sm focus:outline-none ${
                            onDark ? 'text-white placeholder:text-white/50' : 'text-km-text-primary placeholder:text-km-text-muted'
                        }`}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!valid || saving}
                    className="h-12 px-6 rounded-xl bg-km-accent hover:bg-km-accent-light text-white text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
                >
                    {saving ? t('saving') : t('notifyMe')}
                </button>
            </div>
        </form>
    );
}

const BADGES = [
    { key: 'android', href: APP_LINKS.PLAY_STORE, src: '/asset/google-play-badge-logo.svg', label: 'googlePlay' },
    { key: 'ios', href: APP_LINKS.APP_STORE, src: '/asset/download-on-the-app-store-apple-logo.svg', label: 'appStore' },
] as const;

/** Store badges: links once published, otherwise dimmed with a "Coming soon" note */
export function StoreBadges({ tone = 'onLight' }: { tone?: 'onLight' | 'onDark' }) {
    const t = useTranslations('appDownload');
    return (
        <div className="flex flex-wrap items-center gap-3">
            {BADGES.map((b) =>
                b.href ? (
                    <a key={b.key} href={b.href} target="_blank" rel="noopener noreferrer" aria-label={t(b.label)} className="inline-block hover:opacity-90 transition-opacity">
                        <img src={b.src} alt="" className="h-10 w-auto" />
                    </a>
                ) : (
                    <img key={b.key} src={b.src} alt={t('badgeSoon', { store: t(b.label) })} className="h-10 w-auto opacity-50 grayscale" />
                ),
            )}
            {!APP_AVAILABLE && (
                <span className={`text-sm font-medium ${tone === 'onDark' ? 'text-white/80' : 'text-km-text-secondary'}`}>{t('comingSoon')}</span>
            )}
        </div>
    );
}

/** QR code to /get-app (opens the right store on a phone). Desktop only, once the app is out. */
export function AppQrCode({ tone = 'onLight' }: { tone?: 'onLight' | 'onDark' }) {
    const t = useTranslations('appDownload');
    const [src, setSrc] = useState('');

    useEffect(() => {
        if (!APP_AVAILABLE) return;
        let alive = true;
        QRCode.toDataURL(`${window.location.origin}/get-app`, { margin: 1, width: 240, color: { dark: '#071A4D', light: '#FFFFFF' } })
            .then((url) => alive && setSrc(url))
            .catch(() => {});
        return () => {
            alive = false;
        };
    }, []);

    if (!src) return null;
    return (
        <div className="hidden lg:flex items-center gap-3">
            <img src={src} alt={t('qrAlt')} width={96} height={96} className="rounded-lg bg-white p-1" />
            <span className={`text-sm max-w-[9rem] ${tone === 'onDark' ? 'text-white/80' : 'text-km-text-secondary'}`}>
                {t('qrText')}
            </span>
        </div>
    );
}
