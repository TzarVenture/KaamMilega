'use client';

import { useEffect, useRef } from 'react';
import api from './axios';
import { getCurrentUser } from './auth';

// Feed post impressions. A post counts when at least half of it stays on screen for a moment.
// The browser only sends post IDs: the server looks up each author, counts every member (and
// every signed-out visitor, by an anonymous cookie the feed sets) once a day per post, and never
// counts authors seeing their own posts.

const DWELL_MS = 800;
const FLUSH_AFTER_MS = 5_000;
const BATCH_SIZE = 30; // the server's limit per request

// Posts already sent during this page session
const sent = new Set<string>();
const queue: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function endpoint(path: string): string {
  return `${api.defaults.baseURL ?? ''}${path}`;
}

/** A background POST that never disturbs the page and survives the tab closing */
function beacon(path: string, body?: unknown): void {
  void fetch(endpoint(path), {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    // Telemetry never disturbs the page
  });
}

// Profiles already counted during this page session
const viewedProfiles = new Set<string>();

/**
 * Counts a visit to someone else's profile page. Call it once the profile has loaded and is
 * shown; the server counts each member once a day and shows them the way they chose in
 * settings. Loading a member's details anywhere else is not a view.
 */
export function recordProfileView(profileId: string): void {
  const me = getCurrentUser();
  const myId = me?.id || me?._id;
  if (!profileId || !myId || myId === profileId || viewedProfiles.has(profileId)) return;
  viewedProfiles.add(profileId);
  beacon(`/user/${encodeURIComponent(profileId)}/view`);
}

/**
 * Sends what is queued. fetch with keepalive also survives the tab closing; it's used instead
 * of the axios instance so a background beacon can never trigger the sign-in redirect.
 */
export function flushImpressions(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length > 0) {
    beacon('/feed/impressions', { post_ids: queue.splice(0, BATCH_SIZE) });
  }
}

function recordImpression(postId: string): void {
  if (sent.has(postId)) return;
  sent.add(postId);
  queue.push(postId);
  if (queue.length >= BATCH_SIZE) {
    flushImpressions();
    return;
  }
  if (!timer) timer = setTimeout(flushImpressions, FLUSH_AFTER_MS);
}

if (typeof window !== 'undefined') {
  // pagehide also fires on mobile browsers that never fire beforeunload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushImpressions();
  });
  window.addEventListener('pagehide', flushImpressions);
}

/**
 * Watches a feed post and records an impression once it has been at least half on screen for
 * a moment. The post's own author is skipped; signed-out visitors count too.
 */
export function usePostImpression<T extends HTMLElement = HTMLElement>(postId: string, authorId: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window) || sent.has(postId)) return;
    const me = getCurrentUser();
    const myId = me?.id || me?._id;
    if (myId && myId === authorId) return;

    let dwell: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Half the post, or half the screen for a post taller than two screens
        const seen = entry?.isIntersecting && (entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.5);
        if (seen) {
          dwell ??= setTimeout(() => {
            recordImpression(postId);
            observer.disconnect();
          }, DWELL_MS);
        } else if (dwell) {
          clearTimeout(dwell);
          dwell = null;
        }
      },
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75, 1] },
    );
    observer.observe(el);
    return () => {
      if (dwell) clearTimeout(dwell);
      observer.disconnect();
    };
  }, [postId, authorId]);

  return ref;
}
