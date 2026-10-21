import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BriefcaseIcon, BuildingOfficeIcon, CheckCircleIcon, CompassIcon, HandHeartIcon, LockIcon, PhoneCallIcon, QuestionIcon, SealCheckIcon, ShieldCheckIcon, TrendUpIcon, UsersIcon } from '@phosphor-icons/react/ssr';

export const metadata = {
  title: 'About Us | Kaammilega™ — Har Kaam, Har Mauka',
  description:
    "Learn about Kaammilega™ — India's direct, zero-brokerage employment ecosystem connecting candidates and verified recruiters with dignity of labor and transparent wages.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-km-surface font-sans antialiased text-km-text-primary">
      {/* ── 1. HERO: WHO WE ARE ── */}
      <section className="bg-gradient-to-b from-[#F0F5FB] via-[#F4F7FB] to-white pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-km-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-km-link mb-3">
            About Kaammilega™
          </p>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-km-text-primary tracking-tight leading-[1.15] mb-5">
            Building India&apos;s Direct,{' '}
            <span className="text-[#FF6B00]">Zero-Brokerage</span> Employment Network
          </h1>

          <p className="text-base sm:text-lg text-km-text-secondary max-w-3xl mx-auto leading-relaxed mb-8">
            Kaammilega was founded on a simple principle: finding honest work should never require
            paying an agency or middleman. We connect jobseekers, skilled technicians, and employers
            directly — ensuring transparent wages, verified credentials, and dignity of labor for all.
          </p>

          {/* Direct, Working Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/jobs"
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-sm rounded-xl transition-all shadow-[0_4px_14px_rgba(255,107,0,0.25)] hover:scale-[1.01] active:scale-95 inline-flex items-center gap-2"
            >
              <span>Explore 15,000+ Jobs</span>
              <ArrowRightIcon weight="bold" size={15} />
            </Link>

            <Link
              href="/recruiter/login"
              className="px-6 py-3 bg-km-surface-card hover:bg-slate-50 border border-km-border text-km-heading font-semibold text-sm rounded-xl transition-all shadow-xs hover:border-[#0B5ED7]/40 active:scale-95"
            >
              Recruiter &amp; Employer Portal
            </Link>
          </div>
        </div>
      </section>

      {/* ── 2. IMPACT BY THE NUMBERS ── */}
      <section className="-mt-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)] text-center">
            <p className="text-2xl sm:text-3xl font-black text-km-heading tracking-tight">100%</p>
            <p className="text-xs sm:text-sm font-bold text-km-text-primary mt-0.5">Zero Brokerage</p>
            <p className="text-[11px] text-km-text-secondary mt-0.5">No agency commission cuts</p>
          </div>

          <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)] text-center">
            <p className="text-2xl sm:text-3xl font-black text-[#FF6B00] tracking-tight">5,000+</p>
            <p className="text-xs sm:text-sm font-bold text-km-text-primary mt-0.5">Hiring Employers</p>
            <p className="text-[11px] text-km-text-secondary mt-0.5">Verified company entities</p>
          </div>

          <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)] text-center">
            <p className="text-2xl sm:text-3xl font-black text-km-heading tracking-tight">15,000+</p>
            <p className="text-xs sm:text-sm font-bold text-km-text-primary mt-0.5">Active Openings</p>
            <p className="text-[11px] text-km-text-secondary mt-0.5">Full-time, part-time &amp; gigs</p>
          </div>

          <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)] text-center">
            <p className="text-2xl sm:text-3xl font-black text-km-heading tracking-tight">28 States</p>
            <p className="text-xs sm:text-sm font-bold text-km-text-primary mt-0.5">Pan-India Reach</p>
            <p className="text-[11px] text-km-text-secondary mt-0.5">From metros to rural hubs</p>
          </div>
        </div>
      </section>

      {/* ── 3. OUR STORY & THE PROBLEM WE SOLVE ── */}
      <section className="py-14 sm:py-18 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-km-link block mb-1">
              Why We Started
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-km-text-primary tracking-tight leading-snug mb-4">
              Fixing India&apos;s Broken Hiring Pipeline
            </h2>
            <p className="text-sm sm:text-base text-km-text-secondary leading-relaxed mb-4">
              Every year, millions of Indian jobseekers lose their hard-earned savings to fake job
              consultancies, deceptive registration fees, and hidden salary cuts. At the same time,
              businesses struggle to hire reliable, verified staff quickly.
            </p>
            <p className="text-sm sm:text-base text-km-text-secondary leading-relaxed">
              Kaammilega was built to dismantle this predatory middleman system. By giving candidates
              direct access to verified hiring managers with transparent salary commitments, we make
              employment fair, fast, and completely commission-free.
            </p>
          </div>

          <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)] space-y-4">
            <div className="flex gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#EF4444] flex items-center justify-center shrink-0 font-bold text-xs">
                ✕
              </div>
              <div>
                <h4 className="text-sm font-bold text-km-text-primary">The Old Way (Exploitative)</h4>
                <p className="text-xs text-km-text-secondary mt-0.5 leading-snug">
                  Unregistered agents charge upfront fees, hide company identities, and take 15–30% cuts
                  from candidate salaries every month.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-km-border flex gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#16A34A] flex items-center justify-center shrink-0 font-bold text-xs">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-bold text-km-text-primary">The Kaammilega Way (Direct &amp; Free)</h4>
                <p className="text-xs text-km-text-secondary mt-0.5 leading-snug">
                  Zero brokerage. Direct phone and WhatsApp communication with verified employers. You
                  keep 100% of your salary.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. OUR CORE VALUES ── */}
      <section className="py-14 sm:py-18 bg-km-surface-card border-y border-km-border px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-km-text-primary tracking-tight">
              The Principles That Guide Us
            </h2>
            <p className="text-sm sm:text-base text-km-text-secondary mt-2">
              Non-negotiable values embedded in every line of code and business practice.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-km-border flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6B00] flex items-center justify-center mb-3.5">
                  <SealCheckIcon size={20} />
                </div>
                <h3 className="text-base font-bold text-km-text-primary mb-1.5">Zero Brokerage</h3>
                <p className="text-xs text-km-text-secondary leading-relaxed">
                  We never charge jobseekers for applications, interviews, or offer letters. It is and
                  will always be 100% free.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-km-border flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-km-link flex items-center justify-center mb-3.5">
                  <PhoneCallIcon size={20} />
                </div>
                <h3 className="text-base font-bold text-km-text-primary mb-1.5">Direct HR Calls</h3>
                <p className="text-xs text-km-text-secondary leading-relaxed">
                  No black-box queues. Candidates connect directly with authorized company HR and
                  business founders.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-km-border flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center mb-3.5">
                  <HandHeartIcon size={20} />
                </div>
                <h3 className="text-base font-bold text-km-text-primary mb-1.5">Dignity of Labor</h3>
                <p className="text-xs text-km-text-secondary leading-relaxed">
                  Equal respect, verified safety, and transparent wages for blue-collar, vocational, and
                  corporate professionals alike.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-km-border flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center mb-3.5">
                  <ShieldCheckIcon size={20} />
                </div>
                <h3 className="text-base font-bold text-km-text-primary mb-1.5">Verified Safety</h3>
                <p className="text-xs text-km-text-secondary leading-relaxed">
                  Every company profile is audited with entity verification. Immediate zero-tolerance
                  removal of fraudulent posts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS (FOR CANDIDATES & FOR RECRUITERS) ── */}
      <section className="py-14 sm:py-18 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-km-text-primary tracking-tight">
            How Kaammilega Works
          </h2>
          <p className="text-sm sm:text-base text-km-text-secondary mt-2">
            A transparent platform serving both talent and hiring teams.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Candidates Column */}
          <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B00] mb-3">
              <UsersIcon weight="bold" size={16} />
              <span>For Jobseekers &amp; Technicians</span>
            </div>
            <h3 className="text-lg font-bold text-km-text-primary mb-4">
              Get Hired in 3 Simple Steps
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-50 text-[#FF6B00] font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Search by Role &amp; City</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Filter by verified monthly salary, location, job type, and shift flexibility.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-50 text-[#FF6B00] font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Call or Message HR Directly</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Speak directly with recruiters to schedule your interview with 1-click WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-orange-50 text-[#FF6B00] font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Get Hired with Zero Fees</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Receive your appointment letter and keep 100% of your earnings.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-km-border">
              <Link
                href="/jobs"
                className="text-xs font-semibold text-[#FF6B00] hover:text-[#FF8A00] inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Browse Live Job Openings</span>
                <ArrowRightIcon weight="bold" size={13} />
              </Link>
            </div>
          </div>

          {/* Recruiters Column */}
          <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 sm:p-7 shadow-[0_1px_3px_0_rgba(7,26,77,0.04)]">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-km-link mb-3">
              <BuildingOfficeIcon weight="bold" size={16} />
              <span>For Employers &amp; Companies</span>
            </div>
            <h3 className="text-lg font-bold text-km-text-primary mb-4">
              Hire Verified Talent Faster
            </h3>

            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-km-link font-bold text-xs flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Post in 2 Minutes</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Create full-time vacancies or rapid InstantMilega™ shifts with clear wages.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-km-link font-bold text-xs flex items-center justify-center shrink-0">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Access Verified Profiles</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Review candidate experience, skill verification badges, and proximity to job site.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-km-link font-bold text-xs flex items-center justify-center shrink-0">
                  3
                </span>
                <div>
                  <h4 className="text-sm font-bold text-km-text-primary">Manage via ATS Dashboard</h4>
                  <p className="text-xs text-km-text-secondary mt-0.5">
                    Schedule interviews, track applicant pipelines, and hire with zero per-hire agency cuts.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-km-border">
              <Link
                href="/recruiter/login"
                className="text-xs font-semibold text-km-link hover:text-[#0B1F52] inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Access Recruiter ATS Portal</span>
                <ArrowRightIcon weight="bold" size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. CLEAN, FOCUSED CTA BANNER ── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-[#071A4D] text-white shadow-sm">
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Ready to Experience Zero Brokerage?
          </h3>
          <p className="text-slate-300 text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
            Whether you are looking for your next career move or hiring trusted talent for your company,
            Kaammilega connects you directly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/jobs"
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-sm rounded-xl transition-all shadow-[0_4px_14px_rgba(255,107,0,0.25)] hover:scale-[1.01] active:scale-95 inline-flex items-center gap-2"
            >
              <span>Browse All Jobs</span>
              <ArrowRightIcon weight="bold" size={15} />
            </Link>

            <Link
              href="/recruiter/login"
              className="px-6 py-3 bg-km-surface-card hover:bg-slate-100 text-km-heading font-semibold text-sm rounded-xl transition-all shadow-xs active:scale-95"
            >
              Post a Job as Employer
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-center gap-1 text-xs text-slate-400">
            <span>Have questions or need assistance?</span>
            <Link href="/support" className="text-orange-300 hover:text-white underline ml-1">
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
