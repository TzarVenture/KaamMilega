import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRightIcon, BuildingOfficeIcon, CheckCircleIcon, CoinsIcon, HeadsetIcon, LightningIcon, MagnifyingGlassIcon, PhoneCallIcon, SealCheckIcon, ShieldCheckIcon, UserCheckIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr';

export const metadata = {
  title: 'How We Work | KaamMilega™ - Direct Hiring with Zero Brokerage',
  description: "Discover how KaamMilega™ connects jobseekers and verified employers across India directly, transparently, and with zero middlemen fees.",
};

export default function HowWeWorkPage() {
  const jobseekerSteps = [
    {
      step: '01',
      title: 'Create Your Verified Profile',
      desc: 'Build your digital profile in under 2 minutes with mobile OTP and Aadhaar/Biometric badge. Showcase your skills, experience, and preferred work location.',
      icon: UserCheckIcon,
      color: 'bg-blue-50 text-km-link border-blue-200',
    },
    {
      step: '02',
      title: 'Direct Smart Match & Apply',
      desc: 'Browse thousands of verified job vacancies across 100+ cities. Filter by sector, salary, experience, and apply with a single tap.',
      icon: MagnifyingGlassIcon,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      step: '03',
      title: 'Direct HR Call & Interview',
      desc: 'No consultants, no middle agents. Receive calls directly from company recruiters, confirm interview slots, and discuss offers transparently.',
      icon: PhoneCallIcon,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    {
      step: '04',
      title: 'Get Hired & Instant Payouts',
      desc: 'Join full-time roles or take on InstantMilega™ short gigs with guaranteed escrow payouts directly to your bank account or wallet.',
      icon: CoinsIcon,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    },
  ];

  const employerSteps = [
    {
      step: '01',
      title: 'Register & Company Verification',
      desc: 'Register with company GST/CIN credentials. Our compliance team verifies your business within hours to activate your Verified Employer badge.',
      icon: BuildingOfficeIcon,
      color: 'bg-blue-50 text-km-link border-blue-200',
    },
    {
      step: '02',
      title: 'Post Jobs & Instant Shifts',
      desc: 'Post full-time, contract, or urgent shifts. Detail requirements, salary ranges, benefits, and local area preferences with zero hidden charges.',
      icon: SealCheckIcon,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      step: '03',
      title: 'Access Active Candidate Pool',
      desc: 'Review biometric-vetted candidates matched by AI based on proximity and role competencies. View verifiable video intros and skill certifications.',
      icon: UsersThreeIcon,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    {
      step: '04',
      title: 'Hire Faster with Zero Commission',
      desc: 'Directly chat, schedule interviews, and finalize hires. Keep 100% of your budget focused on candidate wages without third-party recruitment markups.',
      icon: CheckCircleIcon,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    },
  ];

  const pillars = [
    {
      title: '100% Zero Brokerage',
      desc: 'Jobseekers never pay a single rupee to get an interview or offer letter. Employers hire directly without inflated agency margins.',
      icon: CoinsIcon,
    },
    {
      title: 'Vetted & Verified Credentials',
      desc: 'Every company GST and worker identity is screened by our multi-tier verification engine to eliminate scams, fake listings, and duplicate profiles.',
      icon: ShieldCheckIcon,
    },
    {
      title: 'InstantMilega™ Escrow',
      desc: 'For on-demand trade shifts, payments are safely secured in platform escrow before work begins and released immediately upon verified shift completion.',
      icon: LightningIcon,
    },
    {
      title: 'Multi-Lingual Voice & Mobile First',
      desc: 'Built ground-up for Bharat with localized regional support, intuitive audio cues, and seamless WhatsApp status updates.',
      icon: HeadsetIcon,
    },
  ];

  return (
    <main className="min-h-screen bg-km-surface font-sans antialiased text-slate-800">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2.5 bg-km-surface-card/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 mb-6 shadow-xs">
            <Image
              src="/kaammilega-logo-icon.png"
              alt="KaamMilega Icon"
              width={22}
              height={22}
              className="object-contain"
            />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white">
              Platform Workflow &amp; Guarantees
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight mb-5">
            How <span className="text-[#FF6B00]">KaamMilega™</span> Works
          </h1>

          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">
            A transparent, tech-powered bridge connecting millions of jobseekers with genuine verified employers across India — with zero brokerage and total peace of mind.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/jobs"
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <span>Explore Jobs</span>
              <ArrowRightIcon weight="bold" size={16} />
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 bg-km-surface-card/15 hover:bg-km-surface-card/25 border border-white/30 text-white font-bold rounded-full text-xs sm:text-sm transition-all backdrop-blur-md"
            >
              Hire Candidates
            </Link>
          </div>
        </div>
      </section>

      {/* For Jobseekers Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-km-link bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            For Jobseekers
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-km-heading tracking-tight mt-3">
            Your Fast Track to a Verified Job
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Follow 4 clear steps to connect with top recruiters without paying any agency commission.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {jobseekerSteps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="bg-km-surface-card rounded-3xl border border-slate-200/90 p-6 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black text-slate-300 group-hover:text-km-link transition-colors">
                      {s.step}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${s.color}`}>
                      <Icon size={22} />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-km-heading mb-2 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* For Employers Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B00] bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
            For Employers &amp; HRs
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-km-heading tracking-tight mt-3">
            Hiring Built for Speed, Scale &amp; Integrity
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            Recruit pre-screened talent across India with instant verified outreach and zero recruitment fees.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {employerSteps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="bg-km-surface-card rounded-3xl border border-slate-200/90 p-6 shadow-2xs hover:shadow-md transition-all relative flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-black text-slate-300 group-hover:text-[#FF6B00] transition-colors">
                      {s.step}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${s.color}`}>
                      <Icon size={22} />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-km-heading mb-2 leading-snug">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust & Safety Pillars */}
      <section className="py-16 sm:py-20 bg-km-surface-card px-4 sm:px-6 lg:px-8 border-y border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Platform Integrity
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-km-heading tracking-tight mt-3">
              The 4 Pillars of Trust on KaamMilega™
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-3xl bg-km-surface border border-slate-200/80 hover:bg-blue-50/50 hover:border-[#0B5ED7]/30 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-km-surface-card border border-slate-200 text-km-heading flex items-center justify-center mb-4 shadow-xs">
                    <Icon size={22} className="text-km-link" />
                  </div>
                  <h3 className="text-base font-bold text-km-heading mb-2">{p.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] rounded-3xl p-8 sm:p-12 text-white shadow-xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4">
            Ready to Experience the Direct Hiring Revolution?
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-xl mx-auto mb-8">
            Join over 500,000+ candidates and 5,000+ verified companies building India&apos;s most reliable employment network.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-bold rounded-full text-sm transition-all shadow-md active:scale-95"
            >
              Get Started for Free
            </Link>
            <Link
              href="/about"
              className="px-8 py-3.5 bg-km-surface-card/10 hover:bg-km-surface-card/20 border border-white/25 text-white font-bold rounded-full text-sm transition-all"
            >
              Learn More About Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
