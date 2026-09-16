"use client";

import React, { Suspense } from "react";
import SettingsView from "@/components/km/SettingsView";
import { FullPageSkeleton } from "@/components/ui/LoadingSkeleton";

export default function CandidateSettingsPage() {
    return (
        <Suspense fallback={<FullPageSkeleton />}>
            <div className="container mx-auto px-4 py-8">
                <SettingsView mode="candidate" />
            </div>
        </Suspense>
    );
}
