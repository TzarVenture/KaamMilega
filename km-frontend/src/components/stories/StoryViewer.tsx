'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CaretLeftIcon,
  CaretRightIcon,
  DotsThreeIcon,
  EyeIcon,
  FlagIcon,
  PaperPlaneRightIcon,
  PauseIcon,
  PlayIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import FeedDialog, { ConfirmDialog } from '@/components/feed/FeedDialog';
import ReportPostDialog from '@/components/feed/ReportPostDialog';
import { relativeTime, useScrollLock } from '@/components/feed/feedUtils';
import UserAvatar from '@/components/ui/UserAvatar';
import { storiesApi, type StoryGroup, type StoryViewer as Viewer } from '@/lib/api/stories';
import { notify } from '@/lib/notify';

/** How long a photo story stays up */
const PHOTO_MS = 5000;
const MAX_REPLY = 1000;

interface Props {
  groups: StoryGroup[];
  /** The group opened from the bar */
  start: number;
  onClose: () => void;
  /** A story was opened, so its ring can turn grey */
  onSeen: (storyId: string) => void;
  /** The owner deleted one of their stories */
  onDeleted: (storyId: string) => void;
}

/** The first story in a group the viewer hasn't opened, else its first */
const firstUnseen = (g: StoryGroup) => Math.max(0, g.stories.findIndex((s) => !s.seen));

/**
 * Full-screen stories: one group (member) at a time, their stories in order. Tap the right side
 * (or →) for the next, the left (or ←) for the previous; press and hold (or space) to pause.
 */
export default function StoryViewer({ groups, start, onClose, onSeen, onDeleted }: Props) {
  const t = useTranslations('stories');
  const tf = useTranslations('feed');
  const locale = useLocale();
  const [pos, setPos] = useState(() => ({ g: start, i: firstUnseen(groups[start]) }));
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<null | 'viewers' | 'delete' | 'report'>(null);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const elapsed = useRef(0);
  const pressStart = useRef(0);
  // A tap that only put the keyboard away doesn't also move on
  const tapClosedKeyboard = useRef(false);
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useScrollLock(true);

  // The phone's back button closes the viewer instead of leaving the feed
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    window.history.pushState({ ...window.history.state, kmStory: true }, '');
    const onPop = () => onCloseRef.current();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  // Closing happens once, however many things ask for it (the back step lands a moment later)
  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (window.history.state?.kmStory) window.history.back();
    else onCloseRef.current();
  }, []);

  const group = groups[pos.g];
  const story = group?.stories[pos.i];
  const paused = held || userPaused || menu || dialog !== null || replying || sending;

  const next = useCallback(() => {
    const p = posRef.current;
    if (p.i + 1 < (groups[p.g]?.stories.length ?? 0)) setPos({ g: p.g, i: p.i + 1 });
    else if (p.g + 1 < groups.length) setPos({ g: p.g + 1, i: firstUnseen(groups[p.g + 1]) });
    else close();
  }, [groups, close]);

  const prev = useCallback(() => {
    const p = posRef.current;
    if (p.i > 0) setPos({ g: p.g, i: p.i - 1 });
    else if (p.g > 0) setPos({ g: p.g - 1, i: 0 });
    else {
      // Back on the very first story: it starts again
      elapsed.current = 0;
      setProgress(0);
      if (videoRef.current) videoRef.current.currentTime = 0;
    }
  }, []);

  // The story shown was deleted: show the one now in its place, or close if none is left
  useEffect(() => {
    if (story) return;
    const len = group?.stories.length ?? 0;
    if (len > 0) setPos({ g: pos.g, i: len - 1 });
    else close();
  }, [story, group, pos.g, close]);

  // Each new story: start from zero, and count the view
  useEffect(() => {
    if (!story) return;
    elapsed.current = 0;
    setProgress(0);
    setMenu(false);
    setViewers(null);
    // A reply typed for one person never goes to the next
    setReply('');
    if (!story.seen) {
      onSeen(story.id);
      if (!group.is_own) storiesApi.view(story.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per story
  }, [story?.id]);

  // Photos run on a timer that stops while paused
  useEffect(() => {
    if (!story || story.media.type !== 'image' || paused) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      elapsed.current += now - last;
      last = now;
      const f = Math.min(1, elapsed.current / PHOTO_MS);
      setProgress(f);
      if (f >= 1) next();
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [story, paused, next]);

  // Videos follow their own playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v || story?.media.type !== 'video') return;
    if (paused) {
      v.pause();
      return;
    }
    v.play().catch(() => {
      // The browser wants it muted to start on its own
      setMuted(true);
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [story, paused]);

  // Keyboard: arrows move, space pauses, Escape closes (unless a dialog is open on top)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (dialog || replying) return;
      if (e.key === 'Escape') {
        if (menu) setMenu(false);
        else close();
      }
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        setUserPaused((p) => !p);
      } else return;
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog, replying, menu, next, prev, close]);

  if (!group || !story) return null;
  const when = relativeTime(story.created_at, locale);

  // Press and hold pauses; a short tap on the left third goes back, elsewhere forward
  const onPointerDown = () => {
    pressStart.current = Date.now();
    tapClosedKeyboard.current = replying || menu;
    setMenu(false);
    setHeld(true);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setHeld(false);
    if (tapClosedKeyboard.current || Date.now() - pressStart.current > 250) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width / 3) prev();
    else next();
  };

  const openViewers = async () => {
    setDialog('viewers');
    try {
      setViewers(await storiesApi.viewers(story.id));
    } catch (err) {
      notify.error(err, t('viewersFailed'));
      setViewers([]);
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await storiesApi.remove(story.id);
      notify.success(t('deleted'));
      setDialog(null);
      // The last one of the group: nothing left to show
      if (group.stories.length === 1) close();
      onDeleted(story.id);
    } catch (err) {
      notify.error(err, t('deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await storiesApi.reply(group.owner.id, story.id, text);
      setReply('');
      notify.success(t('replySent'), t('replySentHint'));
      (document.activeElement as HTMLElement | null)?.blur();
    } catch (err) {
      // The usual chat rules apply: a free user's daily limit, a Chat Pass for non-recruiters
      notify.error(err, t('replyFailed'));
    } finally {
      setSending(false);
    }
  };

  const iconButton = 'p-2 rounded-full text-white hover:bg-white/15 cursor-pointer';
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black" role="dialog" aria-modal="true" aria-label={t('viewerLabel', { name: group.owner.name })}>
      {/* Desktop arrows beside the story */}
      <button type="button" onClick={prev} aria-label={t('previous')} className="hidden sm:flex absolute left-4 lg:left-[calc(50%-260px)] p-2 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer">
        <CaretLeftIcon size={22} />
      </button>
      <button type="button" onClick={next} aria-label={t('next')} className="hidden sm:flex absolute right-4 lg:right-[calc(50%-260px)] p-2 rounded-full bg-white/15 text-white hover:bg-white/25 cursor-pointer">
        <CaretRightIcon size={22} />
      </button>

      <div className="relative h-full w-full sm:h-[min(92dvh,820px)] sm:w-auto sm:aspect-[9/16] sm:rounded-2xl overflow-hidden bg-neutral-900">
        {/* The story itself; taps and holds land here */}
        <div className="absolute inset-0 select-none touch-manipulation [-webkit-touch-callout:none]" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={() => setHeld(false)} onContextMenu={(e) => e.preventDefault()}>
          {story.media.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element -- CDN image at its own size
            <img key={story.id} src={story.media.url} alt={story.caption || t('photoBy', { name: group.owner.name })} className="h-full w-full object-contain" draggable={false} />
          ) : (
            <video
              key={story.id}
              ref={videoRef}
              src={story.media.url}
              poster={story.media.poster_url}
              muted={muted}
              playsInline
              preload="auto"
              className="h-full w-full object-contain"
              aria-label={story.caption || t('videoBy', { name: group.owner.name })}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration) setProgress(Math.min(1, v.currentTime / v.duration));
              }}
              onEnded={next}
              // A video that can't play (gone, or a format this browser can't show) is skipped
              onError={next}
            />
          )}
        </div>

        {/* Top: progress, who and when, controls */}
        <div className="absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex gap-1" aria-hidden="true">
            {group.stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 rounded-full bg-white/35 overflow-hidden">
                <span className="block h-full bg-white" style={{ width: `${i < pos.i ? 100 : i > pos.i ? 0 : progress * 100}%` }} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-700 shrink-0">
              <UserAvatar src={group.owner.avatar} name={group.owner.name} />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="truncate text-sm font-semibold">{group.is_own ? t('yourStory') : group.owner.name}</p>
              <p className="text-xs text-white/75" title={when.full}>{when.label}</p>
            </div>
            <button type="button" onClick={() => setUserPaused((p) => !p)} aria-label={userPaused ? t('play') : t('pause')} className={iconButton}>
              {userPaused ? <PlayIcon size={20} weight="fill" /> : <PauseIcon size={20} weight="fill" />}
            </button>
            {story.media.type === 'video' && (
              <button type="button" onClick={() => setMuted((m) => !m)} aria-label={muted ? t('unmute') : t('mute')} className={iconButton}>
                {muted ? <SpeakerSlashIcon size={20} /> : <SpeakerHighIcon size={20} />}
              </button>
            )}
            <div className="relative">
              <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t('more')} aria-expanded={menu} className={iconButton}>
                <DotsThreeIcon size={22} weight="bold" />
              </button>
              {menu && (
                <div className="absolute right-0 mt-1 w-48 rounded-xl border border-km-border bg-km-surface-card py-1 shadow-xl z-10">
                  {group.is_own ? (
                    <button type="button" onClick={() => { setMenu(false); setDialog('delete'); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-km-surface cursor-pointer">
                      <TrashIcon size={18} aria-hidden="true" />
                      {t('delete')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setMenu(false); setDialog('report'); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-km-text-primary hover:bg-km-surface cursor-pointer">
                      <FlagIcon size={18} aria-hidden="true" />
                      {t('report')}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button type="button" onClick={close} aria-label={tf('close')} className={iconButton}>
              <XIcon size={22} />
            </button>
          </div>
        </div>

        {/* Bottom: caption, then the reply box (or the owner's view count) */}
        <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/75 to-transparent space-y-3">
          {story.caption && <p className="px-1 text-[15px] leading-snug text-white break-words">{story.caption}</p>}
          {group.is_own ? (
            <button type="button" onClick={() => void openViewers()} className="inline-flex items-center gap-2 h-10 px-3 rounded-full text-sm font-semibold text-white hover:bg-white/15 cursor-pointer">
              <EyeIcon size={18} aria-hidden="true" />
              {t('views', { count: story.views ?? 0 })}
            </button>
          ) : (
            <form onSubmit={sendReply} className="flex items-center gap-2">
              <label htmlFor="story-reply" className="sr-only">{t('replyLabel', { name: group.owner.name })}</label>
              <input
                id="story-reply"
                type="text"
                maxLength={MAX_REPLY}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setReplying(true)}
                onBlur={() => setReplying(false)}
                onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
                placeholder={t('replyPlaceholder', { name: group.owner.name })}
                className="h-11 flex-1 min-w-0 rounded-full border border-white/50 bg-black/30 px-4 text-base text-white placeholder:text-white/70 outline-none focus:border-white"
              />
              <button type="submit" disabled={!reply.trim() || sending} aria-label={t('sendReply')} className="p-2.5 rounded-full text-white hover:bg-white/15 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                <PaperPlaneRightIcon size={22} weight="fill" />
              </button>
            </form>
          )}
        </div>
      </div>

      <FeedDialog open={dialog === 'viewers'} onClose={() => setDialog(null)} title={t('viewersTitle')} description={t('viewersHint')}>
        {viewers === null ? (
          <p role="status" className="px-6 py-6 text-sm text-km-text-secondary">{tf('loading')}</p>
        ) : viewers.length === 0 ? (
          <p className="px-6 py-6 text-sm text-km-text-secondary">{t('noViewers')}</p>
        ) : (
          <ul className="py-2">
            {viewers.map((v) => (
              <li key={v.viewer.id} className="flex items-center gap-3 px-5 sm:px-6 py-2.5">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
                  <UserAvatar src={v.viewer.avatar} name={v.viewer.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-km-heading">{v.viewer.name}</p>
                  {v.viewer.headline && <p className="truncate text-[13px] text-km-text-secondary">{v.viewer.headline}</p>}
                </div>
                <span className="text-[13px] text-km-text-secondary shrink-0">{relativeTime(v.viewed_at, locale).label}</span>
              </li>
            ))}
          </ul>
        )}
      </FeedDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        title={t('deleteTitle')}
        description={t('deleteBody')}
        confirmLabel={t('delete')}
        busy={deleting}
        onConfirm={() => void remove()}
        onClose={() => setDialog(null)}
      />

      <ReportPostDialog
        postId={story.id}
        open={dialog === 'report'}
        onClose={() => setDialog(null)}
        onReported={next}
        send={(reason, details) => storiesApi.report(story.id, reason, details)}
        title={t('reportTitle')}
        description={tf('reportSubtitle')}
        doneHint={t('reportedHint')}
      />
    </div>
  );
}
