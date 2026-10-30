"use client";

import { useState } from "react";
import { DownloadSimpleIcon, FileTextIcon, ImageBrokenIcon } from "@phosphor-icons/react";
import { notify } from "@/lib/notify";
import { downloadFile, openFile, useFileLink } from "@/lib/upload";
import { ChatAttachment, formatFileSize, isImageAttachment } from "./chatTypes";

interface Props {
  attachments: ChatAttachment[];
  isMe: boolean;
  /** Still being sent from this browser: tiles show upload progress */
  sending?: boolean;
  /** Opens the viewer at this image (index within the message's images) */
  onOpenImage: (images: ChatAttachment[], index: number) => void;
}

// Albums show at most four tiles; the fourth says how many more there are (WhatsApp pattern)
const MAX_TILES = 4;

/** A message's files: photos as a grid, documents as a list with download buttons */
export default function MessageAttachments({ attachments, isMe, sending, onOpenImage }: Props) {
  const images = attachments.filter(isImageAttachment);
  const docs = attachments.filter((a) => !isImageAttachment(a));
  const tiles = images.slice(0, MAX_TILES);
  const hidden = images.length - tiles.length;

  return (
    <div className="space-y-1">
      {images.length > 0 && (
        <div
          className={`grid gap-0.5 overflow-hidden rounded-[14px] ${
            images.length === 1 ? "grid-cols-1" : "grid-cols-2 w-[272px] max-w-full"
          }`}
        >
          {tiles.map((img, i) => (
            <ImageTile
              key={`${img.url || img.localUrl}-${i}`}
              image={img}
              single={images.length === 1}
              // Three photos: the first spans the full width
              wide={images.length === 3 && i === 0}
              more={i === MAX_TILES - 1 && hidden > 0 ? hidden : 0}
              sending={sending}
              onOpen={() => onOpenImage(images, i)}
            />
          ))}
        </div>
      )}
      {docs.map((doc, i) => (
        <DocumentRow key={`${doc.url || doc.name}-${i}`} doc={doc} isMe={isMe} sending={sending} />
      ))}
    </div>
  );
}

function ImageTile({
  image,
  single,
  wide,
  more,
  sending,
  onOpen,
}: {
  image: ChatAttachment;
  single: boolean;
  wide: boolean;
  more: number;
  sending?: boolean;
  onOpen: () => void;
}) {
  // While sending, the photo from this device shows straight away
  const remote = useFileLink(image.localUrl ? null : image.url);
  const src = image.localUrl || remote.src;
  const [broken, setBroken] = useState(false);
  const [autoRetried, setAutoRetried] = useState(false);
  const uploading = sending && !image.url;

  const box = single
    ? "max-h-72 min-h-24 min-w-32"
    : `aspect-square ${wide ? "col-span-2 aspect-[2/1]" : ""}`;

  if (remote.failed || broken) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setBroken(false);
          remote.retry();
        }}
        className={`${single ? "h-40 w-56 max-w-full" : box} flex flex-col items-center justify-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-semibold dark:bg-km-surface dark:text-km-text-secondary`}
      >
        <ImageBrokenIcon size={22} aria-hidden="true" />
        Tap to retry
      </button>
    );
  }

  if (!src) {
    return (
      <div
        className={`${single ? "h-40 w-56 max-w-full" : box} bg-slate-100 animate-pulse dark:bg-km-surface`}
        aria-label={image.name || "Photo"}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!uploading) onOpen();
      }}
      className={`relative block overflow-hidden ${single ? "" : box} ${uploading ? "cursor-default" : "cursor-zoom-in"}`}
      aria-label={more ? `Open photos, ${more} more` : `Open ${image.name || "photo"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed links and local previews */}
      <img
        src={src}
        alt={image.name || "Photo"}
        onError={() => {
          if (image.localUrl) return;
          // A signed link can expire before the image loads: fetch a fresh one once, then
          // let the person retry
          if (!autoRetried) {
            setAutoRetried(true);
            remote.retry();
          } else {
            setBroken(true);
          }
        }}
        className={`${single ? "max-h-72 w-auto max-w-full" : "h-full w-full"} object-cover`}
      />
      {uploading && <UploadRing progress={image.progress ?? 0} />}
      {more > 0 && !uploading && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-2xl font-bold">
          +{more}
        </span>
      )}
    </button>
  );
}

/** Circular upload progress over a photo */
function UploadRing({ progress }: { progress: number }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/35" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Uploading">
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90">
        <circle cx="22" cy="22" r={r} fill="#0F172A" stroke="#64748B" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0.04, progress))}
          className="transition-[stroke-dashoffset] duration-200"
        />
      </svg>
    </span>
  );
}

function DocumentRow({ doc, isMe, sending }: { doc: ChatAttachment; isMe: boolean; sending?: boolean }) {
  const uploading = sending && !doc.url;
  const name = doc.name || "Document";
  const tone = isMe
    ? "bg-[#0B5ED7] border-transparent text-white dark:bg-[#2348A8]"
    : "bg-[#E9E9EB] border-transparent text-[#111827] dark:bg-[#1E2942] dark:text-km-heading";
  const subTone = isMe ? "text-white/80" : "text-km-text-secondary";

  return (
    <div className={`flex items-center gap-2.5 p-2 rounded-[14px] border w-[272px] max-w-full ${tone}`}>
      <button
        type="button"
        disabled={uploading}
        onClick={(e) => {
          e.stopPropagation();
          openFile(doc.url).catch((err) => notify.error(err, "Could not open this file."));
        }}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-label={`Open ${name}`}
      >
        <FileTextIcon size={26} weight="duotone" className="shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold truncate">{name}</span>
          {uploading ? (
            <span className={`mt-1 block h-1 w-full overflow-hidden rounded-full ${isMe ? "bg-white/30" : "bg-black/10 dark:bg-km-border"}`}>
              <span
                className={`block h-full rounded-full ${isMe ? "bg-white" : "bg-km-heading"} transition-[width] duration-200`}
                style={{ width: `${Math.max(4, Math.round((doc.progress ?? 0) * 100))}%` }}
              />
            </span>
          ) : (
            <span className={`block text-xs ${subTone}`}>{formatFileSize(doc.size)}</span>
          )}
        </span>
      </button>
      {!uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            downloadFile(doc.url, name).catch((err) => notify.error(err, "Could not download this file."));
          }}
          title="Download"
          aria-label={`Download ${name}`}
          className={`p-1.5 rounded-lg shrink-0 transition-colors ${isMe ? "hover:bg-white/15" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
        >
          <DownloadSimpleIcon weight="bold" size={16} />
        </button>
      )}
    </div>
  );
}
