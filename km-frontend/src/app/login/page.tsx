'use client';

import React, { Suspense } from 'react';
import UnifiedAuthView from '@/components/auth/UnifiedAuthView';

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#F4F7FB] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#071A4D] border-t-[#FF6B00] rounded-full animate-spin" />
                </div>
            }
        >
            <UnifiedAuthView initialRole="user" />
        </Suspense>
    );
}