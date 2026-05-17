'use client';

import { useState, useEffect } from 'react';

interface Prefs {
  theme:       'dark' | 'light';
  currency:    'PI' | 'USD';
  hideBalance: boolean;
}

interface Props {
  isOpen:       boolean;
  onClose:      () => void;
  prefs:        Prefs;
  onPrefChange: (key: keyof Prefs, value: unknown) => void;
  username?:    string;
  hubUrl:       string;
  notifCount?:  number;
  onNotif:      () => void;
}

const PI_USD_RATE = 1.5; // approximate — يتحدث لاحقاً

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, position: 'relative', cursor: 'pointer',
        background: value ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1a1a2a',
        border: `1px solid ${value ? 'rgba(212,175,55,0.3)' : '#ffffff15'}`,
        transition: 'all 0.2s ease', flexShrink: 0,
      }}>
      <div style={{
        position: 'absolute', top: 2, left: value ? 22 : 2,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function DrawerRow({ icon, label, right }: { icon: string; label: string; right: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #ffffff06' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
        <span style={{ fontSize: 13, color: '#d0d0e0', fontWeight: 500 }}>{label}</span>
      </div>
      <div>{right}</div>
    </div>
  );
}

export function CommerceDrawer({ isOpen, onClose, prefs, onPrefChange, username, hubUrl, notifCount, onNotif }: Props) {
  const [piRate, setPiRate] = useState(PI_USD_RATE);

  useEffect(() => {
    // محاولة جلب السعر الحقيقي
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.['pi-network']?.usd) setPiRate(d['pi-network'].usd); })
      .catch(() => {});
  }, []);

  const isDark  = prefs.theme === 'dark';
  const isUSD   = prefs.currency === 'USD';

  return (
    <>
      {/* ── Overlay ─────────────────────────────── */}
      {isOpen && (
        <div onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 290, background: 'rgba(2,2,5,0.8)', backdropFilter: 'blur(8px)' }} />
      )}

      {/* ── Drawer ──────────────────────────────── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 300,
        width: 280, background: isDark ? '#0a0a12' : '#f4f4f8',
        borderRight: `1px solid ${isDark ? '#ffffff0a' : '#e0e0e8'}`,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>

        {/* ── Header ──────────────────────────── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${isDark ? '#ffffff08' : '#e0e0e8'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: '#0a0800' }}>🛒</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#d4af37' }}>Commerce</div>
                <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 2 }}>TEC ECOSYSTEM</div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: '50%', background: isDark ? '#ffffff08' : '#e0e0e8', border: 'none', color: isDark ? '#6b6b7a' : '#888', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>

          {/* User */}
          {username && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isDark ? '#ffffff05' : '#e8e8f0', borderRadius: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#0a0800', flexShrink: 0 }}>
                {username[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? '#fff' : '#111' }}>@{username}</div>
                <div style={{ fontSize: 10, color: '#4a4a5a' }}>Pi Network</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Settings ────────────────────────── */}
        <div style={{ flex: 1 }}>

          {/* Section label */}
          <div style={{ padding: '14px 20px 6px', fontSize: 9, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
            Preferences
          </div>

          {/* Theme */}
          <DrawerRow
            icon={isDark ? '🌙' : '☀️'}
            label={isDark ? 'Dark Mode' : 'Light Mode'}
            right={
              <Toggle value={isDark} onChange={v => onPrefChange('theme', v ? 'dark' : 'light')} />
            }
          />

          {/* Currency */}
          <DrawerRow
            icon="💵"
            label="Currency"
            right={
              <div style={{ display: 'flex', background: isDark ? '#0d0d14' : '#e0e0e8', borderRadius: 10, overflow: 'hidden', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}` }}>
                {(['PI', 'USD'] as const).map(c => (
                  <button key={c} onClick={() => onPrefChange('currency', c)}
                    style={{ padding: '5px 12px', background: prefs.currency === c ? 'linear-gradient(135deg,#d4af37,#b8882a)' : 'transparent', border: 'none', color: prefs.currency === c ? '#0a0800' : '#4a4a5a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {c}
                  </button>
                ))}
              </div>
            }
          />

          {/* Pi Rate preview */}
          {isUSD && (
            <div style={{ margin: '0 20px 4px', padding: '8px 12px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>Current rate</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d4af37' }}>1π ≈ ${piRate.toFixed(4)} USD</div>
            </div>
          )}

          {/* Hide Balance */}
          <DrawerRow
            icon="👁️"
            label="Hide Prices"
            right={
              <Toggle value={prefs.hideBalance} onChange={v => onPrefChange('hideBalance', v)} />
            }
          />

          {/* Notifications */}
          <div onClick={onNotif}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #ffffff06', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center', position: 'relative' }}>
                🔔
                {(notifCount ?? 0) > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%', background: '#ef4444', fontSize: 8, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notifCount}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 13, color: '#d0d0e0', fontWeight: 500 }}>Notifications</span>
            </div>
            <span style={{ fontSize: 12, color: '#4a4a5a' }}>→</span>
          </div>

        </div>

        {/* ── Footer ──────────────────────────── */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${isDark ? '#ffffff08' : '#e0e0e8'}` }}>
          <button onClick={() => { window.location.href = `${hubUrl}/hub`; }}
            style={{ width: '100%', padding: '11px', borderRadius: 12, background: isDark ? '#ffffff08' : '#e0e0e8', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}`, color: '#d4af37', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
            🔷 Back to Hub
          </button>
          <div style={{ textAlign: 'center', fontSize: 10, color: '#4a4a5a', letterSpacing: 1 }}>
            TEC Commerce v1.0.0
          </div>
        </div>
      </div>
    </>
  );
                         }
