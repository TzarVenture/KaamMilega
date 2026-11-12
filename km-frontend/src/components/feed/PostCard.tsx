'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookmarkSimpleIcon,
  ChartBarIcon,
  ChatCircleIcon,
  DotsThreeIcon,
  FlagIcon,
  LinkSimpleIcon,
  PencilSimpleIcon,
  SealCheckIcon,
  ShareFatIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import { feedApi, postUrl } from '@/lib/api/feed';
import { loginPathFor } from '@/lib/authPaths';
import { notify } from '@/lib/notify';
import { usePostImpression } from '@/lib/telemetry';
import { ConfirmDialog } from './FeedDialog';
import PostComments, { CommentItem } from './PostComments';
import PostContent from './PostContent';
import PostMedia from './PostMedia';
import { ReactionButton, ReactionSummary, withReaction } from './PostReactions';
import ReportPostDialog from './ReportPostDialog';
import type { FeedPost, ReactionType } from './feedTypes';
import { compactNumber, useFeedUser, useRelativeTime } from './feedUtils';

interface PostCardProps {
  post: FeedPost;
  /** Apply a change to this post in the list that owns it */
  onUpdate: (id: string, change: (p: FeedPost) => FeedPost) => void;
  /** The post was deleted, or reported and hidden */
  onRemove: (id: string) => void;
  onEdit: (post: FeedPost) => void;
  /** Open the comments straight away (a shared link to the post) */
  commentsOpen?: boolean;
  /** Show the whole text without folding (a shared link to the post) */
  expanded?: boolean;
}

// Text colour is left out so the reaction button can show the member's reaction in its own colour
const actionClass = 'w-full flex items-center justify-center gap-2 h-11 px-2 rounded-xl text-sm font-semibold hover:bg-km-surface transition-colors cursor-pointer';
const idleText = 'text-km-text-secondary hover:text-km-heading';

export default function PostCard({ post, onUpdate, onRemove, onEdit, commentsOpen = false, expanded = false }: PostCardProps) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { user } = useFeedUser();
  const time = useRelativeTime(post.created_at);
  const impressionRef = usePostImpression<HTMLElement>(post.id, post.author.id);

  const [showComments, setShowComments] = useState(commentsOpen);
  // Each tap on Comment asks the comment box for focus again
  const [focusRequest, setFocusRequest] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Only the latest reaction request may settle the counts (quick taps can finish out of order)
  const reactionSeq = useRef(0);
  const saveBusy = useRef(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const signIn = () => {
    const qs = search.toString();
    router.push(loginPathFor(pathname, qs ? `?${qs}` : ''));
  };

  const react = async (next?: ReactionType) => {
    if (!user) return signIn();
    const before = { reaction_counts: post.reaction_counts, reactions_total: post.reactions_total, user_reaction: post.user_reaction };
    onUpdate(post.id, (p) => withReaction(p, next));
    const seq = ++reactionSeq.current;
    try {
      const res = next ? await feedApi.react(post.id, next) : await feedApi.unreact(post.id);
      if (seq === reactionSeq.current) onUpdate(post.id, (p) => ({ ...p, ...res, user_reaction: res.user_reaction || undefined }));
    } catch (err) {
      if (seq === reactionSeq.current) {
        onUpdate(post.id, (p) => ({ ...p, ...before }));
        notify.error(err, t('reactFailed'));
      }
    }
  };

  const toggleSave = async () => {
    setMenuOpen(false);
    if (!user) return signIn();
    if (saveBusy.current) return;
    saveBusy.current = true;
    const next = !post.is_saved;
    onUpdate(post.id, (p) => ({ ...p, is_saved: next }));
    try {
      await (next ? feedApi.save(post.id) : feedApi.unsave(post.id));
      notify.success(next ? t('saved') : t('unsaved'));
    } catch (err) {
      onUpdate(post.id, (p) => ({ ...p, is_saved: !next }));
      notify.error(err, t('saveFailed'));
    } finally {
      saveBusy.current = false;
    }
  };

  const copyLink = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(postUrl(post.id));
      notify.success(t('linkCopied'));
    } catch {
      notify.error(t('copyFailed'));
    }
  };

  // Phones open the system share sheet (WhatsApp and the rest); elsewhere the link is copied
  const share = async () => {
    const url = postUrl(post.id);
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: t('shareTitle', { name: post.author.name }), url });
      } catch {
        // Closing the share sheet is not an error
      }
      return;
    }
    await copyLink();
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await feedApi.remove(post.id);
      setConfirmDelete(false);
      notify.success(t('deleted'));
      onRemove(post.id);
    } catch (err) {
      notify.error(err, t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const openComments = () => {
    setShowComments(true);
    if (user) setFocusRequest((n) => n + 1);
  };

  const profile = `/profile/${post.author.id}`;
  const roleLabel = post.author.role === 'recruiter' ? t('role.recruiter') : post.author.role === 'expert' ? t('role.expert') : null;
  const menuItem = 'w-full flex items-center gap-3 px-4 py-2.5 text-[15px] text-km-text-primary hover:bg-km-surface cursor-pointer';

  return (
    <article ref={impressionRef} aria-labelledby={`post-${post.id}-author`} className="bg-km-surface-card border border-km-border rounded-2xl shadow-xs">
      <header className="flex items-start gap-3 px-4 sm:px-5 pt-4">
        <Link href={profile} className="w-12 h-12 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0" tabIndex={-1} aria-hidden="true">
          <UserAvatar src={post.author.avatar} name={post.author.name} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 min-w-0">
            <Link id={`post-${post.id}-author`} href={profile} className="truncate text-[15px] font-semibold text-km-heading hover:text-km-link hover:underline">
              {post.author.name}
            </Link>
            {post.author.is_verified && <SealCheckIcon size={16} weight="fill" className="text-km-link shrink-0" aria-label={t('verified')} />}
            {roleLabel && <span className="shrink-0 text-[13px] text-km-text-secondary">· {roleLabel}</span>}
          </p>
          {post.author.headline && <p className="truncate text-[13px] text-km-text-secondary">{post.author.headline}</p>}
          <p className="flex flex-wrap items-center gap-x-1 text-[12px] text-km-text-secondary">
            <Link href={`/feed/${post.id}`} className="hover:underline">
              <time dateTime={post.created_at} title={time.full}>{time.label}</time>
            </Link>
            {post.category !== 'general' && <span>· {t(`category.${post.category}`)}</span>}
            {post.edited_at && <span>· {t('edited')}</span>}
          </p>
        </div>

        <div className="relative -mr-2" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t('postActions')}
            className="p-2 rounded-full text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer"
          >
            <DotsThreeIcon size={22} weight="bold" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-56 py-1.5 rounded-2xl border border-km-border bg-km-surface-card shadow-lg">
              <button type="button" role="menuitem" onClick={toggleSave} className={menuItem}>
                <BookmarkSimpleIcon size={18} weight={post.is_saved ? 'fill' : 'regular'} className="text-km-text-secondary" aria-hidden="true" />
                {post.is_saved ? t('unsave') : t('save')}
              </button>
              <button type="button" role="menuitem" onClick={copyLink} className={menuItem}>
                <LinkSimpleIcon size={18} className="text-km-text-secondary" aria-hidden="true" />
                {t('copyLink')}
              </button>
              {post.is_owner ? (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(post);
                    }}
                    className={menuItem}
                  >
                    <PencilSimpleIcon size={18} className="text-km-text-secondary" aria-hidden="true" />
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmDelete(true);
                    }}
                    className={`${menuItem} text-red-600 dark:text-red-400`}
                  >
                    <TrashIcon size={18} aria-hidden="true" />
                    {t('delete')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    if (!user) return signIn();
                    setReporting(true);
                  }}
                  className={menuItem}
                >
                  <FlagIcon size={18} className="text-km-text-secondary" aria-hidden="true" />
                  {t('report')}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="px-4 sm:px-5 pt-3 pb-3">
        <PostContent text={post.content} expanded={expanded} />
      </div>

      <PostMedia media={post.media} authorName={post.author.name} />

      {/* Only the author gets this number, as on their analytics */}
      {post.impressions !== undefined && (
        <p className="flex items-center gap-1.5 px-4 sm:px-5 pt-3 text-[13px] text-km-text-secondary">
          <ChartBarIcon size={16} aria-hidden="true" />
          {t('impressionsCount', { count: post.impressions, formatted: compactNumber(post.impressions, locale) })}
        </p>
      )}

      {(post.reactions_total > 0 || post.comments_count > 0) && (
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-3 text-[13px] text-km-text-secondary">
          <ReactionSummary post={post} />
          {post.comments_count > 0 && (
            <button type="button" onClick={() => setShowComments((s) => !s)} className="ml-auto hover:text-km-link hover:underline cursor-pointer">
              {t('commentsCount', { count: post.comments_count, formatted: compactNumber(post.comments_count, locale) })}
            </button>
          )}
        </div>
      )}

      <div className="mx-2 sm:mx-3 mt-2 mb-1 pt-1 grid grid-cols-3 gap-1 border-t border-km-border">
        <ReactionButton current={post.user_reaction} onReact={react} className={actionClass} />
        <button type="button" onClick={openComments} aria-expanded={showComments} className={`${actionClass} ${idleText}`}>
          <ChatCircleIcon size={20} aria-hidden="true" />
          <span>{t('comment')}</span>
        </button>
        <button type="button" onClick={share} className={`${actionClass} ${idleText}`}>
          <ShareFatIcon size={20} aria-hidden="true" />
          <span>{t('share')}</span>
        </button>
      </div>

      {/* Everyone sees the newest comment without opening the thread */}
      {!showComments && post.latest_comment && (
        <div className="border-t border-km-border px-4 sm:px-5 py-3 space-y-2">
          <CommentItem
            comment={post.latest_comment}
            isPostAuthor={post.latest_comment.author.id === post.author.id}
            onReply={openComments}
          />
          {(post.comments_count > 1 || post.latest_comment.replies_count > 0) && (
            <button type="button" onClick={() => setShowComments(true)} className="ml-[46px] text-[13px] font-semibold text-km-text-secondary hover:text-km-link cursor-pointer">
              {t('viewAllComments', { count: post.comments_count })}
            </button>
          )}
        </div>
      )}

      {showComments && (
        <PostComments
          post={post}
          focusRequest={focusRequest}
          onSignIn={signIn}
          onCountChange={(d) => onUpdate(post.id, (p) => ({ ...p, comments_count: Math.max(0, p.comments_count + d) }))}
        />
      )}

      <ReportPostDialog postId={post.id} open={reporting} onClose={() => setReporting(false)} onReported={() => onRemove(post.id)} />
      <ConfirmDialog
        open={confirmDelete}
        title={t('deletePostTitle')}
        description={t('deletePostBody')}
        confirmLabel={t('delete')}
        busy={deleting}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </article>
  );
}
