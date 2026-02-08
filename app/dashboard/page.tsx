'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletAuth } from '@/hooks/useWalletAuth';

export default function DashboardPage() {
  const router = useRouter();
  const { isConnected, user } = useWalletAuth();

  useEffect(() => {
    if (!isConnected) {
      router.replace('/');
    }
  }, [isConnected, router]);

  return (
    <div className="min-h-screen bg-[#0a0e13] text-white p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      {user ? (
        <div className="space-y-2 text-sm text-gray-300">
          <div>Wallet: {user.walletAddress}</div>
          <div>Mock_USDC: {user.mockUsdcBalance.toLocaleString()}</div>
          <div>Last Login: {new Date(user.lastLogin).toLocaleString()}</div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
