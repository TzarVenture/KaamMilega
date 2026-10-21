"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import GuestNavbar from './GuestNavbar';
import api from '@/lib/axios';
import { isAuthenticated, clearSession } from '@/lib/auth';

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

                // A candidate who verified OTP but never finished the name step resumes it
                const roles: string[] = Array.isArray(userData?.roles) ? userData.roles : [];
                if (userData && userData.is_registered === false && !roles.includes('recruiter') && !roles.includes('admin')) {
                    router.replace('/login?complete=1');
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
