import type { Metadata } from 'next';
import Script            from 'next/script';
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
        {/* ✅ Pi SDK — beforeInteractive بدل sync script */}
        <Script
          src="https://sdk.minepi.com/pi-sdk.js"
          strategy="beforeInteractive"
        />
        <Script
          id="pi-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function initPi() {
                  if (typeof window.Pi !== 'undefined') {
                    try {
                      window.Pi.init({
                        version: '2.0',
                        sandbox: ${process.env.NEXT_PUBLIC_PI_SANDBOX === 'true'},
                        appId:   '${process.env.NEXT_PUBLIC_PI_APP_ID ?? ''}',
                      });
                      window.__TEC_PI_READY = true;
                      window.dispatchEvent(new Event('tec-pi-ready'));
                    } catch(e) {
                      var msg = String(e);
                      if (msg.includes('already') || msg.includes('initialized')) {
                        window.__TEC_PI_READY = true;
                        window.dispatchEvent(new Event('tec-pi-ready'));
                      } else {
                        window.__TEC_PI_ERROR = true;
                        window.dispatchEvent(new Event('tec-pi-error'));
                      }
                    }
                  } else {
                    setTimeout(initPi, 100);
                  }
                }
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
