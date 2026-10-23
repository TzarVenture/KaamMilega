'use client';

import { useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';

// Watch the class on <html> itself: the theme switch animates, so the `dark` class can flip
// after useTheme's change event has already been read
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}
const readIsDark = () => document.documentElement.classList.contains('dark');

/**
 * The single toast viewport for the whole app (mounted once in the root layout): top-centre
 * just under the navbar, up to three stacked cards that expand on hover, swipe to dismiss.
 * Colours come from the KaamMilega theme tokens in globals.css, so dark mode follows the app.
 */
export default function AppToaster() {
    const isDark = useSyncExternalStore(subscribe, readIsDark, () => false);
    return (
        <Toaster
            position="top-center"
            theme={isDark ? 'dark' : 'light'}
            offset={{ top: 76 }}
            mobileOffset={{ top: 68, left: 12, right: 12 }}
            visibleToasts={3}
            gap={10}
            closeButton
            containerAriaLabel="Notifications"
            toastOptions={{ closeButtonAriaLabel: 'Dismiss notification' }}
        />
    );
}
