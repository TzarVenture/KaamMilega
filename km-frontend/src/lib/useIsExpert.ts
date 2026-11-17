import { useSyncExternalStore } from 'react';
import { getCurrentUser } from '@/lib/auth';

function subscribe(onChange: () => void) {
    window.addEventListener('storage', onChange);
    return () => window.removeEventListener('storage', onChange);
}

function rolesNow(): string[] {
    const user = getCurrentUser();
    return Array.isArray(user?.roles) ? user.roles : user?.role ? [user.role] : [];
}

/**
 * Whether the signed-in user is an approved Expert (admins count too when `orAdmin` is set).
 * null on the server and during hydration, because roles live in localStorage: pages show
 * nothing role-specific until it is known, so the first render matches the server's.
 */
export function useIsExpert(orAdmin = false): boolean | null {
    return useSyncExternalStore(
        subscribe,
        () => {
            const roles = rolesNow();
            return roles.includes('expert') || (orAdmin && roles.includes('admin'));
        },
        () => null,
    );
}
