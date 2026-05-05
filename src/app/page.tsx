'use client';

import { useEffect } from 'react';
import { usePiAuth } from '@/lib-client/hooks/usePiAuth';

const HUB_SSO = 'https://hub.tecosystem.app/api/auth/sso?target=' +
  encodeURIComponent('https://tec-commerce-app.vercel.app');

const getTokenFromCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find(r => r.startsWith('tec_access_token='));
  return match ? match.split('=')[1] : null;
};

export default function CommerceLanding() {
  const { isAuthenticated, isLoading } = usePiAuth();

  useEffect(() => {
    if (isLoading) return;
    const token = getTokenFromCookie();
    if (token || isAuthenticated) {
      window.location.href = '/app';
    } else {
      window.location.href = HUB_SSO;
    }
  }, [isLoading, isAuthenticated]);

  return (
    <div style={{
      minHeight: '100vh', background: '#020205',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg,#d4af37,#b8882a)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
      }}>🛒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#d4af37' }}>Commerce</div>
      <div style={{ fontSize: 12, color: '#4a4a5a' }}>TEC Ecosystem</div>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '3px solid #d4af3730',
        borderTop: '3px solid #d4af37',
        animation: 'spin 0.8s linear infinite',
        marginTop: 8,
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
