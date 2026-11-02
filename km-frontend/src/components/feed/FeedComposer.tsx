'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowClockwiseIcon, CaretDownIcon, HashIcon, ImageIcon, SpinnerGapIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import { feedApi } from '@/lib/api/feed';
import { compressImage } from '@/lib/compressImage';
import { notify } from '@/lib/notify';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';
import FeedDialog, { ConfirmDialog } from './FeedDialog';
import { MAX_POST_IMAGES, MAX_POST_LENGTH, POST_CATEGORIES, type FeedPost, type PostCategory } from './feedTypes';
import { displayName, imageSize, useFeedUser } from './feedUtils';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

interface Photo {
  key: string;
  preview: string;
  status: 'uploading' | 'done' | 'error';
  progress: number;
  file: File;
  fileId?: string;
  width?: number;
  height?: number;
}

export interface ComposerProps {
  /** Editing an existing post: its text and category can change, its photos can't */
  editing?: FeedPost | null;
  initialCategory?: PostCategory;
  /** Opened from "Photo": the photo picker opens straight away */
  pickPhoto?: boolean;
  onClose: () => void;
  onSaved: (post: FeedPost, isNew: boolean) => void;
}

/** Writing or editing a post. Mount it when needed; it starts from its props each time. */
export default function FeedComposer({ editing, initialCategory = 'general', pickPhoto = false, onClose, onSaved }: ComposerProps) {
  const t = useTranslations('feed');
  const { user } = useFeedUser();
  const [content, setContent] = useState(editing?.content ?? '');
  const [category, setCategory] = useState<PostCategory>(editing?.category ?? initialCategory);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // Free the previews when the composer goes away
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  useEffect(() => {
    if (pickPhoto) fileRef.current?.click();
  }, [pickPhoto]);

  // The text box grows with what is typed
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(140, el.scrollHeight)}px`;
  }, [content]);

  const patch = (key: string, change: Partial<Photo>) => setPhotos((ps) => ps.map((p) => (p.key === key ? { ...p, ...change } : p)));

  const upload = async (photo: Photo) => {
    patch(photo.key, { status: 'uploading', progress: 0 });
    try {
      const res = await uploadFile(photo.file, 'feed_image', {
        moduleName: 'feed',
        onProgress: (f) => patch(photo.key, { progress: f }),
      });
      patch(photo.key, { status: 'done', progress: 1, fileId: res.id });
    } catch (err) {
      patch(photo.key, { status: 'error' });
      notify.error(err, t('photoUploadFailed'));
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const room = MAX_POST_IMAGES - photosRef.current.length;
    const picked = Array.from(list);
    if (picked.length > room) notify.info(t('maxPhotos', { count: MAX_POST_IMAGES }));
    for (const original of picked.slice(0, Math.max(0, room))) {
      if (!ACCEPT.split(',').includes(original.type)) {
        notify.error(t('photoType'));
        continue;
      }
      const file = await compressImage(original);
      if (file.size > UPLOAD_LIMITS.feed_image) {
        notify.error(t('photoTooLarge'));
        continue;
      }
      const size = await imageSize(file);
      const photo: Photo = { key: crypto.randomUUID(), preview: URL.createObjectURL(file), status: 'uploading', progress: 0, file, ...size };
      setPhotos((ps) => [...ps, photo]);
      void upload(photo);
    }
  };

  const removePhoto = (key: string) => {
    setPhotos((ps) => {
      const gone = ps.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return ps.filter((p) => p.key !== key);
    });
  };

  const insertHashtag = () => {
    const el = textRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const lead = before && !/\s$/.test(before) ? ' #' : '#';
    const next = before + lead + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + lead.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const text = content.trim();
  const uploading = photos.some((p) => p.status === 'uploading');
  const failed = photos.some((p) => p.status === 'error');
  const over = content.length > MAX_POST_LENGTH;
  const hasPhotos = photos.length > 0 || (editing?.media.length ?? 0) > 0;
  const unchanged = editing ? text === editing.content && category === editing.category : false;
  const canPost = !busy && !uploading && !failed && !over && (text.length > 0 || hasPhotos) && !unchanged;
  const dirty = editing ? !unchanged : text.length > 0 || photos.length > 0;

  const requestClose = () => {
    if (busy) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async () => {
    if (!canPost) return;
    setBusy(true);
    try {
      if (editing) {
        const updated = await feedApi.update(editing.id, { content: text, category });
        onSaved(updated, false);
      } else {
        const created = await feedApi.create({
          content: text,
          category,
          media: photos.map((p) => ({ file_id: p.fileId!, width: p.width, height: p.height })),
        });
        onSaved(created, true);
      }
    } catch (err) {
      notify.error(err, editing ? t('editFailed') : t('postFailed'));
      setBusy(false);
    }
  };

  const name = displayName(user);

  return (
    <>
      <FeedDialog
        open
        size="lg"
        onClose={requestClose}
        title={editing ? t('editPost') : t('createPost')}
        footer={
          <div className="flex items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photos.length >= MAX_POST_IMAGES}
                aria-label={t('addPhoto')}
                title={t('addPhoto')}
                className="p-2.5 rounded-xl text-km-text-secondary hover:text-km-link hover:bg-km-surface disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ImageIcon size={22} />
              </button>
            )}
            <button
              type="button"
              onClick={insertHashtag}
              aria-label={t('addHashtag')}
              title={t('addHashtag')}
              className="p-2.5 rounded-xl text-km-text-secondary hover:text-km-link hover:bg-km-surface cursor-pointer"
            >
              <HashIcon size={22} />
            </button>
            <span className="ml-auto mr-3 text-[13px] tabular-nums" aria-live="polite">
              {content.length > MAX_POST_LENGTH - 300 && (
                <span className={over ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-km-text-secondary'}>
                  {over ? t('charactersOver', { count: -(MAX_POST_LENGTH - content.length) }) : t('charactersLeft', { count: MAX_POST_LENGTH - content.length })}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="btn-primary h-11 px-6 text-[15px] inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(busy || uploading) && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />}
              {busy ? (editing ? t('saving') : t('posting')) : uploading ? t('uploadingPhotos') : editing ? t('saveChanges') : t('post')}
            </button>
          </div>
        }
      >
        <div className="px-5 sm:px-6 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
              <UserAvatar src={user?.profile_image || user?.avatar} name={name} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-km-heading">{name}</p>
              <label className="relative mt-0.5 inline-flex items-center">
                <span className="sr-only">{t('postAbout')}</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as PostCategory)}
                  className="appearance-none h-8 pl-3 pr-8 rounded-full border border-km-border bg-km-surface-card text-[13px] font-semibold text-km-text-primary cursor-pointer outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]"
                >
                  {POST_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`category.${c}`)}</option>
                  ))}
                </select>
                <CaretDownIcon size={12} weight="bold" className="absolute right-3 pointer-events-none text-km-text-secondary" aria-hidden="true" />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="feed-composer-text" className="sr-only">{t('postText')}</label>
            <textarea
              id="feed-composer-text"
              ref={textRef}
              data-autofocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t(`placeholder.${category}`)}
              dir="auto"
              className="block w-full min-h-[140px] resize-none bg-transparent text-[16px] leading-relaxed text-km-text-primary placeholder:text-km-text-muted outline-none"
            />
          </div>

          {editing && editing.media.length > 0 && (
            <div>
              <div className="grid grid-cols-4 gap-2">
                {editing.media.map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={m.url} src={m.url} alt="" className="aspect-square w-full rounded-xl object-cover border border-km-border" />
                ))}
              </div>
              <p className="mt-2 text-[13px] text-km-text-secondary">{t('photosCantChange')}</p>
            </div>
          )}

          {photos.length > 0 && (
            <ul className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {photos.map((p) => (
                <li key={p.key} className={`relative overflow-hidden rounded-xl border border-km-border bg-km-surface ${photos.length === 1 ? 'max-h-80' : 'aspect-square'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" className={`w-full h-full ${photos.length === 1 ? 'object-contain max-h-80' : 'object-cover'} ${p.status === 'done' ? '' : 'opacity-60'}`} />
                  {p.status === 'uploading' && (
                    <div className="absolute inset-x-3 bottom-3 h-1.5 rounded-full bg-black/30 overflow-hidden" role="progressbar" aria-label={t('uploadingPhotos')} aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full bg-white transition-[width]" style={{ width: `${Math.max(5, p.progress * 100)}%` }} />
                    </div>
                  )}
                  {p.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => void upload(p)}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white text-sm font-semibold cursor-pointer"
                    >
                      <WarningCircleIcon size={22} aria-hidden="true" />
                      <span className="inline-flex items-center gap-1">
                        <ArrowClockwiseIcon size={14} aria-hidden="true" />
                        {t('retry')}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.key)}
                    aria-label={t('removePhoto')}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/65 text-white hover:bg-black/85 cursor-pointer"
                  >
                    <XIcon size={16} weight="bold" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </FeedDialog>

      <ConfirmDialog
        open={confirmDiscard}
        title={editing ? t('discardEditTitle') : t('discardTitle')}
        description={editing ? t('discardEditBody') : t('discardBody')}
        confirmLabel={t('discard')}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}
