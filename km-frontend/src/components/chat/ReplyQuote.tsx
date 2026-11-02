"use client";

import { FileTextIcon, ImageIcon, ProhibitIcon, XIcon } from "@phosphor-icons/react";
import { useFileUrl } from "@/lib/upload";
import { ReplyPreview } from "./chatTypes";

interface Props {
  reply: ReplyPreview;
  /** "You" or the other person's first name */
  senderLabel: string;
  /** In a bubble: which side's colours to use */
  onDarkBubble?: boolean;
  /** Bubble quotes jump to the original */
  onJump?: () => void;
  /** Composer quote can be cancelled */
  onCancel?: () => void;
}

/** What the quoted message was: its text, or a description of its files */
function summary(r: ReplyPreview): string {
  if (r.is_deleted) return "This message was deleted";
  if (r.content) return r.content;
  const n = r.attachment_count || 0;
  const isImage = r.attachment_type?.startsWith("image/");
  if (n > 1) return isImage ? `${n} photos` : `${n} files`;
  if (isImage) return "Photo";
  return r.attachment_name || "File";
}

/** The quoted message shown at the top of a reply, and above the message box while replying */
export default function ReplyQuote({ reply, senderLabel, onDarkBubble, onJump, onCancel }: Props) {
  const thumb = useFileUrl(reply.is_deleted ? null : reply.thumb_url);
  const isImage = reply.attachment_type?.startsWith("image/");
  const hasFile = !reply.is_deleted && !reply.content && (reply.attachment_count || 0) > 0;
  const tone = onDarkBubble
    ? "bg-[#0A4FB5] border-[#BFDBFE] text-white dark:bg-[#1B3A86]"
    : "bg-[#F2F2F7] border-km-link text-km-text-primary dark:bg-km-surface-card";

  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block text-xs font-bold ${onDarkBubble ? "text-white" : "text-km-link"}`}>{senderLabel}</span>
        <span className={`mt-0.5 flex items-center gap-1 text-xs ${onDarkBubble ? "text-white/85" : "text-km-text-secondary"} ${reply.is_deleted ? "italic" : ""}`}>
          {reply.is_deleted && <ProhibitIcon size={12} className="shrink-0" aria-hidden="true" />}
          {hasFile && (isImage ? <ImageIcon size={13} className="shrink-0" aria-hidden="true" /> : <FileTextIcon size={13} className="shrink-0" aria-hidden="true" />)}
          <span className="line-clamp-2 break-words">{summary(reply)}</span>
        </span>
      </span>
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element -- signed link thumbnail
        <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      )}
    </>
  );

  if (onCancel) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border-l-4 px-3 py-2 ${tone}`}>
        {body}
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-lg shrink-0 text-km-text-secondary hover:text-km-heading hover:bg-km-surface-card transition-colors"
          title="Cancel reply"
          aria-label="Cancel reply"
        >
          <XIcon weight="bold" size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.();
      }}
      className={`mb-1.5 flex w-full min-w-40 items-center gap-2 rounded-lg border-l-4 px-2.5 py-1.5 text-left ${tone}`}
      aria-label={`Replying to ${senderLabel}: ${summary(reply)}. Show original message`}
    >
      {body}
    </button>
  );
}
