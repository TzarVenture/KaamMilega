'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { getCurrentUser, type StoredUser } from '@/lib/auth';
import { PROFILE_UPDATED_EVENT } from '@/lib/profileStrength';

/**
 * The signed-in member from the saved session, read after mount so the server render and the
 * first client render match. Updates when the profile changes in another component.
 */
export function useFeedUser(): { user: StoredUser | null; ready: boolean } {
  const [state, setState] = useState<{ user: StoredUser | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    const read = () => setState({ user: getCurrentUser(), ready: true });
    read();
    window.addEventListener(PROFILE_UPDATED_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);
  return state;
}

export function displayName(user: StoredUser | null): string {
  if (!user) return '';
  return (user.name || `${user.first_name ?? ''} ${user.last_name ?? ''}`).trim();
}

// Digits stay 0-9 in every language, as everywhere else on the site
const latin = (locale: string) => `${locale}-u-nu-latn`;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['minute', 60],
  ['hour', 60 * 60],
  ['day', 24 * 60 * 60],
];

/**
 * "5 min ago", "3 hr ago", "2 days ago" in the page's language; older than a week shows the
 * date. Re-renders once a minute so fresh posts don't keep saying "just now".
 */
export function useRelativeTime(iso: string): { label: string; full: string } {
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return relativeTime(iso, locale, now);
}

export function relativeTime(iso: string, pageLocale: string, now = Date.now()): { label: string; full: string } {
  const locale = latin(pageLocale);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { label: '', full: '' };
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 60) {
    return { label: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second'), full };
  }
  if (seconds < 7 * 24 * 60 * 60) {
    let unit: Intl.RelativeTimeFormatUnit = 'minute';
    let size = 60;
    for (const [u, s] of UNITS) {
      if (seconds >= s) {
        unit = u;
        size = s;
      }
    }
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    return { label: rtf.format(-Math.floor(seconds / size), unit), full };
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  const label = new Intl.DateTimeFormat(locale, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  return { label, full };
}

/** 1,234 → "1.2K" in the page's language */
export function compactNumber(n: number, locale: string): string {
  return new Intl.NumberFormat(latin(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Locks page scroll while a dialog or sheet is open */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [active]);
}

/** Width and height of a picked photo, for a layout that doesn't jump while it loads */
export async function imageSize(file: Blob): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return {};
  }
}
