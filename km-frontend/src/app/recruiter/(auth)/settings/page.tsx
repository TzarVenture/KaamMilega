"use client";

import React, { Suspense } from "react";
import SettingsView from "@/components/km/SettingsView";
import { FullPageSkeleton } from "@/components/ui/LoadingSkeleton";

export default function RecruiterSettingsPage() {
    return (
        <Suspense fallback={<FullPageSkeleton />}>
            <SettingsView mode="recruiter" />
        </Suspense>
    );
}
