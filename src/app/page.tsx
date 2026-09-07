'use client';

import { useEffect } from 'react';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';
import { ssoUrl }    from '@/lib/sso';

const getTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='));
  return match ? match.split('=')[1] : null;
};

export default function CommerceLanding() {
  // Fire-and-forget backend warmup (Railway cold starts — see /api/warmup).
  useEffect(() => { fetch('/api/warmup').catch(() => {}); }, []);

  const { isAuthenticated, isLoading } = usePiAuth();

  useEffect(() => {
    if (isLoading) return;
    const token = getTokenFromCookie();
    if (token || isAuthenticated) {
      window.location.href = '/app';
    } else {
      // Hub SSO carrying THIS host as the return address (src/lib/sso.ts).
      // It used to be a bare Hub URL with no `target=`, which on the Testnet
      // host was a one-way trip: host-only cookies mean a visitor never
      // arrives with a token, so every visit bounced to the Hub and nothing
      // ever came back.
      window.location.href = ssoUrl();
    }
  }, [isLoading, isAuthenticated]);

  return (
    <div style={{
      minHeight: '100vh', background: '#050816',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>🛒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#FBBF24' }}>Commerce</div>
      <div style={{ fontSize: 12, color: '#4a4a5a' }}>TEC Ecosystem</div>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '3px solid #FBBF2430',
        borderTop: '3px solid #FBBF24',
        animation: 'spin 0.8s linear infinite',
        marginTop: 8,
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
