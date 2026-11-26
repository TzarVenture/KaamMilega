'use client';

import React, { useEffect, useState } from 'react';
import { PlusIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { displayName, useFeedUser } from '@/components/feed/feedUtils';
import UserAvatar from '@/components/ui/UserAvatar';
import { storiesApi, type Story, type StoryGroup } from '@/lib/api/stories';
import StoryComposer from './StoryComposer';
import StoryViewer from './StoryViewer';

/**
 * The row of stories at the top of the feed: "Your story" first (add one, or open yours), then
 * the people you are connected to and the companies you follow. A coloured ring means something
 * not yet seen. Shown only to signed-in members, and only once something can be shown.
 */
export default function StoryBar() {
  const t = useTranslations('stories');
  const { user } = useFeedUser();
  const [groups, setGroups] = useState<StoryGroup[] | null>(null);
  const [open, setOpen] = useState<{ groups: StoryGroup[]; start: number } | null>(null);
  const [composing, setComposing] = useState(false);

  const signedIn = Boolean(user);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    storiesApi
      .bar()
      .then((gs) => live && setGroups(gs))
      // The feed works without stories; the row just shows "Your story"
      .catch(() => live && setGroups([]));
    return () => {
      live = false;
    };
  }, [signedIn]);

  const markSeen = (storyId: string) => {
    const mark = (gs: StoryGroup[]) =>
      gs.map((g) => {
        if (!g.stories.some((s) => s.id === storyId)) return g;
        const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
        return { ...g, stories, all_seen: stories.every((s) => s.seen) };
      });
    setGroups((gs) => (gs ? mark(gs) : gs));
    setOpen((o) => (o ? { ...o, groups: mark(o.groups) } : o));
  };

  const removeStory = (storyId: string) => {
    const drop = (gs: StoryGroup[]) =>
      gs.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) })).filter((g) => g.stories.length > 0);
    setGroups((gs) => (gs ? drop(gs) : gs));
    // The open viewer keeps an emptied group in place, so its position stays right until it closes
    setOpen((o) => (o ? { ...o, groups: o.groups.map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== storyId) })) } : o));
  };

  const onShared = (story: Story) => {
    setComposing(false);
    setGroups((gs) => {
      const list = gs ?? [];
      const own = list.find((g) => g.is_own);
      if (own) return list.map((g) => (g.is_own ? { ...g, stories: [...g.stories, story] } : g));
      const owner = {
        id: String(user?.id || user?._id || ''),
        name: displayName(user),
        avatar: user?.profile_image || user?.avatar,
        is_verified: false,
        role: 'user' as const,
      };
      return [{ owner, stories: [story], all_seen: true, is_own: true }, ...list];
    });
  };

  if (!user || groups === null) return null;
  const own = groups.find((g) => g.is_own);
  const others = groups.filter((g) => !g.is_own);
  const openGroup = (g: StoryGroup) => {
    const list = own ? [own, ...others] : others;
    setOpen({ groups: list, start: list.indexOf(g) });
  };

  const ring = (seen: boolean) =>
    seen ? 'p-[2px] bg-km-border' : 'p-[2.5px] bg-gradient-to-tr from-[#F59E0B] via-[#EC4899] to-[#0B5ED7]';
  const tile = 'flex w-[72px] shrink-0 flex-col items-center gap-1.5 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#DCE8FB] dark:focus-visible:ring-[#16294F]';

  return (
    <section aria-label={t('title')} className="rounded-2xl border border-km-border bg-km-surface-card px-3 py-3 shadow-xs">
      <ul className="flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li className="relative">
          <button type="button" onClick={() => (own ? openGroup(own) : setComposing(true))} className={tile} aria-label={own ? t('openYours') : t('addStory')}>
            <span className={`block rounded-full ${own ? ring(own.all_seen) : 'p-[2px]'}`}>
              <span className="block w-16 h-16 rounded-full overflow-hidden border-2 border-km-surface-card bg-km-surface">
                <UserAvatar src={user.profile_image || user.avatar} name={displayName(user)} />
              </span>
            </span>
            <span className="w-full truncate text-center text-xs font-medium text-km-text-primary">{t('yourStory')}</span>
          </button>
          {/* Adding another while yours are up */}
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-label={t('addStory')}
            className="absolute left-[46px] top-[46px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-km-surface-card bg-km-link text-white cursor-pointer"
          >
            <PlusIcon size={13} weight="bold" />
          </button>
        </li>
        {others.map((g) => (
          <li key={g.owner.id}>
            <button type="button" onClick={() => openGroup(g)} className={tile} aria-label={g.all_seen ? t('openSeen', { name: g.owner.name }) : t('openNew', { name: g.owner.name })}>
              <span className={`block rounded-full ${ring(g.all_seen)}`}>
                <span className="block w-16 h-16 rounded-full overflow-hidden border-2 border-km-surface-card bg-km-surface">
                  <UserAvatar src={g.owner.avatar} name={g.owner.name} />
                </span>
              </span>
              <span className={`w-full truncate text-center text-xs ${g.all_seen ? 'text-km-text-secondary' : 'font-semibold text-km-heading'}`}>{g.owner.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {others.length === 0 && !own && <p className="sr-only">{t('empty')}</p>}

      {open && (
        <StoryViewer
          groups={open.groups}
          start={open.start}
          onClose={() => setOpen(null)}
          onSeen={markSeen}
          onDeleted={removeStory}
        />
      )}
      {composing && <StoryComposer onClose={() => setComposing(false)} onShared={onShared} />}
    </section>
  );
}
