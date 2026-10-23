'use client';

import { useSyncExternalStore } from 'react';
import { Toaster } from 'sileo';

// Watch the class on <html> itself: the theme switch animates, so the `dark` class can flip
// after useTheme's change event has already been read
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}
const readIsDark = () => document.documentElement.classList.contains('dark');

/**
 * The single toast viewport for the whole app (mounted once in the root layout). Toasts sit
 * just under the navbar, centred, so they are easy to see on phones and never hide the nav.
 *
 * Look: a KaamMilega navy pill on light pages and a soft light pill on dark pages. sileo's
 * `theme` names the pill's surroundings ("light" = light page), which also picks the right
 * description colour; the state colours are tuned in globals.css for contrast on each pill.
 */
export default function AppToaster() {
    const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);
    return (
        <Toaster
            position="top-center"
            offset={{ top: 72 }}
            theme={isDark ? 'dark' : 'light'}
            options={{ fill: isDark ? '#E8EEF8' : '#071A4D', roundness: 18 }}
        />
    );
}
