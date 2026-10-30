import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import UnifiedAuthView, { type AuthPreviewStep } from '@/components/auth/UnifiedAuthView';
import EmployerSetupView, { type EmployerSetupStep } from '@/components/auth/EmployerSetupView';

const STEPS: AuthPreviewStep[] = ['phone', 'code', 'details', 'password', 'forgot'];
const SETUP_STEPS: EmployerSetupStep[] = ['you', 'company', 'verify'];

// Design preview for the sign-in screens (?step=code&role=recruiter) and the employer setup
// (?setup=company); never shipped to production
export default async function AuthPreviewPage({ searchParams }: { searchParams: Promise<{ step?: string; role?: string; setup?: string }> }) {
    if (process.env.NODE_ENV === 'production') notFound();
    const { step, role, setup } = await searchParams;
    if (SETUP_STEPS.includes(setup as EmployerSetupStep)) {
        return <EmployerSetupView previewStep={setup as EmployerSetupStep} />;
    }
    const previewStep = STEPS.includes(step as AuthPreviewStep) ? (step as AuthPreviewStep) : 'phone';
    return (
        <Suspense>
            <UnifiedAuthView initialRole={role === 'recruiter' ? 'recruiter' : 'user'} previewStep={previewStep} />
        </Suspense>
    );
}
