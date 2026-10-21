'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { DARK_QUERY, THEME_STORAGE_KEY } from './themeScript';

/**
 * Theme preference: 'system' follows the OS, 'light'/'dark' are explicit choices.
 * The resolved theme is a `dark` class on <html>; components style it with `dark:` utilities
 * and theme tokens (globals.css). Stored per browser in localStorage.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = THEME_STORAGE_KEY;
const CHANGE_EVENT = 'km-theme-change';

function readPreference(): ThemePreference {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        return 'system';
    }
}

function applyTheme(preference: ThemePreference) {
    const dark = preference === 'dark' || (preference === 'system' && window.matchMedia(DARK_QUERY).matches);
    const root = document.documentElement;
    // Switch instantly: without this every transition-colors element fades through the swap
    const freeze = document.createElement('style');
    freeze.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(freeze);
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    void window.getComputedStyle(root).color; // apply the new colours before transitions return
    requestAnimationFrame(() => freeze.remove());
}

function subscribe(onChange: () => void) {
    const media = window.matchMedia(DARK_QUERY);
    // 'system' follows OS changes live
    const onSystemChange = () => {
        if (readPreference() === 'system') applyTheme('system');
        onChange();
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener('storage', onChange); // other tabs
    return () => {
        media.removeEventListener('change', onSystemChange);
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener('storage', onChange);
    };
}

const readIsDark = () => document.documentElement.classList.contains('dark');

export function useTheme() {
    const preference = useSyncExternalStore(subscribe, readPreference, () => 'system' as ThemePreference);
    // What is actually showing right now (preference resolved against the OS for 'system')
    const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);

    const setPreference = useCallback((next: ThemePreference) => {
        try {
            if (next === 'system') localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Storage blocked: still apply for this page view
        }
        applyTheme(next);
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    return { preference, isDark, setPreference };
}
