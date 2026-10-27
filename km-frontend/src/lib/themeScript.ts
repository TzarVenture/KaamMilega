// Shared by the root layout (server) and lib/theme.ts (client); keep this module free of 'use client'.
export const THEME_STORAGE_KEY = 'km-theme';
export const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Inline script for <head>: applies the saved theme before first paint (no flash), then keeps
 * this tab in step afterwards: a theme chosen in another tab (storage event) and OS changes while
 * the preference is "system". It runs on every page, including ones without the theme toggle.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}',q=window.matchMedia('${DARK_QUERY}'),e=document.documentElement;function a(){var p=null;try{p=localStorage.getItem(k)}catch(_){}p=p==='light'||p==='dark'?p:'system';var d=p==='dark'||(p==='system'&&q.matches);e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light'}a();window.addEventListener('storage',function(v){if(v.key===k||v.key===null)a()});q.addEventListener('change',a)}catch(_){}})();`;
