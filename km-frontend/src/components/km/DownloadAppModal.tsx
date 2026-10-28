'use client';

import React, { useEffect, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { APP_AVAILABLE } from '@/config/appLinks';
import { AppNotifyForm, AppQrCode, StoreBadges, type AppInterest } from './AppDownload';

interface DownloadAppModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Preselects Hire or Work for the notify-me sign-up */
    interest?: AppInterest;
    trade?: string;
}

export default function DownloadAppModal({ isOpen, ...rest }: DownloadAppModalProps) {
    // Mounted only while open, so each opening starts from the given Hire / Work choice
    return isOpen ? <DownloadAppDialog {...rest} /> : null;
}

function DownloadAppDialog({ onClose, interest: initialInterest = 'hire', trade }: Omit<DownloadAppModalProps, 'isOpen'>) {
    const t = useTranslations('appDownload');
    const [interest, setInterest] = useState<AppInterest>(initialInterest);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-km-ink/60 font-sans antialiased"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="download-app-title"
                className="relative w-full max-w-md bg-km-surface-card rounded-2xl shadow-xl border border-km-border animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 px-6 pt-6">
                    <div>
                        <h3 id="download-app-title" className="text-lg font-semibold text-km-text-primary">
                            {APP_AVAILABLE ? t('modalTitle') : t('modalTitleSoon')}
                        </h3>
                        <p className="mt-1 text-sm text-km-text-secondary">
                            {t('modalText')}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 -mr-1.5 rounded-lg text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface transition-colors cursor-pointer"
                        aria-label={t('close')}
                    >
                        <XIcon size={18} aria-hidden="true" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <StoreBadges />
                    <AppQrCode />

                    {!APP_AVAILABLE && (
                        <div className="space-y-3 pt-1">
                            <div role="radiogroup" aria-label={t('iWantTo')} className="inline-flex p-1 rounded-xl bg-km-surface border border-km-border">
                                {(['hire', 'work'] as const).map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={interest === value}
                                        onClick={() => setInterest(value)}
                                        className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                            interest === value ? 'bg-km-surface-card text-km-text-primary shadow-xs' : 'text-km-text-secondary hover:text-km-text-primary'
                                        }`}
                                    >
                                        {value === 'hire' ? t('wantHire') : t('wantWork')}
                                    </button>
                                ))}
                            </div>
                            <AppNotifyForm interest={interest} trade={trade} id="download-modal-mobile" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
