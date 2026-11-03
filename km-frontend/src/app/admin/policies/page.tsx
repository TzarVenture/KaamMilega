'use client';

import React from 'react';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import { AdminPageHeader, AdminPanel, EmptyState } from '@/components/admin/ui';

// Terms and privacy pages have no backend yet (see docs/pending-todo.md), so there is nothing to
// edit here. The page used to show placeholder text that looked like live policies.
export default function PoliciesPage() {
    return (
        <div>
            <AdminPageHeader title="Policies" description="Terms of use, privacy and community rules" />
            <AdminPanel>
                <EmptyState
                    icon={ShieldCheckIcon}
                    title="Policies aren't connected yet"
                    description="Policy pages need a backend before they can be edited here. Until then they're changed in the site's code."
                />
            </AdminPanel>
        </div>
    );
}
