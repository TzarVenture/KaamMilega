import React from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/km/BrandLogo';
import { Home, Briefcase, Users, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-km-primary">
      {/* Navigation Header */}
      <header className="w-full bg-white border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <BrandLogo size="sm" />
          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-km-primary flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-xl w-full text-center">
          {/* Subtle Decorative Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-km-primary text-xs font-bold uppercase tracking-wider mb-6">
            Error 404 &bull; Page Not Found
          </div>

          {/* Large Numerals */}
          <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black text-slate-900 tracking-tighter leading-none">
            4<span className="text-km-primary">0</span>4
          </h1>

          {/* Message */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-4 tracking-tight">
            We couldn&apos;t find that page
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mt-2.5 max-w-md mx-auto leading-relaxed">
            The link you followed may be broken, expired, or the page may have been moved to another location.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-km-primary hover:bg-km-primary-dark text-white font-bold px-6 py-3 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer text-sm"
            >
              <Home size={18} />
              <span>Go to Homepage</span>
            </Link>

            <Link
              href="/jobs"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-bold px-6 py-3 rounded-xl border border-slate-200 transition-all shadow-2xs hover:shadow-xs cursor-pointer text-sm"
            >
              <Briefcase size={18} className="text-km-primary" />
              <span>Explore Jobs</span>
            </Link>
          </div>

          {/* Helpful Quick Links Container */}
          <div className="mt-12 pt-8 border-t border-slate-200/80">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Popular Destinations
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-left">
              <Link
                href="/jobs"
                className="p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400/40 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs group-hover:text-km-primary transition-colors">
                  <Briefcase size={14} className="text-km-primary" />
                  <span>Job Openings</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Verified vacancies</p>
              </Link>

              <Link
                href="/network"
                className="p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400/40 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs group-hover:text-km-primary transition-colors">
                  <Users size={14} className="text-km-primary" />
                  <span>Community</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Connect with peers</p>
              </Link>

              <Link
                href="/events"
                className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-white border border-slate-200/70 hover:border-blue-400/40 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center gap-2 text-slate-800 font-bold text-xs group-hover:text-km-primary transition-colors">
                  <Search size={14} className="text-km-primary" />
                  <span>Job Melas</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Hiring drives & fairs</p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Note */}
      <footer className="w-full py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        &copy; {new Date().getFullYear()} KaamMilega. All rights reserved. Zero-brokerage employment ecosystem.
      </footer>
    </div>
  );
}
