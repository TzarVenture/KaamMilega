"use client";

import { useEffect } from "react";
import { refreshRoleCookie } from "@/lib/auth";

/** Keeps the km_user_role cookie fresh on every visit while a login is stored (see refreshRoleCookie) */
export default function RoleCookieKeeper() {
    useEffect(() => {
        refreshRoleCookie();
    }, []);
    return null;
}
