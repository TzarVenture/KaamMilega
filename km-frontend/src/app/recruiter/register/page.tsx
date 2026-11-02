'use client';

import EmployerSetupView from '@/components/auth/EmployerSetupView';

// Employer setup after signing in: about you, the company (saved at this step, which makes the
// account an employer), then optional verification. ?step=verify reopens verification later.
export default function RecruiterRegisterPage() {
    return <EmployerSetupView />;
}
