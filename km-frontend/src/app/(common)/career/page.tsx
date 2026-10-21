import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRightIcon, BriefcaseIcon, CoffeeIcon, EnvelopeSimpleIcon, GraduationCapIcon, HeartIcon, LightningIcon, MapPinIcon, ShieldCheckIcon, TrendUpIcon } from '@phosphor-icons/react/ssr';

export const metadata = {
  title: 'Careers at KaamMilega™ | Join Our Mission',
  description: "Join the team revolutionizing blue-collar and vocational employment in India with direct connections, InstantMilega rapid gigs, and zero brokerage.",
};

export default function CareerPage() {
  const perks = [
    {
      title: 'Meaningful Societal Impact',
      desc: 'Directly empower millions of jobseekers, skilled technicians, and freshers across Bharat with fair, transparent livelihoods.',
      icon: HeartIcon,
    },
    {
      title: 'Competitive CTC & Equity',
      desc: 'Top-tier base compensation with meaningful ESOP allocation so every team member shares in the platform’s upside.',
      icon: TrendUpIcon,
    },
    {
      title: 'Comprehensive Health Cover',
      desc: 'Full medical, accidental, and family healthcare coverage with OPD benefits and wellness programs.',
      icon: ShieldCheckIcon,
    },
    {
      title: 'Modern Stack & Velocity',
      desc: 'Work with high-throughput Go microservices, modern Next.js 16, reactive web architectures, and high-concurrency real-time engines.',
      icon: LightningIcon,
    },
    {
      title: 'Flexible & Hybrid Culture',
      desc: 'Output-driven autonomy. We trust you to do your best work whether collaborating in our Mumbai hub or remotely.',
      icon: CoffeeIcon,
    },
    {
      title: 'Continuous Learning Budget',
      desc: 'Annual stipend for books, conferences, technical certifications, and skill bootcamps to supercharge your career.',
      icon: GraduationCapIcon,
    },
  ];

  const openings = [
    {
      title: 'Senior Full Stack Engineer (Go + Next.js)',
      dept: 'Engineering',
      location: 'Mumbai / Hybrid',
      type: 'Full-Time',
      exp: '3 - 6 Years',
      desc: 'Own core high-throughput APIs in Golang Fiber and responsive web architecture in Next.js. Architect real-time matchmaking, live notifications, and escrow settlement systems.',
    },
    {
      title: 'Product Manager — InstantMilega™ & Rapid Shifts',
      dept: 'Product',
      location: 'Mumbai / Remote',
      type: 'Full-Time',
      exp: '3 - 5 Years',
      desc: 'Drive the roadmap for India’s fastest on-demand shift platform. Design zero-friction worker onboarding, location-based dispatching, and automated escrow payouts.',
    },
    {
      title: 'Regional Operations & City Expansion Lead',
      dept: 'Operations & Growth',
      location: 'Delhi-NCR / Tier-2 Metros',
      type: 'Full-Time',
      exp: '2 - 5 Years',
      desc: 'Scale ground merchant partnerships, drive employer onboarding across industrial belts, and lead localized candidate registration drives across North India.',
    },
    {
      title: 'DevOps & Cloud Security Architect',
      dept: 'Infrastructure',
      location: 'Remote (India)',
      type: 'Full-Time',
      exp: '4 - 7 Years',
      desc: 'Manage containerized Docker/Kubernetes workloads, MongoDB Atlas clusters, automated CI/CD pipelines, and zero-trust biometric data encryption.',
    },
    {
      title: 'Community & Customer Happiness Specialist',
      dept: 'Support & Trust',
      location: 'Mumbai / Hybrid',
      type: 'Full-Time',
      exp: '1 - 3 Years',
      desc: 'Be the voice of KaamMilega™ for thousands of daily users. Handle dispute resolution, employer verifications, and regional voice support in Hindi & English.',
    },
  ];

  return (
    <main className="min-h-screen bg-[#F4F7FB] font-sans antialiased text-slate-800">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] text-white py-16 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 mb-6 shadow-xs">
            <BriefcaseIcon weight="bold" size={16} className="text-amber-400" />
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-white">
              We&apos;re Hiring Across Engineering, Product &amp; Growth
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight mb-5">
            Build the Future of <span className="text-[#FF6B00]">Work in India</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">
            Join a mission-driven team solving real employment challenges for millions of workers, technicians, and businesses across Bharat with cutting-edge technology.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#openings"
              className="px-6 py-3 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-md active:scale-95 flex items-center gap-2"
            >
              <span>View Open Positions</span>
              <ArrowRightIcon weight="bold" size={16} />
            </a>
            <Link
              href="/about"
              className="px-6 py-3 bg-white/15 hover:bg-white/25 border border-white/30 text-white font-bold rounded-full text-xs sm:text-sm transition-all backdrop-blur-md"
            >
              Our Mission
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="py-10 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-black text-[#071A4D]">500K+</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Workers Empowered</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-[#FF6B00]">5,000+</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Verified Employers</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-[#0B5ED7]">100+</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Indian Cities Covered</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">0%</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Worker Brokerage Taken</p>
          </div>
        </div>
      </section>

      {/* Perks & Benefits */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0B5ED7] bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Why KaamMilega™
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#071A4D] tracking-tight mt-3">
            Life at KaamMilega™
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2">
            We take care of our people so they can do their life&apos;s most meaningful and impactful work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {perks.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-[#0B5ED7] flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                  <Icon size={22} />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#071A4D] mb-2 leading-snug">
                  {p.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Positions Section */}
      <section id="openings" className="py-16 sm:py-20 bg-white border-t border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B00] bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
              Current Openings
            </span>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#071A4D] tracking-tight mt-3">
              Explore Our Open Roles
            </h2>
            <p className="text-sm sm:text-base text-slate-600 mt-2">
              Don’t see an exact match? Send your resume to <a href="mailto:careers@kaammilega.com" className="text-[#0B5ED7] font-semibold underline">careers@kaammilega.com</a>.
            </p>
          </div>

          <div className="space-y-4">
            {openings.map((job, idx) => (
              <div
                key={idx}
                className="bg-[#F4F7FB] hover:bg-blue-50/40 rounded-3xl p-6 sm:p-7 border border-slate-200/90 hover:border-[#0B5ED7]/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold text-[#0B5ED7] bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                      {job.dept}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                      {job.type}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-full">
                      {job.exp}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-[#071A4D] group-hover:text-[#0B5ED7] transition-colors mb-2">
                    {job.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3 max-w-3xl">
                    {job.desc}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <MapPinIcon weight="bold" size={13} className="text-slate-400" />
                      {job.location}
                    </span>
                  </div>
                </div>

                <a
                  href={`mailto:careers@kaammilega.com?subject=Application for ${encodeURIComponent(job.title)}`}
                  className="px-6 py-2.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-bold rounded-full text-xs sm:text-sm transition-all shadow-xs shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span>Apply Now</span>
                  <ArrowRightIcon weight="bold" size={14} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Direct Contact Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <div className="bg-gradient-to-r from-[#071A4D] via-[#0B1F52] to-[#0B5ED7] rounded-3xl p-8 sm:p-12 text-white shadow-xl">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mx-auto mb-4 text-white">
            <EnvelopeSimpleIcon size={24} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-3">
            Don&apos;t See Your Role Listed?
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-xl mx-auto mb-6">
            We are always on the lookout for exceptional engineers, product designers, growth marketers, and operations champions.
          </p>
          <a
            href="mailto:careers@kaammilega.com?subject=General Career Application - KaamMilega"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-bold rounded-full text-sm transition-all shadow-md active:scale-95"
          >
            <span>Email careers@kaammilega.com</span>
            <ArrowRightIcon weight="bold" size={16} />
          </a>
        </div>
      </section>
    </main>
  );
}
