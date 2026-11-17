"use client";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowSquareOutIcon, CalendarBlankIcon, ChalkboardTeacherIcon, CheckCircleIcon, CheckIcon, ClockIcon,
  LinkSimpleIcon, PauseIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon, UserIcon, UsersThreeIcon,
  VideoCameraIcon, WalletIcon,
} from '@phosphor-icons/react';
import api from '@/lib/axios';
import { inr } from '@/lib/money';
import { useIsExpert } from '@/lib/useIsExpert';
import { notify } from '@/lib/notify';
import { AdminModal, ConfirmDialog, EmptyState, StatusBadge, btn, cx, field } from '@/components/admin/ui';
import { BOOKING_STATUS, SESSION_CATEGORIES, SESSION_DURATIONS, SESSION_LIMITS, price, sessionTime, sortBookings } from '@/lib/mentorship';

interface WalletSummary {
  withdrawable_balance: number;
  locked_balance: number;
}

interface Session {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  price: number;
  status: string;
  rating?: number;
  reviews?: number;
}

interface Booking {
  id: string;
  mentorship_title?: string;
  mentee_name?: string;
  mentee_email?: string;
  scheduled_at: string;
  status: string;
  amount: number;
  meeting_link?: string;
  notes?: string;
}

interface Slot {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}

type Tab = 'bookings' | 'sessions' | 'hours';

const TABS: { id: Tab; label: string; Icon: typeof UserIcon }[] = [
  { id: 'bookings', label: 'Bookings', Icon: UsersThreeIcon },
  { id: 'sessions', label: 'My sessions', Icon: ChalkboardTeacherIcon },
  { id: 'hours', label: 'Weekly hours', Icon: CalendarBlankIcon },
];

export default function ExpertMentorshipManagement() {
  const isExpert = useIsExpert(true);
  const [tab, setTab] = useState<Tab>('bookings');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hours, setHours] = useState<Slot[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  // null = closed, 'new' = create, a session = edit
  const [editing, setEditing] = useState<Session | 'new' | null>(null);

  const loadSessions = useCallback(async () => {
    const res = await api.get<unknown, Session[] | null>('/mentorships/expert/my');
    setSessions(res || []);
  }, []);
  const loadBookings = useCallback(async () => {
    const res = await api.get<unknown, Booking[] | null>('/mentorships/bookings/expert');
    setBookings(res || []);
  }, []);
  const loadHours = useCallback(async () => {
    const res = await api.get<unknown, Slot[] | null>('/mentorships/availability');
    setHours((res || []).filter((s) => s.is_active !== false));
  }, []);
  const loadWallet = useCallback(async () => {
    try {
      setWallet(await api.get<unknown, WalletSummary>('/wallet/balance'));
    } catch {
      // The money summary is extra; the dashboard works without it
    }
  }, []);

  // Everything loads once, together, so every tab count is right from the start
  useEffect(() => {
    if (!isExpert) return;
    let live = true;
    Promise.allSettled([
      api.get<unknown, Session[] | null>('/mentorships/expert/my'),
      api.get<unknown, Booking[] | null>('/mentorships/bookings/expert'),
      api.get<unknown, Slot[] | null>('/mentorships/availability'),
      api.get<unknown, WalletSummary>('/wallet/balance'),
    ]).then(([s, b, h, w]) => {
      if (!live) return;
      if (s.status === 'fulfilled') setSessions(s.value || []);
      if (b.status === 'fulfilled') setBookings(b.value || []);
      if (h.status === 'fulfilled') setHours((h.value || []).filter((slot) => slot.is_active !== false));
      if (w.status === 'fulfilled') setWallet(w.value);
      const failed = [s, b, h].find((r) => r.status === 'rejected');
      if (failed) notify.error((failed as PromiseRejectedResult).reason, 'Some of your dashboard couldn’t be loaded. Refresh to try again.');
      setLoading(false);
    });
    return () => { live = false; };
  }, [isExpert]);

  const toDo = bookings.filter((b) => b.status === 'confirmed').length;
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const counts: Record<Tab, number | undefined> = { bookings: bookings.length, sessions: sessions.length, hours: undefined };

  if (isExpert === false) {
    return (
      <main className="min-h-screen bg-km-surface pb-20">
        <div className="max-w-3xl mx-auto px-4 pt-16">
          <div className="km-card">
            <EmptyState
              icon={ChalkboardTeacherIcon}
              title="This dashboard is for approved Experts"
              description="Apply as an Expert to publish paid sessions. Our team reviews applications the same day."
              action={<Link href="/expert/apply" className={btn.primary}>Apply as an Expert</Link>}
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-km-surface pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 mb-6">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-km-mentors-text mb-1.5">
              <ChalkboardTeacherIcon size={16} weight="bold" aria-hidden="true" />
              Expert Portal
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-km-heading">Mentor dashboard</h1>
            <p className="mt-1 text-sm text-km-text-secondary">Publish sessions, run your calls and get paid after each one.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {wallet && (
              <dl className="flex items-center gap-6 bg-km-surface-card border border-km-border rounded-xl px-4 py-2">
                <div>
                  <dt className="text-xs text-km-text-secondary">Earnings</dt>
                  <dd className="text-base font-semibold text-km-heading tabular-nums">{inr(wallet.withdrawable_balance)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-km-text-secondary">On hold</dt>
                  <dd className="text-base font-semibold text-km-heading tabular-nums">{inr(wallet.locked_balance)}</dd>
                </div>
              </dl>
            )}
            <Link href="/wallet" className={btn.secondary}>
              <WalletIcon size={16} aria-hidden="true" /> Wallet
            </Link>
            <button type="button" onClick={() => setEditing('new')} className={btn.primary}>
              <PlusIcon size={16} weight="bold" aria-hidden="true" /> New session
            </button>
          </div>
        </header>

        {!loading && (hours.length === 0 || activeSessions === 0) && (
          <SetupSteps hasHours={hours.length > 0} hasSession={activeSessions > 0} onHours={() => setTab('hours')} onSession={() => setEditing('new')} />
        )}

        <div role="tablist" aria-label="Mentor dashboard" className="flex border-b border-km-border mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {TABS.map(({ id, label, Icon }) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={`panel-${id}`}
                onClick={() => setTab(id)}
                className={cx(
                  'relative flex items-center gap-2 px-4 md:px-5 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
                  selected ? 'text-km-mentors-text border-km-mentors' : 'text-km-text-secondary border-transparent hover:text-km-heading',
                )}
              >
                <Icon size={16} weight="bold" aria-hidden="true" />
                {label}
                {!loading && counts[id] !== undefined && (
                  <span className="text-xs tabular-nums text-km-text-secondary">({counts[id]})</span>
                )}
                {id === 'bookings' && toDo > 0 && <span className="sr-only">, {toDo} to run</span>}
              </button>
            );
          })}
        </div>

        <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-[360px]">
          {loading ? (
            <div className="flex items-center justify-center py-20" role="status">
              <div className="w-9 h-9 border-2 border-km-mentors border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading your dashboard</span>
            </div>
          ) : tab === 'bookings' ? (
            <BookingsList bookings={bookings} onChange={() => { loadBookings(); loadWallet(); }} />
          ) : tab === 'sessions' ? (
            <SessionsList sessions={sessions} onNew={() => setEditing('new')} onEdit={setEditing} onChange={loadSessions} />
          ) : (
            <WeeklyHours saved={hours} onSaved={loadHours} />
          )}
        </section>
      </div>

      {editing && (
        <SessionForm
          session={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadSessions(); setTab('sessions'); }}
        />
      )}
    </main>
  );
}

/** The two things a new Expert sets up before anyone can book them */
function SetupSteps({ hasHours, hasSession, onHours, onSession }: {
  hasHours: boolean; hasSession: boolean; onHours: () => void; onSession: () => void;
}) {
  const steps = [
    { done: hasHours, title: 'Set your weekly hours', text: 'Mentees can only pick times inside them.', action: 'Set hours', onClick: onHours },
    { done: hasSession, title: 'Publish a session', text: 'Give it a title, a length and a price.', action: 'New session', onClick: onSession },
    { done: false, title: 'Run the call and get paid', text: 'Mark it done after the call. You’re paid once the mentee confirms.' },
  ];
  return (
    <section aria-labelledby="setup-title" className="km-card p-5 md:p-6 mb-6">
      <h2 id="setup-title" className="text-base font-semibold text-km-heading">Get ready for your first booking</h2>
      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span
              className={cx(
                'w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm font-semibold',
                s.done ? 'bg-emerald-600 text-white' : 'bg-km-surface text-km-mentors-text',
              )}
              aria-hidden="true"
            >
              {s.done ? <CheckIcon size={16} weight="bold" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cx('text-sm font-semibold', s.done ? 'text-km-text-secondary line-through' : 'text-km-heading')}>
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </p>
              <p className="text-xs text-km-text-secondary mt-0.5">{s.text}</p>
              {!s.done && s.action && (
                <button type="button" onClick={s.onClick} className="mt-2 text-sm font-semibold text-km-link hover:underline">
                  {s.action}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Sessions                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

function SessionsList({ sessions, onNew, onEdit, onChange }: {
  sessions: Session[]; onNew: () => void; onEdit: (s: Session) => void; onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Session | null>(null);

  const togglePause = async (s: Session) => {
    const next = s.status === 'active' ? 'inactive' : 'active';
    setBusyId(s.id);
    try {
      await api.patch(`/mentorships/${s.id}`, { title: s.title, description: s.description, category: s.category, duration: s.duration, price: s.price, status: next });
      notify.success(next === 'active' ? 'Session is live again.' : 'Session paused. Mentees can’t book it until you resume it.');
      onChange();
    } catch (e) {
      notify.error(e, 'The session couldn’t be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.delete(`/mentorships/${deleting.id}`);
      notify.success('Session deleted.');
      setDeleting(null);
      onChange();
    } catch (e) {
      notify.error(e, 'The session couldn’t be deleted.');
      setDeleting(null);
    } finally {
      setBusyId(null);
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="km-card">
        <EmptyState
          icon={ChalkboardTeacherIcon}
          title="No sessions yet"
          description="Publish a session so mentees can find and book you, for example a 30-minute resume review."
          action={<button type="button" onClick={onNew} className={btn.primary}><PlusIcon size={16} weight="bold" aria-hidden="true" /> New session</button>}
        />
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.map((s) => {
          const live = s.status === 'active';
          const busy = busyId === s.id;
          return (
            <li key={s.id} className="km-card p-5 flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-km-mentors-text truncate">{s.category}</p>
                <StatusBadge tone={live ? 'green' : 'neutral'}>{live ? 'Live' : 'Paused'}</StatusBadge>
              </div>
              <h3 className="mt-2 text-base font-semibold text-km-heading">{s.title}</h3>
              {s.description && <p className="mt-1 text-sm text-km-text-secondary line-clamp-2">{s.description}</p>}
              <div className="mt-auto pt-4 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-km-text-secondary">
                  <ClockIcon size={16} aria-hidden="true" /> {s.duration} min
                </span>
                <span className="font-semibold text-km-heading tabular-nums">{price(s.price)}</span>
              </div>
              <div className="mt-4 pt-3 border-t border-km-border-subtle flex items-center gap-1">
                <button type="button" onClick={() => onEdit(s)} disabled={busy} className={btn.ghost}>
                  <PencilSimpleIcon size={16} aria-hidden="true" /> Edit
                </button>
                <button type="button" onClick={() => togglePause(s)} disabled={busy} className={btn.ghost}>
                  {live ? <PauseIcon size={16} aria-hidden="true" /> : <PlayIcon size={16} aria-hidden="true" />}
                  {live ? 'Pause' : 'Resume'}
                </button>
                <button type="button" onClick={() => setDeleting(s)} disabled={busy} className={cx(btn.ghost, 'ml-auto hover:text-red-600')} aria-label={`Delete ${s.title}`}>
                  <TrashIcon size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {deleting && (
        <ConfirmDialog
          title="Delete this session?"
          description={<>“{deleting.title}” will no longer be listed. Bookings already finished stay in your history. To stop new bookings for a while, pause it instead.</>}
          confirmLabel="Delete session"
          busy={busyId === deleting.id}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </>
  );
}

function SessionForm({ session, onClose, onSaved }: { session: Session | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(session?.title ?? '');
  const [category, setCategory] = useState(session?.category ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [duration, setDuration] = useState(session?.duration ?? 30);
  const [priceText, setPriceText] = useState(session ? String(session.price) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // An older session may use a category or length that's no longer in the list; keep it selectable
  const categories = useMemo(() => (category && !SESSION_CATEGORIES.includes(category) ? [category, ...SESSION_CATEGORIES] : SESSION_CATEGORIES), [category]);
  const durations = useMemo(() => (SESSION_DURATIONS.includes(duration) ? SESSION_DURATIONS : [...SESSION_DURATIONS, duration].sort((a, b) => a - b)), [duration]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(priceText);
    if (!title.trim() || !category || !description.trim()) {
      setError('Fill in the title, category and description.');
      return;
    }
    if (!Number.isFinite(amount) || amount < SESSION_LIMITS.minPrice || amount > SESSION_LIMITS.maxPrice) {
      setError(`Set a price between ${price(SESSION_LIMITS.minPrice)} and ${price(SESSION_LIMITS.maxPrice)}.`);
      return;
    }
    setError('');
    setSaving(true);
    const body = { title: title.trim(), category, description: description.trim(), duration, price: amount };
    try {
      if (session) {
        await api.patch(`/mentorships/${session.id}`, { ...body, status: session.status });
        notify.success('Session updated.');
      } else {
        await api.post('/mentorships/', body);
        notify.success('Session published. Mentees can book it now.');
      }
      onSaved();
    } catch (err) {
      notify.error(err, 'The session couldn’t be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal isOpen onClose={() => !saving && onClose()} title={session ? 'Edit session' : 'New session'}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="session-title" className={field.label}>Title</label>
          <input
            id="session-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={SESSION_LIMITS.title}
            placeholder="Resume review for freshers"
            className={field.input}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="session-category" className={field.label}>Category</label>
            <select id="session-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field.input} required>
              <option value="" disabled>Choose a category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="session-duration" className={field.label}>Length</label>
            <select id="session-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field.input}>
              {durations.map((d) => <option key={d} value={d}>{d} minutes</option>)}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="session-description" className={field.label}>What the mentee gets</label>
          <textarea
            id="session-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={SESSION_LIMITS.description}
            rows={4}
            placeholder="We go through your resume line by line and fix what recruiters skip."
            className={field.textarea}
            aria-describedby="session-description-count"
            required
          />
          <p id="session-description-count" className={field.hint}>{description.length} / {SESSION_LIMITS.description.toLocaleString('en-IN')} characters</p>
        </div>

        <div>
          <label htmlFor="session-price" className={field.label}>Price (₹)</label>
          <input
            id="session-price"
            type="number"
            inputMode="numeric"
            min={SESSION_LIMITS.minPrice}
            max={SESSION_LIMITS.maxPrice}
            step="1"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            placeholder="499"
            className={field.input}
            aria-describedby="session-price-hint"
            required
          />
          <p id="session-price-hint" className={field.hint}>The mentee pays this when booking. It’s held until the session is done, then paid to your earnings.</p>
        </div>

        {error && <p role="alert" className={field.error}>{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={btn.secondary}>Cancel</button>
          <button type="submit" disabled={saving} className={btn.primary}>
            {saving ? 'Saving…' : session ? 'Save changes' : 'Publish session'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Bookings                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

function BookingsList({ bookings, onChange }: { bookings: Booking[]; onChange: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [linkFor, setLinkFor] = useState<Booking | null>(null);
  const sorted = useMemo(() => sortBookings(bookings), [bookings]);

  const setStatus = async (b: Booking, status: 'completed' | 'cancelled') => {
    setBusyId(b.id);
    try {
      await api.patch(`/mentorships/bookings/${b.id}/status?status=${status}`);
      if (status === 'completed') {
        notify.success('Marked as done. You’re paid when the mentee confirms, or automatically after 24 hours.');
      } else {
        notify.info('Session cancelled. The mentee is being refunded.');
      }
      onChange();
    } catch (e) {
      notify.error(e, 'The booking couldn’t be updated.');
    } finally {
      setBusyId(null);
      setCancelling(null);
    }
  };

  if (bookings.length === 0) {
    return (
      <div className="km-card">
        <EmptyState
          icon={UsersThreeIcon}
          title="No bookings yet"
          description="When a mentee books one of your sessions it shows up here. Their payment is held until the session is done."
        />
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {sorted.map((b) => {
          const info = BOOKING_STATUS[b.status] ?? { label: b.status, tone: 'neutral' as const };
          const busy = busyId === b.id;
          const started = new Date(b.scheduled_at).getTime() <= Date.now();
          const canCancel = b.status === 'pending' || b.status === 'confirmed';
          return (
            <li key={b.id} className="km-card p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex gap-3.5 items-start min-w-0">
                <div className="w-10 h-10 bg-km-surface text-km-mentors-text rounded-xl flex items-center justify-center shrink-0 font-semibold" aria-hidden="true">
                  {b.mentee_name ? b.mentee_name.charAt(0).toUpperCase() : <UserIcon size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-km-heading">{b.mentee_name || 'Mentee'}</h3>
                    <StatusBadge tone={info.tone}>{info.label}</StatusBadge>
                  </div>
                  <p className="text-sm text-km-text-secondary truncate">{b.mentorship_title || 'Mentorship session'}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-km-text-secondary">
                    <span className="flex items-center gap-1.5">
                      <CalendarBlankIcon size={16} aria-hidden="true" />
                      <time dateTime={b.scheduled_at}>{sessionTime(b.scheduled_at)}</time>
                    </span>
                    <span className="font-semibold text-km-heading tabular-nums">{price(b.amount)}</span>
                  </p>
                  {b.notes && <p className="mt-1.5 text-sm text-km-text-secondary"><span className="font-medium text-km-heading">Note: </span>{b.notes}</p>}
                  {info.next && (
                    <p className="mt-1.5 text-xs text-km-text-secondary">
                      {info.next}
                      {b.status === 'confirmed' && !started && ' You can mark it done once it starts.'}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
                {b.status === 'confirmed' && (
                  b.meeting_link ? (
                    <>
                      <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
                        <VideoCameraIcon size={16} aria-hidden="true" /> Join call <ArrowSquareOutIcon size={14} aria-hidden="true" />
                      </a>
                      <button type="button" onClick={() => setLinkFor(b)} className={btn.ghost}>Change link</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setLinkFor(b)} className={btn.secondary}>
                      <LinkSimpleIcon size={16} aria-hidden="true" /> Add meeting link
                    </button>
                  )
                )}

                {b.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => setStatus(b, 'completed')}
                    disabled={busy || !started}
                    className={btn.primary}
                  >
                    <CheckCircleIcon size={16} weight="bold" aria-hidden="true" /> Mark as done
                  </button>
                )}

                {canCancel && (
                  <button type="button" onClick={() => setCancelling(b)} disabled={busy} className={cx(btn.ghost, 'hover:text-red-600')}>
                    {b.status === 'pending' ? 'Decline' : 'Cancel'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {cancelling && (
        <ConfirmDialog
          title={cancelling.status === 'pending' ? 'Decline this request?' : 'Cancel this session?'}
          description={cancelling.status === 'pending'
            ? 'The mentee is told you can’t take this request.'
            : <>The mentee gets a full refund of {price(cancelling.amount)} and you won’t be paid for this session.</>}
          confirmLabel={cancelling.status === 'pending' ? 'Decline' : 'Cancel session'}
          busy={busyId === cancelling.id}
          onCancel={() => setCancelling(null)}
          onConfirm={() => setStatus(cancelling, 'cancelled')}
        />
      )}

      {linkFor && <MeetingLinkForm booking={linkFor} onClose={() => setLinkFor(null)} onSaved={() => { setLinkFor(null); onChange(); }} />}
    </>
  );
}

function MeetingLinkForm({ booking, onClose, onSaved }: { booking: Booking; onClose: () => void; onSaved: () => void }) {
  const [link, setLink] = useState(booking.meeting_link ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = link.trim();
    if (!/^https:\/\/\S+\.\S+/.test(value)) {
      setError('Paste the full link, starting with https://');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/mentorships/bookings/${booking.id}/meeting-link`, { meeting_link: value });
      notify.success('Meeting link saved. The mentee can see it now.');
      onSaved();
    } catch (err) {
      notify.error(err, 'The meeting link couldn’t be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal isOpen onClose={() => !saving && onClose()} title="Meeting link">
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-km-text-secondary">
          For your session with {booking.mentee_name || 'the mentee'} on {sessionTime(booking.scheduled_at)}. Only the mentee sees this link.
        </p>
        <div>
          <label htmlFor="meeting-link" className={field.label}>Google Meet, Zoom or Teams link</label>
          <input
            id="meeting-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            className={field.input}
            aria-invalid={!!error}
            aria-describedby={error ? 'meeting-link-error' : undefined}
            autoFocus
          />
          {error && <p id="meeting-link-error" role="alert" className={field.error}>{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={btn.secondary}>Cancel</button>
          <button type="submit" disabled={saving || !link.trim()} className={btn.primary}>{saving ? 'Saving…' : 'Save link'}</button>
        </div>
      </form>
    </AdminModal>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* Weekly hours                                                                                      */
/* ------------------------------------------------------------------------------------------------ */

const DAYS = [
  { day: 1, name: 'Monday' },
  { day: 2, name: 'Tuesday' },
  { day: 3, name: 'Wednesday' },
  { day: 4, name: 'Thursday' },
  { day: 5, name: 'Friday' },
  { day: 6, name: 'Saturday' },
  { day: 0, name: 'Sunday' },
];

function WeeklyHours({ saved, onSaved }: { saved: Slot[]; onSaved: () => void }) {
  const fromSaved = useCallback(() => DAYS.map(({ day, name }) => {
    const slot = saved.find((s) => s.day_of_week === day);
    return { day, name, on: !!slot, start: slot?.start_time || '09:00', end: slot?.end_time || '17:00' };
  }), [saved]);

  const [week, setWeek] = useState(fromSaved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setWeek(fromSaved()); }, [fromSaved]);

  const update = (day: number, change: Partial<(typeof week)[number]>) =>
    setWeek((prev) => prev.map((d) => (d.day === day ? { ...d, ...change } : d)));

  const dirty = JSON.stringify(week) !== JSON.stringify(fromSaved());
  const onDays = week.filter((d) => d.on);

  const save = async () => {
    if (onDays.length === 0) {
      setError('Turn on at least one day.');
      return;
    }
    const bad = onDays.find((d) => d.start >= d.end);
    if (bad) {
      setError(`${bad.name}: the end time must be after the start time.`);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.put('/mentorships/availability', onDays.map((d) => ({ day_of_week: d.day, start_time: d.start, end_time: d.end })));
      notify.success('Weekly hours saved.');
      onSaved();
    } catch (e) {
      notify.error(e, 'Your hours couldn’t be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="km-card p-5 md:p-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-km-heading">Weekly hours</h2>
          <p className="text-sm text-km-text-secondary mt-1">Mentees can book you only inside these times. Times are in IST.</p>
        </div>
        <button
          type="button"
          onClick={() => setWeek((prev) => prev.map((d) => ({ ...d, on: d.day >= 1 && d.day <= 5, start: '09:00', end: '17:00' })))}
          className={cx(btn.secondary, 'self-start shrink-0')}
        >
          Weekdays, 9 to 5
        </button>
      </div>

      <ul className="divide-y divide-km-border-subtle">
        {week.map((d) => (
          <li key={d.day} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
            <div className="sm:w-40 flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={d.on}
                aria-label={`Available on ${d.name}`}
                onClick={() => update(d.day, { on: !d.on })}
                className={cx('w-11 h-6 rounded-full p-0.5 transition-colors shrink-0', d.on ? 'bg-km-mentors' : 'bg-km-border')}
              >
                <span className={cx('block w-5 h-5 bg-white rounded-full shadow-sm transition-transform', d.on ? 'translate-x-5' : 'translate-x-0')} />
              </button>
              <span className={cx('text-sm font-semibold', d.on ? 'text-km-heading' : 'text-km-text-secondary')}>{d.name}</span>
            </div>

            {d.on ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={d.start}
                  onChange={(e) => update(d.day, { start: e.target.value })}
                  aria-label={`${d.name} start time`}
                  className={cx(field.input, 'w-32')}
                />
                <span className="text-sm text-km-text-secondary">to</span>
                <input
                  type="time"
                  value={d.end}
                  onChange={(e) => update(d.day, { end: e.target.value })}
                  aria-label={`${d.name} end time`}
                  className={cx(field.input, 'w-32')}
                />
              </div>
            ) : (
              <span className="text-sm text-km-text-secondary">Not available</span>
            )}
          </li>
        ))}
      </ul>

      {error && <p role="alert" className={cx(field.error, 'mt-3')}>{error}</p>}

      <div className="mt-5 pt-4 border-t border-km-border-subtle flex flex-col-reverse sm:flex-row justify-end gap-2">
        <button type="button" onClick={() => { setWeek(fromSaved()); setError(''); }} disabled={saving || !dirty} className={btn.ghost}>
          Undo changes
        </button>
        <button type="button" onClick={save} disabled={saving || !dirty} className={btn.primary}>
          <CheckIcon size={16} weight="bold" aria-hidden="true" /> {saving ? 'Saving…' : 'Save hours'}
        </button>
      </div>
    </div>
  );
}
