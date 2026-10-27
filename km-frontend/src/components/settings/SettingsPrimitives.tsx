'use client';

import React from 'react';

/** Accessible on/off switch (role="switch", keyboard operable, visible focus ring) */
export function Toggle({
    checked,
    onChange,
    label,
    disabled = false,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    label: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-km-link focus-visible:ring-offset-2 focus-visible:ring-offset-km-surface-card disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${
                checked ? 'bg-[#0B5ED7]' : 'bg-slate-300'
            }`}
        >
            <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`}
            />
        </button>
    );
}

export type BadgeTone = 'soon' | 'ok' | 'warn' | 'neutral';

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
    const tones: Record<BadgeTone, string> = {
        soon: 'bg-amber-50 text-amber-800 border-amber-200',
        ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        warn: 'bg-amber-50 text-amber-800 border-amber-200',
        neutral: 'bg-km-surface text-km-text-secondary border-km-border',
    };
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
            {children}
        </span>
    );
}

/** One setting: title + description on the left, a control on the right */
export function SettingRow({
    title,
    description,
    badge,
    control,
    id,
}: {
    title: string;
    description?: React.ReactNode;
    badge?: React.ReactNode;
    control?: React.ReactNode;
    id?: string;
}) {
    return (
        <div id={id} className="py-4 flex items-start sm:items-center justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-km-text-primary">{title}</p>
                    {badge}
                </div>
                {description && <div className="mt-0.5 text-sm text-km-text-secondary leading-relaxed">{description}</div>}
            </div>
            {control && <div className="shrink-0 pt-0.5 sm:pt-0">{control}</div>}
        </div>
    );
}

export function SettingsCard({
    title,
    description,
    children,
    tone = 'default',
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    tone?: 'default' | 'danger';
}) {
    return (
        <section
            className={`bg-km-surface-card rounded-2xl border p-5 sm:p-6 ${
                tone === 'danger' ? 'border-red-200' : 'border-km-border'
            }`}
        >
            <h2 className={`text-base font-semibold ${tone === 'danger' ? 'text-red-700' : 'text-km-heading'}`}>{title}</h2>
            {description && <p className="mt-1 text-sm text-km-text-secondary">{description}</p>}
            <div className="mt-2 divide-y divide-km-border-subtle">{children}</div>
        </section>
    );
}

export const buttonPrimary =
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] dark:bg-km-primary dark:hover:bg-km-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';
export const buttonSecondary =
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-km-border bg-km-surface-card text-km-text-primary text-sm font-semibold hover:bg-km-surface transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';
export const buttonDanger =
    'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';
export const inputClass =
    'w-full h-11 px-3.5 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary placeholder:text-km-text-muted focus:outline-none focus:border-km-link focus:ring-2 focus:ring-km-link/20 transition';
