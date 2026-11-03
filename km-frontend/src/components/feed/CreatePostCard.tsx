'use client';

import React from 'react';
import { BriefcaseIcon, GraduationCapIcon, ImageIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import type { PostCategory } from './feedTypes';
import { displayName, useFeedUser } from './feedUtils';

interface CreatePostCardProps {
  onCompose: (opts: { category?: PostCategory; pickPhoto?: boolean }) => void;
  onSignIn: () => void;
}

/** The "start a post" box at the top of the feed; guests get a sign-in prompt instead */
export default function CreatePostCard({ onCompose, onSignIn }: CreatePostCardProps) {
  const t = useTranslations('feed');
  const { user, ready } = useFeedUser();

  if (!ready) return <div className="h-[132px] rounded-2xl border border-km-border bg-km-surface-card animate-shimmer" aria-hidden="true" />;

  if (!user) {
    return (
      <div className="rounded-2xl border border-km-border bg-km-surface-card p-5 shadow-xs">
        <h2 className="text-base font-semibold text-km-heading">{t('guestTitle')}</h2>
        <p className="mt-1 text-sm text-km-text-secondary leading-relaxed">{t('guestBody')}</p>
        <button type="button" onClick={onSignIn} className="btn-primary mt-4 h-11 px-5 text-[15px]">
          {t('signIn')}
        </button>
      </div>
    );
  }

  const quick = 'flex-1 inline-flex items-center justify-center gap-2 h-11 px-2 rounded-xl text-sm font-semibold text-km-text-secondary hover:bg-km-surface hover:text-km-heading transition-colors cursor-pointer';
  return (
    <div className="rounded-2xl border border-km-border bg-km-surface-card px-4 sm:px-5 pt-4 pb-2 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
          <UserAvatar src={user.profile_image || user.avatar} name={displayName(user)} />
        </div>
        <button
          type="button"
          onClick={() => onCompose({})}
          className="flex-1 h-12 px-4 text-left rounded-full border border-km-border bg-km-surface-card text-[15px] text-km-text-secondary hover:bg-km-surface transition-colors cursor-pointer"
        >
          {t('startPost')}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <button type="button" onClick={() => onCompose({ pickPhoto: true })} className={quick}>
          <ImageIcon size={20} className="text-km-link" aria-hidden="true" />
          {t('photo')}
        </button>
        <button type="button" onClick={() => onCompose({ category: 'jobs' })} className={quick}>
          <BriefcaseIcon size={20} className="text-km-jobs" aria-hidden="true" />
          {t('quickJob')}
        </button>
        <button type="button" onClick={() => onCompose({ category: 'skills' })} className={quick}>
          <GraduationCapIcon size={20} className="text-km-skills" aria-hidden="true" />
          {t('quickSkill')}
        </button>
      </div>
    </div>
  );
}
