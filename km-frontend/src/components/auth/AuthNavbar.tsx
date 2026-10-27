'use client';

import React, { useState, useRef, useEffect } from 'react';
import BrandLogo from '@/components/km/BrandLogo';
import DownloadAppModal from '@/components/km/DownloadAppModal';
import { CaretDownIcon, DownloadSimpleIcon, GlobeIcon } from '@phosphor-icons/react';

export default function AuthNavbar() {
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState('English');
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (langRef.current && !langRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <>
            <header className="sticky top-0 z-40 bg-km-surface-card border-b border-km-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 h-16 flex items-center justify-between">
                    <div className="flex items-center">
                        <BrandLogo size="md" href="/" />
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm font-semibold text-km-text-secondary">
                        <button
                            type="button"
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="flex items-center gap-1.5 hover:text-km-heading transition-colors cursor-pointer py-1.5 px-3 rounded-lg hover:bg-km-surface border border-transparent hover:border-km-border"
                        >
                            <DownloadSimpleIcon weight="bold" size={16} className="text-km-text-secondary" />
                            <span className="hidden sm:inline">Download App</span>
                            <span className="sm:hidden">App</span>
                        </button>

                        {/* Language Switcher */}
                        <div className="relative" ref={langRef}>
                            <button
                                type="button"
                                onClick={() => setIsLangOpen(!isLangOpen)}
                                className="flex items-center gap-1.5 hover:text-km-heading transition-colors py-1.5 px-3 rounded-lg hover:bg-km-surface border border-km-border cursor-pointer"
                            >
                                <GlobeIcon weight="bold" size={15} className="text-km-text-secondary" />
                                <span>{selectedLang}</span>
                                <CaretDownIcon weight="bold"
                                    size={14}
                                    className={`transition-transform duration-200 text-km-text-secondary ${
                                        isLangOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>

                            {isLangOpen && (
                                <div className="absolute right-0 mt-1.5 w-32 bg-km-surface-card border border-km-border rounded-xl shadow-md py-1 z-50">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedLang('English');
                                            setIsLangOpen(false);
                                        }}
                                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                                            selectedLang === 'English'
                                                ? 'font-bold text-km-heading bg-km-surface'
                                                : 'text-km-text-primary hover:bg-km-surface'
                                        }`}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedLang('हिन्दी');
                                            setIsLangOpen(false);
                                        }}
                                        className={`w-full text-left px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                                            selectedLang === 'हिन्दी'
                                                ? 'font-bold text-km-heading bg-km-surface'
                                                : 'text-km-text-primary hover:bg-km-surface'
                                        }`}
                                    >
                                        हिन्दी
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <DownloadAppModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />
        </>
    );
}
