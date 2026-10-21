'use client';

import { DesktopIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useTheme, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; Icon: Icon }[] = [
    { value: 'light', label: 'Light', Icon: SunIcon },
    { value: 'dark', label: 'Dark', Icon: MoonIcon },
    { value: 'system', label: 'System', Icon: DesktopIcon },
];

/** Light / Dark / System segmented control */
export default function ThemeToggle({ className = '' }: { className?: string }) {
    const { preference, setPreference } = useTheme();

    return (
        <div role="radiogroup" aria-label="Theme" className={`grid grid-cols-3 gap-1 p-1 rounded-xl bg-km-surface border border-km-border ${className}`}>
            {OPTIONS.map(({ value, label, Icon }) => {
                const selected = preference === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPreference(value)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            selected
                                ? 'bg-km-surface-card text-km-heading shadow-xs'
                                : 'text-km-text-secondary hover:text-km-text-primary'
                        }`}
                    >
                        <Icon size={14} weight={selected ? 'fill' : 'bold'} aria-hidden="true" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
}

/** Compact navbar button: moon in light mode, sun in dark mode; flips to the other theme */
export function ThemeIconButton({ className = '' }: { className?: string }) {
    const { isDark, setPreference } = useTheme();
    const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    const Icon = isDark ? SunIcon : MoonIcon;

    return (
        <button
            type="button"
            onClick={() => setPreference(isDark ? 'light' : 'dark')}
            aria-label={label}
            title={label}
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:bg-km-surface hover:text-km-heading transition-colors cursor-pointer ${className}`}
        >
            <Icon size={22} weight="duotone" aria-hidden="true" />
        </button>
    );
}
