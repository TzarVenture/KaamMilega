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
    return useHasRole(orAdmin ? ['expert', 'admin'] : ['expert']);
}

/** Roles that may host an event (the server checks the same list: km-backend event/host.go HostRoles) */
export const EVENT_HOST_ROLES = ['expert', 'recruiter', 'admin'];

/** Whether the signed-in user has any of these roles; null until known, as above */
export function useHasRole(anyOf: string[]): boolean | null {
    return useSyncExternalStore(
        subscribe,
        () => rolesNow().some((r) => anyOf.includes(r)),
        () => null,
    );
}
