'use client';

import { ApplyProfileSheet } from '@/components/jobs/ApplyProfileGate';
import type { ProfileCompletion } from '@/lib/profileStrength';

// A new account: name, mobile and city done (30%), everything else missing
const SAMPLE: ProfileCompletion = {
    score: 30,
    tier: 1,
    tier_name: 'Basic',
    missing_fields: [],
    unlocked_services: [],
    experience_years: 0,
    expert_eligible: false,
    criteria: ['name', 'mobile', 'city', 'headline', 'skills', 'work_experience', 'email', 'education', 'profile_image', 'about', 'portfolio'].map((id, i) => ({
        id,
        weight: 10,
        earned: i < 3 ? 10 : 0,
        completed: i < 3,
    })),
};

/** Design preview of the details asked before applying (/dev/auth?sheet=apply) */
export default function ApplySheetPreview() {
    return (
        <div className="min-h-dvh bg-km-surface">
            <ApplyProfileSheet completion={SAMPLE} profile={{ skills: ['Wiring'] }} onDone={() => {}} />
        </div>
    );
}
