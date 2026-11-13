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
import type { StoredUser } from '@/lib/auth';

interface PostCommentsProps {
  post: FeedPost;
  /** Goes up each time the member asks to write a comment */
  focusRequest: number;
  /** Opens the reply box of this comment (the preview's Reply); n goes up each time */
  replyRequest?: { commentId: string; n: number };
  onCountChange: (delta: number) => void;
  onSignIn: () => void;
}

/** Grows the comment box with its text up to a limit, then scrolls */
function fitHeight(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
}

/** A post's comments, newest first, each with its replies, and the box to add one */
export default function PostComments({ post, focusRequest, replyRequest, onCountChange, onSignIn }: PostCommentsProps) {
  const t = useTranslations('feed');
  const { user } = useFeedUser();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState<FeedComment | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  // Replies a thread has loaded, so deleting one can update that thread
  const [removedReply, setRemovedReply] = useState<FeedComment | null>(null);
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

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await feedApi.deleteComment(post.id, deleting.id);
      if (deleting.parent_id) {
        const parentId = deleting.parent_id;
        setComments((prev) => prev.map((c) => (c.id === parentId ? { ...c, replies_count: Math.max(0, c.replies_count - 1) } : c)));
        setRemovedReply(deleting);
        onCountChange(-1);
      } else {
        setComments((prev) => prev.filter((c) => c.id !== deleting.id));
        // Its replies go with it
        onCountChange(-(1 + deleting.replies_count));
      }
      setDeleting(null);
    } catch (err) {
      notify.error(err, t('deleteFailed'));
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="border-t border-km-border px-4 sm:px-5 py-4 space-y-4">
      {user ? (
        <CommentForm
          user={user}
          postId={post.id}
          inputRef={inputRef}
          placeholder={t('addComment')}
          submitLabel={t('postComment')}
          failedMessage={t('commentFailed')}
          onPosted={(created) => {
            setComments((prev) => [created, ...prev]);
            onCountChange(1);
          }}
        />
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
            <CommentThread
              key={c.id}
              post={post}
              comment={c}
              user={user}
              replyRequest={replyRequest?.commentId === c.id ? replyRequest.n : 0}
              removedReply={removedReply}
              onDelete={setDeleting}
              onSignIn={onSignIn}
              onReplied={() => {
                setComments((prev) => prev.map((p) => (p.id === c.id ? { ...p, replies_count: p.replies_count + 1 } : p)));
                onCountChange(1);
              }}
            />
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
        description={deleting && !deleting.parent_id && deleting.replies_count > 0 ? t('deleteThreadBody') : t('deleteCommentBody')}
        confirmLabel={t('delete')}
        busy={busyDelete}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

/** The box for a new comment or reply */
function CommentForm({ user, postId, parentId, inputRef, placeholder, submitLabel, failedMessage, focusRequest = 0, prefill, onPosted }: {
  user: StoredUser;
  postId: string;
  parentId?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  placeholder: string;
  submitLabel: string;
  failedMessage: string;
  /** Goes up each time the member presses Reply: focuses the box (no remount, so typed text stays) */
  focusRequest?: number;
  /** Starts an empty box with this text, e.g. "@Name " when replying to a reply */
  prefill?: string;
  onPosted: (comment: FeedComment) => void;
}) {
  const t = useTranslations('feed');
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? ownRef;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const over = text.length > MAX_COMMENT_LENGTH;
  const small = Boolean(parentId);

  useEffect(() => {
    const el = ref.current;
    if (!focusRequest || !el) return;
    if (prefill) {
      setText((current) => (current.trim() ? current : prefill));
    }
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
    // Caret after any prefilled text
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
    // prefill is read only when a new request comes in
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest, ref]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending || over) return;
    setSending(true);
    try {
      const created = await feedApi.addComment(postId, content, parentId);
      onPosted(created);
      setText('');
      if (ref.current) {
        ref.current.style.height = '';
        ref.current.style.overflowY = '';
      }
    } catch (err) {
      notify.error(err, failedMessage);
    } finally {
      setSending(false);
    }
  };

  const id = `comment-${postId}${parentId ? `-${parentId}` : ''}`;

  return (
    <form onSubmit={submit} className="flex items-start gap-2.5">
      <div className={`${small ? 'w-7 h-7' : 'w-9 h-9'} rounded-full overflow-hidden bg-km-surface shrink-0 border border-km-border`}>
        <UserAvatar src={user.profile_image || user.avatar} name={displayName(user)} />
      </div>
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="sr-only">{placeholder}</label>
        <textarea
          id={id}
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            fitHeight(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
          }}
          placeholder={placeholder}
          dir="auto"
          className={`block w-full resize-none overflow-hidden rounded-2xl border border-km-border bg-km-surface-card px-4 ${small ? 'py-2 text-sm' : 'py-2.5 text-[15px]'} text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]`}
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
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

/** A top-level comment and its replies, which load when asked for */
function CommentThread({ user, post, comment, replyRequest, removedReply, onDelete, onSignIn, onReplied }: {
  user: StoredUser | null;
  post: FeedPost;
  comment: FeedComment;
  /** Non-zero and rising when the post's preview asked to reply to this comment */
  replyRequest: number;
  removedReply: FeedComment | null;
  onDelete: (c: FeedComment) => void;
  onSignIn: () => void;
  onReplied: () => void;
}) {
  const t = useTranslations('feed');
  const [replies, setReplies] = useState<FeedComment[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [replying, setReplying] = useState(0);
  const [mention, setMention] = useState('');

  useEffect(() => {
    if (removedReply?.parent_id === comment.id) setReplies((prev) => prev.filter((r) => r.id !== removedReply.id));
  }, [removedReply, comment.id]);

  const loadReplies = async (after?: string) => {
    setLoading(true);
    try {
      const page = await feedApi.replies(post.id, comment.id, after);
      setReplies((prev) => [...prev, ...page.comments.filter((c) => !prev.some((p) => p.id === c.id))]);
      setCursor(page.next_cursor);
      setOpen(true);
    } catch (err) {
      notify.error(err, t('loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Replying to a reply starts with @their name, so it's clear who it answers
  const startReply = (to?: FeedComment) => {
    if (!user) {
      onSignIn();
      return;
    }
    if (!open && comment.replies_count > 0 && replies.length === 0) void loadReplies();
    setOpen(true);
    setMention(to && to.author.id !== (user.id || user._id) ? `@${to.author.name} ` : '');
    setReplying((n) => n + 1);
  };

  const handledRequest = useRef(0);
  useEffect(() => {
    if (!replyRequest || replyRequest === handledRequest.current) return;
    handledRequest.current = replyRequest;
    startReply();
    // startReply reads the latest state on each render; the request number is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replyRequest]);

  // Replies posted here this session that the loaded pages don't include yet
  const hidden = Math.max(0, comment.replies_count - replies.length);

  return (
    <li>
      <CommentItem comment={comment} isPostAuthor={comment.author.id === post.author.id} onDelete={() => onDelete(comment)} onReply={() => startReply()} />
      {(comment.replies_count > 0 || replying > 0) && (
        <div className="ml-[46px] mt-2 space-y-3">
          {!open && comment.replies_count > 0 && (
            <ToggleButton busy={loading} onClick={() => void loadReplies()}>
              {t('viewReplies', { count: comment.replies_count })}
            </ToggleButton>
          )}
          {open && (
            <>
              {replies.length > 0 && (
                <ul className="space-y-3">
                  {replies.map((r) => (
                    <li key={r.id}>
                      <CommentItem small comment={r} isPostAuthor={r.author.id === post.author.id} onDelete={() => onDelete(r)} onReply={() => startReply(r)} />
                    </li>
                  ))}
                </ul>
              )}
              {cursor && hidden > 0 && (
                <ToggleButton busy={loading} onClick={() => void loadReplies(cursor)}>{t('moreReplies')}</ToggleButton>
              )}
              {replying > 0 && user && (
                <CommentForm
                  user={user}
                  postId={post.id}
                  parentId={comment.id}
                  focusRequest={replying}
                  prefill={mention}
                  placeholder={t('addReply')}
                  submitLabel={t('postReply')}
                  failedMessage={t('replyFailed')}
                  onPosted={(created) => {
                    setReplies((prev) => [...prev, created]);
                    onReplied();
                  }}
                />
              )}
              {replies.length > 0 && (
                <ToggleButton onClick={() => setOpen(false)}>{t('hideReplies')}</ToggleButton>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

function ToggleButton({ busy, onClick, children }: { busy?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-2 text-[13px] font-semibold text-km-text-secondary hover:text-km-link cursor-pointer disabled:opacity-60"
    >
      {busy && <SpinnerGapIcon size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** One comment or reply. Also shown under a post in the feed as its newest comment. */
export function CommentItem({ comment, isPostAuthor, small = false, onDelete, onReply }: {
  comment: FeedComment;
  isPostAuthor: boolean;
  small?: boolean;
  onDelete?: () => void;
  onReply?: () => void;
}) {
  const t = useTranslations('feed');
  const time = useRelativeTime(comment.created_at);
  const profile = `/profile/${comment.author.id}`;
  return (
    <div className="flex items-start gap-2.5">
      <Link href={profile} className={`${small ? 'w-7 h-7' : 'w-9 h-9'} rounded-full overflow-hidden bg-km-surface shrink-0 border border-km-border`} tabIndex={-1} aria-hidden="true">
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
        {(onReply || (onDelete && comment.can_delete)) && (
          <div className="mt-1 ml-3 flex items-center gap-4">
            {onReply && (
              <button type="button" onClick={onReply} className="text-[13px] font-semibold text-km-text-secondary hover:text-km-link cursor-pointer">
                {t('reply')}
              </button>
            )}
            {onDelete && comment.can_delete && (
              <button type="button" onClick={onDelete} className="text-[13px] font-semibold text-km-text-secondary hover:text-red-600 cursor-pointer">
                {t('delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
