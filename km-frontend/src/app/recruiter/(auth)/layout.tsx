'use client';
import Footer from '@/components/km/Footer';
import Navbar from '@/components/km/AppNavbar';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import RecruiterSidebar from '@/components/RecruiterSidebar';
import { FullPageSkeleton } from '@/components/ui/LoadingSkeleton';

const Layout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifyRecruiter = async () => {
            if (!isAuthenticated()) {
                router.push('/recruiter/login');
                return;
            }

            try {
                // Fetch user profile to check roles
                const user: any = await api.get('/user/profile');

                // Handle different role structures (array or string)
                const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);

                // Check if user has recruiter role
                if (roles.includes('recruiter')) {
                    if (!user.company_name || !user.company_name.trim()) {
                        router.push('/recruiter/register');
                        return;
                    }
                    setIsLoading(false);
                } else {
                    // Redirect non-recruiters to home page
                    router.push('/');
                }
            } catch (error) {
                console.error("Failed to verify recruiter access", error);
                router.push('/recruiter/login');
            }
        };

        verifyRecruiter();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-km-surface text-km-text-primary">
                <Navbar />
                <div className="flex">
                    <RecruiterSidebar />
                    <div className="flex-1 min-w-0 md:ml-64">
                        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                            <FullPageSkeleton />
                        </main>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-km-surface text-km-text-primary">
            <Navbar />
            <div className="flex">
                <RecruiterSidebar />
                <div className="flex-1 min-w-0 md:ml-64">
                    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-8">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Layout;