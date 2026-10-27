'use client';

import { useSyncExternalStore } from 'react';
import { Toaster } from 'sonner';
import { CheckCircleIcon, CircleNotchIcon, InfoIcon, WarningCircleIcon, XCircleIcon } from '@phosphor-icons/react';

// Watch the class on <html> itself: the theme switch animates, so the `dark` class can flip
// after useTheme's change event has already been read
function subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
}
const readIsDark = () => document.documentElement.classList.contains('dark');

// Filled status glyphs in the type colour, placed directly in the layout (icons.md: no icon
// containers). sonner's defaults are built for a 16px left-aligned slot, so we supply our own.
const icons = {
    success: <CheckCircleIcon size={22} weight="fill" />,
    error: <XCircleIcon size={22} weight="fill" />,
    warning: <WarningCircleIcon size={22} weight="fill" />,
    info: <InfoIcon size={22} weight="fill" />,
    loading: <CircleNotchIcon size={20} weight="bold" className="km-toast-spin" />,
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
