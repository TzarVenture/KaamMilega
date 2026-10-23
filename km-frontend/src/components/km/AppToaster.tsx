'use client';

import { useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';
import { CheckIcon, CircleNotchIcon, InfoIcon, WarningIcon, XIcon } from '@phosphor-icons/react';

// Watch the class on <html> itself: the theme switch animates, so the `dark` class can flip
// after useTheme's change event has already been read
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}
const readIsDark = () => document.documentElement.classList.contains('dark');

// Our own glyphs, centred in the tinted chip (sonner's defaults are built for a 16px left-aligned slot)
const icons = {
    success: <CheckIcon size={15} weight="bold" />,
    error: <XIcon size={15} weight="bold" />,
    warning: <WarningIcon size={15} weight="bold" />,
    info: <InfoIcon size={16} weight="bold" />,
    loading: <CircleNotchIcon size={16} weight="bold" className="km-toast-spin" />,
};

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
            icons={icons}
            containerAriaLabel="Notifications"
            toastOptions={{ closeButtonAriaLabel: 'Dismiss notification' }}
        />
    );
}
