'use client';

// Shared building blocks for the admin panel, following docs/design.md: brand tokens only (they
// carry dark mode), sentence case, no motion, no icon containers.

import React from 'react';
import type { Icon } from '@phosphor-icons/react';
import { DotsThreeVerticalIcon, MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';

export function cx(...parts: (string | false | null | undefined)[]) {
    return parts.filter(Boolean).join(' ');
}

/** Page title, one-line description and the page's actions */
export function AdminPageHeader({ title, description, actions }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold text-km-heading tracking-tight">{title}</h1>
                {description && <p className="mt-1 text-sm text-km-text-secondary">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}

/** A white card with an optional titled header row */
export function AdminPanel({ title, description, actions, children, className, bodyClassName }: {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cx('bg-km-surface-card border border-km-border rounded-2xl', className)}>
            {(title || actions) && (
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-km-border-subtle">
                    <div className="min-w-0">
                        {title && <h2 className="text-base font-semibold text-km-heading">{title}</h2>}
                        {description && <p className="text-xs text-km-text-secondary mt-0.5">{description}</p>}
                    </div>
                    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
                </div>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

/** A headline number with its label */
export function StatCard({ label, value, hint, icon: IconCmp, iconClassName = 'text-km-link', href }: {
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    icon?: Icon;
    iconClassName?: string;
    href?: string;
}) {
    const body = (
        <>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-km-text-secondary">{label}</p>
                {IconCmp && <IconCmp size={22} weight="duotone" className={cx('shrink-0', iconClassName)} aria-hidden="true" />}
            </div>
            <p className="mt-2 text-2xl font-bold text-km-heading font-inter tabular-nums">{value}</p>
            {hint && <p className="mt-1 text-xs text-km-text-secondary">{hint}</p>}
        </>
    );
    const cls = 'block bg-km-surface-card border border-km-border rounded-2xl p-5';
    return href
        ? <a href={href} className={cx(cls, 'transition-colors hover:border-km-blue/40')}>{body}</a>
        : <div className={cls}>{body}</div>;
}

export type BadgeTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'orange';

const TONES: Record<BadgeTone, string> = {
    neutral: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
};

/** A status pill: a solid dot and a label, never colour alone */
export function StatusBadge({ tone = 'neutral', children, dot = true }: {
    tone?: BadgeTone;
    children: React.ReactNode;
    dot?: boolean;
}) {
    return (
        <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap', TONES[tone])}>
            {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />}
            {children}
        </span>
    );
}

/** Nothing to show yet */
export function EmptyState({ icon: IconCmp, title, description, action }: {
    icon?: Icon;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-14 px-6">
            {IconCmp && <IconCmp size={36} weight="duotone" className="text-km-text-muted mb-3" aria-hidden="true" />}
            <p className="text-sm font-semibold text-km-heading">{title}</p>
            {description && <p className="mt-1 text-sm text-km-text-secondary max-w-sm">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}

/** The search box at the head of a list */
export function SearchInput({ value, onChange, placeholder = 'Search', className }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <label className={cx('relative block', className)}>
            <span className="sr-only">{placeholder}</span>
            <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted pointer-events-none" aria-hidden="true" />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-blue focus:ring-2 focus:ring-km-blue/15"
            />
        </label>
    );
}

/** Segmented filter tabs */
export function FilterTabs<T extends string>({ value, onChange, options }: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string; count?: number }[];
}) {
    return (
        <div role="tablist" className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-km-surface border border-km-border">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'px-3 h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                            active ? 'bg-km-surface-card text-km-heading shadow-xs' : 'text-km-text-secondary hover:text-km-heading',
                        )}
                    >
                        {o.label}
                        {o.count !== undefined && <span className="ml-1.5 text-xs text-km-text-muted font-inter tabular-nums">{o.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

// Buttons: navy primary, outline secondary, red for destructive actions
const BTN_BASE = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none';
export const btn = {
    primary: cx(BTN_BASE, 'bg-km-primary text-white hover:bg-km-primary-dark'),
    accent: cx(BTN_BASE, 'bg-km-accent text-white hover:bg-km-accent-dark'),
    secondary: cx(BTN_BASE, 'border border-km-border bg-km-surface-card text-km-heading hover:bg-km-surface'),
    danger: cx(BTN_BASE, 'bg-red-600 text-white hover:bg-red-700'),
    ghost: cx(BTN_BASE, 'text-km-text-secondary hover:text-km-heading hover:bg-km-surface'),
    icon: 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface transition-colors cursor-pointer disabled:opacity-50',
};

// Form fields
export const field = {
    label: 'block text-sm font-medium text-km-heading mb-1.5',
    input: 'w-full h-10 px-3 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-blue focus:ring-2 focus:ring-km-blue/15',
    textarea: 'w-full px-3 py-2 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-blue focus:ring-2 focus:ring-km-blue/15',
    hint: 'mt-1 text-xs text-km-text-secondary',
    error: 'mt-1 text-xs text-red-600',
};

// Tables
export const table = {
    wrap: 'relative overflow-x-auto',
    table: 'w-full text-sm',
    th: 'px-5 py-3 text-left text-xs font-semibold text-km-text-secondary bg-km-surface border-b border-km-border whitespace-nowrap',
    td: 'px-5 py-3.5 border-b border-km-border-subtle text-km-text-primary align-middle',
    row: 'hover:bg-km-surface transition-colors',
};

/** Placeholder rows while a list loads */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
    return (
        <div className="divide-y divide-km-border-subtle" aria-busy="true">
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                    <div className="w-9 h-9 rounded-full bg-km-border-subtle" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-1/3 rounded bg-km-border-subtle" />
                        <div className="h-3 w-1/5 rounded bg-km-border-subtle" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** One row in a row-actions menu */
export function MenuItem({ icon: IconCmp, onClick, danger, children }: {
    icon?: Icon;
    onClick: () => void;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onClick}
            className={cx(
                'w-full flex items-center gap-2.5 px-2.5 h-9 rounded-lg text-sm text-left transition-colors cursor-pointer',
                danger ? 'text-red-600 hover:bg-red-50' : 'text-km-text-primary hover:bg-km-surface',
            )}
        >
            {IconCmp && <IconCmp size={18} className="shrink-0" aria-hidden="true" />}
            {children}
        </button>
    );
}

/** Asks before a destructive action */
export function ConfirmDialog({ title, description, confirmLabel = 'Confirm', busy, onCancel, onConfirm, tone = 'danger' }: {
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    tone?: 'danger' | 'primary';
}) {
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onCancel]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !busy && onCancel()}>
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                className="w-full max-w-sm bg-km-surface-raised rounded-2xl border border-km-border shadow-lg p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 id="confirm-dialog-title" className="text-base font-semibold text-km-heading">{title}</h2>
                {description && <p className="mt-2 text-sm text-km-text-secondary">{description}</p>}
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} disabled={busy} className={btn.secondary}>Cancel</button>
                    <button type="button" onClick={onConfirm} disabled={busy} className={tone === 'danger' ? btn.danger : btn.primary}>
                        {busy ? 'Working…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * A "more actions" button with a dropdown. The menu is fixed-positioned so a table's scroll
 * container can't clip it; it closes on an outside click, Escape, scroll or after an action.
 */
export function RowMenu({ label, children }: {
    label: string;
    children: (close: () => void) => React.ReactNode;
}) {
    const [pos, setPos] = React.useState<{ top: number; right: number; up: boolean } | null>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const close = React.useCallback(() => setPos(null), []);

    React.useEffect(() => {
        if (!pos) return;
        const onDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [pos, close]);

    const toggle = () => {
        if (pos) return close();
        const r = buttonRef.current?.getBoundingClientRect();
        if (!r) return;
        // Open upwards when the button sits in the lower part of the screen
        const up = r.bottom > window.innerHeight * 0.6;
        setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up });
    };

    return (
        <>
            <button ref={buttonRef} type="button" onClick={toggle} className={btn.icon} aria-label={label} aria-haspopup="menu" aria-expanded={!!pos}>
                <DotsThreeVerticalIcon size={20} weight="bold" aria-hidden="true" />
            </button>
            {pos && (
                <div
                    ref={menuRef}
                    role="menu"
                    className="fixed z-50 w-56 bg-km-surface-raised rounded-xl shadow-lg border border-km-border p-1.5 text-left"
                    style={{ top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, right: pos.right }}
                    onClick={(e) => { if ((e.target as HTMLElement).closest('[role="menuitem"]')) close(); }}
                >
                    {children(close)}
                </div>
            )}
        </>
    );
}

/** A logo or photo with an initial as the fallback when it's missing or fails to load */
export function LogoTile({ src, name, rounded = 'rounded-lg', size = 'w-9 h-9' }: {
    src?: string;
    name: string;
    rounded?: string;
    size?: string;
}) {
    const [failed, setFailed] = React.useState(false);
    return (
        <span className={cx(size, rounded, 'bg-km-surface border border-km-border text-km-heading text-sm font-semibold flex items-center justify-center shrink-0 overflow-hidden')}>
            {src && !failed
                ? <img src={src} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
                : (name.trim().charAt(0) || '?').toUpperCase()}
        </span>
    );
}

/** The admin modal shell: a titled dialog that closes on Escape or a click outside */
export function AdminModal({ isOpen, onClose, title, children, size = 'md' }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'md' | 'lg' | 'xl' | 'full';
}) {
    const titleId = React.useId();
    React.useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;
    const width = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl', full: 'max-w-[95vw]' }[size];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cx('w-full max-h-[92vh] flex flex-col bg-km-surface-raised rounded-2xl border border-km-border shadow-lg overflow-hidden', width)}
            >
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-km-border-subtle shrink-0">
                    <h2 id={titleId} className="text-base font-semibold text-km-heading truncate">{title}</h2>
                    <button type="button" onClick={onClose} className={btn.icon} aria-label="Close">
                        <XIcon size={18} aria-hidden="true" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
        </div>
    );
}
