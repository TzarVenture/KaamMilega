"use client";

import { useState } from "react";
import { FilmStripIcon } from "@phosphor-icons/react";

/** The story a chat message replies to, as the server copied it */
export interface StoryQuoteData {
  id: string;
  owner_id: string;
  media_type: "image" | "video";
  thumb_url?: string;
  caption?: string;
  expires_at: string;
}

interface Props {
  story: StoryQuoteData;
  /** The message was sent by this member */
  isMe: boolean;
  /** The story was this member's */
  isMine: boolean;
}

/**
 * Above a story reply: a small still of the story and its caption while it is up, "Story ended"
 * once its 24 hours are over (its photo or video is gone by then).
 */
export default function StoryQuote({ story, isMe, isMine }: Props) {
  const [broken, setBroken] = useState(false);
  // Checked when the bubble first shows; a story ending while the chat is open keeps its still
  // until the photo fails to load, which also falls back to the icon
  const [now] = useState(() => Date.now());
  const ended = new Date(story.expires_at).getTime() <= now;
  const label = isMe ? (isMine ? "You replied to your story" : "You replied to their story") : isMine ? "Replied to your story" : "Replied to a story";
  const showThumb = !ended && !broken && !!story.thumb_url;

  return (
    <div className={`mb-1 flex max-w-[272px] items-center gap-2.5 ${isMe ? "self-end flex-row-reverse text-right" : ""}`}>
      <div className="relative h-16 w-10 shrink-0 overflow-hidden rounded-lg border border-km-border bg-km-surface">
        {showThumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN still of the story
          <img src={story.thumb_url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-km-text-secondary">
            <FilmStripIcon size={18} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-km-text-secondary">{label}</p>
        <p className="text-xs text-km-text-secondary line-clamp-2 break-words">
          {ended ? <span className="italic">Story ended</span> : story.caption || (story.media_type === "video" ? "Video" : "Photo")}
        </p>
      </div>
    </div>
  );
}
