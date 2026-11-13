'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ConfettiIcon, HandHeartIcon, LightbulbIcon, ThumbsUpIcon, type Icon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { REACTIONS, type FeedPost, type ReactionType } from './feedTypes';
import { compactNumber } from './feedUtils';

export const REACTION_STYLE: Record<ReactionType, { Icon: Icon; color: string }> = {
  like: { Icon: ThumbsUpIcon, color: 'text-km-link' },
  celebrate: { Icon: ConfettiIcon, color: 'text-emerald-600 dark:text-emerald-400' },
  support: { Icon: HandHeartIcon, color: 'text-rose-600 dark:text-rose-400' },
  insightful: { Icon: LightbulbIcon, color: 'text-amber-600 dark:text-amber-400' },
};

/** The post with the member's reaction changed, counts adjusted the way the server will */
export function withReaction(p: FeedPost, next?: ReactionType): FeedPost {
  const counts = { ...p.reaction_counts };
  let total = p.reactions_total;
  if (p.user_reaction) {
    counts[p.user_reaction] = Math.max(0, (counts[p.user_reaction] ?? 0) - 1);
    total -= 1;
  }
  if (next) {
    counts[next] = (counts[next] ?? 0) + 1;
    total += 1;
  }
  return { ...p, reaction_counts: counts, reactions_total: Math.max(0, total), user_reaction: next };
}

/** Up to three reaction icons, most used first, and the total */
export function ReactionSummary({ post, onOpen }: { post: FeedPost; onOpen?: () => void }) {
  const t = useTranslations('feed');
  const locale = useLocale();
  if (post.reactions_total <= 0) return null;
  const top = REACTIONS.filter((r) => (post.reaction_counts[r] ?? 0) > 0)
    .sort((a, b) => (post.reaction_counts[b] ?? 0) - (post.reaction_counts[a] ?? 0))
    .slice(0, 3);
  const Tag = onOpen ? 'button' : 'span';
  return (
    <Tag
      {...(onOpen ? { type: 'button' as const, onClick: onOpen } : {})}
      className={`inline-flex items-center gap-1.5 ${onOpen ? 'relative hit-44 min-h-6 hover:text-km-link hover:underline cursor-pointer' : ''}`}
      aria-label={t(onOpen ? 'seeReactions' : 'reactionsCount', { count: post.reactions_total })}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {top.map((r) => {
          const { Icon, color } = REACTION_STYLE[r];
          return <Icon key={r} size={16} weight="fill" className={color} />;
        })}
      </span>
      <span className="tabular-nums" aria-hidden="true">{compactNumber(post.reactions_total, locale)}</span>
    </Tag>
  );
}

const HOLD_MS = 450;

/**
 * Like button. A tap likes, or takes back whatever reaction is there. Holding it (touch), hovering
 * (mouse) or pressing the Up arrow opens the other reactions.
 */
export function ReactionButton({ current, onReact, className }: { current?: ReactionType; onReact: (r?: ReactionType) => void; className: string }) {
  const t = useTranslations('feed');
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const later = (fn: () => void, ms: number) => {
    clear();
    timer.current = window.setTimeout(fn, ms);
  };
  useEffect(() => clear, []);

  // A tap outside closes the picker on touch screens
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!pickerRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (r?: ReactionType) => {
    clear();
    setOpen(false);
    onReact(r);
  };

  const style = current ? REACTION_STYLE[current] : null;
  const CurrentIcon = style?.Icon ?? ThumbsUpIcon;

  return (
    <div
      className="relative flex-1 flex"
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') later(() => setOpen(true), HOLD_MS);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') later(() => setOpen(false), 300);
      }}
    >
      {open && (
        <div
          ref={pickerRef}
          role="toolbar"
          aria-label={t('reactions')}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              buttonRef.current?.focus();
            }
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              const items = Array.from(pickerRef.current?.querySelectorAll('button') ?? []);
              const i = items.indexOf(document.activeElement as HTMLButtonElement);
              items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length]?.focus();
            }
          }}
          className="km-sheet-in absolute bottom-full left-0 mb-2 z-30 flex items-center gap-1 rounded-full border border-km-border bg-km-surface-card px-2 py-1.5 shadow-lg"
        >
          {REACTIONS.map((r) => {
            const { Icon, color } = REACTION_STYLE[r];
            return (
              <button
                key={r}
                type="button"
                onClick={() => pick(r === current ? undefined : r)}
                aria-label={t(`reaction.${r}`)}
                aria-pressed={r === current}
                title={t(`reaction.${r}`)}
                className={`p-2 rounded-full hover:bg-km-surface transition-transform hover:-translate-y-0.5 cursor-pointer ${color} ${r === current ? 'bg-km-surface' : ''}`}
              >
                <Icon size={26} weight="fill" />
              </button>
            );
          })}
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={Boolean(current)}
        aria-haspopup="true"
        aria-expanded={open}
        onPointerDown={(e) => {
          if (e.pointerType !== 'touch') return;
          held.current = false;
          later(() => {
            held.current = true;
            setOpen(true);
            navigator.vibrate?.(10);
          }, HOLD_MS);
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch' && !held.current) clear();
        }}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          // The release after a long press opened the picker; it isn't a tap
          if (held.current) {
            held.current = false;
            return;
          }
          pick(current ? undefined : 'like');
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => pickerRef.current?.querySelector('button')?.focus());
          }
        }}
        className={`${className} select-none [-webkit-touch-callout:none] ${style ? style.color : 'text-km-text-secondary hover:text-km-heading'}`}
      >
        <CurrentIcon size={20} weight={current ? 'fill' : 'regular'} aria-hidden="true" />
        <span>{current ? t(`reaction.${current}`) : t('reaction.like')}</span>
      </button>
    </div>
  );
}
