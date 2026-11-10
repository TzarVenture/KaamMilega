"use client";

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowSquareOutIcon, CalendarBlankIcon, CircleNotchIcon, StarIcon, VideoCameraIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { dateTime, inr } from '@/lib/money';
import { AdminModal, BadgeTone, EmptyState, FilterTabs, StatusBadge, btn, cx, field } from '@/components/admin/ui';
import SessionConfirmation from '@/components/km/SessionConfirmation';

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

interface Booking {
  id?: string;
  _id?: string;
  status: string;
  amount: number;
  scheduled_at: string;
  release_after?: string;
  payment_method?: string;
  mentorship_title?: string;
  expert_name?: string;
  expert_headline?: string;
  expert_image?: string;
  meeting_link?: string;
  notes?: string;
  rating?: number;
  review?: string;
}

const UPCOMING = ['pending', 'confirmed', 'awaiting_confirmation', 'reported'];

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'neutral',
  confirmed: 'green',
  awaiting_confirmation: 'amber',
  reported: 'amber',
  completed: 'blue',
  cancelled: 'red',
};

const bookingId = (booking: Booking) => booking.id || booking._id || '';

export default function MyMentorshipSessionsPage() {
  const t = useTranslations('mySessions');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<unknown, Booking[] | { data?: Booking[] }>('/mentorships/bookings/my');
      const data = Array.isArray(res) ? res : res?.data;
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      notify.error(err, t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const authed = isAuthenticated();
    setIsLoggedIn(authed);
    if (authed) load();
    else setLoading(false);
  }, [load]);

  const openReview = (booking: Booking) => {
    setReviewing(booking);
    setRating(5);
    setComment('');
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewing) return;
    const id = bookingId(reviewing);
    setSubmitting(true);
    try {
      await api.post(`/mentorships/bookings/${id}/review`, { rating, review: comment.trim() });
      notify.success(t('review.thanks'));
      setBookings((prev) => prev.map((b) => (bookingId(b) === id ? { ...b, rating, review: comment.trim() } : b)));
      setReviewing(null);
    } catch (err) {
      notify.error(err, t('review.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const countOf = (value: Filter) => bookings.filter((b) => {
    if (value === 'upcoming') return UPCOMING.includes(b.status);
    return value === 'all' || b.status === value;
  }).length;

  const visible = bookings.filter((b) => (filter === 'upcoming' ? UPCOMING.includes(b.status) : filter === 'all' || b.status === filter));

  return (
    <main className="min-h-screen bg-km-surface px-4 py-6 sm:px-6 lg:py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/mentorship" className="inline-flex items-center gap-1.5 text-sm font-medium text-km-text-secondary hover:text-km-heading">
            <ArrowLeftIcon size={16} aria-hidden="true" />
            {t('back')}
          </Link>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-km-heading tracking-tight">{t('title')}</h1>
              <p className="mt-1 text-sm text-km-text-secondary">{t('subtitle')}</p>
            </div>
            <Link href="/mentorship" className={cx(btn.secondary, 'self-start sm:self-auto')}>{t('findMentors')}</Link>
          </div>
        </div>

        {!isLoggedIn && !loading ? (
          <div className="bg-km-surface-card border border-km-border rounded-2xl">
            <EmptyState
              icon={CalendarBlankIcon}
              title={t('signInTitle')}
              description={t('signInHint')}
              action={<Link href="/login?redirect=/mentorship/my-sessions" className={btn.primary}>{t('signIn')}</Link>}
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <FilterTabs
                value={filter}
                onChange={setFilter}
                options={(['all', 'upcoming', 'completed', 'cancelled'] as Filter[]).map((value) => ({
                  value,
                  label: t(`filter.${value}`),
                  count: countOf(value),
                }))}
              />
            </div>

            {loading ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {[1, 2].map((i) => <div key={i} className="h-48 rounded-2xl border border-km-border bg-km-surface-card animate-pulse" />)}
              </div>
            ) : visible.length === 0 ? (
              <div className="bg-km-surface-card border border-km-border rounded-2xl">
                <EmptyState
                  icon={CalendarBlankIcon}
                  title={t('emptyTitle')}
                  description={filter === 'all' ? t('emptyHint') : undefined}
                  action={filter === 'all' ? <Link href="/mentorship" className={btn.primary}>{t('findMentors')}</Link> : undefined}
                />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {visible.map((booking) => (
                  <BookingCard key={bookingId(booking)} booking={booking} onReview={openReview} onChanged={load} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <AdminModal isOpen={!!reviewing} onClose={() => !submitting && setReviewing(null)} title={t('review.title')}>
        <form onSubmit={submitReview} className="space-y-4">
          <p className="text-sm text-km-text-secondary">{t('review.prompt', { name: reviewing?.expert_name || t('defaultMentor') })}</p>
          <div>
            <p className={field.label}>{t('review.rating')}</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} aria-label={t('review.star', { count: star })} aria-pressed={star === rating} className="p-1 cursor-pointer">
                  <StarIcon size={28} weight={star <= rating ? 'fill' : 'regular'} className={star <= rating ? 'text-amber-500 dark:text-amber-400' : 'text-km-text-muted'} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className={field.label}>{t('review.feedback')}</span>
            <textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} className={field.textarea} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReviewing(null)} disabled={submitting} className={btn.secondary}>{t('review.cancel')}</button>
            <button type="submit" disabled={submitting} className={btn.primary}>
              {submitting && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
              {t('review.submit')}
            </button>
          </div>
        </form>
      </AdminModal>
    </main>
  );
}

function BookingCard({ booking, onReview, onChanged }: { booking: Booking; onReview: (booking: Booking) => void; onChanged: () => void }) {
  const t = useTranslations('mySessions');
  const locale = useLocale();
  const mentor = (booking.expert_name || t('defaultMentor')).replace(/\s*\.+$/, '');
  const canReview = booking.status === 'completed' && !booking.rating;
  const link = booking.meeting_link && (booking.meeting_link.startsWith('http') ? booking.meeting_link : `https://${booking.meeting_link}`);
  const showLink = link && UPCOMING.includes(booking.status);

  return (
    <article className="flex flex-col bg-km-surface-card border border-km-border rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {booking.expert_image ? (
            <img src={booking.expert_image} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-km-surface text-base font-semibold text-km-heading" aria-hidden="true">
              {mentor[0]?.toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-km-heading">{booking.mentorship_title || t('defaultTitle')}</h2>
            <p className="truncate text-sm text-km-text-secondary">{mentor}</p>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge tone={STATUS_TONE[booking.status] ?? 'neutral'}>{t(`status.${booking.status in STATUS_TONE ? booking.status : 'pending'}`)}</StatusBadge>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-km-text-secondary">{t('when')}</dt>
          <dd className="mt-0.5 font-medium text-km-text-primary font-inter">{dateTime(booking.scheduled_at, locale)}</dd>
        </div>
        <div>
          <dt className="text-km-text-secondary">{booking.payment_method === 'wallet' ? t('paidWallet') : t('paidOnline')}</dt>
          <dd className="mt-0.5 font-medium text-km-text-primary font-inter tabular-nums">{inr(booking.amount)}</dd>
        </div>
      </dl>

      {booking.notes && <p className="mt-3 text-sm text-km-text-secondary"><span className="font-medium text-km-text-primary">{t('topic')}</span> {booking.notes}</p>}

      {booking.rating ? (
        <div className="mt-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-km-text-primary">
            <StarIcon size={16} weight="fill" className="text-amber-500 dark:text-amber-400" aria-hidden="true" />
            {t('youRated', { rating: booking.rating })}
          </p>
          {booking.review && <p className="mt-1 text-km-text-secondary">{booking.review}</p>}
        </div>
      ) : null}

      {booking.status === 'confirmed' && !link && <p className="mt-3 text-sm text-km-text-secondary">{t('linkSoon')}</p>}

      <div className="mt-4 empty:hidden">
        <SessionConfirmation
          bookingId={bookingId(booking)}
          status={booking.status}
          releaseAfter={booking.release_after}
          scheduledAt={booking.scheduled_at}
          onChanged={onChanged}
        />
      </div>

      {(showLink || canReview) && (
        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {showLink && (
            <a href={link} target="_blank" rel="noopener noreferrer" className={btn.primary}>
              <VideoCameraIcon size={16} aria-hidden="true" />
              {t('join')}
              <ArrowSquareOutIcon size={14} aria-hidden="true" />
            </a>
          )}
          {canReview && <button type="button" onClick={() => onReview(booking)} className={btn.secondary}>{t('leaveReview')}</button>}
        </div>
      )}
    </article>
  );
}
