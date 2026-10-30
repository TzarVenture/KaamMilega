'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import BrandLogo from '@/components/km/BrandLogo';
import DownloadAppModal from '@/components/km/DownloadAppModal';
import { LanguageMenu } from '@/components/km/LanguageSwitcher';
import { DownloadSimpleIcon } from '@phosphor-icons/react';

export default function AuthNavbar() {
    const t = useTranslations('nav');
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-40 bg-km-surface-card border-b border-km-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 flex items-center justify-between">
                    <BrandLogo size="md" href="/" />

                    <div className="flex items-center gap-1 sm:gap-2">
                        <button
                            type="button"
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-km-heading transition-colors py-2 px-2.5 rounded-lg hover:bg-km-surface cursor-pointer"
                        >
                            <DownloadSimpleIcon size={16} aria-hidden="true" />
                            <span className="hidden sm:inline">{t('installApp')}</span>
                            <span className="sm:hidden">{t('app')}</span>
                        </button>
                        {/* The same language menu as the rest of the site: all five languages */}
                        <LanguageMenu />
                    </div>
                </div>
            </header>

            <DownloadAppModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />
        </>
    );
}
