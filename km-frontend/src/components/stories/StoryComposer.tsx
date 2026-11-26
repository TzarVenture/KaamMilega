'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowClockwiseIcon, ImageIcon, SpinnerGapIcon, VideoCameraIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import FeedDialog from '@/components/feed/FeedDialog';
import { imageSize } from '@/components/feed/feedUtils';
import { storiesApi, STORY_MAX_CAPTION, type Story } from '@/lib/api/stories';
import { compressImage } from '@/lib/compressImage';
import { notify } from '@/lib/notify';
import { MAX_VIDEO_SECONDS, readVideo, uploadFile, uploadLargeFile, UPLOAD_LIMITS, videoPoster, waitForVideo } from '@/lib/upload';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;
const ACCEPT = `${IMAGE_TYPES.join(',')},video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm`;

/** The photo or video being added, uploaded as soon as it is picked */
interface Picked {
  key: string;
  kind: 'image' | 'video';
  file: File;
  preview: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  /** Sent; the server is checking the video (and converting it if browsers can't play it) */
  preparing?: boolean;
  /** The browser can't play this video, so there is no preview; the server converts it */
  noPreview?: boolean;
  width?: number;
  height?: number;
  duration?: number;
  fileId?: string;
  posterId?: string;
  abort?: AbortController;
}

/** Sharing a story: one photo or video and an optional caption. Mount it when needed. */
export default function StoryComposer({ onClose, onShared }: { onClose: () => void; onShared: (s: Story) => void }) {
  const t = useTranslations('stories');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickedRef = useRef<Picked | null>(null);
  useEffect(() => {
    pickedRef.current = picked;
  }, [picked]);

  // The picker opens straight away; the preview and any upload stop when the composer goes away
  useEffect(() => {
    inputRef.current?.click();
    return () => {
      const p = pickedRef.current;
      p?.abort?.abort();
      if (p) URL.revokeObjectURL(p.preview);
    };
  }, []);

  /** Changes only the pick it was started for, never one chosen after it */
  const patchFor = (key: string) => (change: Partial<Picked>) => setPicked((p) => (p && p.key === key ? { ...p, ...change } : p));

  const upload = async (p: Picked) => {
    const patch = patchFor(p.key);
    const abort = new AbortController();
    patch({ status: 'uploading', progress: 0, preparing: false, abort });
    try {
      if (p.kind === 'image') {
        const res = await uploadFile(p.file, 'story_image', { signal: abort.signal, onProgress: (f) => patch({ progress: f }) });
        if (abort.signal.aborted) return;
        patch({ status: 'done', progress: 1, fileId: res.id, abort: undefined });
        return;
      }
      // A still to show while the video loads; the story works without it. Kept across a retry.
      let posterId = p.posterId;
      if (!posterId) {
        const still = await videoPoster(p.file);
        if (still) posterId = (await uploadFile(still, 'story_image', { signal: abort.signal }).catch(() => null))?.id;
        if (posterId) patch({ posterId });
      }
      if (abort.signal.aborted) return;
      const res = await uploadLargeFile(p.file, 'story_video', { signal: abort.signal, onProgress: (f) => patch({ progress: f }) });
      if (abort.signal.aborted) return;
      patch({ progress: 1, preparing: true });
      const ready = await waitForVideo(res.id, abort.signal);
      if (abort.signal.aborted) return;
      // The server's length and size, which are what the story will show. A video this browser
      // couldn't play was converted, so its preview is the server's copy.
      if (p.noPreview) URL.revokeObjectURL(p.preview);
      patch({
        ...(p.noPreview ? { preview: ready.url, noPreview: false } : {}),
        status: 'done',
        preparing: false,
        fileId: ready.id,
        posterId,
        duration: Math.max(1, Math.round(ready.video?.duration ?? p.duration ?? 1)),
        width: ready.video?.width || p.width,
        height: ready.video?.height || p.height,
        abort: undefined,
      });
    } catch (err) {
      if (abort.signal.aborted) return;
      patch({ status: 'error', preparing: false, abort: undefined });
      notify.error(err, t('uploadFailed'));
    }
  };

  const choose = async (list: FileList | null) => {
    const original = list?.[0];
    if (!original) return;
    let next: Picked;
    if (IMAGE_TYPES.includes(original.type)) {
      const file = await compressImage(original);
      if (file.size > UPLOAD_LIMITS.story_image) {
        notify.error(t('photoTooLarge'));
        return;
      }
      next = { key: crypto.randomUUID(), kind: 'image', file, preview: URL.createObjectURL(file), status: 'uploading', progress: 0, ...(await imageSize(file)) };
    } else if (VIDEO_EXT.test(original.name)) {
      if (original.size > UPLOAD_LIMITS.story_video) {
        notify.error(t('videoTooLarge'));
        return;
      }
      // Null, or no picture size, when this browser can't play the file (often an iPhone video):
      // it is sent anyway and the server checks and converts it
      const meta = await readVideo(original);
      const playable = !!meta?.width && !!meta.height;
      if (meta && meta.duration > MAX_VIDEO_SECONDS + 0.5) {
        notify.error(t('videoTooLong', { seconds: MAX_VIDEO_SECONDS }));
        return;
      }
      next = {
        key: crypto.randomUUID(),
        kind: 'video',
        file: original,
        preview: URL.createObjectURL(original),
        status: 'uploading',
        progress: 0,
        width: meta?.width || undefined,
        height: meta?.height || undefined,
        duration: meta ? Math.min(MAX_VIDEO_SECONDS, Math.max(1, Math.round(meta.duration))) : undefined,
        noPreview: !playable,
      };
    } else {
      notify.error(t('fileType'));
      return;
    }
    clear();
    setPicked(next);
    void upload(next);
  };

  const clear = () => {
    const p = pickedRef.current;
    if (!p) return;
    p.abort?.abort();
    URL.revokeObjectURL(p.preview);
    setPicked(null);
  };

  const share = async () => {
    if (!picked?.fileId || busy) return;
    setBusy(true);
    try {
      const story = await storiesApi.create({
        media: { file_id: picked.fileId, width: picked.width, height: picked.height, poster_file_id: picked.posterId, duration: picked.duration },
        caption: caption.trim() || undefined,
      });
      notify.success(t('shared'));
      onShared(story);
    } catch (err) {
      notify.error(err, t('shareFailed'));
      setBusy(false);
    }
  };

  const left = STORY_MAX_CAPTION - caption.length;
  return (
    <FeedDialog
      open
      size="lg"
      onClose={onClose}
      title={t('newStory')}
      description={t('newStoryHint')}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl text-[15px] font-semibold text-km-text-primary hover:bg-km-surface cursor-pointer">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={() => void share()}
            disabled={!picked || picked.status !== 'done' || busy}
            className="btn-primary h-11 px-5 text-[15px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? t('sharing') : t('share')}
          </button>
        </div>
      }
    >
      <div className="px-5 sm:px-6 py-4 space-y-4">
        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { void choose(e.target.files); e.target.value = ''; }} />

        {picked ? (
          <div className="relative mx-auto w-full max-w-[260px] aspect-[9/16] overflow-hidden rounded-2xl bg-black">
            {picked.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              <img src={picked.preview} alt={t('previewAlt')} className="h-full w-full object-contain" />
            ) : picked.noPreview ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-white">
                <VideoCameraIcon size={32} aria-hidden="true" />
                {t('videoNoPreview')}
              </div>
            ) : (
              <video src={picked.preview} className="h-full w-full object-contain" muted playsInline autoPlay loop aria-label={t('previewAlt')} />
            )}
            <button
              type="button"
              onClick={clear}
              aria-label={t('removeMedia')}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black cursor-pointer"
            >
              <XIcon size={18} />
            </button>
            {picked.status !== 'done' && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-black/70 text-white text-sm">
                {picked.status === 'uploading' && picked.preparing ? (
                  <span role="status" className="flex items-center gap-2">
                    <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />
                    {t('preparingVideo')}
                  </span>
                ) : picked.status === 'uploading' ? (
                  <div role="status" className="space-y-1.5">
                    <span className="flex items-center gap-2">
                      <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />
                      {t('uploading', { percent: Math.round(picked.progress * 100) })}
                    </span>
                    <span className="block h-1 rounded-full bg-white/30 overflow-hidden">
                      <span className="block h-full bg-white" style={{ width: `${Math.round(picked.progress * 100)}%` }} />
                    </span>
                  </div>
                ) : (
                  <button type="button" onClick={() => void upload(picked)} className="flex items-center gap-2 font-semibold cursor-pointer">
                    <WarningCircleIcon size={18} aria-hidden="true" />
                    {t('uploadFailed')}
                    <ArrowClockwiseIcon size={16} aria-hidden="true" />
                    {t('retry')}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mx-auto flex w-full max-w-[260px] aspect-[9/16] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-km-border text-km-text-secondary hover:bg-km-surface hover:text-km-heading cursor-pointer"
          >
            <ImageIcon size={36} aria-hidden="true" />
            <span className="text-[15px] font-semibold">{t('choose')}</span>
            <span className="px-6 text-center text-[13px]">{t('chooseHint', { seconds: MAX_VIDEO_SECONDS })}</span>
          </button>
        )}

        <div>
          <label htmlFor="story-caption" className="block mb-1.5 text-sm font-semibold text-km-heading">
            {t('caption')}
          </label>
          <input
            id="story-caption"
            type="text"
            maxLength={STORY_MAX_CAPTION}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={t('captionPlaceholder')}
            className="block w-full h-11 rounded-xl border-[1.5px] border-km-border bg-km-surface-card px-3.5 text-base text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]"
          />
          {left <= 40 && <p className="mt-1 text-right text-[12px] text-km-text-secondary">{t('captionLeft', { count: left })}</p>}
        </div>
      </div>
    </FeedDialog>
  );
}
