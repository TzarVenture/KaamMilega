'use client';

import React, { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Critical root application exception:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-5 font-bold text-2xl">
            !
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Application Error
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            A critical system error prevented the application from loading. You can reload the application or return to the main portal.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => reset()}
              className="w-full bg-[#0F4C81] hover:bg-[#0B3860] text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-xs cursor-pointer"
            >
              Reload Application
            </button>
            <a
              href="/"
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition-all cursor-pointer inline-block"
            >
              Return to Homepage
            </a>
          </div>

          {error?.digest && (
            <p className="mt-6 text-[11px] font-mono text-slate-400">
              Digest: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
