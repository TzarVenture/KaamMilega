import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import PolicyContent, { policySections } from '@/components/policies/PolicyContent';
import { POLICY_SLUGS, policyPath, type Policy, type PolicySlug } from '@/lib/api/policies';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Policies change rarely: pages are rebuilt at most every five minutes
const REVALIDATE_SECONDS = 300;

/** The footer's names for each policy, used until one is published and for the links below it */
const NAME_KEYS: Record<PolicySlug, 'userTerms' | 'employerTerms' | 'privacy' | 'guidelines'> = {
  terms: 'userTerms',
  'employer-terms': 'employerTerms',
  privacy: 'privacy',
  'community-guidelines': 'guidelines',
};

function isSlug(s: string): s is PolicySlug {
  return (POLICY_SLUGS as string[]).includes(s);
}

/** The published policy, or null when it hasn't been published (or the API can't be reached) */
async function load(slug: PolicySlug): Promise<Policy | null> {
  try {
    const res = await fetch(`${apiUrl}/api/policies/${slug}`, { next: { revalidate: REVALIDATE_SECONDS } });
    return res.ok ? ((await res.json()) as Policy) : null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isSlug(slug)) return {};
  const [policy, t] = await Promise.all([load(slug), getTranslations('footer')]);
  return { title: `${policy?.title ?? t(NAME_KEYS[slug])} | KaamMilega` };
}

export default async function PolicyPage({ params }: Props) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();

  const [policy, t, names, format] = await Promise.all([
    load(slug),
    getTranslations('policies'),
    getTranslations('footer'),
    getFormatter(),
  ]);
  const title = policy?.title ?? names(NAME_KEYS[slug]);
  const sections = policy ? policySections(policy.content) : [];

  return (
    <main className="min-h-screen bg-km-surface">
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="border-b border-km-border pb-6">
          <h1 className="text-2xl font-semibold text-km-heading sm:text-3xl">{title}</h1>
          {policy?.published_at && (
            <p className="mt-2 text-sm text-km-text-secondary">
              {t('lastUpdated', { date: format.dateTime(new Date(policy.published_at), { day: 'numeric', month: 'long', year: 'numeric' }) })}
            </p>
          )}
        </header>

        {policy ? (
          <>
            {sections.length >= 3 && (
              <nav aria-label={t('contents')} className="mt-6 rounded-2xl border border-km-border bg-km-surface-card p-5">
                <p className="text-sm font-semibold text-km-heading">{t('contents')}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm marker:text-km-text-muted">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <a href={`#${s.id}`} className="text-km-link hover:underline">{s.title}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
            <PolicyContent source={policy.content} className="mt-6" />
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-km-border bg-km-surface-card p-6">
            <p className="font-semibold text-km-heading">{t('notPublishedTitle')}</p>
            <p className="mt-1 text-sm text-km-text-secondary">{t('notPublished')}</p>
            <Link href="/support" className="mt-4 inline-flex text-sm font-semibold text-km-link hover:underline">
              {t('contactSupport')}
            </Link>
          </div>
        )}

        <nav aria-label={t('otherPolicies')} className="mt-12 border-t border-km-border pt-6">
          <p className="text-sm font-semibold text-km-heading">{t('otherPolicies')}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {POLICY_SLUGS.filter((s) => s !== slug).map((s) => (
              <li key={s}>
                <Link href={policyPath(s)} className="text-km-link hover:underline">{names(NAME_KEYS[s])}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </main>
  );
}
