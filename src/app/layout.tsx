import type { Metadata } from 'next';
import Script                   from 'next/script';
import { LocaleProvider }       from '@/lib/i18n';
import { BackendOfflineBanner } from '@/components/BackendOfflineBanner';

export const metadata: Metadata = {
  title:       'TEC Commerce — Pi Marketplace',
  description: 'Buy and sell on the Pi Network marketplace',
};

const piSandbox = process.env.NEXT_PUBLIC_PI_SANDBOX === 'true';
const piAppId   = process.env.NEXT_PUBLIC_PI_APP_ID ?? '';
const piScript  = `(function(){
  var tries=0;
  function setReady(){window.__TEC_PI_READY=true;window.dispatchEvent(new Event('tec-pi-ready'));}
  function initPi(){
    if(tries++>=40)return;
    if(typeof window.Pi==='undefined'){setTimeout(initPi,150);return;}
    try{
      window.Pi.init({version:'2.0',sandbox:${piSandbox},appId:'${piAppId}'});
      setReady();
    }catch(e){
      var msg=String(e).toLowerCase();
      if(msg.includes('already')||msg.includes('initialized')){
        window.__TEC_PI_FOREIGN_SESSION=true;
        setReady();
      }else{setTimeout(initPi,150);}
    }
  }
  initPi();
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <style>{`
          *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; width: 100%; background: #050816; }
          body { overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
        `}</style>
      </head>
      <body>
        <Script src="https://sdk.minepi.com/pi-sdk.js" strategy="beforeInteractive" />
        <Script id="pi-init" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: piScript }} />
        <LocaleProvider>
          <BackendOfflineBanner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
