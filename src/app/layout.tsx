import { HUB_HOSTS } from '@/lib/pi-network';
import type { Metadata } from 'next';
import Script                   from 'next/script';
import { LocaleProvider }       from '@/lib/i18n';
import { BackendOfflineBanner } from '@/components/BackendOfflineBanner';
import { ArrivalReport } from '@/components/pioneer/ArrivalReport';

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
    // ADR-007/C-12 §3: Hub-entered = Hub owns this Pi Browser session — never
    // Pi.init() here (it poisons the session and breaks the Hub PaymentModal).
    // The SSO landing persists the flag; referrer covers direct hops.
    try{
      var __hubHosts=${JSON.stringify(HUB_HOSTS)};var __fromHub=false;
      try{__fromHub=!!document.referrer&&__hubHosts.indexOf(new URL(document.referrer).hostname.toLowerCase())!==-1;}catch(e){}
      if(sessionStorage.getItem('__tec_hub_entry')==='1'||__fromHub){
        window.__TEC_PI_FOREIGN_SESSION=true;setReady();return;
      }
    }catch(e){}
    if(typeof window.Pi==='undefined'){setTimeout(initPi,150);return;}
    try{
      // SANDBOX IS NOT TESTNET. The HOST decides which Pi APP the visitor is
      // in (and so which network the server approves against); "sandbox" points
      // the SDK at Pi's SANDBOX environment, a third thing. A paired Testnet
      // app is a normal app on its own domain — NOT the sandbox. Setting
      // sandbox:true there left the Pi bridge silent ("Messaging promise with
      // id 1 timed out after 120000ms"). Default false; ?pi_sandbox=1 is the
      // way back in, read ONLY on the Testnet host so no query param can put a
      // Mainnet payment into sandbox mode.
      var __isTestnetHost=/\\.vercel\\.app$/i.test(location.hostname)||/-test\\.tecosystem\\.app$/i.test(location.hostname);
      var __q=null; try{__q=new URLSearchParams(location.search).get('pi_sandbox');}catch(e){}
      var __sandbox=__isTestnetHost?(__q==='1'):${piSandbox};
      window.__TEC_PI_SANDBOX=__sandbox;
      window.Pi.init({version:'2.0',sandbox:__sandbox,appId:'${piAppId}'});
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
          <ArrivalReport />
          <BackendOfflineBanner />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
