'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, MedalIcon } from '@phosphor-icons/react';

export const FeedRightSidebar: React.FC = () => {
  return (
    <aside className="w-full space-y-4">
      {/* 1. Rectangle Brand Promotion Banner (From /network) */}
      <div className="bg-[#071A4D] border border-slate-700/60 rounded-2xl p-5 text-white shadow-xs dark:bg-km-primary">
        <div className="flex items-center gap-2 mb-3">
          <MedalIcon size={16} weight="bold" className="text-amber-300" aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Expert Network
          </span>
        </div>

        <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">
          Become a Verified Mentor
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          Guide ambitious candidates, host 1-on-1 career sessions, and monetize your verified professional experience.
        </p>

        <Link
          href="/mentorship"
          className="inline-flex items-center gap-1.5 bg-[#FF6B00] hover:bg-[#E05E00] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
        >
          <span>Join as Expert</span>
          <ArrowRightIcon weight="bold" size={13} />
        </Link>
      </div>

      {/* 2. Blank Ad Banner Section (Matches /network & user reference) */}
      <div className="w-full bg-km-surface-card rounded-2xl h-64 flex items-center justify-center border border-dashed border-gray-300 text-slate-400 font-medium text-sm shadow-2xs dark:border-slate-700 dark:text-slate-500">
        Ad Banner
      </div>
    </aside>
  );
};

export default FeedRightSidebar;
