'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowClockwiseIcon, BookmarkSimpleIcon, ChatsCircleIcon, NotePencilIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { feedApi } from '@/lib/api/feed';
import { loginPathFor } from '@/lib/authPaths';
import { notify } from '@/lib/notify';
import CreatePostCard from './CreatePostCard';
import FeedComposer from './FeedComposer';
import FeedHeaderFilters from './FeedHeaderFilters';
import FeedLeftSidebar from './FeedLeftSidebar';
import FeedRightSidebar from './FeedRightSidebar';
import PostCard from './PostCard';
import { POST_CATEGORIES, type FeedPage, type FeedPost, type FeedView as View, type PostCategory } from './feedTypes';
import { useFeedUser } from './feedUtils';

type Status = 'loading' | 'ready' | 'error';

interface ComposerState {
  editing?: FeedPost;
  category?: PostCategory;
  pickPhoto?: boolean;
}

/** The feed page. What it shows lives in the address (?view=saved, ?category=jobs, ?tag=hiring) so it can be shared and survives a reload. */
export default function FeedView() {
  const t = useTranslations('feed');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, ready } = useFeedUser();
  const userId = user?.id || user?._id;

  const rawView = params.get('view');
  const view: View = rawView === 'saved' || rawView === 'mine' ? rawView : 'all';
  const rawCategory = params.get('category');
  const category = POST_CATEGORIES.includes(rawCategory as PostCategory) ? (rawCategory as PostCategory) : undefined;
  const tag = params.get('tag')?.replace(/^#/, '').toLowerCase() || undefined;

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const request = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const needsAccount = ready && view !== 'all' && !user;
  const guest = ready && !user;

  const fetchPage = useCallback(
    (before?: string): Promise<FeedPage> => {
      if (view === 'saved') return feedApi.saved(before);
      return feedApi.list({ category: view === 'all' ? category : undefined, tag: view === 'all' ? tag : undefined, authorId: view === 'mine' ? userId : undefined, before });
    },
    [view, category, tag, userId],
  );

  // First page whenever what is shown changes; an older answer never overwrites a newer one
  const loadFirst = useCallback(async () => {
    const id = ++request.current;
    setStatus('loading');
    try {
      const page = await fetchPage();
      if (id !== request.current) return;
      setPosts(page.posts);
      setCursor(page.next_cursor);
      setStatus('ready');
    } catch {
      if (id === request.current) setStatus('error');
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!ready || needsAccount) return;
    void loadFirst();
  }, [ready, needsAccount, loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore || status !== 'ready') return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (id !== request.current) return;
      setPosts((prev) => [...prev, ...page.posts.filter((p) => !prev.some((x) => x.id === p.id))]);
      setCursor(page.next_cursor);
    } catch (err) {
      notify.error(err, t('loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, status, fetchPage, t]);

  // Infinite scroll: the next page starts loading well before the end is reached
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  const setQuery = (next: { view?: View; category?: PostCategory; tag?: string }) => {
    const q = new URLSearchParams();
    if (next.view && next.view !== 'all') q.set('view', next.view);
    if (next.category) q.set('category', next.category);
    if (next.tag) q.set('tag', next.tag);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const signIn = () => {
    const qs = params.toString();
    router.push(loginPathFor(pathname, qs ? `?${qs}` : ''));
  };

  const updatePost = useCallback((id: string, change: (p: FeedPost) => FeedPost) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? change(p) : p)));
  }, []);
  const removePost = useCallback((id: string) => setPosts((prev) => prev.filter((p) => p.id !== id)), []);

  const onSaved = (post: FeedPost, isNew: boolean) => {
    setComposer(null);
    if (!isNew) {
      updatePost(post.id, () => post);
      notify.success(t('updated'));
      return;
    }
    notify.success(t('posted'));
    // Show the new post at the top; if a filter would hide it, go back to everything
    const fits = view === 'mine' || (view === 'all' && (!category || category === post.category) && (!tag || post.content.toLowerCase().includes(`#${tag}`)));
    if (fits) setPosts((prev) => [post, ...prev]);
    else setQuery({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const empty = (() => {
    if (view === 'saved') return { Icon: BookmarkSimpleIcon, title: t('emptySavedTitle'), body: t('emptySavedBody') };
    if (view === 'mine') return { Icon: NotePencilIcon, title: t('emptyMineTitle'), body: t('emptyMineBody') };
    if (tag || category) return { Icon: ChatsCircleIcon, title: t('emptyFilterTitle'), body: t('emptyFilterBody') };
    return { Icon: ChatsCircleIcon, title: t('emptyTitle'), body: t('emptyBody') };
  })();

  return (
    <div className="min-h-screen bg-km-surface px-4 py-5 sm:px-6 sm:py-7">
      {/*
        Phones: the feed alone. Tablets: profile column + feed. Laptops and up: profile, feed and
        the trending/ad column. Guests have no profile column, so the feed sits centred.
      */}
      <div
        className={`mx-auto grid grid-cols-1 items-start gap-5 xl:gap-6 ${
          guest
            ? 'max-w-[680px] lg:max-w-[1000px] lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_312px]'
            : 'max-w-[1240px] md:grid-cols-[212px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_260px] xl:grid-cols-[256px_minmax(0,1fr)_312px]'
        }`}
      >
        {!guest && (
          <div className="hidden md:block md:sticky md:top-20">
            <FeedLeftSidebar view={view} onView={(v) => setQuery({ view: v })} />
          </div>
        )}

        <main className="min-w-0 space-y-4">
          <h1 className="sr-only">{t('title')}</h1>
          {view === 'all' && <CreatePostCard onCompose={(o) => setComposer(o)} onSignIn={signIn} />}

          <FeedHeaderFilters
            view={view}
            category={category}
            tag={tag}
            signedIn={Boolean(user)}
            onView={(v) => setQuery({ view: v })}
            onCategory={(c) => setQuery({ category: c, tag })}
            onClearTag={() => setQuery({ category })}
          />

          {view !== 'all' && (
            <h2 className="text-lg font-semibold text-km-heading">{view === 'saved' ? t('view.saved') : t('view.mine')}</h2>
          )}

          {needsAccount ? (
            <div className="rounded-2xl border border-km-border bg-km-surface-card p-8 text-center">
              <p className="text-[15px] text-km-text-secondary">{t('signInToSee')}</p>
              <button type="button" onClick={signIn} className="btn-primary mt-4 h-11 px-5 text-[15px]">{t('signIn')}</button>
            </div>
          ) : status === 'loading' ? (
            <div className="space-y-4" role="status" aria-label={t('loading')}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-km-border bg-km-surface-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full animate-shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-40 rounded animate-shimmer" />
                      <div className="h-3 w-24 rounded animate-shimmer" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3.5 w-full rounded animate-shimmer" />
                    <div className="h-3.5 w-5/6 rounded animate-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : status === 'error' ? (
            <div className="rounded-2xl border border-km-border bg-km-surface-card p-8 text-center">
              <p className="text-[15px] text-km-text-secondary">{t('loadFailed')}</p>
              <button type="button" onClick={() => void loadFirst()} className="mt-4 inline-flex items-center gap-2 h-11 px-5 rounded-xl border-[1.5px] border-km-border text-[15px] font-semibold text-km-text-primary hover:bg-km-surface cursor-pointer">
                <ArrowClockwiseIcon size={16} aria-hidden="true" />
                {t('retry')}
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-km-border bg-km-surface-card px-6 py-10 text-center">
              <empty.Icon size={36} className="mx-auto text-km-text-secondary" aria-hidden="true" />
              <h2 className="mt-3 text-base font-semibold text-km-heading">{empty.title}</h2>
              <p className="mt-1 text-sm text-km-text-secondary max-w-sm mx-auto leading-relaxed">{empty.body}</p>
              {(tag || category || view !== 'all') && (
                <button type="button" onClick={() => setQuery({})} className="mt-4 text-sm font-semibold text-km-link hover:underline cursor-pointer">
                  {t('seeAllPosts')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} onUpdate={updatePost} onRemove={removePost} onEdit={(p) => setComposer({ editing: p })} />
                ))}
              </div>
              <div ref={sentinel} aria-hidden="true" />
              {cursor ? (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border-[1.5px] border-km-border bg-km-surface-card text-sm font-semibold text-km-text-primary hover:bg-km-surface disabled:opacity-60 cursor-pointer"
                  >
                    {loadingMore && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />}
                    {loadingMore ? t('loading') : t('loadMore')}
                  </button>
                </div>
              ) : (
                <p className="py-4 text-center text-[13px] text-km-text-secondary">{t('endOfFeed')}</p>
              )}
            </>
          )}
        </main>

        {/* Stretches to the feed's height so the ad at its foot can stay in view */}
        <div className="hidden lg:block lg:self-stretch">
          <FeedRightSidebar />
        </div>
      </div>

      {composer && (
        <FeedComposer
          key={composer.editing?.id ?? 'new'}
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
