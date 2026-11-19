'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon, BriefcaseIcon, BuildingsIcon, HandshakeIcon, MapPinIcon, MedalIcon, TargetIcon, UsersIcon, UsersThreeIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import UserAvatar from '@/components/ui/UserAvatar';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import CompaniesToFollow from '@/components/network/CompaniesToFollow';
import { errorText, notify } from '@/lib/notify';
import { useFormat } from '@/i18n/useFormat';

interface User extends ProfileCardUser {
    id: string;
    name: string;
    roles: string[];
}

interface ConnectionRequest {
    id: string;
    sender_id: string;
}

interface Invitation extends ConnectionRequest {
    sender: User;
}

interface SuggestionsApiResponse {
    suggestions: User[];
    total: number;
    has_incomplete_profile: boolean;
    user_city: string;
}

type FilterType = 'all' | 'mutual' | 'company' | 'city' | 'skills' | 'industry';

const FILTERS: { id: FilterType; icon: Icon }[] = [
    { id: 'all', icon: UsersThreeIcon },
    { id: 'mutual', icon: HandshakeIcon },
    { id: 'company', icon: BuildingsIcon },
    { id: 'city', icon: MapPinIcon },
    { id: 'skills', icon: MedalIcon },
    { id: 'industry', icon: BriefcaseIcon },
];

const PAGE_SIZE = 24;

const withId = (list?: User[] | null) => (list || []).map((u) => ({ ...u, id: u.id || u._id || '' })).filter((u) => u.id);

const primaryButton =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default dark:bg-km-primary dark:hover:bg-km-primary-dark';
const secondaryButton =
    'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-km-border text-km-text-primary text-sm font-semibold hover:bg-km-surface transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default';

function CardSkeletons({ count = 4 }: { count?: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="h-60 bg-km-surface border border-km-border rounded-2xl p-5 flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-km-border" />
                    <div className="h-3.5 w-28 bg-km-border rounded mt-4" />
                    <div className="h-3 w-36 bg-km-border/60 rounded mt-2" />
                    <div className="h-9 w-full bg-km-border/60 rounded-xl mt-auto" />
                </div>
            ))}
        </div>
    );
}

const NetworkPage = () => {
    const t = useTranslations('network');
    const { number } = useFormat();
    const router = useRouter();

    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [busyInvites, setBusyInvites] = useState<string[]>([]);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [connections, setConnections] = useState<string[]>([]);
    const [sentPending, setSentPending] = useState<string[]>([]);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [hasIncompleteProfile, setHasIncompleteProfile] = useState(false);
    const [userCity, setUserCity] = useState('');
    const [loading, setLoading] = useState(true);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    // Only the latest suggestions request may fill the grid (filters can be clicked quickly)
    const requestRef = useRef(0);

    useEffect(() => {
        let alive = true;
        Promise.all([
            api.get('/network/pending').catch(() => []) as Promise<ConnectionRequest[]>,
            api.get('/network/connections').catch(() => []) as Promise<string[]>,
            api.get('/network/sent').catch(() => []) as Promise<string[]>,
            api.get('/network/suggestions', { params: { type: 'all', limit: PAGE_SIZE } }).catch(() => null) as Promise<SuggestionsApiResponse | null>,
        ])
            .then(async ([pending, conns, sent, res]) => {
                const withSender = await Promise.all(
                    (Array.isArray(pending) ? pending : []).map((inv) =>
                        (api.get(`/user/${inv.sender_id}`) as Promise<User>)
                            .then((sender) => ({ ...inv, sender }))
                            .catch(() => null),
                    ),
                );
                if (!alive) return;
                setInvitations(withSender.filter((i): i is Invitation => i !== null));
                setConnections(Array.isArray(conns) ? conns : []);
                setSentPending(Array.isArray(sent) ? sent : []);
                if (res) {
                    setSuggestions(withId(res.suggestions));
                    setTotal(res.total || 0);
                    setHasIncompleteProfile(Boolean(res.has_incomplete_profile));
                    setUserCity(res.user_city || '');
                }
            })
            .catch((err) => alive && notify.error(err, t('loadError')))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, [t]);

    const loadSuggestions = async (filter: FilterType, nextPage: number) => {
        const request = ++requestRef.current;
        const res = (await api.get('/network/suggestions', {
            params: { type: filter, limit: PAGE_SIZE, page: nextPage },
        })) as SuggestionsApiResponse | null;
        if (request !== requestRef.current) return;
        const list = withId(res?.suggestions);
        setSuggestions((prev) => {
            if (nextPage === 1) return list;
            const seen = new Set(prev.map((u) => u.id));
            return [...prev, ...list.filter((u) => !seen.has(u.id))];
        });
        setTotal(res?.total || 0);
        setPage(nextPage);
    };

    const selectFilter = async (filter: FilterType) => {
        if (filter === activeFilter) return;
        setActiveFilter(filter);
        setSuggestionsLoading(true);
        try {
            await loadSuggestions(filter, 1);
        } catch (err) {
            setSuggestions([]);
            setTotal(0);
            notify.error(err, t('suggestionsError'));
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const showMore = async () => {
        setLoadingMore(true);
        try {
            await loadSuggestions(activeFilter, page + 1);
        } catch (err) {
            notify.error(err, t('suggestionsError'));
        } finally {
            setLoadingMore(false);
        }
    };

    const answerInvite = async (senderId: string, accept: boolean) => {
        if (busyInvites.includes(senderId)) return;
        setBusyInvites((prev) => [...prev, senderId]);
        try {
            await api.post(accept ? '/network/accept' : '/network/ignore', { sender_id: senderId });
            setInvitations((prev) => prev.filter((inv) => inv.sender_id !== senderId));
            if (accept) {
                setConnections((prev) => [...prev, senderId]);
                notify.success(t('accepted'));
            }
        } catch (err) {
            notify.error(err, accept ? t('acceptError') : t('ignoreError'));
        } finally {
            setBusyInvites((prev) => prev.filter((id) => id !== senderId));
        }
    };

    const connect = async (userId: string) => {
        if (sentPending.includes(userId)) return;
        // Show "Pending" right away; undo it if the request fails for a real reason
        setSentPending((prev) => [...prev, userId]);
        try {
            await api.post('/network/connect', { receiver_id: userId });
        } catch (err) {
            const msg = errorText(err, '').toLowerCase();
            if (msg.includes('already') || msg.includes('pending')) return;
            setSentPending((prev) => prev.filter((id) => id !== userId));
            notify.error(err, t('connectError'));
        }
    };

    const dismiss = (targetId: string) => {
        setSuggestions((prev) => prev.filter((s) => s.id !== targetId));
        setTotal((n) => Math.max(0, n - 1));
        api.post(`/network/suggestions/${targetId}/dismiss`).catch(() => {});
    };

    const filterLabel = (id: FilterType) => (id === 'city' && userCity ? t('filters.cityNamed', { city: userCity }) : t(`filters.${id}`));

    if (loading) {
        return (
            <div className="bg-km-surface-card rounded-2xl border border-km-border p-5 sm:p-6" aria-busy="true">
                <div className="h-5 w-44 bg-km-border rounded-lg mb-2 animate-pulse" />
                <div className="h-3 w-64 bg-km-border/60 rounded-lg mb-6 animate-pulse" />
                <CardSkeletons />
            </div>
        );
    }

    const hasMore = suggestions.length < total;

    return (
        <div className="space-y-6">
            {/* Invitations come first: they are the one thing here waiting on the user */}
            {invitations.length > 0 && (
                <section id="invitations" aria-labelledby="invitations-title" className="bg-km-surface-card rounded-2xl p-5 sm:p-6 border border-km-border scroll-mt-24">
                    <h2 id="invitations-title" className="text-base sm:text-lg font-bold text-km-text-primary">
                        {t('invitationsTitle', { count: invitations.length, n: number(invitations.length) })}
                    </h2>
                    <p className="text-sm text-km-text-secondary mt-0.5 mb-4">{t('invitationsSubtitle')}</p>

                    <ul className="divide-y divide-km-border-subtle">
                        {invitations.map((inv) => (
                            <InvitationRow
                                key={inv.id}
                                invitation={inv}
                                busy={busyInvites.includes(inv.sender_id)}
                                onAccept={() => answerInvite(inv.sender_id, true)}
                                onIgnore={() => answerInvite(inv.sender_id, false)}
                            />
                        ))}
                    </ul>
                </section>
            )}

            {hasIncompleteProfile && (
                <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <TargetIcon size={26} weight="duotone" className="text-km-link shrink-0" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-bold text-km-text-primary">{t('improveTitle')}</h2>
                            <p className="text-sm text-km-text-secondary mt-0.5">{t('improveText')}</p>
                        </div>
                    </div>
                    <Link href="/profile" className={`${primaryButton} whitespace-nowrap self-stretch sm:self-auto`}>
                        {t('improveAction')}
                        <ArrowRightIcon weight="bold" size={14} aria-hidden="true" />
                    </Link>
                </div>
            )}

            <section aria-labelledby="suggestions-title" className="bg-km-surface-card rounded-2xl p-5 sm:p-6 border border-km-border">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 mb-4">
                    <div>
                        <h2 id="suggestions-title" className="text-base sm:text-lg font-bold text-km-text-primary">{t('suggestionsTitle')}</h2>
                        <p className="text-sm text-km-text-secondary mt-0.5">{t('suggestionsSubtitle')}</p>
                    </div>
                    <Link href="/network/connections" className="inline-flex items-center gap-1 text-sm font-semibold text-km-heading hover:text-km-link transition-colors">
                        {t('viewConnections', { count: connections.length, n: number(connections.length) })}
                        <ArrowRightIcon weight="bold" size={13} aria-hidden="true" />
                    </Link>
                </div>

                {/* Filters: one scrolling row on phones, wrapped on wider screens so none are hidden */}
                <div role="group" aria-label={t('filtersLabel')} className="-mx-1 px-1 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1 mb-5 scrollbar-hide">
                    {FILTERS.map(({ id, icon: FilterIcon }) => {
                        const active = activeFilter === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={active}
                                onClick={() => selectFilter(id)}
                                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                                    active
                                        ? 'bg-[#071A4D] text-white border-[#071A4D] dark:bg-km-primary dark:border-km-primary'
                                        : 'bg-km-surface-card text-km-text-secondary border-km-border hover:text-km-text-primary hover:border-km-text-secondary'
                                }`}
                            >
                                <FilterIcon size={14} weight={active ? 'bold' : 'regular'} aria-hidden="true" />
                                {filterLabel(id)}
                            </button>
                        );
                    })}
                </div>

                <div aria-live="polite" aria-busy={suggestionsLoading}>
                    {suggestionsLoading ? (
                        <CardSkeletons />
                    ) : suggestions.length === 0 ? (
                        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-km-border">
                            <UsersIcon size={30} weight="duotone" className="text-km-heading mx-auto mb-3" aria-hidden="true" />
                            <h3 className="text-sm font-bold text-km-text-primary mb-1">
                                {activeFilter === 'all' ? t('emptyAllTitle') : t('emptyFilterTitle', { filter: filterLabel(activeFilter) })}
                            </h3>
                            <p className="text-sm text-km-text-secondary max-w-sm mx-auto mb-4">
                                {activeFilter === 'all' ? t('emptyAllText') : t('emptyFilterText')}
                            </p>
                            {activeFilter === 'all' ? (
                                <Link href="/profile" className={primaryButton}>{t('improveAction')}</Link>
                            ) : (
                                <button type="button" onClick={() => selectFilter('all')} className={primaryButton}>
                                    {t('showAll')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {suggestions.map((user) => (
                                    <ProfileConnectionCard
                                        key={user.id}
                                        user={user}
                                        variant="grid"
                                        actionType="discover"
                                        isPending={sentPending.includes(user.id)}
                                        isConnected={connections.includes(user.id)}
                                        onConnect={() => connect(user.id)}
                                        onChat={() => router.push(`/chat?userId=${user.id}`)}
                                        onDismiss={dismiss}
                                    />
                                ))}
                            </div>
                            {hasMore && (
                                <div className="mt-5 flex justify-center">
                                    <button type="button" onClick={showMore} disabled={loadingMore} className={secondaryButton}>
                                        {loadingMore ? t('loadingMore') : t('showMore')}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            <CompaniesToFollow />
        </div>
    );
};

const InvitationRow = ({
    invitation,
    busy,
    onAccept,
    onIgnore,
}: {
    invitation: Invitation;
    busy: boolean;
    onAccept: () => void;
    onIgnore: () => void;
}) => {
    const t = useTranslations('network');
    const tp = useTranslations('people');
    const { sender } = invitation;
    const name = sender.name || tp('member');

    return (
        <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
            <Link href={`/profile/${invitation.sender_id}`} className="flex items-center gap-3.5 min-w-0 group">
                <div className="w-12 h-12 rounded-full bg-km-surface border border-km-border overflow-hidden shrink-0">
                    <UserAvatar src={sender.profile_image} name={name} />
                </div>
                <div className="min-w-0">
                    <p className="font-semibold text-sm text-km-text-primary truncate group-hover:text-km-link transition-colors">{name}</p>
                    <p className="text-sm text-km-text-secondary truncate">{sender.headline || tp('defaultHeadline')}</p>
                    {sender.city && (
                        <p className="flex items-center gap-1 text-xs text-km-text-secondary mt-0.5">
                            <MapPinIcon weight="bold" size={11} className="text-km-heading shrink-0" aria-hidden="true" />
                            <span className="truncate">{sender.city}</span>
                        </p>
                    )}
                </div>
            </Link>

            <div className="flex items-center gap-2 shrink-0 sm:justify-end">
                <button type="button" onClick={onIgnore} disabled={busy} className={`${secondaryButton} flex-1 sm:flex-none`}>
                    {t('ignore')}
                </button>
                <button type="button" onClick={onAccept} disabled={busy} className={`${primaryButton} flex-1 sm:flex-none`}>
                    {t('accept')}
                </button>
            </div>
        </li>
    );
};

export default NetworkPage;
