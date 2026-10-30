"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BankIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  FileArrowUpIcon,
  FileTextIcon,
  IdentificationCardIcon,
  LockKeyIcon,
  MedalIcon,
  SealCheckIcon,
  TicketIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import { isAuthenticated } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { uploadFile, UPLOAD_LIMITS } from "@/lib/upload";
import PageHero, { HeroAccent } from "@/components/km/PageHero";
import InstantPassModal from "@/components/instant-milega/InstantPassModal";

/**
 * Becoming an Expert (client Q&A Q8–Q12): at least 2 years of experience, the ₹99 pass,
 * Aadhaar + PAN + payout details, then our team reviews the application the same day.
 */

interface ExpertKYC {
  aadhaar_last4: string;
  pan_masked: string;
  payout_method: "bank" | "upi";
  account_holder: string;
  account_last4?: string;
  ifsc?: string;
  upi_id?: string;
  submitted_at: string;
  rejection_reason?: string;
}

interface ApplicationStatus {
  status: "" | "pending" | "approved" | "rejected";
  experience_years: number;
  min_years: number;
  has_pass: boolean;
  categories: string[];
  expert_category?: string;
  expert_bio?: string;
  expert_pricing?: number;
  kyc?: ExpertKYC;
}

interface UploadedDoc {
  url: string;
  name: string;
  size: number;
}

const STEPS = ["Eligibility", "Expertise", "Identity", "Payouts"] as const;

const INPUT =
  "block w-full rounded-xl border border-km-border bg-km-surface-card px-3.5 py-2.5 text-sm text-km-heading placeholder:text-km-text-muted focus:outline-none focus:ring-2 focus:ring-km-link/30 focus:border-km-link";
const LABEL = "block text-sm font-semibold text-km-heading mb-1.5";
const HINT = "mt-1.5 text-xs text-km-text-secondary";

const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);
const groupAadhaar = (v: string) => v.replace(/(\d{4})(?=\d)/g, "$1 ");
// Verhoeff checksum, the same rule UIDAI and the backend use, so typos are caught on this step
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const validAadhaar = (v: string) =>
  /^[2-9]\d{11}$/.test(v) &&
  v.split("").reverse().reduce((c, ch, i) => VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(ch)]], 0) === 0;
// Server codes that belong to the Identity step
const IDENTITY_CODES = ["AADHAAR_INVALID", "PAN_INVALID", "KYC_DOCUMENT_REQUIRED"];
const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function ExpertApplyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<ApplicationStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [passOpen, setPassOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [category, setCategory] = useState("");
  const [bio, setBio] = useState("");
  const [price, setPrice] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [aadhaarDoc, setAadhaarDoc] = useState<UploadedDoc | null>(null);
  const [panDoc, setPanDoc] = useState<UploadedDoc | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "upi">("bank");
  const [holder, setHolder] = useState("");
  const [account, setAccount] = useState("");
  const [confirmAccount, setConfirmAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [upi, setUpi] = useState("");
  const [consent, setConsent] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = (await api.get("/user/expert-application")) as unknown as ApplicationStatus;
      setApp(res);
      setCategory((c) => c || res.expert_category || "");
      setBio((b) => b || res.expert_bio || "");
      setPrice((p) => p || (res.expert_pricing ? String(res.expert_pricing) : ""));
    } catch (err) {
      notify.error(err, "Could not load your application. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?redirect=/expert/apply");
      return;
    }
    load();
  }, [load, router]);

  const eligible = !!app && app.experience_years >= app.min_years;
  const showForm = !!app && (app.status === "" || (app.status === "rejected" && editing));

  const stepError = (s: number): string | null => {
    if (s === 0) {
      if (!eligible) return "Add at least 2 years of work experience on your profile first.";
      if (!app?.has_pass) return "Get the ₹99 pass to continue.";
    }
    if (s === 1) {
      if (!category) return "Choose your expertise area.";
      if (bio.trim().length < 50) return "Write at least 50 characters about your expertise.";
      const p = Number(price);
      if (!p || p < 99 || p > 50000) return "Set a session price between ₹99 and ₹50,000.";
    }
    if (s === 2) {
      if (aadhaar.length !== 12) return "Enter your 12-digit Aadhaar number.";
      if (!validAadhaar(aadhaar)) return "This Aadhaar number isn't valid. Please check it.";
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) return "Enter a valid PAN, like ABCDE1234F.";
      if (!aadhaarDoc || !panDoc) return "Upload both your Aadhaar and PAN card.";
    }
    if (s === 3) {
      if (!holder.trim()) return "Enter the account holder's name.";
      if (payoutMethod === "bank") {
        if (!/^\d{9,18}$/.test(account)) return "Enter a valid bank account number.";
        if (account !== confirmAccount) return "The two account numbers don't match.";
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return "Enter a valid IFSC code, like SBIN0001234.";
      } else if (!/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(upi)) {
        return "Enter a valid UPI ID, like name@bank.";
      }
      if (!consent) return "Confirm that the details and documents are yours.";
    }
    return null;
  };

  const next = () => {
    const err = stepError(step);
    if (err) return notify.error(err);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length; s++) {
      const err = stepError(s);
      if (err) {
        setStep(s);
        return notify.error(err);
      }
    }
    setSubmitting(true);
    try {
      await api.post("/user/apply-expert", {
        expert_category: category,
        expert_bio: bio.trim(),
        expert_pricing: Number(price),
        aadhaar_number: aadhaar,
        pan_number: pan,
        aadhaar_doc_url: aadhaarDoc?.url,
        pan_doc_url: panDoc?.url,
        payout_method: payoutMethod,
        account_holder: holder.trim(),
        account_number: payoutMethod === "bank" ? account : "",
        confirm_account_number: payoutMethod === "bank" ? confirmAccount : "",
        ifsc: payoutMethod === "bank" ? ifsc : "",
        upi_id: payoutMethod === "upi" ? upi.trim() : "",
      });
      // Identity numbers are not kept in the browser after submitting
      setAadhaar("");
      setPan("");
      setAccount("");
      setConfirmAccount("");
      setEditing(false);
      notify.success("Application submitted. We'll review it today.");
      await load();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (IDENTITY_CODES.includes((err as { code?: string })?.code ?? "")) setStep(2);
      notify.error(err, "Could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-km-surface pb-16 sm:pb-20">
      <PageHero
        width="max-w-5xl"
        kicker={{ label: "Become a KaamMilega Expert", Icon: MedalIcon, tone: "experts" }}
        title={<>Share your experience. <HeroAccent>Get paid for it.</HeroAccent></>}
        description="Host paid 1-on-1 sessions at your own price. One ₹99 pass, quick KYC, approval the same day."
        highlights={[
          { Icon: TicketIcon, label: "One ₹99 pass" },
          { Icon: ClockIcon, label: "Same-day review" },
          { Icon: SealCheckIcon, label: "Verified badge" },
        ]}
      />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        {loading || !app ? (
          <div className="h-64 rounded-3xl bg-km-surface-card border border-km-border animate-pulse" />
        ) : app.status === "approved" ? (
          <StatusCard
            tone="success"
            Icon={SealCheckIcon}
            title="You're a verified Expert"
            body="Your profile shows the Verified badge. Create your sessions and set your availability to start taking bookings."
            action={<PrimaryLink href="/expert/mentorship">Open Expert dashboard</PrimaryLink>}
          />
        ) : app.status === "pending" ? (
          <StatusCard
            tone="info"
            Icon={ClockIcon}
            title="Your application is under review"
            body="Our team checks applications the same day. We'll notify you as soon as it's done."
          >
            {app.kyc && <Summary app={app} />}
          </StatusCard>
        ) : app.status === "rejected" && !editing ? (
          <StatusCard
            tone="warning"
            Icon={WarningCircleIcon}
            title="Your application needs changes"
            body={app.kyc?.rejection_reason ? `Reason: ${app.kyc.rejection_reason}` : "Please review your details and apply again."}
            action={
              <button type="button" onClick={() => { setEditing(true); setStep(0); }} className={PRIMARY_BTN}>
                Update and resubmit <ArrowRightIcon weight="bold" size={16} aria-hidden="true" />
              </button>
            }
          />
        ) : null}

        {showForm && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            <div className="lg:col-span-8">
              <Stepper step={step} onJump={(s) => s < step && setStep(s)} />

              <div className="mt-5 rounded-3xl border border-km-border bg-km-surface-card p-5 sm:p-7">
                {step === 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-km-heading">Check you&apos;re eligible</h2>
                    <p className="mt-1 text-sm text-km-text-secondary">Both are needed before you apply.</p>
                    <div className="mt-5 space-y-3">
                      <Requirement
                        done={eligible}
                        Icon={BriefcaseIcon}
                        title="At least 2 years of work experience"
                        detail={
                          eligible
                            ? `${app.experience_years.toFixed(1)} years on your profile`
                            : `${app.experience_years.toFixed(1)} years on your profile. Add your past jobs to continue.`
                        }
                        action={!eligible && <SecondaryLink href="/profile">Add experience</SecondaryLink>}
                      />
                      <Requirement
                        done={app.has_pass}
                        Icon={TicketIcon}
                        title="Active ₹99 pass"
                        detail={app.has_pass ? "Your pass is active" : "One pass covers Expert listing, chats, mentors and InstantMilega"}
                        action={
                          !app.has_pass && (
                            <button type="button" onClick={() => setPassOpen(true)} className={SECONDARY_BTN}>
                              Get pass for ₹99
                            </button>
                          )
                        }
                      />
                    </div>
                    <div className="mt-6 rounded-2xl bg-km-surface p-4">
                      <p className="text-sm font-semibold text-km-heading">Keep these ready</p>
                      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-km-text-secondary">
                        <li className="flex items-center gap-2"><IdentificationCardIcon size={18} className="text-km-mentors shrink-0" aria-hidden="true" />Aadhaar card</li>
                        <li className="flex items-center gap-2"><FileTextIcon size={18} className="text-km-mentors shrink-0" aria-hidden="true" />PAN card</li>
                        <li className="flex items-center gap-2"><BankIcon size={18} className="text-km-mentors shrink-0" aria-hidden="true" />Bank or UPI details</li>
                      </ul>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-km-heading">Your expertise</h2>
                      <p className="mt-1 text-sm text-km-text-secondary">This is what people see on your Expert profile.</p>
                    </div>
                    <div>
                      <label htmlFor="category" className={LABEL}>Expertise area</label>
                      <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                        <option value="">Choose one</option>
                        {app.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="bio" className={LABEL}>How you help people</label>
                      <textarea
                        id="bio"
                        rows={5}
                        maxLength={1000}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="e.g. 8 years as a hiring manager in retail. I help freshers prepare for interviews and choose their first role."
                        className={INPUT}
                      />
                      <p className={HINT}>{bio.trim().length}/1000 characters, at least 50</p>
                    </div>
                    <div>
                      <label htmlFor="price" className={LABEL}>Price per session</label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-km-text-secondary">₹</span>
                        <input
                          id="price"
                          inputMode="numeric"
                          value={price}
                          onChange={(e) => setPrice(digits(e.target.value, 5))}
                          placeholder="499"
                          className={`${INPUT} pl-8`}
                        />
                      </div>
                      <p className={HINT}>Between ₹99 and ₹50,000. You keep 100% of it.</p>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-km-heading">Verify your identity</h2>
                      <p className="mt-1 text-sm text-km-text-secondary">Only our verification team sees your documents.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="aadhaar" className={LABEL}>Aadhaar number</label>
                        <input
                          id="aadhaar"
                          inputMode="numeric"
                          autoComplete="off"
                          value={groupAadhaar(aadhaar)}
                          onChange={(e) => setAadhaar(digits(e.target.value, 12))}
                          placeholder="1234 5678 9012"
                          className={`${INPUT} tracking-wider`}
                        />
                      </div>
                      <div>
                        <label htmlFor="pan" className={LABEL}>PAN</label>
                        <input
                          id="pan"
                          autoComplete="off"
                          value={pan}
                          onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                          placeholder="ABCDE1234F"
                          className={`${INPUT} tracking-wider`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DocUpload label="Aadhaar card" value={aadhaarDoc} onChange={setAadhaarDoc} />
                      <DocUpload label="PAN card" value={panDoc} onChange={setPanDoc} />
                    </div>
                    <PrivacyNote />
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div>
                      <h2 className="text-lg font-bold text-km-heading">Where should we pay you?</h2>
                      <p className="mt-1 text-sm text-km-text-secondary">Session earnings are paid here.</p>
                    </div>
                    <div className="inline-flex rounded-xl border border-km-border bg-km-surface p-1" role="radiogroup" aria-label="Payout method">
                      {(["bank", "upi"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={payoutMethod === m}
                          onClick={() => setPayoutMethod(m)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            payoutMethod === m ? "bg-km-surface-card text-km-heading shadow-sm" : "text-km-text-secondary hover:text-km-heading"
                          }`}
                        >
                          {m === "bank" ? "Bank account" : "UPI"}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label htmlFor="holder" className={LABEL}>Account holder name</label>
                      <input id="holder" value={holder} onChange={(e) => setHolder(e.target.value)} placeholder="As on your bank account" className={INPUT} />
                    </div>
                    {payoutMethod === "bank" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="account" className={LABEL}>Account number</label>
                          <input id="account" inputMode="numeric" autoComplete="off" value={account} onChange={(e) => setAccount(digits(e.target.value, 18))} className={INPUT} />
                        </div>
                        <div>
                          <label htmlFor="confirm-account" className={LABEL}>Re-enter account number</label>
                          <input
                            id="confirm-account"
                            inputMode="numeric"
                            autoComplete="off"
                            value={confirmAccount}
                            onChange={(e) => setConfirmAccount(digits(e.target.value, 18))}
                            onPaste={(e) => e.preventDefault()}
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label htmlFor="ifsc" className={LABEL}>IFSC code</label>
                          <input
                            id="ifsc"
                            value={ifsc}
                            onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))}
                            placeholder="SBIN0001234"
                            className={`${INPUT} tracking-wider`}
                          />
                          <p className={HINT}>Printed on your cheque book or passbook</p>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-sm">
                        <label htmlFor="upi" className={LABEL}>UPI ID</label>
                        <input id="upi" autoComplete="off" value={upi} onChange={(e) => setUpi(e.target.value.trim())} placeholder="name@bank" className={INPUT} />
                      </div>
                    )}
                    <label className="flex items-start gap-3 rounded-2xl bg-km-surface p-4 cursor-pointer">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-km-primary" />
                      <span className="text-sm text-km-text-primary">
                        These details and documents are mine and correct. I agree to KaamMilega verifying them.
                      </span>
                    </label>
                  </div>
                )}

                <div className="mt-7 flex items-center justify-between gap-3 border-t border-km-border pt-5">
                  {step > 0 ? (
                    <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-km-text-secondary hover:text-km-heading">
                      <ArrowLeftIcon weight="bold" size={16} aria-hidden="true" /> Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step < STEPS.length - 1 ? (
                    <button type="button" onClick={next} disabled={step === 0 && (!eligible || !app.has_pass)} className={PRIMARY_BTN}>
                      Continue <ArrowRightIcon weight="bold" size={16} aria-hidden="true" />
                    </button>
                  ) : (
                    <button type="button" onClick={submit} disabled={submitting} className={PRIMARY_BTN}>
                      {submitting ? "Submitting…" : "Submit application"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <aside className="lg:col-span-4">
              <HowItWorks />
            </aside>
          </div>
        )}
      </section>

      <InstantPassModal
        isOpen={passOpen}
        onClose={() => setPassOpen(false)}
        onSuccess={() => {
          setPassOpen(false);
          load();
        }}
      />
    </main>
  );
}

const PRIMARY_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-km-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-km-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
const SECONDARY_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-km-border bg-km-surface-card px-3.5 py-2 text-sm font-semibold text-km-heading hover:bg-km-surface transition-colors whitespace-nowrap";

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={PRIMARY_BTN}>
      {children} <ArrowRightIcon weight="bold" size={16} aria-hidden="true" />
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={SECONDARY_BTN}>{children}</Link>;
}

function Stepper({ step, onJump }: { step: number; onJump: (s: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Application steps">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onJump(i)}
              disabled={!done}
              aria-current={current ? "step" : undefined}
              className="w-full text-left disabled:cursor-default"
            >
              <span className={`block h-1.5 rounded-full ${done || current ? "bg-km-mentors" : "bg-km-border"}`} />
              <span className={`mt-2 flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${current ? "text-km-heading" : "text-km-text-secondary"}`}>
                {done && <CheckIcon weight="bold" size={14} className="text-km-mentors shrink-0" aria-hidden="true" />}
                <span className="truncate">{label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Requirement({
  done,
  Icon,
  title,
  detail,
  action,
}: {
  done: boolean;
  Icon: React.ElementType;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-km-border p-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-[#ECFDF5] text-[#047857] dark:bg-[#0F2E2A] dark:text-[#6EE7B7]" : "bg-[#F4F7FB] text-km-text-secondary dark:bg-[#1A2440]"}`}>
          {done ? <CheckCircleIcon weight="fill" size={22} aria-hidden="true" /> : <Icon size={22} aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-km-heading">{title}</p>
          <p className="text-sm text-km-text-secondary">{detail}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function DocUpload({ label, value, onChange }: { label: string; value: UploadedDoc | null; onChange: (d: UploadedDoc | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > UPLOAD_LIMITS.expert_document) return notify.error("This file is over 10 MB. Please choose a smaller one.");
    setBusy(true);
    try {
      const res = await uploadFile(file, "expert_document", { moduleName: "expert_application" });
      onChange({ url: res.url, name: file.name, size: file.size });
    } catch (err) {
      notify.error(err, "Could not upload the file. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className={LABEL}>{label}</span>
      <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pick} className="hidden" />
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-km-border p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#047857] dark:bg-[#0F2E2A] dark:text-[#6EE7B7]">
            <CheckCircleIcon weight="fill" size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-km-heading">{value.name}</p>
            <p className="text-xs text-km-text-secondary">{formatSize(value.size)} · Uploaded</p>
          </div>
          <button type="button" onClick={() => ref.current?.click()} className="text-sm font-semibold text-km-link hover:underline">
            Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-km-border p-3 text-left hover:border-km-mentors disabled:opacity-60 transition-colors"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F4F7FB] text-km-mentors dark:bg-[#1A2440]">
            <FileArrowUpIcon size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-km-heading">{busy ? "Uploading…" : `Upload ${label}`}</span>
            <span className="block text-xs text-km-text-secondary">PDF, JPG or PNG, up to 10 MB</span>
          </span>
        </button>
      )}
    </div>
  );
}

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2.5 rounded-2xl bg-km-surface p-4 text-sm text-km-text-secondary">
      <LockKeyIcon size={18} className="mt-0.5 shrink-0 text-km-heading" aria-hidden="true" />
      <span>
        Documents are stored privately and opened only by our verification team. We keep just the last 4 digits of your
        Aadhaar and PAN numbers.
      </span>
    </p>
  );
}

function HowItWorks() {
  const items = [
    { title: "Apply in 5 minutes", body: "Experience, expertise, ID and payout details." },
    { title: "Same-day review", body: "Our team checks your documents and profile." },
    { title: "Get verified", body: "The Verified badge appears on your profile." },
    { title: "Start earning", body: "Set your availability and take paid sessions." },
  ];
  return (
    <div className="rounded-3xl border border-km-border bg-km-surface-card p-5 sm:p-6 lg:sticky lg:top-24">
      <p className="text-sm font-bold text-km-heading">How it works</p>
      <ol className="mt-4 space-y-4">
        {items.map((it, i) => (
          <li key={it.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F5F3FF] text-xs font-bold text-[#6D28D9] dark:bg-[#231C45] dark:text-[#C4B5FD]">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-km-heading">{it.title}</p>
              <p className="text-sm text-km-text-secondary">{it.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function StatusCard({
  tone,
  Icon,
  title,
  body,
  action,
  children,
}: {
  tone: "success" | "info" | "warning";
  Icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const chip = {
    success: "bg-[#ECFDF5] text-[#047857] dark:bg-[#0F2E2A] dark:text-[#6EE7B7]",
    info: "bg-[#EFF6FF] text-[#1D4ED8] dark:bg-[#132447] dark:text-[#93C5FD]",
    warning: "bg-[#FFFBEB] text-[#B45309] dark:bg-[#2E2412] dark:text-[#FCD34D]",
  }[tone];
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-km-border bg-km-surface-card p-6 sm:p-8">
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${chip}`}>
        <Icon size={26} weight="fill" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-xl font-bold text-km-heading">{title}</h2>
      <p className="mt-1.5 text-sm text-km-text-secondary">{body}</p>
      {children}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function Summary({ app }: { app: ApplicationStatus }) {
  const kyc = app.kyc!;
  const rows: [string, string][] = [
    ["Expertise", app.expert_category || "-"],
    ["Session price", app.expert_pricing ? `₹${app.expert_pricing}` : "-"],
    ["Aadhaar", `XXXX XXXX ${kyc.aadhaar_last4}`],
    ["PAN", kyc.pan_masked],
    ["Payouts", kyc.payout_method === "bank" ? `Bank account ending ${kyc.account_last4} (${kyc.ifsc})` : `UPI ${kyc.upi_id}`],
    ["Submitted", new Date(kyc.submitted_at).toLocaleString()],
  ];
  return (
    <dl className="mt-5 divide-y divide-km-border rounded-2xl border border-km-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 px-4 py-3">
          <dt className="w-32 shrink-0 text-xs font-semibold text-km-text-secondary">{k}</dt>
          <dd className="text-sm text-km-heading break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
