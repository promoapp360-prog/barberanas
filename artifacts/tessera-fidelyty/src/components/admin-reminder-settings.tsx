import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Clock3, Save, ShieldCheck } from "lucide-react";
import {
  getGetReminderSettingsQueryKey,
  useGetReminderSettings,
  useUpdateReminderSettings,
} from "@workspace/api-client-react";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { error?: unknown } }).data;
    if (typeof data?.error === "string") return data.error;
  }
  return error instanceof Error ? error.message : "Riprova tra poco.";
}

export function AdminReminderSettings({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useGetReminderSettings({
    query: { queryKey: getGetReminderSettingsQueryKey() },
  });
  const save = useUpdateReminderSettings();
  const [enabled, setEnabled] = useState(false);
  const [afterDays, setAfterDays] = useState(30);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!query.data) return;
    setEnabled(query.data.enabled);
    setAfterDays(query.data.after_days);
    setTitle(query.data.title);
    setMessage(query.data.message);
  }, [query.data]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await save.mutateAsync({
        data: {
          enabled,
          after_days: afterDays,
          title: title.trim(),
          message: message.trim(),
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetReminderSettingsQueryKey(),
      });
      onNotice("Impostazioni promemoria salvate.");
    } catch (error) {
      onNotice(`Impostazioni non aggiornate: ${errorMessage(error)}`);
      await queryClient.invalidateQueries({
        queryKey: getGetReminderSettingsQueryKey(),
      });
    }
  };

  if (query.isLoading) {
    return <div className="skeleton h-64 rounded-2xl" role="status" aria-label="Caricamento promemoria" />;
  }
  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl border border-[#ead5ce] bg-[#fff8f4] p-6">
        <h2 className="font-semibold">Impostazioni non disponibili</h2>
        <p className="mt-1 text-sm text-[#81766d]">{errorMessage(query.error)}</p>
        <button type="button" className="btn-outline mt-4" onClick={() => void query.refetch()}>
          Riprova
        </button>
      </div>
    );
  }

  return (
    <section className="max-w-3xl">
      <div className="mb-7">
        <p className="eyebrow">Resta in contatto</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] sm:text-4xl">
          Promemoria visite
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[#81766d]">
          Imposta quando invitare i clienti a tornare. La notifica arriva solo a chi attiva volontariamente le push sulla propria tessera.
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe4d1] text-[#8f6b3e]">
            <BellRing size={18} />
          </span>
          <div>
            <p className="font-semibold">Notifiche OneSignal</p>
            <p className="mt-1 text-sm text-[#81766d]">
              {query.data.push_available
                ? "Chiave API verificata per l’app Da Barber Anas."
                : "Configurazione push non disponibile. Controlla i Secrets del progetto."}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe4d1] text-[#8f6b3e]">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="font-semibold">{query.data.subscribed_customers} clienti iscritti</p>
            <p className="mt-1 text-sm text-[#81766d]">
              Solo i clienti che hanno dato il consenso possono ricevere il promemoria.
            </p>
          </div>
        </div>
      </div>
      <p className="mb-5 rounded-xl border border-[#e4dbcf] bg-[#f1ece3] p-4 text-sm leading-5 text-[#756b60]">
        In OneSignal completa anche la piattaforma Web Push per l’origine esatta <strong>https://anas.promoapp.it</strong>. La chiave verificata qui è limitata all’app di Da Barber Anas; il worker push è già predisposto nel sito.
      </p>

      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-5 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#f1ece3] p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-[#9b7846]"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            data-testid="toggle-reminders-enabled"
          />
          <span>
            <span className="block font-semibold">{enabled ? "Promemoria attivi" : "Promemoria disattivati"}</span>
            <span className="mt-1 block text-sm leading-5 text-[#81766d]">
              {enabled
                ? "I promemoria vengono programmati per i clienti iscritti."
                : "Nessun nuovo promemoria verrà inviato; quelli già programmati saranno annullati."}
            </span>
          </span>
        </label>

        <div>
          <label className="label" htmlFor="reminder-after-days">Dopo quanti giorni senza visite?</label>
          <div className="relative">
            <Clock3 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#927143]" />
            <input
              id="reminder-after-days"
              className="field pl-10"
              type="number"
              min={1}
              max={30}
              required
              value={afterDays}
              onChange={(event) => setAfterDays(Number(event.target.value))}
              data-testid="input-reminder-days"
            />
          </div>
          <p className="mt-1 text-xs text-[#81766d]">Puoi scegliere da 1 a 30 giorni; il valore iniziale è 30.</p>
        </div>

        <div>
          <label className="label" htmlFor="reminder-title">Titolo della notifica</label>
          <input
            id="reminder-title"
            className="field"
            maxLength={60}
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            data-testid="input-reminder-title"
          />
        </div>

        <div>
          <label className="label" htmlFor="reminder-message">Testo del promemoria</label>
          <textarea
            id="reminder-message"
            className="field min-h-28 resize-y py-3"
            maxLength={240}
            required
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            data-testid="input-reminder-message"
          />
          <p className="mt-1 text-right text-xs text-[#81766d]">{message.length}/240</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#e7dfd4] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-[#81766d]">
            <CheckCircle2 size={15} className="shrink-0 text-[#647b58]" />
            Un nuovo timbro annulla il promemoria in attesa e fa ripartire il conteggio.
          </p>
          <button
            type="submit"
            className="btn-primary min-h-11 w-full sm:w-auto"
            disabled={save.isPending || afterDays < 1 || afterDays > 30}
            data-testid="button-save-reminder-settings"
          >
            <Save size={16} />
            {save.isPending ? "Salvo…" : "Salva promemoria"}
          </button>
        </div>
      </form>
    </section>
  );
}
