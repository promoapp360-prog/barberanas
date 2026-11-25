import { useState, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let prompt: InstallPrompt | undefined;
let installed = false;
const standalone = window.matchMedia('(display-mode: standalone)');
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const state = () => installed || standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone
  ? 'installed' : prompt ? 'prompt' : 'manual';
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  prompt = event as InstallPrompt;
  notify();
});
window.addEventListener('appinstalled', () => {
  installed = true;
  prompt = undefined;
  notify();
});
standalone.addEventListener('change', notify);

export function InstallApp({ className }: { className: string }) {
  const installState = useSyncExternalStore(subscribe, state);
  const [showHelp, setShowHelp] = useState(false);
  if (installState === 'installed') return null;

  const install = async () => {
    if (!prompt || window.top !== window.self) {
      setShowHelp(true);
      return;
    }
    const request = prompt;
    prompt = undefined;
    notify();
    try {
      await request.prompt();
      if ((await request.userChoice).outcome === 'accepted') {
        installed = true;
        notify();
      }
    } catch {
      setShowHelp(true);
    }
  };

  return <>
    <button className={className} type="button" data-testid="button-install-app" onClick={() => void install()}>
      <Download size={16} aria-hidden="true" /> Installa app
    </button>
    {showHelp && <InstallHelp close={() => setShowHelp(false)} />}
  </>;
}

function InstallHelp({ close }: { close: () => void }) {
  return <div className="install-help" role="status">
    <div>
      {window.top !== window.self && <p>Apri prima l’app <a href={window.location.href} target="_blank" rel="noopener noreferrer" data-testid="link-install-open-browser">in una nuova scheda</a>.</p>}
      <p>{isIOS ? <>In Safari, tocca <strong>Condividi</strong>, poi <strong>Aggiungi alla schermata Home</strong>.</>
        : <>Nel menu del browser, scegli <strong>Installa app</strong> o <strong>Aggiungi a schermata Home</strong>, se disponibile.</>}</p>
    </div>
    <button type="button" className="btn-outline" data-testid="button-close-install-help" onClick={close}>Chiudi</button>
  </div>;
}
