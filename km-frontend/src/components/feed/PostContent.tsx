'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

// A link, or a hashtag in any script (Hindi, Bengali...) — matches the server's tag rule
const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(#[\p{L}\p{M}\p{N}_]+)/gu;

function renderText(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    if (m[1]) {
      out.push(
        <a key={i} href={m[1]} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-km-link font-medium hover:underline break-all">
          {m[1].replace(/^https?:\/\//, '')}
        </a>,
      );
    } else {
      const tag = m[2].slice(1).toLowerCase();
      out.push(
        <Link key={i} href={`/feed?tag=${encodeURIComponent(tag)}`} className="text-km-link font-medium hover:underline">
          {m[2]}
        </Link>,
      );
    }
    last = i + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Post text with live links and hashtags; long posts fold after six lines */
export default function PostContent({ text, expanded: startExpanded = false }: { text: string; expanded?: boolean }) {
  const t = useTranslations('feed');
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(startExpanded);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  if (!text) return null;
  return (
    <div>
      <p
        ref={ref}
        dir="auto"
        className={`text-[15px] leading-relaxed text-km-text-primary whitespace-pre-line break-words ${expanded ? '' : 'line-clamp-6'}`}
      >
        {renderText(text)}
      </p>
      {!expanded && overflows && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-sm font-semibold text-km-text-secondary hover:text-km-link hover:underline cursor-pointer"
        >
          {t('seeMore')}
        </button>
      )}
    </div>
  );
}
