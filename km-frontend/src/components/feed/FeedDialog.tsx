'use client';

import React, { useEffect, useId, useRef } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useScrollLock } from './feedUtils';

interface FeedDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** Wider dialogs (the composer) fill the phone screen instead of sitting as a short sheet */
  size?: 'sm' | 'lg';
}

/**
 * Dialog shell for the feed: a bottom sheet on phones, centred on larger screens. Escape and the
 * dim backdrop close it; focus moves in on open and back to where it was on close.
 */
export default function FeedDialog({ open, onClose, title, description, children, footer, size = 'sm' }: FeedDialogProps) {
  const t = useTranslations('feed');
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the field marked data-autofocus, else the first field, else the panel itself;
    // text already in a box keeps the cursor at its end
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('textarea, input:not([type=hidden]):not(.sr-only), select');
    (first ?? panel)?.focus({ preventScroll: true });
    if (first instanceof HTMLTextAreaElement) first.setSelectionRange(first.value.length, first.value.length);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`km-sheet-in relative w-full flex flex-col bg-km-surface-card border border-km-border shadow-xl outline-none rounded-t-[24px] sm:rounded-2xl ${
          size === 'lg'
            ? 'h-[100dvh] rounded-t-none sm:h-auto sm:max-h-[min(720px,90dvh)] sm:max-w-xl'
            : 'max-h-[90dvh] sm:max-w-md'
        }`}
      >
        {size === 'sm' && <div className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-km-border" aria-hidden="true" />}
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-km-border">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-km-heading leading-snug">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-km-text-secondary leading-relaxed">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-mr-2 p-2 rounded-full text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer"
          >
            <XIcon size={20} />
          </button>
        </div>
        {children && <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>}
        {footer && (
          <div className="px-5 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-km-border">{footer}</div>
        )}
      </div>
    </div>
  );
}

/** "Delete this post?" and friends */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('feed');
  return (
    <FeedDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl text-[15px] font-semibold text-km-text-primary hover:bg-km-surface cursor-pointer"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="h-11 px-5 rounded-xl text-[15px] font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {confirmLabel}
          </button>
        </div>
      }
    />
  );
}
