'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, ChatsCircleIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { feedApi } from '@/lib/api/feed';
import { notify } from '@/lib/notify';
import FeedComposer from './FeedComposer';
import FeedRightSidebar from './FeedRightSidebar';
import PostCard from './PostCard';
import type { FeedPost } from './feedTypes';
import { useFeedUser } from './feedUtils';

/** One post on its own page: where shared links and comment notifications land */
export default function SinglePostView({ postId }: { postId: string }) {
  const t = useTranslations('feed');
  const router = useRouter();
  const { ready, user } = useFeedUser();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [editing, setEditing] = useState<FeedPost | null>(null);

  const fetchPost = useCallback(
    () =>
      feedApi.get(postId).then(
        (p) => {
          setPost(p);
          setStatus('ready');
        },
        (err) => setStatus((err as { status?: number })?.status === 404 ? 'missing' : 'error'),
      ),
    [postId],
  );

  const load = () => {
    setStatus('loading');
    void fetchPost();
  };

  // Wait for the session so the member's own reaction and save come back with the post
  useEffect(() => {
    if (ready) void fetchPost();
  }, [ready, fetchPost, user?.id]);

  return (
    <div className="min-h-screen bg-km-surface px-4 py-5 sm:px-6 sm:py-7">
      <div className="mx-auto grid max-w-[680px] grid-cols-1 items-start gap-5 lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_280px] xl:gap-6 xl:grid-cols-[minmax(0,1fr)_312px]">
        <main className="min-w-0 space-y-4">
          <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm font-semibold text-km-link hover:underline">
            <ArrowLeftIcon size={16} weight="bold" aria-hidden="true" />
            {t('backToFeed')}
          </Link>

          {status === 'loading' && <div className="h-64 rounded-2xl border border-km-border bg-km-surface-card animate-shimmer" role="status" aria-label={t('loading')} />}

          {(status === 'missing' || status === 'error') && (
            <div className="rounded-2xl border border-km-border bg-km-surface-card px-6 py-10 text-center">
              <ChatsCircleIcon size={36} className="mx-auto text-km-text-secondary" aria-hidden="true" />
              <h1 className="mt-3 text-base font-semibold text-km-heading">{status === 'missing' ? t('missingTitle') : t('loadFailed')}</h1>
              {status === 'missing' && <p className="mt-1 text-sm text-km-text-secondary">{t('missingBody')}</p>}
              {status === 'error' && (
                <button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold text-km-link hover:underline cursor-pointer">
                  {t('retry')}
                </button>
              )}
            </div>
          )}

          {status === 'ready' && post && (
            <>
              <h1 className="sr-only">{t('postBy', { name: post.author.name })}</h1>
              <PostCard
                post={post}
                commentsOpen
                expanded
                onUpdate={(_, change) => setPost((p) => (p ? change(p) : p))}
                onRemove={() => router.push('/feed')}
                onEdit={(p) => setEditing(p)}
              />
            </>
          )}
        </main>
        <div className="hidden lg:block lg:self-stretch lg:pt-9">
          <FeedRightSidebar placement="post_sidebar" />
        </div>
      </div>

      {editing && (
        <FeedComposer
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setEditing(null);
            setPost(updated);
            notify.success(t('updated'));
          }}
        />
      )}
    </div>
  );
}
