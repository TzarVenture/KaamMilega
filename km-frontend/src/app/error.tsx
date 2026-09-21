'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import BrandLogo from '@/components/km/BrandLogo';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log unexpected client-side error for telemetry
    console.error('Unhandled route error caught by boundary:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-km-primary">
      {/* Header */}
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

      {/* Main Error Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-lg w-full text-center">
          {/* Status Icon */}
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center mx-auto mb-6 shadow-2xs">
            <AlertTriangle size={36} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50/80 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3">
            Temporary System Exception
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-2.5 max-w-md mx-auto leading-relaxed">
            An unexpected error interrupted this request. Our technical team has been alerted. You can attempt to retry the action or return to safety.
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => reset()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-km-primary hover:bg-km-primary-dark text-white font-bold px-6 py-3 rounded-xl transition-all shadow-xs hover:shadow-md cursor-pointer text-sm"
            >
              <RefreshCw size={17} />
              <span>Try Again</span>
            </button>

            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-700 font-bold px-6 py-3 rounded-xl border border-slate-200 transition-all shadow-2xs hover:shadow-xs cursor-pointer text-sm"
            >
              <Home size={17} className="text-km-primary" />
              <span>Go to Homepage</span>
            </Link>
          </div>

          {/* Collapsible Diagnostics (Useful for support & staging) */}
          {(error.message || error.digest) && (
            <div className="mt-10 pt-6 border-t border-slate-200/80 text-left">
              <details className="group text-xs text-slate-500 cursor-pointer">
                <summary className="font-semibold text-slate-600 hover:text-slate-900 select-none list-none flex items-center justify-between py-1">
                  <span>Technical Diagnostics</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
                    {error.digest ? `ID: ${error.digest.slice(0, 10)}` : 'Details'}
                  </span>
                </summary>
                <div className="mt-3 p-3.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] leading-relaxed break-all shadow-inner">
                  {error.message && <p className="text-rose-400 font-semibold mb-1">{error.message}</p>}
                  {error.digest && <p className="text-slate-400">Error Digest: {error.digest}</p>}
                </div>
              </details>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        &copy; {new Date().getFullYear()} KaamMilega. Technical Monitoring & Protection Active.
      </footer>
    </div>
  );
}
