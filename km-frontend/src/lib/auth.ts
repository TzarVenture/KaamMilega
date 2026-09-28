import api from "./axios";

export interface StoredUser {
    id?: string;
    _id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    roles?: string[];
    role?: string;
    is_registered?: boolean;
    avatar?: string;
    [key: string]: any;
}

/**
 * Saves non-sensitive profile display data to localStorage and sets the km_user_role cookie.
 * In accordance with industry standards, the secret JWT authentication token is NEVER stored
 * in localStorage; it is securely managed via the HttpOnly km_auth_token cookie set by the backend.
 */
export function saveSession(user: StoredUser, _optionalToken?: string) {
    if (typeof window === "undefined") return;

    try {
        // Purge token from localStorage so the secret JWT is never exposed to client-side scripts
        localStorage.removeItem("token");

        // Save harmless display info for instant UI rendering (avatar, name, etc.)
        localStorage.setItem("user", JSON.stringify(user));

        // Derive primary role
        const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : ["user"]);
        const primaryRole = roles[0] || "user";

        // Set readable role cookie for Next.js Edge Middleware (72 hours)
        document.cookie = `km_user_role=${primaryRole}; Path=/; Max-Age=259200; SameSite=Lax`;
    } catch (e) {
        console.error("Failed to save auth session:", e);
    }
}

/**
 * Clears session credentials locally and on the server via /api/auth/logout.
 */
export async function clearSession() {
    if (typeof window === "undefined") return;

    try {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        // Expire the client-side role cookie
        document.cookie = "km_user_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;";

        // Notify backend to clear HttpOnly km_auth_token cookie
        await api.post("/auth/logout").catch(() => {});
    } catch (e) {
        console.error("Error during session logout:", e);
    }
}

/**
 * Checks if the user is authenticated (checks stored profile and role cookie).
 */
export function isAuthenticated(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const hasUser = Boolean(localStorage.getItem("user"));
        if (hasUser) return true;
        return document.cookie.includes("km_user_role=");
    } catch {
        return false;
    }
}

/**
 * Retrieves the currently logged-in user profile from localStorage.
 */
export function getCurrentUser(): StoredUser | null {
    if (typeof window === "undefined") return null;

    try {
        const stored = localStorage.getItem("user");
        if (!stored) return null;
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

/**
 * Retrieves the primary role of the current user.
 */
export function getCurrentRole(): string {
    const user = getCurrentUser();
    if (!user) return "";
    const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
    return roles[0] || "";
}

/**
 * Checks if the current user has recruiter permissions.
 */
export function isRecruiter(): boolean {
    const user = getCurrentUser();
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
    return roles.includes("recruiter");
}
