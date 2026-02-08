'use client';

import { useRouter } from 'next/navigation';
import { useWalletAuth } from '@/hooks/useWalletAuth';

export function Navbar() {
  const router = useRouter();
  const { isConnected, formattedAddress, user, loading, connectWallet } = useWalletAuth();

  const handleConnect = async () => {
    const ok = await connectWallet();
    if (ok) router.push('/dashboard');
  };

  return (
    <nav className="w-full px-6 py-4 border-b border-gray-800 bg-[#0a0e13] text-white flex items-center justify-between">
      <div className="font-semibold text-lg">Paper Dex</div>

      <div className="flex items-center gap-4">
        {isConnected ? (
          <>
            <span className="flex items-center gap-2 text-sm text-gray-300">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Logged In
            </span>
            <span className="text-sm font-mono text-gray-300">{formattedAddress}</span>
            <span className="text-sm font-semibold text-green-400">
              {user ? `${user.availableBalance.toLocaleString()} Available` : '—'}
            </span>
            <span className="text-sm font-semibold text-amber-400">
              {user ? `${user.lockedMargin.toLocaleString()} Locked` : '—'}
            </span>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="px-4 py-2 rounded bg-teal-500 hover:bg-teal-600 text-black font-semibold disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
}
