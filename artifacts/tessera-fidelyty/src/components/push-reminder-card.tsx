import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, LoaderCircle } from "lucide-react";
import {
  getGetCustomerCardQueryKey,
  useUpdateCustomerPushConsent,
} from "@workspace/api-client-react";
import { initializeOneSignal, type OneSignalClient } from "@/lib/onesignal";

const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
const isInstalled =
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIosHomeScreenRequired = isIos && !isInstalled;
const isOfficialOrigin = window.location.origin === "https://anas.promoapp.it";

export function PushReminderCard({
  token,
  externalId,
  enabled,
  pushAvailable,
  optedIn,
  afterDays,
}: {
  token: string;
  externalId: string | null;
  enabled: boolean;
  pushAvailable: boolean;
  optedIn: boolean;
  afterDays: number;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateConsent, isPending } = useUpdateCustomerPushConsent();
  const [client, setClient] = useState<OneSignalClient | null>(null);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushAvailable || (!enabled && !optedIn) || !externalId || !isOfficialOrigin) return;
    let active = true;
    void initializeOneSignal()
      .then(async (sdk) => {
        if (!active) return;
        setClient(sdk);
        setSupported(sdk.Notifications.isPushSupported());
        if (optedIn) {
          await sdk.login(externalId);
          if (!sdk.User.PushSubscription.optedIn) {
            await updateConsent({ data: { token, enabled: false } });
            await queryClient.invalidateQueries({
              queryKey: getGetCustomerCardQueryKey(token),
            });
          }
        }
      })
      .catch(() => {
        if (active) setError("Non riusciamo a preparare le notifiche in questo momento.");
      });
    return () => {
      active = false;
    };
  }, [enabled, externalId, optedIn, pushAvailable, queryClient, token, updateConsent]);

  const update = async (next: boolean) => {
    if (!client || !externalId || busy) return;
    setBusy(true);
    setError("");
    try {
      if (next) {
        // Start both SDK calls directly from the tap so the browser permission
        // prompt remains attached to the user's gesture.
        const login = client.login(externalId);
        const subscribe = client.User.PushSubscription.optIn();
        await Promise.all([login, subscribe]);
        if (!client.User.PushSubscription.optedIn) {
          throw new Error("Attiva le notifiche dal messaggio del browser.");
        }
        await updateConsent({ data: { token, enabled: true } });
      } else {
        await client.User.PushSubscription.optOut();
        await updateConsent({ data: { token, enabled: false } });
      }
      await queryClient.invalidateQueries({
        queryKey: getGetCustomerCardQueryKey(token),
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Non siamo riusciti a modificare la preferenza. Riprova.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!pushAvailable || (!enabled && !optedIn)) return null;

  return (
    <section className="mt-4 rounded-[22px] border border-[#e4dbcf] bg-[#fbf8f1] p-5">
      <div className="flex items-start gap-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe4d1] text-[#8f6b3e]">
          {optedIn ? <Check size={19} /> : <BellRing size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold tracking-[-.02em]">
            {optedIn ? "Promemoria attivi" : "Un promemoria per la prossima visita"}
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#81766d]">
            {optedIn
              ? `Riceverai una notifica dopo ${afterDays} giorni senza visite. Puoi disattivarla quando vuoi.`
              : `Attiva le notifiche per ricevere un promemoria dopo ${afterDays} giorni senza visite.`}
          </p>
        </div>
      </div>

      {!isOfficialOrigin ? (
        <p className="mt-4 rounded-xl bg-[#f1ece3] p-3 text-sm leading-5 text-[#756b60]">
          Apri la tessera su anas.promoapp.it per attivare le notifiche.
        </p>
      ) : isIosHomeScreenRequired ? (
        <p className="mt-4 rounded-xl bg-[#f1ece3] p-3 text-sm leading-5 text-[#756b60]">
          Su iPhone, aggiungi prima la tessera alla schermata Home e aprila da lì. Le notifiche richiedono iOS 16.4 o successivo.
        </p>
      ) : !supported && client ? (
        <p className="mt-4 rounded-xl bg-[#f1ece3] p-3 text-sm leading-5 text-[#756b60]">
          Questo browser non supporta le notifiche push. Apri la tessera in Safari o Chrome aggiornato.
        </p>
      ) : (
        <button
          type="button"
          className={optedIn ? "btn-outline mt-4 min-h-11 w-full" : "btn-primary mt-4 min-h-11 w-full"}
          onClick={() => void update(!optedIn)}
          disabled={!client || !supported || busy || isPending}
        >
          {busy || isPending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : optedIn ? (
            <BellRing size={16} />
          ) : (
            <BellRing size={16} />
          )}
          {busy || isPending
            ? "Aggiorno la preferenza…"
            : optedIn
              ? "Disattiva promemoria"
              : "Attiva promemoria push"}
        </button>
      )}
      {!optedIn && <p className="mt-2 text-center text-xs text-[#81766d]">Riceverai solo il promemoria che hai scelto di attivare.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-[#9b4437]">{error}</p>}
    </section>
  );
}
