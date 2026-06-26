'use client';

export function CommerceSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: '#050816', padding: '0 0 90px' }}>
      <style>{`
        @keyframes shimmer{0%,100%{opacity:0.4}50%{opacity:0.8}}
        .sk{animation:shimmer 1.4s ease infinite;background:#0B1020;border-radius:18px}
      `}</style>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #ffffff08',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ffffff08' }} />
          <div style={{ width: 80, height: 18, borderRadius: 6, background: '#ffffff08' }} />
        </div>
        <div style={{ width: 80, height: 18, borderRadius: 6, background: '#ffffff08' }} />
      </div>
      <div style={{ padding: '16px' }}>
        <div className="sk" style={{ height: 100, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="sk" style={{ flex: 1, height: 36 }} />
          ))}
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="sk" style={{ height: 120, marginBottom: 12 }} />
        ))}
      </div>
    </div>
  );
}
