'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import type { Symbol } from '@/lib/types';

interface NavbarProps {
  symbol: Symbol;
  markPrice: number | null;
  availableBalance: number;
  onSymbolChange: (next: Symbol) => void;
  symbolOptions: Symbol[];
}

export function Navbar({ symbol, markPrice, availableBalance, onSymbolChange, symbolOptions }: NavbarProps) {
  const router = useRouter();
  const { isConnected, formattedAddress, loading, connectWallet, disconnect } = useWalletAuth();
  const [marketMenuOpen, setMarketMenuOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const marketMenuRef = useRef<HTMLDivElement | null>(null);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);

  const handleConnect = async () => {
    const ok = await connectWallet();
    if (ok) router.push('/dashboard');
  };

  const handleLogout = () => {
    disconnect();
    setWalletMenuOpen(false);
    router.refresh();
  };

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!marketMenuRef.current?.contains(target)) {
        setMarketMenuOpen(false);
      }
      if (!walletMenuRef.current?.contains(target)) {
        setWalletMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  return (
    <nav className="w-full px-5 pt-7 pb-3  text-white flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-sm tracking-wide uppercase">Paper Dex</span>

        <div className="relative" ref={marketMenuRef}>
          <button
            type="button"
            onClick={() => setMarketMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-white/10 bg-white/5 text-sm cursor-pointer hover:bg-white/10 transition rounded-xl"
          >
            <span className="text-gray-300">{symbol}/USDT</span>
            <span className="text-green-400 font-mono">
              {markPrice != null ? markPrice.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
            </span>
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {marketMenuOpen ? (
            <div className="absolute left-0 mt-2 w-36 rounded-xl border border-white/10 bg-[#111823] shadow-lg shadow-black/30 overflow-hidden z-20">
              {symbolOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSymbolChange(option);
                    setMarketMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition ${
                    option === symbol
                      ? 'text-white bg-white/10'
                      : 'text-gray-300 hover:bg-white/10'
                  }`}
                >
                  {option}/USDT
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Paper Balance</div>
          <div className="text-sm font-semibold font-mono">
            ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="relative" ref={walletMenuRef}>
          {isConnected ? (
            <>
              <button
                type="button"
                onClick={() => setWalletMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 bg-white/10 text-sm hover:bg-white/15 transition cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3.5 h-3.5 text-gray-300"
                >
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
                <span className="font-mono text-gray-300">{formattedAddress}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </button>
              {walletMenuOpen ? (
                <div className="absolute right-0 mt-2 w-36 rounded-xl border border-white/10 bg-[#111823] shadow-lg shadow-black/30 overflow-hidden z-20">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10 transition cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 text-gray-300"
              >
                <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
              </svg>
              <span className="font-medium text-gray-300">{loading ? 'Connecting...' : 'Connect Wallet'}</span>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
