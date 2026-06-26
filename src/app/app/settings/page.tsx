'use client';

import { useRouter }       from 'next/navigation';
import { useEffect }       from 'react';
import { usePiAuth }       from '@/lib-client/hooks/usePiAuth';
import { useSettings }     from '@/lib/hooks/useSettings';
import { useTranslation }  from '@/lib/i18n';
import { ErrorBoundary }   from '@/components/ErrorBoundary';

// ── Theme Colors ──────────────────────────────────────────
const THEMES = {
  dark: {
    bg:      '#050816',
    surface: '#0B1020',
    border:  '#ffffff08',
    text:    '#ffffff',
    subtext: '#6b6b7a',
  },
  light: {
    bg:      '#f5f5f7',
    surface: '#ffffff',
    border:  '#00000010',
    text:    '#1a1a2e',
    subtext: '#6b6b7a',
  },
};

type Theme = typeof THEMES.dark;

// ── Toggle ────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{
        width: 48, height: 28, borderRadius: 14,
        background:  value ? 'linear-gradient(135deg,#FBBF24,#F59E0B)' : '#ffffff15',
        border:      'none', cursor: 'pointer',
        position:    'relative', transition: 'all 0.25s', flexShrink: 0,
      }}>
      <span style={{
        position: 'absolute', top: 3, left: value ? 22 : 3,
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff', transition: 'left 0.25s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

// ── Select ────────────────────────────────────────────────
function Select<T extends string>({
  value, options, onChange,
}: {
  value:    T;
  options:  { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          style={{
            padding: '6px 14px', borderRadius: 20,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: value === opt.value ? '#FBBF2420' : '#ffffff08',
            color:      value === opt.value ? '#FBBF24'   : '#6b6b7a',
            border:     value === opt.value ? '1px solid #FBBF2440' : '1px solid transparent',
            transition: 'all 0.2s',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Section ───────────────────────────────────────────────
function Section({ title, icon, children, theme }: {
  title:    string;
  icon:     string;
  children: React.ReactNode;
  theme:    Theme;
}) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 20, overflow: 'hidden', marginBottom: 12,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: theme.subtext, letterSpacing: 2, textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────
function Row({ label, desc, children, theme }: {
  label:    string;
  desc?:    string;
  children: React.ReactNode;
  theme:    Theme;
}) {
  return (
    <div style={{
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${theme.border}`, gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: theme.text, fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 11, color: theme.subtext, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
function SettingsPageInner() {
  const { user, logout }            = usePiAuth();
  const { settings, update, reset } = useSettings();
  const { t, setLocale }            = useTranslation();
  const router                      = useRouter();

  // ✅ Resolve theme
  const resolvedTheme = settings.theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : settings.theme;

  const theme = THEMES[resolvedTheme];

  // ✅ Apply theme to body
  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color      = theme.text;
    return () => {
      document.body.style.background = '';
      document.body.style.color      = '';
    };
  }, [theme]);

  // ✅ Apply language on mount
  useEffect(() => {
    setLocale(settings.language);
    document.documentElement.dir  = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = settings.language;
  }, [settings.language, setLocale]);

  // ✅ Language change handler
  const handleLanguageChange = (lang: 'en' | 'ar') => {
    update('language', lang);
    setLocale(lang);
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  };

  const s = t.settings;

  return (
    <div style={{
      minHeight: '100vh', background: theme.bg, color: theme.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      paddingBottom: 40, transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      <style>{`
        .btn:active { transform: scale(0.97); }
        @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        .fade-in { animation: slideUp 0.3s ease; }
      `}</style>

      {/* ── Header ── */}
      <header style={{
        padding: '14px 20px', borderBottom: `1px solid ${theme.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0,
        background: resolvedTheme === 'dark' ? 'rgba(2,2,5,0.95)' : 'rgba(245,245,247,0.95)',
        backdropFilter: 'blur(20px)', zIndex: 100,
      }}>
        <button className="btn" onClick={() => router.back()}
          style={{
            background: theme.surface, border: `1px solid ${theme.border}`,
            borderRadius: 10, padding: '6px 12px',
            color: '#FBBF24', fontSize: 14, cursor: 'pointer',
          }}>
          {s.back}
        </button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text }}>{s.title}</div>
          <div style={{ fontSize: 9, color: theme.subtext, letterSpacing: 2 }}>{s.subtitle}</div>
        </div>
      </header>

      <div style={{ padding: '16px 16px 0' }} className="fade-in">

        {/* ── Profile ── */}
        <Section title={s.profile} icon="👤" theme={theme}>
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg,#FBBF24,#F59E0B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#0a0800', flexShrink: 0,
            }}>
              {user?.piUsername?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>
                @{user?.piUsername ?? '—'}
              </div>
              <div style={{ fontSize: 11, color: theme.subtext, marginTop: 3 }}>
                {user?.role ?? 'Member'} · {user?.subscriptionPlan ?? 'Free'}
              </div>
              <div style={{
                marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#7ee7c010', border: '1px solid #7ee7c030',
                borderRadius: 20, padding: '3px 10px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7ee7c0' }} />
                <span style={{ fontSize: 10, color: '#7ee7c0', fontWeight: 600 }}>{s.connectedPi}</span>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Appearance ── */}
        <Section title={s.appearance} icon="🎨" theme={theme}>
          <Row label={s.theme} desc={s.themeDesc} theme={theme}>
            <Select
              value={settings.theme}
              onChange={v => update('theme', v)}
              options={[
                { value: 'dark',   label: s.dark  },
                { value: 'light',  label: s.light },
                { value: 'system', label: s.auto  },
              ]}
            />
          </Row>
          <Row label={s.language} desc={s.languageDesc} theme={theme}>
            <Select
              value={settings.language}
              onChange={handleLanguageChange}
              options={[
                { value: 'en', label: '🇺🇸 EN' },
                { value: 'ar', label: '🇸🇦 AR' },
              ]}
            />
          </Row>
        </Section>

        {/* ── Assets Display ── */}
        <Section title={s.assetsDisplay} icon="💎" theme={theme}>
          <Row label={s.showValues} desc={s.showValuesDesc} theme={theme}>
            <Toggle value={settings.showValues} onChange={v => update('showValues', v)} />
          </Row>
          <Row label={s.hideBalance} desc={s.hideBalanceDesc} theme={theme}>
            <Toggle value={settings.hideBalance} onChange={v => update('hideBalance', v)} />
          </Row>
          <Row label={s.currency} desc={s.currencyDesc} theme={theme}>
            <Select
              value={settings.currency}
              onChange={v => update('currency', v)}
              options={[
                { value: 'PI',  label: 'π PI'  },
                { value: 'USD', label: '$ USD' },
              ]}
            />
          </Row>
          <Row label={s.defaultTab} desc={s.defaultTabDesc} theme={theme}>
            <Select
              value={settings.defaultTab}
              onChange={v => update('defaultTab', v)}
              options={[
                { value: 'all',     label: t.assets.all     },
                { value: 'domains', label: t.assets.domains },
                { value: 'nfts',    label: t.assets.nfts    },
              ]}
            />
          </Row>
        </Section>

        {/* ── Notifications ── */}
        <Section title={s.notifications} icon="🔔" theme={theme}>
          <Row label={s.assetUpdates} desc={s.assetUpdatesDesc} theme={theme}>
            <Toggle value={settings.notifyAssets} onChange={v => update('notifyAssets', v)} />
          </Row>
          <Row label={s.priceAlerts} desc={s.priceAlertsDesc} theme={theme}>
            <Toggle value={settings.notifyPrice} onChange={v => update('notifyPrice', v)} />
          </Row>
        </Section>

        {/* ── Privacy ── */}
        <Section title={s.privacy} icon="🔒" theme={theme}>
          <Row label={s.hideAmount} desc={s.hideAmountDesc} theme={theme}>
            <Toggle value={settings.hideBalance} onChange={v => update('hideBalance', v)} />
          </Row>
        </Section>

        {/* ── About ── */}
        <Section title={s.about} icon="ℹ️" theme={theme}>
          <Row label={s.version} theme={theme}>
            <span style={{ fontSize: 13, color: theme.subtext }}>1.0.0</span>
          </Row>
          <Row label={s.domain} theme={theme}>
            <span style={{ fontSize: 13, color: theme.subtext }}>assets.pi</span>
          </Row>
          <Row label={s.ecosystem} theme={theme}>
            <span style={{ fontSize: 13, color: '#FBBF24' }}>TEC · 24 Apps</span>
          </Row>
          <Row label={s.builtOn} theme={theme}>
            <span style={{ fontSize: 13, color: theme.subtext }}>Pi Network</span>
          </Row>
        </Section>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <button className="btn" onClick={reset}
            style={{
              padding: '14px', borderRadius: 16,
              background: theme.surface, border: `1px solid ${theme.border}`,
              color: theme.subtext, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
            {s.resetDefaults}
          </button>
          <button className="btn" onClick={logout}
            style={{
              padding: '14px', borderRadius: 16,
              background: '#1a0505', border: '1px solid #e74c3c30',
              color: '#e74c3c', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
            {s.logout}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ErrorBoundary>
      <SettingsPageInner />
    </ErrorBoundary>
  );
      }
