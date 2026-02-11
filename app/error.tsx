'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-[#050505] p-8 text-center">
        <div className="font-mono text-7xl font-semibold tracking-[0.24em] text-white">404</div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-gray-400">
          Runtime Failure
        </p>
        <p className="mt-4 text-sm text-gray-300">
          Something broke while rendering this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs uppercase tracking-wide text-white transition hover:bg-white/15"
          >
            Retry
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/20 bg-black px-4 py-2 text-xs uppercase tracking-wide text-gray-200 transition hover:bg-white/10"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
