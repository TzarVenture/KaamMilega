// Where sign-in and sign-up send people. Kept free of imports so the axios interceptor can
// use it without a circular import through lib/auth.

/** Sign-up is finished once the person has given their name (matches the backend's IsSignupComplete) */
export function isSignupComplete(user: { is_registered?: boolean; name?: string } | null | undefined): boolean {
    return user?.is_registered === true || Boolean(user?.name?.trim());
}

/** Pages that are part of signing in or signing up: never redirect away from these */
export function isAuthPage(pathname: string): boolean {
    return ["/login", "/register", "/signup", "/recruiter/login", "/recruiter/register", "/admin/login"].some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
    );
}

/** Where an unfinished sign-up continues: the company form in the employer portal, else the name step */
export function signupResumePath(pathname: string): string {
    return pathname.startsWith("/recruiter") ? "/recruiter/register" : "/login?complete=1";
}

/** The sign-in page for the portal a page belongs to, coming back to that page afterwards */
export function loginPathFor(pathname: string, search = ""): string {
    const base = pathname.startsWith("/recruiter") ? "/recruiter/login" : "/login";
    if (pathname === "/" || isAuthPage(pathname)) return base;
    return `${base}?redirect=${encodeURIComponent(pathname + search)}`;
}

/** A same-site path to return to after sign-in ("//host" and "/\host" are other sites), or null */
export function safeRedirect(target: string | null | undefined): string | null {
    if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return null;
    const path = target.split("?")[0];
    return isAuthPage(path) ? null : target;
}
