'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MapPinIcon, UsersIcon } from '@phosphor-icons/react';
import { useCompany } from "../CompanyContext";
import api from '@/lib/axios';
import UserAvatar from '@/components/ui/UserAvatar';
import { isAuthenticated } from '@/lib/auth';
import { loginPathFor } from '@/lib/authPaths';

/** GET /network/companies/:id/people */
interface Person {
    id: string;
    name: string;
    headline?: string;
    title?: string;
    profile_image?: string;
    city?: string;
    is_recruiter: boolean;
}

/** Members who work at the company now. Signed-in members only, like the rest of the network. */
export default function CompanyPeoplePage() {
    const t = useTranslations('company');
    const pathname = usePathname();
    const { company } = useCompany();
    const [signedIn] = useState(() => isAuthenticated());
    const [people, setPeople] = useState<Person[] | null>(null);

    useEffect(() => {
        if (!company?.id || !signedIn) return;
        let alive = true;
        api.get(`/network/companies/${company.id}/people`)
            .then((res) => {
                const list = (res as { data?: Person[] } | null)?.data;
                if (alive) setPeople(Array.isArray(list) ? list : []);
            })
            .catch(() => alive && setPeople([]));
        return () => {
            alive = false;
        };
    }, [company?.id, signedIn]);

    const box = 'bg-km-surface-card border border-km-border rounded-2xl p-10 text-center';

    if (!signedIn) {
        return (
            <section className={box}>
                <UsersIcon size={32} weight="duotone" className="text-km-heading mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-km-text-secondary mb-4">{t('peopleSignIn')}</p>
                <Link href={loginPathFor(pathname)} className="inline-flex px-5 py-2 bg-km-primary text-white rounded-xl text-sm font-semibold hover:bg-km-primary-dark transition-colors">
                    {t('signIn')}
                </Link>
            </section>
        );
    }

    if (people === null) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true">
                {[1, 2, 3, 4].map((n) => <div key={n} className="h-20 bg-km-surface-card border border-km-border rounded-2xl animate-pulse" />)}
            </div>
        );
    }

    if (people.length === 0) {
        return (
            <section className={box}>
                <UsersIcon size={32} weight="duotone" className="text-km-heading mx-auto mb-3" aria-hidden="true" />
                <p className="text-sm text-km-text-secondary">{t('noPeople')}</p>
            </section>
        );
    }

    return (
        <section className="bg-km-surface-card border border-km-border rounded-2xl p-5 sm:p-6">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {people.map((p) => (
                    <li key={p.id}>
                        <Link href={`/profile/${p.id}`} className="flex items-center gap-3 p-3 rounded-xl border border-km-border-subtle hover:border-km-border hover:bg-km-surface transition-colors">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-km-surface border border-km-border">
                                <UserAvatar src={p.profile_image} name={p.name} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-km-text-primary truncate">{p.name}</p>
                                <p className="text-xs text-km-text-secondary truncate">
                                    {p.is_recruiter ? t('recruiter') : p.title || p.headline}
                                </p>
                                {p.city && (
                                    <p className="flex items-center gap-1 text-xs text-km-text-secondary mt-0.5">
                                        <MapPinIcon weight="bold" size={11} className="text-km-heading shrink-0" aria-hidden="true" />
                                        <span className="truncate">{p.city}</span>
                                    </p>
                                )}
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
