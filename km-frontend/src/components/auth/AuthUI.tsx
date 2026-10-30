'use client';

// Shared building blocks for the sign-in and employer setup screens, so both look and behave
// the same: the page shell with the brand panel, fields, buttons and step headings.

import React from 'react';
import { useTranslations } from 'next-intl';
import {
    ArrowLeftIcon,
    ChatsCircleIcon,
    CheckCircleIcon,
    CurrencyInrIcon,
    MapPinIcon,
    SealCheckIcon,
    ShieldCheckIcon,
    UserCheckIcon,
    WarningCircleIcon,
} from '@phosphor-icons/react';
import AuthNavbar from '@/components/auth/AuthNavbar';
import { AuthHeroArt } from '@/components/auth/AuthArt';

export type AuthBrand = 'candidate' | 'employer';

// 16px text in every field: smaller text makes iPhones zoom the page on focus
export const inputClass = (invalid: boolean) =>
    `w-full h-12 px-3.5 bg-km-surface-card border-[1.5px] rounded-xl text-base font-inter text-km-text-primary placeholder:text-km-text-muted outline-none transition-colors focus:ring-4 disabled:opacity-60 ${
        invalid
            ? 'border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-950'
            : 'border-km-border focus:border-km-link focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]'
    }`;

export const labelClass = 'block text-sm font-semibold text-km-text-primary mb-1.5';
export const linkClass = 'font-semibold text-km-link hover:underline cursor-pointer';
/** A link-style button on its own line: a full 44px touch target without looking bigger */
export const actionLinkClass = `${linkClass} inline-flex items-center min-h-11 text-sm`;

/** 10 digits from whatever was typed or pasted: "+91 98765 43210", "098765 43210", "9876543210" */
export function normalizeMobile(raw: string): string {
    let digits = raw.replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
    return digits.slice(0, 10);
}

export function FieldError({ message, id }: { message: string | null; id?: string }) {
    if (!message) return null;
    return (
        <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-red-600 dark:text-red-400">
            <WarningCircleIcon size={16} className="shrink-0 mt-px" aria-hidden="true" />
            <span>{message}</span>
        </p>
    );
}

export function Notice({ message }: { message: string | null }) {
    if (!message) return null;
    return (
        <p role="status" className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-[#0F2A22] dark:text-emerald-300">
            <CheckCircleIcon size={18} className="shrink-0 mt-px" aria-hidden="true" />
            <span>{message}</span>
        </p>
    );
}

export function SubmitButton({
    disabled,
    busy,
    label,
    busyLabel,
    type = 'submit',
    onClick,
}: {
    disabled: boolean;
    busy: boolean;
    label: string;
    busyLabel: string;
    type?: 'submit' | 'button';
    onClick?: () => void;
}) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || busy}
            className="w-full h-12 rounded-xl text-base font-semibold text-white bg-km-primary hover:bg-km-primary-dark hover:shadow-[0_4px_14px_rgba(7,26,77,0.25)] active:scale-[0.98] transition-[background-color,box-shadow,transform] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 inline-flex items-center justify-center gap-2"
        >
            {busy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />}
            {busy ? busyLabel : label}
        </button>
    );
}

/** Quiet full-width button for the second choice under a SubmitButton ("Do this later") */
export function SecondaryButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="w-full h-12 rounded-xl text-base font-semibold text-km-text-primary border-[1.5px] border-km-border hover:bg-km-surface transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
            {label}
        </button>
    );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="-ml-2 mb-3 inline-flex items-center gap-1.5 rounded-lg px-2 min-h-11 text-sm font-semibold text-km-text-secondary hover:text-km-heading hover:bg-km-surface transition-colors cursor-pointer"
        >
            <ArrowLeftIcon size={16} aria-hidden="true" />
            {label}
        </button>
    );
}

export function StepHeading({ title, subtitle, art }: { title: string; subtitle?: React.ReactNode; art?: React.ReactNode }) {
    return (
        <div className="mb-6">
            {art}
            <h2 className="text-2xl font-bold tracking-[-0.015em] text-km-heading leading-tight">{title}</h2>
            {subtitle && <p className="mt-1.5 text-[15px] text-km-text-secondary leading-relaxed">{subtitle}</p>}
        </div>
    );
}

/**
 * The sign-in page: navbar, the navy brand panel and the form column. Large screens show the
 * panel on the left; phones put the form first and the panel after it, so the step in hand is
 * on screen without scrolling.
 */
export function AuthShell({ brand, children }: { brand: AuthBrand; children: React.ReactNode }) {
    const t = useTranslations('auth');
    const proofIcons = brand === 'employer' ? [UserCheckIcon, ChatsCircleIcon, SealCheckIcon] : [ShieldCheckIcon, MapPinIcon, CurrencyInrIcon];

    return (
        <div className="min-h-dvh bg-km-surface-card text-km-text-primary flex flex-col">
            <AuthNavbar />

            <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <aside className="order-last lg:order-none relative overflow-hidden bg-km-primary dark:bg-km-primary-dark text-white px-5 pt-8 sm:px-8 lg:px-14 lg:pt-16 flex flex-col">
                    <div className="max-w-xl">
                        <h1 className="text-2xl sm:text-3xl lg:text-[40px] font-bold leading-[1.2] tracking-[-0.02em]">
                            {t(`${brand}.headline`)}
                        </h1>
                        <p className="mt-3 text-[15px] lg:text-base leading-relaxed text-[#C9D6F0] max-w-md">
                            {t(`${brand}.reason`)}
                        </p>
                        <ul className="mt-6 grid grid-cols-3 gap-3 lg:flex lg:flex-wrap lg:gap-x-6 lg:gap-y-3">
                            {proofIcons.map((Icon, i) => (
                                <li key={i} className="flex flex-col items-start gap-1.5 lg:flex-row lg:items-center lg:gap-2 text-[13px] lg:text-sm font-medium text-[#E4EBF7]">
                                    <Icon size={20} weight="duotone" className="text-[#FFB066] shrink-0" aria-hidden="true" />
                                    {t(`${brand}.proof${i + 1}`)}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="mt-auto pt-6 lg:pt-10 flex justify-center lg:justify-start">
                        <AuthHeroArt variant={brand} className="w-full max-w-[280px] sm:max-w-[360px] lg:max-w-[480px] h-auto block" />
                    </div>
                </aside>

                <section className="flex justify-center px-5 pt-6 pb-10 sm:px-8 sm:pt-10 lg:items-center lg:py-12">
                    <div className="w-full max-w-[420px]">{children}</div>
                </section>
            </main>
        </div>
    );
}
