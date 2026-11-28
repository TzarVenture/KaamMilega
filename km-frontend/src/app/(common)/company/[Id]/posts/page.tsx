'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NewspaperIcon } from '@phosphor-icons/react';
import { useCompany } from '../CompanyContext';
import { feedApi } from '@/lib/api/feed';
import PostCard from '@/components/feed/PostCard';
import type { FeedPost } from '@/components/feed/feedTypes';

const Skeleton = () => (
    <div className="space-y-4" aria-busy="true">
        {[1, 2].map((n) => <div key={n} className="h-56 bg-km-surface-card border border-km-border rounded-2xl animate-pulse" />)}
    </div>
);

/** The company's posts on the KaamMilega feed: hiring news, walk-in drives and team updates */
function CompanyPosts() {
    const t = useTranslations('company');
    const router = useRouter();
    const { company } = useCompany();
    const [posts, setPosts] = useState<FeedPost[] | null>(null);
    const [cursor, setCursor] = useState<string | undefined>();
    const [more, setMore] = useState(false);

    useEffect(() => {
        if (!company?.id) return;
        let alive = true;
        feedApi.list({ authorId: company.id, limit: 10 })
            .then((page) => {
                if (!alive) return;
                setPosts(page.posts ?? []);
                setCursor(page.next_cursor);
            })
            .catch(() => alive && setPosts([]));
        return () => {
            alive = false;
        };
    }, [company?.id]);

    const loadMore = () => {
        if (!company?.id || !cursor || more) return;
        setMore(true);
        feedApi.list({ authorId: company.id, before: cursor, limit: 10 })
            .then((page) => {
                setPosts((prev) => [...(prev ?? []), ...(page.posts ?? []).filter((p) => !prev?.some((q) => q.id === p.id))]);
                setCursor(page.next_cursor);
            })
            .catch(() => setCursor(undefined))
            .finally(() => setMore(false));
    };

    const update = (id: string, change: (p: FeedPost) => FeedPost) =>
        setPosts((prev) => prev?.map((p) => (p.id === id ? change(p) : p)) ?? prev);
    const remove = (id: string) => setPosts((prev) => prev?.filter((p) => p.id !== id) ?? prev);

    if (posts === null) return <Skeleton />;

    if (posts.length === 0) {
        return (
            <section className="bg-km-surface-card border border-km-border rounded-2xl p-10 text-center">
                <NewspaperIcon size={32} weight="duotone" className="text-km-heading mx-auto mb-3" aria-hidden="true" />
                <h2 className="text-base font-bold text-km-text-primary">{t('noPosts')}</h2>
                <p className="text-sm text-km-text-secondary mt-1">{t('noPostsText')}</p>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {posts.map((post) => (
                // The company edits its posts from its own Posts page in the employer portal
                <PostCard key={post.id} post={post} onUpdate={update} onRemove={remove} onEdit={() => router.push('/recruiter/posts')} />
            ))}
            {cursor && (
                <button
                    type="button"
                    onClick={loadMore}
                    disabled={more}
                    className="w-full rounded-xl border border-km-border bg-km-surface-card py-2.5 text-sm font-semibold text-km-text-primary hover:bg-km-surface disabled:opacity-60"
                >
                    {more ? t('loadingMore') : t('loadMore')}
                </button>
            )}
        </section>
    );
}

export default function CompanyPostsPage() {
    return (
        <Suspense fallback={<Skeleton />}>
            <CompanyPosts />
        </Suspense>
    );
}
