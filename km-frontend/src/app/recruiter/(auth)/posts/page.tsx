"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MegaphoneIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { feedApi } from "@/lib/api/feed";
import { notify } from "@/lib/notify";
import { btn, cx } from "@/components/admin/ui";
import CreatePostCard from "@/components/feed/CreatePostCard";
import FeedComposer from "@/components/feed/FeedComposer";
import PostCard from "@/components/feed/PostCard";
import { useFeedUser } from "@/components/feed/feedUtils";
import type { FeedPost, PostCategory } from "@/components/feed/feedTypes";

type Composer = { editing?: FeedPost; category?: PostCategory; pickPhoto?: boolean };

const Skeleton = () => (
    <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => <div key={i} className="h-56 rounded-2xl border border-km-border bg-km-surface-card animate-shimmer" />)}
    </div>
);

/**
 * The company's own posts on the KaamMilega feed: hiring news, walk-in drives, team updates.
 * Posts are real feed posts, so candidates see them on the feed and on the company page.
 */
function PostsContent() {
    const t = useTranslations("recruiterPosts");
    const { user, ready } = useFeedUser();
    const me = user?.id || user?._id || "";
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [cursor, setCursor] = useState<string | undefined>();
    const [loading, setLoading] = useState(true);
    const [more, setMore] = useState(false);
    const [failed, setFailed] = useState(false);
    const [composer, setComposer] = useState<Composer | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (!ready || !me) return;
        let alive = true;
        feedApi.list({ authorId: me, limit: 10 })
            .then((page) => {
                if (!alive) return;
                setPosts(page.posts ?? []);
                setCursor(page.next_cursor);
                setFailed(false);
                setLoading(false);
            })
            .catch((err) => {
                if (!alive) return;
                setFailed(true);
                setLoading(false);
                notify.error(err, t("loadFailed"));
            });
        return () => {
            alive = false;
        };
    }, [ready, me, attempt, t]);

    const loadMore = useCallback(() => {
        if (!cursor || more) return;
        setMore(true);
        feedApi.list({ authorId: me, before: cursor, limit: 10 })
            .then((page) => {
                setPosts((prev) => [...prev, ...(page.posts ?? []).filter((p) => !prev.some((q) => q.id === p.id))]);
                setCursor(page.next_cursor);
            })
            .catch((err) => notify.error(err, t("loadFailed")))
            .finally(() => setMore(false));
    }, [cursor, me, more, t]);

    const onSaved = (post: FeedPost, isNew: boolean) => {
        setComposer(null);
        setPosts((prev) => (isNew ? [post, ...prev] : prev.map((p) => (p.id === post.id ? post : p))));
    };
    const updatePost = (id: string, change: (p: FeedPost) => FeedPost) => setPosts((prev) => prev.map((p) => (p.id === id ? change(p) : p)));
    const removePost = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id));

    return (
        <div className="mx-auto max-w-3xl pb-12">
            <h1 className="text-2xl font-bold text-km-heading">{t("title")}</h1>
            <p className="mt-1 text-sm text-km-text-secondary">{t("text")}</p>

            <div className="mt-6 space-y-4">
                <CreatePostCard onCompose={(o) => setComposer({ category: o.category ?? "jobs", pickPhoto: o.pickPhoto })} onSignIn={() => {}} />

                {failed ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-[#2A1215] dark:text-red-300">
                        <span className="flex items-center gap-2"><WarningCircleIcon size={18} aria-hidden="true" />{t("loadFailed")}</span>
                        <button type="button" onClick={() => { setLoading(true); setAttempt((n) => n + 1); }} className={btn.secondary}>{t("retry")}</button>
                    </div>
                ) : loading ? (
                    <Skeleton />
                ) : posts.length === 0 ? (
                    <div className="rounded-2xl border border-km-border bg-km-surface-card px-6 py-10 text-center">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F7FB] text-[#0B5ED7] dark:bg-[#0B1F52] dark:text-[#93C5FD]">
                            <MegaphoneIcon size={24} weight="duotone" aria-hidden="true" />
                        </span>
                        <h2 className="mt-4 text-base font-semibold text-km-heading">{t("emptyTitle")}</h2>
                        <p className="mx-auto mt-1 max-w-sm text-sm text-km-text-secondary">{t("emptyText")}</p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <button type="button" onClick={() => setComposer({ category: "jobs" })} className={btn.primary}>{t("emptyCta")}</button>
                            <Link href="/feed" className={btn.secondary}>{t("seeFeed")}</Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <ul className="space-y-4">
                            {posts.map((post) => (
                                <li key={post.id}>
                                    <PostCard post={post} onUpdate={updatePost} onRemove={removePost} onEdit={(p) => setComposer({ editing: p })} />
                                </li>
                            ))}
                        </ul>
                        {cursor && (
                            <button type="button" onClick={loadMore} disabled={more} className={cx(btn.secondary, "w-full")}>
                                {more ? t("loading") : t("loadMore")}
                            </button>
                        )}
                    </>
                )}
            </div>

            {composer && (
                <FeedComposer
                    key={composer.editing?.id ?? "new"}
                    editing={composer.editing}
                    initialCategory={composer.category}
                    pickPhoto={composer.pickPhoto}
                    onClose={() => setComposer(null)}
                    onSaved={onSaved}
                />
            )}
        </div>
    );
}

export default function RecruiterPostsPage() {
    return (
        <Suspense fallback={<Skeleton />}>
            <PostsContent />
        </Suspense>
    );
}
