import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { Camera, LoaderCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function tokenFromQr(value: string) {
  const text = value.trim();
  const cardLink = text.match(/\/c\/([\w-]{8,80})(?:[/?#]|$)/);
  if (cardLink) return cardLink[1];
  return /^[\w-]{8,80}$/.test(text) ? text : null;
}

function stopStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function errorName(error: unknown) {
  return error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === 'CAMERA_TIMEOUT') {
    return 'La richiesta della fotocamera non ha ricevuto risposta. Riprova e, se non compare la richiesta, controlla i permessi del browser.';
  }
  switch (errorName(error)) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Accesso alla fotocamera negato. Consenti la fotocamera nelle impostazioni di Safari e ricarica la pagina.';
    case 'NotFoundError':
      return 'Non è stata trovata una fotocamera disponibile su questo dispositivo.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'La fotocamera è già in uso. Chiudi le altre app che la stanno usando e riprova.';
    default:
      return 'Non riesco ad avviare la fotocamera. Controlla i permessi del browser oppure inserisci il codice manualmente.';
  }
}

export function QrCameraScanner({ onClose, onScan }: { onClose: () => void; onScan: (token: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const stopCamera = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      controlsRef.current?.stop();
      stopStream(streamRef.current);
      streamRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    const attempt = ++attemptRef.current;
    setStatus('starting');
    setMessage('Attendo l’autorizzazione della fotocamera…');

    if (!window.isSecureContext) {
      setStatus('error');
      setMessage('La fotocamera richiede una connessione sicura HTTPS. Apri l’indirizzo del negozio e riprova.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setMessage('Questo browser non consente l’accesso alla fotocamera. Apri la pagina con Safari o Chrome aggiornato.');
      return;
    }

    let timedOut = false;
    let timeoutId: number | undefined;
    stopCamera();

    try {
      // Call getUserMedia directly from the button tap for better iOS Safari compatibility.
      const streamRequest = navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      }).catch((error: unknown) => {
        if (timedOut || attemptRef.current !== attempt || errorName(error) !== 'OverconstrainedError') throw error;
        return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      });
      void streamRequest.then((stream) => {
        if (timedOut || attemptRef.current !== attempt) stopStream(stream);
      }, () => undefined);

      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          reject(new Error('CAMERA_TIMEOUT'));
        }, 15000);
      });
      const stream = await Promise.race([streamRequest, timeout]);
      if (timedOut || attemptRef.current !== attempt) {
        stopStream(stream);
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopCamera();
        return;
      }

      const initializeReader = async () => {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (timedOut || attemptRef.current !== attempt) return null;
        const reader = new BrowserQRCodeReader();
        const activeControls = await reader.decodeFromStream(stream, video, (result, _error, currentControls) => {
          if (!result || timedOut || attemptRef.current !== attempt) return;
          const token = tokenFromQr(result.getText());
          if (!token) {
            setMessage('Questo QR non sembra una tessera cliente. Inquadra il QR della tessera.');
            return;
          }
          attemptRef.current += 1;
          currentControls.stop();
          stopCamera();
          onScan(token);
        });
        if (timedOut || attemptRef.current !== attempt) {
          activeControls.stop();
          return null;
        }
        return activeControls;
      };
      const controls = await Promise.race([initializeReader(), timeout]);
      if (!controls) return;
      controlsRef.current = controls;
      if (attemptRef.current !== attempt) controls.stop();
      else {
        setStatus('ready');
        setMessage('Tieni il QR della tessera dentro il riquadro.');
      }
    } catch (error) {
      if (attemptRef.current === attempt) {
        stopCamera();
        setStatus('error');
        setMessage(cameraErrorMessage(error));
      }
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg border-[#665331] bg-[#101115] text-[#f7f6f3] sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#f0ce82]"><Camera size={19} /> Scansione QR</DialogTitle>
          <DialogDescription className="text-[#cbc7be]">Inquadra il QR della tessera che il cliente mostra sul telefono.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#51442f] bg-black">
          <video ref={videoRef} autoPlay muted playsInline aria-label="Anteprima fotocamera per la scansione del QR" className="h-full w-full object-cover" />
          {status === 'ready' && <span className="pointer-events-none absolute inset-[14%] rounded-xl border-2 border-[#f0ce82] shadow-[0_0_0_999px_#0004]" />}
          {status !== 'ready' && <div className="absolute inset-0 grid place-items-center bg-black/70 px-5 text-center text-sm text-white">
            <span>
              {status === 'starting' ? <LoaderCircle className="mx-auto mb-3 animate-spin text-[#f0ce82]" size={28} /> : <Camera className="mx-auto mb-3 text-[#f0ce82]" size={28} />}
              {status === 'idle' ? 'Premi “Avvia fotocamera” per leggere il QR.' : message}
            </span>
          </div>}
        </div>
        {status === 'ready' && <p aria-live="polite" className="text-center text-sm text-[#f0ce82]">{message}</p>}
        {status === 'error' && <p role="alert" className="text-center text-sm text-[#f0ce82]">{message}</p>}
        {status !== 'ready' && <button type="button" onClick={startCamera} disabled={status === 'starting'} className="btn-primary w-full disabled:cursor-wait disabled:opacity-70">
          {status === 'starting' ? <><LoaderCircle size={17} className="animate-spin" /> Attendo la fotocamera…</> : <><Camera size={17} /> Avvia fotocamera</>}
        </button>}
        <p aria-live="polite" className="text-center text-xs text-[#a8a49d]">{status === 'starting' ? 'Se la richiesta non compare, verifica i permessi della fotocamera nelle impostazioni del browser.' : 'La fotocamera si attiva solo mentre questa finestra è aperta.'}</p>
        <button type="button" onClick={onClose} className="w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-[#cbc7be] hover:bg-white/5">Chiudi e inserisci il codice manualmente</button>
      </DialogContent>
    </Dialog>
  );
}
