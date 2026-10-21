// Shared by the root layout (server) and lib/theme.ts (client); keep this module free of 'use client'.
export const THEME_STORAGE_KEY = 'km-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Inline script for <head>: applies the saved theme before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('${DARK_QUERY}').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}catch(_){}})();`;
