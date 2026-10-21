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

/**
 * Compact navbar button: moon in light mode, sun in dark mode; flips to the other theme.
 * Both icons render and CSS picks one, so the server render never shows the wrong icon
 * (the theme class is set before first paint).
 */
export function ThemeIconButton({ className = '' }: { className?: string }) {
    const { setPreference } = useTheme();

    return (
        <button
            type="button"
            onClick={(e) => {
                const dark = document.documentElement.classList.contains('dark');
                // Reveal grows from the button's centre (keyboard clicks have no pointer position)
                const box = e.currentTarget.getBoundingClientRect();
                setPreference(dark ? 'light' : 'dark', { x: box.left + box.width / 2, y: box.top + box.height / 2 });
            }}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:bg-km-surface hover:text-km-heading transition-colors cursor-pointer ${className}`}
        >
            <MoonIcon size={22} weight="duotone" aria-hidden="true" className="dark:hidden" />
            <SunIcon size={22} weight="duotone" aria-hidden="true" className="hidden dark:block" />
        </button>
    );
}
