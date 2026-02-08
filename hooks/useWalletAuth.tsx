'use client';

import { useCallback, useEffect, useState } from 'react';
import { BrowserProvider } from 'ethers';
import { apiFetch } from '@/lib/apiFetch';

type AuthUser = {
  id: number;
  walletAddress: string;
  mockUsdcBalance: number;
  lockedMargin: number;
  availableBalance: number;
  createdAt: string;
  lastLogin: string;
};

const TOKEN_KEY = 'auth_token';
const MESSAGE_PREFIX = 'Sign this message to authenticate. Nonce:';

function formatAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function useWalletAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSession = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;

    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
        localStorage.removeItem(TOKEN_KEY);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setAddress(data.user.walletAddress);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask not detected');
      return false;
    }

    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const walletAddress = (await signer.getAddress()).toLowerCase();

      const nonceRes = await apiFetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();

      const message = `${MESSAGE_PREFIX} ${nonce}`;
      const signature = await signer.signMessage(message);

      const verifyRes = await apiFetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature }),
      });
      if (!verifyRes.ok) throw new Error('Signature verification failed');
      const data = await verifyRes.json();

      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      setAddress(data.user.walletAddress);
      return true;
    } catch (err) {
      console.error('Wallet connection failed', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setAddress(null);
  }, []);

  return {
    user,
    address,
    formattedAddress: address ? formatAddress(address) : '',
    isConnected: Boolean(user),
    loading,
    connectWallet,
    disconnect,
    refresh: loadSession,
  };
}
