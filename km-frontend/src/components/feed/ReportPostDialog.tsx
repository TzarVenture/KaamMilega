'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { feedApi } from '@/lib/api/feed';
import { notify } from '@/lib/notify';
import FeedDialog from './FeedDialog';
import { REPORT_REASONS, type ReportReason } from './feedTypes';

const MAX_DETAILS = 500;

/** Asks why a post is being reported. On success the post leaves this member's feed. */
export default function ReportPostDialog({ postId, open, onClose, onReported }: { postId: string; open: boolean; onClose: () => void; onReported: () => void }) {
  const t = useTranslations('feed');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    setError(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await feedApi.report(postId, reason, details.trim() || undefined);
      notify.success(t('reported'), t('reportedHint'));
      close();
      onReported();
    } catch (err) {
      notify.error(err, t('reportFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FeedDialog
      open={open}
      onClose={close}
      title={t('reportTitle')}
      description={t('reportSubtitle')}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={close} className="h-11 px-5 rounded-xl text-[15px] font-semibold text-km-text-primary hover:bg-km-surface cursor-pointer">
            {t('cancel')}
          </button>
          <button type="submit" form={`report-${postId}`} disabled={busy} className="btn-primary h-11 px-5 text-[15px] disabled:opacity-60 disabled:cursor-not-allowed">
            {busy ? t('sending') : t('sendReport')}
          </button>
        </div>
      }
    >
      <form id={`report-${postId}`} onSubmit={submit} noValidate className="px-5 sm:px-6 py-4 space-y-4">
        <fieldset>
          <legend className="sr-only">{t('reportReason')}</legend>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r}
                className={`flex items-start gap-3 rounded-xl border-[1.5px] px-3.5 py-3 cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#DCE8FB] dark:has-[:focus-visible]:ring-[#16294F] ${
                  reason === r ? 'border-km-link bg-[#F1F6FE] dark:bg-[#12224A]' : 'border-km-border hover:bg-km-surface'
                }`}
              >
                <input
                  type="radio"
                  name={`reason-${postId}`}
                  checked={reason === r}
                  onChange={() => {
                    setReason(r);
                    setError(false);
                  }}
                  className="mt-1 accent-[#0B5ED7]"
                />
                <span>
                  <span className="block text-[15px] font-semibold text-km-heading">{t(`reportReasons.${r}.label`)}</span>
                  <span className="block text-[13px] text-km-text-secondary">{t(`reportReasons.${r}.hint`)}</span>
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">
              {t('reportReasonRequired')}
            </p>
          )}
        </fieldset>
        <div>
          <label htmlFor={`report-details-${postId}`} className="block mb-1.5 text-sm font-semibold text-km-heading">
            {t('reportDetails')}
          </label>
          <textarea
            id={`report-details-${postId}`}
            rows={3}
            maxLength={MAX_DETAILS}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t('reportDetailsPlaceholder')}
            className="block w-full resize-none rounded-xl border-[1.5px] border-km-border bg-km-surface-card px-3.5 py-2.5 text-[15px] text-km-text-primary placeholder:text-km-text-muted outline-none focus:border-km-link focus:ring-4 focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]"
          />
        </div>
      </form>
    </FeedDialog>
  );
}
