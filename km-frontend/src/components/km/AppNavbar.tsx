"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import GuestNavbar from './GuestNavbar';
import api from '@/lib/axios';
import { isAuthenticated, clearSession } from '@/lib/auth';
import { ACCOUNT_RESTORE_PATH, needsAccountRestore } from '@/lib/account';
import { isAuthPage, isSignupComplete, signupResumePath } from '@/lib/authPaths';

function AppNavbarContent() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        const verifyUser = async () => {
            if (typeof window === "undefined") return;

            if (!isAuthenticated()) {
                setIsLoggedIn(false);
                setLoading(false);
                return;
            }

            // Optimistic update
            setIsLoggedIn(true);

            try {
                const userData: any = await api.get(`/user/profile`);
                setUser(userData);

                // A deactivated or pending-deletion account has to restore itself first
                if (needsAccountRestore(userData) && !window.location.pathname.startsWith(ACCOUNT_RESTORE_PATH)) {
                    router.replace(ACCOUNT_RESTORE_PATH);
                    return;
                }

                // Verified the mobile but never finished sign-up: resume the missing step
                const roles: string[] = Array.isArray(userData?.roles) ? userData.roles : [];
                const path = window.location.pathname;
                if (userData && !isSignupComplete(userData) && !roles.includes('admin') && !isAuthPage(path)) {
                    router.replace(signupResumePath(path));
                }
            } catch (error: any) {
                // Only a real auth failure ends the session; network or server errors keep it
                if (error?.status === 401) {
                    await clearSession();
                    setIsLoggedIn(false);
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        };

        verifyUser();
    }, [router]);

    // Optimistic UI:
    // 1. Initial render: false (matches server) -> GuestNavbar
    // 2. Effect: Token found -> true -> Navbar (Optimistic)
    // 3. API Fail: -> false -> GuestNavbar (Correction)
    return isLoggedIn ? <Navbar user={user} /> : <GuestNavbar />;
}

export default function AppNavbar() {
    return (
        <Suspense fallback={
            <div className="h-14 bg-km-surface-card border-b border-gray-100 flex items-center justify-between px-4 md:px-6">
                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded" />
            </div>
        }>
            <AppNavbarContent />
        </Suspense>
    );
}
