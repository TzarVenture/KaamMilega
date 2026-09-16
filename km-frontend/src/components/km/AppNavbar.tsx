"use client";
import { useEffect, useState, Suspense } from 'react';
import Navbar from './Navbar';
import GuestNavbar from './GuestNavbar';
import api from '@/lib/axios';

function AppNavbarContent() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const verifyUser = async () => {
            if (typeof window === "undefined") return;

            const token = localStorage.getItem('token');
            if (!token) {
                setIsLoggedIn(false);
                setLoading(false);
                return;
            }

            // Optimistic update
            setIsLoggedIn(true);

            try {
                // Use fetch to avoid global axios interceptor redirects
                const userData = await api.get(`/user/profile`);
                setUser(userData);
            } catch (error) {
                console.error("Auth check failed", error);
                setIsLoggedIn(false);
            } finally {
                setLoading(false);
            }
        };

        verifyUser();
    }, []);

    // Optimistic UI:
    // 1. Initial render: false (matches server) -> GuestNavbar
    // 2. Effect: Token found -> true -> Navbar (Optimistic)
    // 3. API Fail: -> false -> GuestNavbar (Correction)
    return isLoggedIn ? <Navbar user={user} /> : <GuestNavbar />;
}

export default function AppNavbar() {
    return (
        <Suspense fallback={
            <div className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6">
                <div className="h-7 w-20 bg-slate-200 animate-pulse rounded" />
            </div>
        }>
            <AppNavbarContent />
        </Suspense>
    );
}
