'use client';

import { useState, useEffect } from 'react';

const APP_VERSION = '1.0.0';
const BUILD       = '2026.05';

interface Prefs {
  theme:       'dark' | 'light';
  currency:    'PI' | 'USD';
  hideBalance: boolean;
  language:    'en' | 'ar';
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

// ── Toggle ─────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, position: 'relative',
        cursor: 'pointer', flexShrink: 0, border: 'none',
        background: value ? 'linear-gradient(135deg,#d4af37,#b8882a)' : '#1a1a2a',
        transition: 'all 0.2s ease',
      }}>
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

// ── Row ────────────────────────────────────────────────────────
function DrawerRow({ icon, label, right, onClick, isDark }: {
  icon: string; label: string; right?: React.ReactNode;
  onClick?: () => void; isDark: boolean;
}) {
  return (
    <div onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 20px', borderBottom: `1px solid ${isDark ? '#ffffff06' : '#e8e8f0'}`, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 17, width: 24, textAlign: 'center' }}>{icon}</span>
        <span style={{ fontSize: 13, color: isDark ? '#d0d0e0' : '#333', fontWeight: 500 }}>{label}</span>
      </div>
      {right && <div>{right}</div>}
      {onClick && !right && <span style={{ fontSize: 12, color: '#4a4a5a' }}>→</span>}
    </div>
  );
}

// ── Section Label ──────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '14px 20px 6px', fontSize: 9, color: '#4a4a5a', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>
      {label}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export function CommerceDrawer({ isOpen, onClose, prefs, onPrefChange, username, hubUrl, notifCount, onNotif }: Props) {
  const [piRate,      setPiRate]      = useState(1.5);
  const [isOnline,    setIsOnline]    = useState(true);
  const [cacheCleared, setCacheCleared] = useState(false);

  const isDark = prefs.theme === 'dark';
  const isAR   = prefs.language === 'ar';
  const isUSD  = prefs.currency === 'USD';

  // Pi price
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.['pi-network']?.usd) setPiRate(d['pi-network'].usd); })
      .catch(() => {});
  }, []);

  // Online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const handleShare = () => {
    const url = `${window.location.origin}/app`;
    if (navigator.share) {
      navigator.share({ title: 'TEC Commerce', text: 'Buy & Sell on Pi Network', url });
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link copied!'));
    }
  };

  const handleClearCache = () => {
    try {
      const keys = ['tec_commerce_prefs'];
      keys.forEach(k => localStorage.removeItem(k));
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2000);
    } catch {}
  };

  const bg      = isDark ? '#0a0a12'  : '#f4f4f8';
  const border  = isDark ? '#ffffff0a' : '#e0e0e8';
  const textPri = isDark ? '#fff'     : '#111';

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
        width: 280, background: bg, borderRight: `1px solid ${border}`,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        direction: isAR ? 'rtl' : 'ltr',
      }}>

        {/* ── Header ──────────────────────────── */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#0a0800' }}>🛒</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#d4af37' }}>Commerce</div>
                <div style={{ fontSize: 9, color: '#4a4a5a', letterSpacing: 2 }}>TEC ECOSYSTEM</div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: '50%', background: isDark ? '#ffffff08' : '#e0e0e8', border: 'none', color: '#6b6b7a', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ×
            </button>
          </div>

          {/* User + Connection */}
          {username && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: isDark ? '#ffffff05' : '#e8e8f0', borderRadius: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#d4af37,#b8882a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#0a0800', flexShrink: 0 }}>
                {username[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: textPri }}>@{username}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', display: 'inline-block' }} />
                  <span style={{ fontSize: 9, color: isOnline ? '#10b981' : '#ef4444' }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Content ─────────────────────────── */}
        <div style={{ flex: 1 }}>

          {/* ── Preferences ─── */}
          <SectionLabel label={isAR ? 'التفضيلات' : 'Preferences'} />

          {/* Theme */}
          <DrawerRow isDark={isDark} icon={isDark ? '🌙' : '☀️'} label={isDark ? 'Dark Mode' : 'Light Mode'}
            right={<Toggle value={isDark} onChange={v => onPrefChange('theme', v ? 'dark' : 'light')} />}
          />

          {/* Language */}
          <DrawerRow isDark={isDark} icon="🌐" label={isAR ? 'اللغة' : 'Language'}
            right={
              <div style={{ display: 'flex', background: isDark ? '#0d0d14' : '#e0e0e8', borderRadius: 10, overflow: 'hidden', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}` }}>
                {(['EN', 'AR'] as const).map(l => (
                  <button key={l} onClick={() => onPrefChange('language', l.toLowerCase())}
                    style={{ padding: '5px 11px', background: prefs.language === l.toLowerCase() ? 'linear-gradient(135deg,#d4af37,#b8882a)' : 'transparent', border: 'none', color: prefs.language === l.toLowerCase() ? '#0a0800' : '#4a4a5a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            }
          />

          {/* Currency */}
          <DrawerRow isDark={isDark} icon="💵" label={isAR ? 'العملة' : 'Currency'}
            right={
              <div style={{ display: 'flex', background: isDark ? '#0d0d14' : '#e0e0e8', borderRadius: 10, overflow: 'hidden', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}` }}>
                {(['PI', 'USD'] as const).map(c => (
                  <button key={c} onClick={() => onPrefChange('currency', c)}
                    style={{ padding: '5px 11px', background: prefs.currency === c ? 'linear-gradient(135deg,#d4af37,#b8882a)' : 'transparent', border: 'none', color: prefs.currency === c ? '#0a0800' : '#4a4a5a', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    {c}
                  </button>
                ))}
              </div>
            }
          />

          {/* Pi Rate */}
          {isUSD && (
            <div style={{ margin: '0 20px 4px', padding: '8px 12px', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, color: '#4a4a5a' }}>{isAR ? 'السعر الحالي' : 'Current rate'}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d4af37' }}>1π ≈ ${piRate.toFixed(4)} USD</div>
            </div>
          )}

          {/* Hide Prices */}
          <DrawerRow isDark={isDark} icon="👁️" label={isAR ? 'إخفاء الأسعار' : 'Hide Prices'}
            right={<Toggle value={prefs.hideBalance} onChange={v => onPrefChange('hideBalance', v)} />}
          />

          {/* ── Notifications ─── */}
          <SectionLabel label={isAR ? 'الإشعارات' : 'Notifications'} />

          <DrawerRow isDark={isDark} icon="🔔" label={isAR ? 'الإشعارات' : 'Notifications'}
            onClick={onNotif}
            right={
              (notifCount ?? 0) > 0 ? (
                <span style={{ background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 20 }}>
                  {notifCount}
                </span>
              ) : undefined
            }
          />

          {/* ── App ─── */}
          <SectionLabel label={isAR ? 'التطبيق' : 'App'} />

          {/* Share */}
          <DrawerRow isDark={isDark} icon="🔗" label={isAR ? 'مشاركة التطبيق' : 'Share App'} onClick={handleShare} />

          {/* Help */}
          <DrawerRow isDark={isDark} icon="❓" label={isAR ? 'المساعدة' : 'Help & Support'}
            onClick={() => { window.location.href = `${hubUrl}/hub`; }}
          />

          {/* Privacy */}
          <DrawerRow isDark={isDark} icon="🔒" label={isAR ? 'سياسة الخصوصية' : 'Privacy Policy'}
            onClick={() => { window.location.href = `${hubUrl}/privacy`; }}
          />

          {/* ── System ─── */}
          <SectionLabel label={isAR ? 'النظام' : 'System'} />

          {/* Connection */}
          <DrawerRow isDark={isDark} icon={isOnline ? '📶' : '📵'} label={isAR ? 'الاتصال' : 'Connection'}
            right={
              <span style={{ fontSize: 11, fontWeight: 600, color: isOnline ? '#10b981' : '#ef4444' }}>
                {isOnline ? (isAR ? 'متصل' : 'Online') : (isAR ? 'غير متصل' : 'Offline')}
              </span>
            }
          />

          {/* Clear Cache */}
          <DrawerRow isDark={isDark} icon="🗑️" label={isAR ? 'مسح الذاكرة المؤقتة' : 'Clear Cache'}
            onClick={handleClearCache}
            right={
              cacheCleared ? (
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>✓ Done</span>
              ) : undefined
            }
          />

        </div>

        {/* ── Footer ──────────────────────────── */}
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${border}` }}>
          <button onClick={() => { window.location.href = `${hubUrl}/hub`; }}
            style={{ width: '100%', padding: '11px', borderRadius: 12, background: isDark ? '#ffffff08' : '#e0e0e8', border: `1px solid ${isDark ? '#ffffff10' : '#ccc'}`, color: '#d4af37', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
            🔷 {isAR ? 'العودة للمركز' : 'Back to Hub'}
          </button>

          {/* Version */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#d0d0e0' : '#555', marginBottom: 2 }}>
              TEC Commerce
            </div>
            <div style={{ fontSize: 10, color: '#4a4a5a' }}>
              v{APP_VERSION} · Build {BUILD}
            </div>
            <div style={{ fontSize: 9, color: '#3a3a4a', marginTop: 4, letterSpacing: 0.5 }}>
              © 2026 TEC Ecosystem · Pi Network
            </div>
          </div>
        </div>

      </div>
    </>
  );
                }
