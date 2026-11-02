'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SealCheckIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import { feedApi } from '@/lib/api/feed';
import { notify } from '@/lib/notify';
import { ConfirmDialog } from './FeedDialog';
import PostContent from './PostContent';
import { MAX_COMMENT_LENGTH, type FeedComment, type FeedPost } from './feedTypes';
import { displayName, useFeedUser, useRelativeTime } from './feedUtils';

interface PostCommentsProps {
  post: FeedPost;
  /** Goes up each time the member asks to write a comment */
  focusRequest: number;
  onCountChange: (delta: number) => void;
  onSignIn: () => void;
}

/** Grows the comment box with its text up to a limit, then scrolls */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
}

/** A post's comments, newest first, with the box to add one */
export default function PostComments({ post, focusRequest, onCountChange, onSignIn }: PostCommentsProps) {
  const t = useTranslations('feed');
  const { user } = useFeedUser();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<FeedComment | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const page = await feedApi.comments(post.id);
      setComments(page.comments);
      setCursor(page.next_cursor);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [post.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // The box only exists once the session is read, so a request made before then waits for it
  const handledFocus = useRef(0);
  useEffect(() => {
    if (!user || focusRequest === handledFocus.current) return;
    handledFocus.current = focusRequest;
    inputRef.current?.focus();
  }, [focusRequest, user]);

  const loadOlder = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await feedApi.comments(post.id, cursor);
      setComments((prev) => [...prev, ...page.comments.filter((c) => !prev.some((p) => p.id === c.id))]);
      setCursor(page.next_cursor);
    } catch (err) {
      notify.error(err, t('loadFailed'));
    } finally {
      setLoadingMore(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const created = await feedApi.addComment(post.id, content);
      setComments((prev) => [created, ...prev]);
      setText('');
      if (inputRef.current) {
        inputRef.current.style.height = '';
        inputRef.current.style.overflowY = '';
      }
      onCountChange(1);
    } catch (err) {
      notify.error(err, t('commentFailed'));
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await feedApi.deleteComment(post.id, deleting.id);
      setComments((prev) => prev.filter((c) => c.id !== deleting.id));
      onCountChange(-1);
      setDeleting(null);
    } catch (err) {
      notify.error(err, t('deleteFailed'));
    } finally {
      setBusyDelete(false);
    }
  };

  const over = text.length > MAX_COMMENT_LENGTH;

  return (
    <div className="border-t border-km-border px-4 sm:px-5 py-4 space-y-4">
      {user ? (
        <form onSubmit={submit} className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-km-surface shrink-0 border border-km-border">
            <UserAvatar src={user.profile_image || user.avatar} name={displayName(user)} />
          </div>
          <div className="flex-1 min-w-0">
            <label htmlFor={`comment-${post.id}`} className="sr-only">{t('addComment')}</label>
            <textarea
              id={`comment-${post.id}`}
              ref={inputRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                fitHeight(e.target);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
              }}
              placeholder={t('addComment')}
              dir="auto"
              className="block w-full resize-none overflow-hidden rounded-2xl border border-km-border bg-km-surface-card px-4 py-2.5 text-[15px] text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]"
            />
            {(text.trim() || sending) && (
              <div className="mt-2 flex items-center justify-end gap-3">
                {text.length > MAX_COMMENT_LENGTH - 200 && (
                  <span className={`text-[13px] tabular-nums ${over ? 'text-red-600 dark:text-red-400' : 'text-km-text-secondary'}`}>
                    {over ? t('charactersOver', { count: -(MAX_COMMENT_LENGTH - text.length) }) : t('charactersLeft', { count: MAX_COMMENT_LENGTH - text.length })}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={sending || over}
                  className="btn-primary h-9 px-4 text-sm inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sending && <SpinnerGapIcon size={14} className="animate-spin" aria-hidden="true" />}
                  {t('postComment')}
                </button>
              </div>
            )}
          </div>
        </form>
      ) : (
        <button type="button" onClick={onSignIn} className="text-sm font-semibold text-km-link hover:underline cursor-pointer">
          {t('signInToComment')}
        </button>
      )}

      {status === 'loading' && (
        <div className="flex justify-center py-2" role="status" aria-label={t('loading')}>
          <SpinnerGapIcon size={20} className="animate-spin text-km-text-secondary" />
        </div>
      )}
      {status === 'error' && (
        <p className="text-sm text-km-text-secondary">
          {t('commentsFailed')}{' '}
          <button type="button" onClick={() => void load()} className="font-semibold text-km-link hover:underline cursor-pointer">
            {t('retry')}
          </button>
        </p>
      )}

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} isPostAuthor={c.author.id === post.author.id} onDelete={() => setDeleting(c)} />
          ))}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          onClick={loadOlder}
          disabled={loadingMore}
          className="inline-flex items-center gap-2 text-sm font-semibold text-km-text-secondary hover:text-km-link cursor-pointer disabled:opacity-60"
        >
          {loadingMore && <SpinnerGapIcon size={14} className="animate-spin" aria-hidden="true" />}
          {t('olderComments')}
        </button>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteCommentTitle')}
        description={t('deleteCommentBody')}
        confirmLabel={t('delete')}
        busy={busyDelete}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function CommentItem({ comment, isPostAuthor, onDelete }: { comment: FeedComment; isPostAuthor: boolean; onDelete: () => void }) {
  const t = useTranslations('feed');
  const time = useRelativeTime(comment.created_at);
  const profile = `/profile/${comment.author.id}`;
  return (
    <li className="flex items-start gap-2.5">
      <Link href={profile} className="w-9 h-9 rounded-full overflow-hidden bg-km-surface shrink-0 border border-km-border" tabIndex={-1} aria-hidden="true">
        <UserAvatar src={comment.author.avatar} name={comment.author.name} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-km-surface px-3.5 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-semibold text-km-heading">
                <Link href={profile} className="truncate hover:text-km-link hover:underline">{comment.author.name}</Link>
                {comment.author.is_verified && <SealCheckIcon size={15} weight="fill" className="text-km-link shrink-0" aria-label={t('verified')} />}
                {isPostAuthor && <span className="shrink-0 text-[12px] font-medium text-km-text-secondary">· {t('author')}</span>}
              </p>
              {comment.author.headline && <p className="truncate text-[13px] text-km-text-secondary">{comment.author.headline}</p>}
            </div>
            <time dateTime={comment.created_at} title={time.full} className="shrink-0 text-[12px] text-km-text-secondary">
              {time.label}
            </time>
          </div>
          <div className="mt-1.5 [&_p]:text-sm">
            <PostContent text={comment.content} />
          </div>
        </div>
        {comment.can_delete && (
          <button type="button" onClick={onDelete} className="mt-1 ml-3 text-[13px] font-semibold text-km-text-secondary hover:text-red-600 cursor-pointer">
            {t('delete')}
          </button>
        )}
      </div>
    </li>
  );
}
