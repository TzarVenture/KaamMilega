"use client";

import { useEffect, useRef, useState } from "react";
import { CaretLeftIcon, CaretRightIcon, CircleNotchIcon, DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { notify } from "@/lib/notify";
import { downloadFile, useFileLink } from "@/lib/upload";
import { ChatAttachment } from "./chatTypes";

interface Props {
  images: ChatAttachment[];
  startIndex: number;
  onClose: () => void;
}

/**
 * Full-screen photo viewer: arrows, swipe and the keyboard move through the album, Download saves
 * the original file, Esc or the close button exits.
 */
export default function MediaViewer({ images, startIndex, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [downloading, setDownloading] = useState(false);
  const [retried, setRetried] = useState<Set<string>>(() => new Set());
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const current = images[index];
  const remote = useFileLink(current?.localUrl ? null : current?.url);
  const src = current?.localUrl || remote.src;
  const many = images.length > 1;

  const go = (step: number) => setIndex((i) => (i + step + images.length) % images.length);

  useEffect(() => {
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && images.length > 1) setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft" && images.length > 1) setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  if (!current) return null;
  const name = current.name || "photo";

  const download = async () => {
    if (!current.url) return;
    setDownloading(true);
    try {
      await downloadFile(current.url, name);
    } catch (err) {
      notify.error(err, "Could not download this photo.");
    } finally {
      setDownloading(false);
    }
  };

  const ctrl =
    "p-2.5 rounded-full bg-[#1F2937] text-white hover:bg-[#374151] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-colors disabled:opacity-60";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={many ? `Photo ${index + 1} of ${images.length}` : "Photo"}
      className="fixed inset-0 z-50 flex flex-col bg-[#0B0F17]"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null || !many) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 sm:px-5 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{name}</p>
          {many && (
            <p className="text-xs text-slate-300">
              {index + 1} of {images.length}
            </p>
          )}
        </div>
        <button type="button" onClick={download} disabled={downloading || !current.url} className={ctrl} title="Download" aria-label={`Download ${name}`}>
          {downloading ? <CircleNotchIcon size={20} className="animate-spin" /> : <DownloadSimpleIcon weight="bold" size={20} />}
        </button>
        <button ref={closeRef} type="button" onClick={onClose} className={ctrl} title="Close" aria-label="Close">
          <XIcon weight="bold" size={20} />
        </button>
      </div>

      {/* Photo */}
      <div className="relative flex flex-1 items-center justify-center px-2 sm:px-16 pb-6 min-h-0" onClick={onClose}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed links and local previews
          <img
            key={src}
            src={src}
            alt={name}
            onClick={(e) => e.stopPropagation()}
            onError={() => {
              // An expired signed link: fetch a fresh one, once per photo
              if (current.localUrl || retried.has(current.url)) return;
              setRetried((s) => new Set(s).add(current.url));
              remote.retry();
            }}
            className="max-h-full max-w-full object-contain rounded-lg select-none"
          />
        ) : remote.failed ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); remote.retry(); }} className="text-sm font-semibold text-white underline">
            Couldn&apos;t load this photo. Tap to retry
          </button>
        ) : (
          <CircleNotchIcon size={32} className="animate-spin text-white" aria-label="Loading" />
        )}

        {many && (
          <>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${ctrl} absolute left-2 sm:left-4 hidden sm:flex`} aria-label="Previous photo">
              <CaretLeftIcon weight="bold" size={22} />
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} className={`${ctrl} absolute right-2 sm:right-4 hidden sm:flex`} aria-label="Next photo">
              <CaretRightIcon weight="bold" size={22} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {many && (
        <div className="flex justify-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-x-auto">
          {images.map((img, i) => (
            <Thumb key={`${img.url || img.localUrl}-${i}`} image={img} active={i === index} onClick={() => setIndex(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Thumb({ image, active, onClick }: { image: ChatAttachment; active: boolean; onClick: () => void }) {
  const remote = useFileLink(image.localUrl ? null : image.url);
  const src = image.localUrl || remote.src;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Show ${image.name || "photo"}`}
      aria-current={active}
      className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${active ? "border-white" : "border-transparent opacity-70 hover:opacity-100"}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed links and local previews
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="block h-full w-full bg-[#1F2937]" />
      )}
    </button>
  );
}
