import type { Metadata } from 'next';
import Script                   from 'next/script';
import { LocaleProvider }       from '@/lib/i18n';
import { BackendOfflineBanner } from '@/components/BackendOfflineBanner';

export const metadata: Metadata = {
  title:       'TEC Commerce — Pi Marketplace',
  description: 'Buy and sell on the Pi Network marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <style>{`
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; width: 100%; background: #020205; }
          body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
        `}</style>
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />

        <Script
          id="pi-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  var MAX = 40;
  var tries = 0;

  function setReady() {
    window.__TEC_PI_READY = true;
    window.dispatchEvent(new Event('tec-pi-ready'));
  }

  function setError() {
    window.__TEC_PI_ERROR = true;
    window.dispatchEvent(new Event('tec-pi-error'));
  }

  function initPi() {
    if (tries++ >= MAX) { setError(); return; }

    if (typeof window.Pi === 'undefined') {
      setTimeout(initPi, 150);
      return;
    }

    try {
      var r = window.Pi.init({
        version: '2.0',
        sandbox: ${process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'},
        appId:   '${process.env.NEXT_PUBLIC_PI_APP_ID ?? ''}',
      });
      if (r && typeof r.then === 'function') {
        r.then(setReady).catch(function() { setTimeout(initPi, 300); });
      } else {
        setReady();
      }
    } catch(e) {
      var msg = String(e).toLowerCase();
      if (msg.includes('already') || msg.includes('initialized')) {
        // ✅ Pi SDK initialized لـ Hub في نفس الـ session
        // Reload مرة واحدة بس → يعطي fresh Pi SDK instance لـ Commerce
        var reloaded = sessionStorage.getItem('tec_pi_reloaded');
        if (!reloaded) {
          sessionStorage.setItem('tec_pi_reloaded', '1');
          window.location.reload();
        } else {
          // بعد الـ reload Pi.init المفروض نجح — لو وصلنا هنا تاني = error
          sessionStorage.removeItem('tec_pi_reloaded');
          setError();
        }
      } else {
        setTimeout(initPi, 150);
      }
    }
  }

  // ✅ امسح الـ reload flag لو Pi.init نجح قبل كده
  initPi();
})();
            `,
          }}
        />

        <LocaleProvider>
          <BackendOfflineBanner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
