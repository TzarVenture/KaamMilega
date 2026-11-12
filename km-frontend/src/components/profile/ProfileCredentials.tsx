'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowSquareOutIcon,
  CertificateIcon,
  CheckIcon,
  ClockIcon,
  FileTextIcon,
  PencilSimpleIcon,
  PlusIcon,
  SealCheckIcon,
  TrashIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import UserAvatar from '@/components/ui/UserAvatar';
import FileLink from '@/components/ui/FileLink';
import FeedDialog, { ConfirmDialog } from '@/components/feed/FeedDialog';
import CertificationModal from '@/components/profile/CertificationModal';
import { credentialsApi, monthLabel, type Byline, type Certification, type ProfileCredentials as Data, type SkillView } from '@/lib/api/credentials';
import { notify } from '@/lib/notify';
import { useFeedUser } from '@/components/feed/feedUtils';

const SKILLS_SHOWN = 6;

interface Props {
  userId: string;
  /** The skills on the user record, so the list updates as soon as one is added or removed */
  skills: string[];
  isOwner: boolean;
  /** For "Connect with Asha to endorse their skills" */
  firstName?: string;
  onAddSkill?: () => void;
  onRemoveSkill?: (skill: string) => void;
  removingSkill?: string | null;
}

/** Skills with endorsements, and licences and certificates, for a profile page */
export default function ProfileCredentials({ userId, skills, isOwner, firstName, onAddSkill, onRemoveSkill, removingSkill }: Props) {
  const [data, setData] = useState<Data | null>(null);
  const skillsKey = skills.join('\n');

  // If it fails, the skill names still show from the profile; only the proof is missing
  const load = useCallback(
    () => credentialsApi.profile(userId).then(setData, () => setData(null)),
    [userId],
  );

  // Reloads when a skill is added or removed, so new skills pick up their proof
  useEffect(() => {
    let live = true;
    credentialsApi.profile(userId).then(
      (d) => live && setData(d),
      () => live && setData(null),
    );
    return () => {
      live = false;
    };
  }, [userId, skillsKey]);

  return (
    <>
      <SkillsSection
        userId={userId}
        skills={skills}
        data={data}
        setData={setData}
        isOwner={isOwner}
        firstName={firstName}
        onAddSkill={onAddSkill}
        onRemoveSkill={onRemoveSkill}
        removingSkill={removingSkill}
      />
      <CertificationsSection skills={skills} data={data} isOwner={isOwner} reload={load} />
    </>
  );
}

// ─── Skills ─────────────────────────────────────────────────────────────────────

function SkillsSection({ userId, skills, data, setData, isOwner, firstName, onAddSkill, onRemoveSkill, removingSkill }: Props & {
  data: Data | null;
  setData: React.Dispatch<React.SetStateAction<Data | null>>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [listFor, setListFor] = useState<string | null>(null);

  // Proof from the server where it has loaded, otherwise just the names
  const views: SkillView[] = skills.map(
    (name) =>
      data?.skills.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) ?? {
        name, endorsements: 0, endorsed_by_me: false, endorsers: [], certified: false,
      },
  );
  const shown = showAll ? views : views.slice(0, SKILLS_SHOWN);
  const canEndorse = !!data?.can_endorse;

  const toggle = async (skill: SkillView) => {
    if (busy) return;
    setBusy(skill.name);
    const was = skill.endorsed_by_me;
    const patch = (endorsed: boolean, delta: number) =>
      setData((d) => d && {
        ...d,
        skills: d.skills.map((s) => (s.name === skill.name ? { ...s, endorsed_by_me: endorsed, endorsements: Math.max(0, s.endorsements + delta) } : s)),
      });
    patch(!was, was ? -1 : 1);
    try {
      if (was) await credentialsApi.unendorse(userId, skill.name);
      else await credentialsApi.endorse(userId, skill.name);
      // Picks up the endorser list with the viewer in it
      setData(await credentialsApi.profile(userId));
    } catch (err) {
      patch(was, was ? 1 : -1);
      notify.error(err, was ? "Couldn't remove your endorsement" : "Couldn't endorse this skill");
    } finally {
      setBusy(null);
    }
  };

  if (!isOwner && skills.length === 0) return null;

  return (
    <section id="skills" className="bg-km-surface-card rounded-xl p-6 border border-km-border shadow-sm scroll-mt-24">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-km-heading">Skills</h2>
          {isOwner && <p className="text-[13px] text-km-text-secondary mt-0.5">Your connections can endorse these. A verified certificate adds a Certified badge.</p>}
        </div>
        {isOwner && onAddSkill && (
          <button type="button" onClick={onAddSkill} className="btn-outline h-9 px-3 text-sm shrink-0">
            <PlusIcon weight="bold" size={15} aria-hidden="true" /> Add skill
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <p className="text-sm text-km-text-secondary">No skills added yet.</p>
      ) : (
        <ul className="divide-y divide-km-border">
          {shown.map((s) => (
            <li key={s.name} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-km-heading">
                  {s.name}
                  {s.certified && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-km-link">
                      <SealCheckIcon size={15} weight="fill" aria-hidden="true" /> Certified
                    </span>
                  )}
                </p>
                {s.endorsements > 0 ? (
                  <button
                    type="button"
                    onClick={() => setListFor(s.name)}
                    className="mt-1.5 flex items-center gap-2 text-[13px] text-km-text-secondary hover:text-km-link cursor-pointer"
                  >
                    <span className="flex -space-x-1.5" aria-hidden="true">
                      {s.endorsers.map((b) => (
                        <span key={b.id} className="w-5 h-5 rounded-full overflow-hidden border-2 border-km-surface-card bg-km-surface">
                          <UserAvatar src={b.avatar} name={b.name} />
                        </span>
                      ))}
                    </span>
                    {endorsedBy(s)}
                  </button>
                ) : (
                  isOwner && <p className="mt-1 text-[13px] text-km-text-muted">No endorsements yet</p>
                )}
              </div>

              {canEndorse && (
                <button
                  type="button"
                  onClick={() => void toggle(s)}
                  disabled={busy === s.name}
                  aria-pressed={s.endorsed_by_me}
                  className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-semibold cursor-pointer disabled:opacity-60 transition-colors ${
                    s.endorsed_by_me
                      ? 'border-km-link bg-km-link text-white hover:opacity-90'
                      : 'border-km-border text-km-heading hover:border-km-link hover:text-km-link'
                  }`}
                >
                  {s.endorsed_by_me ? <CheckIcon size={14} weight="bold" aria-hidden="true" /> : <PlusIcon size={14} weight="bold" aria-hidden="true" />}
                  {s.endorsed_by_me ? 'Endorsed' : 'Endorse'}
                </button>
              )}
              {isOwner && onRemoveSkill && (
                <button
                  type="button"
                  onClick={() => onRemoveSkill(s.name)}
                  disabled={removingSkill === s.name}
                  aria-label={`Remove ${s.name}`}
                  className="shrink-0 p-1.5 rounded-lg text-km-text-secondary hover:text-red-600 hover:bg-km-surface cursor-pointer disabled:opacity-50 dark:hover:text-red-400"
                >
                  <XIcon size={16} weight="bold" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {views.length > SKILLS_SHOWN && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-4 text-sm font-semibold text-km-link hover:underline cursor-pointer">
          {showAll ? 'Show fewer skills' : `Show all ${views.length} skills`}
        </button>
      )}

      {/* Signed in, not connected: say how endorsing works rather than hiding it */}
      {data && !isOwner && !canEndorse && skills.length > 0 && <EndorseHint firstName={firstName} />}

      <EndorsersDialog userId={userId} skill={listFor} onClose={() => setListFor(null)} />
    </section>
  );
}

function endorsedBy(s: SkillView): string {
  const first = s.endorsers[0]?.name;
  if (!first) return `${s.endorsements} endorsement${s.endorsements === 1 ? '' : 's'}`;
  const others = s.endorsements - 1;
  if (others === 0) return `Endorsed by ${first}`;
  return `Endorsed by ${first} and ${others} other${others === 1 ? '' : 's'}`;
}

function EndorseHint({ firstName }: { firstName?: string }) {
  const { user } = useFeedUser();
  if (!user) return null;
  return (
    <p className="mt-4 text-[13px] text-km-text-secondary">
      Connect with {firstName || 'them'} to endorse their skills.
    </p>
  );
}

function EndorsersDialog({ userId, skill, onClose }: { userId: string; skill: string | null; onClose: () => void }) {
  const [list, setList] = useState<Byline[] | null>(null);

  useEffect(() => {
    if (!skill) return;
    let live = true;
    credentialsApi
      .endorsers(userId, skill)
      .then((r) => live && setList(r.endorsers))
      .catch((err) => {
        notify.error(err, "Couldn't load endorsements");
        onClose();
      });
    return () => {
      live = false;
      setList(null);
    };
  }, [userId, skill, onClose]);

  return (
    <FeedDialog open={skill !== null} onClose={onClose} title={skill ? `Endorsed for ${skill}` : ''}>
      {list === null ? (
        <p className="py-6 text-center text-sm text-km-text-secondary">Loading…</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-1">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/profile/${b.id}`} onClick={onClose} className="flex items-center gap-3 rounded-xl p-2 hover:bg-km-surface">
                <span className="w-10 h-10 rounded-full overflow-hidden bg-km-surface border border-km-border shrink-0">
                  <UserAvatar src={b.avatar} name={b.name} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-sm font-semibold text-km-heading">
                    <span className="truncate">{b.name}</span>
                    {b.is_verified && <SealCheckIcon size={14} weight="fill" className="text-km-link shrink-0" aria-label="Verified" />}
                  </span>
                  {b.headline && <span className="block truncate text-[13px] text-km-text-secondary">{b.headline}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FeedDialog>
  );
}

// ─── Certificates ───────────────────────────────────────────────────────────────

function CertificationsSection({ skills, data, isOwner, reload }: { skills: string[]; data: Data | null; isOwner: boolean; reload: () => Promise<void> }) {
  const [editing, setEditing] = useState<Certification | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Certification | null>(null);
  const [busy, setBusy] = useState(false);
  const certs = data?.certifications ?? [];

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await credentialsApi.deleteCertification(deleting.id);
      notify.success('Certificate removed');
      setDeleting(null);
      await reload();
    } catch (err) {
      notify.error(err, "Couldn't remove the certificate");
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner && certs.length === 0) return null;

  return (
    <section id="certifications" className="bg-km-surface-card rounded-xl p-6 border border-km-border shadow-sm scroll-mt-24">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-km-heading">Licences and certificates</h2>
          {isOwner && <p className="text-[13px] text-km-text-secondary mt-0.5">Add a file, link or ID and our team checks it. Verified ones get a badge.</p>}
        </div>
        {isOwner && (
          <button type="button" onClick={() => setEditing('new')} className="btn-outline h-9 px-3 text-sm shrink-0">
            <PlusIcon weight="bold" size={15} aria-hidden="true" /> Add certificate
          </button>
        )}
      </div>

      {certs.length === 0 ? (
        <p className="text-sm text-km-text-secondary">Add licences and certificates to show what you&apos;ve been trained in.</p>
      ) : (
        <ul className="divide-y divide-km-border">
          {certs.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
              <span className="w-11 h-11 rounded-lg bg-km-surface border border-km-border flex items-center justify-center shrink-0 text-km-heading">
                <CertificateIcon size={22} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-km-heading">{c.name}</p>
                    <p className="text-sm text-km-text-primary">{c.issuer}</p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`} className="p-1.5 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer">
                        <PencilSimpleIcon size={17} />
                      </button>
                      <button type="button" onClick={() => setDeleting(c)} aria-label={`Remove ${c.name}`} className="p-1.5 rounded-lg text-km-text-secondary hover:text-red-600 hover:bg-km-surface cursor-pointer dark:hover:text-red-400">
                        <TrashIcon size={17} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-km-text-secondary">
                  Issued {monthLabel(c.issued_on)}
                  {c.expires_on && (c.expired ? ` · Expired ${monthLabel(c.expires_on)}` : ` · Expires ${monthLabel(c.expires_on)}`)}
                </p>
                {c.credential_id && <p className="text-[13px] text-km-text-secondary">Credential ID {c.credential_id}</p>}

                <StatusLine cert={c} isOwner={isOwner} />

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {c.credential_url && (
                    <a href={c.credential_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-[13px] font-semibold text-km-link hover:underline">
                      Show credential <ArrowSquareOutIcon size={13} aria-hidden="true" />
                    </a>
                  )}
                  {c.file_url && (
                    <FileLink href={c.file_url} className="inline-flex items-center gap-1 text-[13px] font-semibold text-km-link hover:underline">
                      <FileTextIcon size={14} aria-hidden="true" /> View file
                    </FileLink>
                  )}
                </div>
                {c.skills.length > 0 && (
                  <p className="mt-2 text-[13px] text-km-text-secondary">
                    <span className="font-medium text-km-text-primary">Skills:</span> {c.skills.join(', ')}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <CertificationModal
          cert={editing === 'new' ? null : editing}
          open={editing !== null}
          skills={skills}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Remove this certificate?"
        description={deleting?.status === 'verified' ? 'Its Verified badge goes with it. Adding it again means another review.' : undefined}
        confirmLabel="Remove"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}

function StatusLine({ cert, isOwner }: { cert: Certification; isOwner: boolean }) {
  if (cert.status === 'verified') {
    return (
      <p className={`mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold ${cert.expired ? 'text-km-text-secondary' : 'text-km-link'}`}>
        <SealCheckIcon size={15} weight="fill" aria-hidden="true" />
        {cert.expired ? 'Verified, now expired' : 'Verified by KaamMilega'}
      </p>
    );
  }
  if (!isOwner) return null;
  if (cert.status === 'pending') {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-amber-700 dark:text-amber-400">
        <ClockIcon size={15} aria-hidden="true" /> Waiting for review
      </p>
    );
  }
  if (cert.status === 'rejected') {
    return (
      <p className="mt-1.5 flex items-start gap-1 text-[13px] text-red-700 dark:text-red-400">
        <WarningCircleIcon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-semibold">Not verified.</span> {cert.review_note}{cert.review_note && !/[.!?]$/.test(cert.review_note.trim()) ? '.' : ''} Edit it to send it again.
        </span>
      </p>
    );
  }
  return <p className="mt-1.5 text-[13px] text-km-text-muted">Not verified. Add a file, link or ID to get it checked.</p>;
}
