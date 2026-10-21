'use client';

import React, { Suspense } from 'react';
import UnifiedAuthView from '@/components/auth/UnifiedAuthView';

export default function RegisterPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-km-surface flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#071A4D] border-t-[#FF6B00] rounded-full animate-spin dark:border-km-link" />
                </div>
            }
        >
            <UnifiedAuthView initialRole="user" />
        </Suspense>
    );
}
