'use client';
import Footer from '@/components/km/Footer';
import Navbar from '@/components/km/AppNavbar';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import RecruiterSidebar from '@/components/RecruiterSidebar';
import { FullPageSkeleton } from '@/components/ui/LoadingSkeleton';

const Layout = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifyRecruiter = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
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
            <div>
                <Navbar />
                <div className="flex">
                    <RecruiterSidebar />
                    <div className="flex-1 min-w-0 md:ml-64">
                        <main className="container mx-auto px-4 py-8">
                            <FullPageSkeleton />
                        </main>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navbar />
            <div className="flex">
                <RecruiterSidebar />
                <div className="flex-1 min-w-0 transition-all duration-300 md:ml-64">
                    <main className="container mx-auto px-4 py-8">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Layout;