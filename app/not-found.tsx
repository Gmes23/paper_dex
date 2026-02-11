import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-[#050505] p-8 text-center">
        <div className="font-mono text-7xl font-semibold tracking-[0.24em] text-white">404</div>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-gray-400">
          Page Not Found
        </p>
        <p className="mt-4 text-sm text-gray-300">
          The route you requested does not exist.
        </p>
        <div className="mt-6 flex items-center justify-center">
          <Link
            href="/"
            className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs uppercase tracking-wide text-white transition hover:bg-white/15"
          >
            Back To Trading
          </Link>
        </div>
      </div>
    </div>
  );
}
