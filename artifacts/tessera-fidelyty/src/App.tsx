import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  useCreateCustomer,
  useCreatePromo,
  useDeleteCustomer,
  useDeletePromo,
  useFindCustomerByToken,
  useGetAdminSession,
  useGetAdminStats,
  useGetCustomerCard,
  useGetCustomerDetail,
  useGetShopConfig,
  useListAdminPromos,
  useListCustomers,
  useListPublicPromos,
  useLoginAdmin,
  useLogoutAdmin,
  useRedeemCustomerReward,
  useStampCustomer,
  useUnstampCustomer,
  useUpdateCustomer,
  useUpdatePromo,
  getGetAdminSessionQueryKey,
  getGetAdminStatsQueryKey,
  getGetCustomerCardQueryKey,
  getGetCustomerDetailQueryKey,
  getGetQrSvgUrl,
  getListAdminPromosQueryKey,
  getListCustomersQueryKey,
  getListPublicPromosQueryKey,
} from '@workspace/api-client-react';
import type { AdminCustomer, CustomerProgram, Promo, PromoInput } from '@workspace/api-client-react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, ChevronRight, CircleHelp, Clock3, Download,
  Gift, LogOut, Mail, Menu, Plus, Printer, Scissors, Search, Settings2,
  ShieldCheck, Sparkles, TicketPercent, Trash2, UserRound, Users, X, BellRing,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { InstallApp } from '@/components/install-app';
import { QrCameraScanner } from '@/components/qr-camera-scanner';
import { PushReminderCard } from '@/components/push-reminder-card';
import { AdminReminderSettings } from '@/components/admin-reminder-settings';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { barberName } from '@/lib/barber-brand';
import { barberArtworkLogo, barberHaircutPhoto } from '@/lib/barber-images';
import { createCustomerCardImage } from '@/lib/customer-card-image';
import NotFound from '@/pages/not-found';
import { LandingPage } from '@/pages/landing-page';

const queryClient = new QueryClient();
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Si è verificato un errore. Riprova.';
const day = (value?: string | null) => value ? new Date(value).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : '';
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
const cardUrl = (token: string) => `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/c/${token}`;

function useNotice() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return { notice, setNotice };
}

function Notice({ text, close }: { text: string; close: () => void }) {
  if (!text) return null;
  return <div role="status" className="fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-xl bg-[#302821] px-4 py-3 text-sm text-[#fffaf0] shadow-xl">
    <Check size={16} className="text-[#d3b476]" />{text}<button aria-label="Chiudi avviso" onClick={close}><X size={15} /></button>
  </div>;
}

function Brand({ shop, dark = false }: { shop: string; dark?: boolean }) {
  return <div className="flex items-center gap-3">
    <span className={`brand-mark ${dark ? 'brand-mark-inverse' : ''}`}><Scissors size={20} /></span>
    <span className={`font-semibold tracking-[-.04em] ${dark ? 'text-white' : 'text-[#201b14]'}`}>{barberName(shop)}</span>
  </div>;
}

function PageLoader({ label = 'Un momento…' }: { label?: string }) {
  return <div className="mx-auto max-w-md px-5 py-14" role="status" aria-label={label}>
    <div className="skeleton mb-5 h-36 w-full" /><div className="skeleton mb-3 h-5 w-2/3" /><div className="skeleton h-4 w-1/2" />
  </div>;
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="rounded-2xl border border-[#ead5ce] bg-[#fff8f4] p-6 text-center">
    <CircleHelp className="mx-auto mb-3 text-[#a94e3d]" size={25} />
    <p className="font-semibold text-[#493b32]">Non riusciamo a caricare questa pagina</p>
    <p className="mt-1 text-sm text-[#81766d]">{message}</p>
    {retry && <button onClick={retry} className="btn-outline mt-4">Riprova</button>}
  </div>;
}

function ReminderErrorFallback() {
  return (
    <p role="status" className="mt-4 rounded-xl border border-[#e4dbcf] bg-[#f1ece3] p-4 text-sm leading-5 text-[#756b60]">
      I promemoria non sono disponibili su questo dispositivo. La tessera e il QR restano utilizzabili.
    </p>
  );
}

function PromoGlyph({ kind, size = 17 }: { kind: string; size?: number }) {
  return kind === 'offerta' ? <TicketPercent size={size} /> : <Scissors size={size} />;
}

function QrImage({ value, className = '' }: { value: string; className?: string }) {
  const src = getGetQrSvgUrl({ d: value });
  const [failedSrc, setFailedSrc] = useState('');
  if (failedSrc === src) return <div className={`grid aspect-square place-items-center bg-[#f2eee7] p-4 text-center text-xs text-[#81766d] ${className}`}>QR non disponibile</div>;
  return <img src={src} alt="Codice QR" className={`aspect-square ${className}`} onError={() => setFailedSrc(src)} />;
}

function StampRow({ program }: { program: CustomerProgram }) {
  const count = Math.max(0, Math.min(program.stamps, program.goal));
  const ready = count >= program.goal;
  return <div className="border-t border-[#4a3e2f] py-5 first:border-0">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-lg font-semibold"><Scissors size={17} className="text-[#d5b77e]" />{program.title}</div><p className="mt-1 text-xs text-[#b9ad9b]">{program.ends_at ? `Valida fino al ${day(program.ends_at)}` : 'La raccolta è in corso'}</p></div><span className="text-sm font-semibold text-[#e0c58f]">{count}<span className="text-[#9a8f7e]">/{program.goal}</span></span></div>
    <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-7">
      {Array.from({ length: program.goal }, (_, i) => <div key={i} className={`card-stamp ${i < count ? 'is-filled' : ''}`}><span className="text-xs font-semibold">{i < count ? <Check size={15} /> : String(i + 1).padStart(2, '0')}</span></div>)}
      <div className={`card-stamp is-reward ${ready ? 'is-ready' : ''}`}><Gift size={15} /><span>PREMIO</span></div>
    </div>
    <p className="mt-3 text-center text-sm text-[#d6c9b5]">{ready ? <span className="font-semibold text-[#e0c58f]">Premio pronto: {program.reward}</span> : <>Mancano <b className="text-[#eee3d1]">{program.goal - count}</b> {program.goal - count === 1 ? 'timbro' : 'timbri'} · {program.reward}</>}</p>
  </div>;
}

function CustomerCardPage() {
  const { token = '' } = useParams<{ token: string }>();
  const card = useGetCustomerCard(token, { query: { queryKey: getGetCustomerCardQueryKey(token), enabled: !!token, refetchInterval: 12000 } });
  const config = useGetShopConfig();
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [saveImageMessage, setSaveImageMessage] = useState('');
  const [saveImageError, setSaveImageError] = useState('');
  useEffect(() => { if (token) window.localStorage.setItem('tessera_token', token); }, [token]);
  if (card.isLoading) return <PageLoader label="Caricamento tessera" />;
  if (card.isError || !card.data) return <main className="min-h-[100dvh] bg-[#f2eee7] px-5 py-12"><div className="mx-auto max-w-md"><Brand shop={config.data?.shopName || 'Barberia'} /><div className="mt-10"><ErrorState message="Questo link non è valido o la tessera non è più disponibile." retry={() => card.refetch()} /></div><Link href="/" className="btn-primary mt-5 w-full"><ArrowLeft size={16} /> Crea o ritrova la tessera</Link></div></main>;
  const c = card.data;
  const rewards = c.programs.reduce((total, p) => total + p.rewards, 0);
  const saveCardImage = async () => {
    setIsSavingImage(true);
    setSaveImageMessage('');
    setSaveImageError('');
    try {
      const image = await createCustomerCardImage({
        customerName: c.name,
        shopName: barberName(c.shopName),
        cardUrl: cardUrl(token),
        logoUrl: barberArtworkLogo,
        program: c.programs[0] ? { goal: c.programs[0].goal, reward: c.programs[0].reward } : null,
      });
      const safeName = `${barberName(c.shopName)}-${c.name}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
      const filename = `${safeName || 'tessera'}-punti.png`;
      const file = new File([image], filename, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Tessera punti ${barberName(c.shopName)}` });
        setSaveImageMessage('Menu di condivisione chiuso. Se hai scelto “Salva immagine”, la tessera è nella galleria.');
      } else {
        const imageUrl = URL.createObjectURL(image);
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1500);
        setSaveImageMessage('Immagine scaricata. Aprila e scegli “Salva immagine” per aggiungerla alla galleria.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setSaveImageError(errorText(error));
    } finally {
      setIsSavingImage(false);
    }
  };
  return <main className="customer-page min-h-[100dvh] px-4 pb-10 pt-5 sm:px-6">
    <div className="mx-auto max-w-[480px]">
      <header className="mb-5 flex items-center justify-between"><Brand shop={c.shopName} /><span className="rounded-full border border-[#ded3c1] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#957545]">Tessera digitale</span></header>
      <section className="customer-loyalty-card">
        <div className="customer-card-cover">
          <img src={barberArtworkLogo} alt="" width={940} height={509} />
          <div className="customer-card-cover-copy"><p>La tua tessera digitale</p><h1>{c.name}</h1><span>{barberName(c.shopName)}</span></div>
          <span className="customer-card-mark"><Scissors size={18} /></span>
        </div>
        <div className="customer-card-body">
          <div className="customer-stamp-area">
            {c.programs.length ? c.programs.map((program) => <StampRow key={program.id} program={program} />) : <p className="py-7 text-center text-sm text-[#c9bcaa]">Nessuna raccolta punti attiva al momento.</p>}
          </div>
          <div className="mt-5 flex justify-between text-xs text-[#c9bcaa]"><span>Una visita alla volta, un premio alla volta.</span><span>{c.visits} {c.visits === 1 ? 'visita' : 'visite'}</span></div>
        </div>
      </section>
      {c.offers.length > 0 && <section className="mt-4 space-y-3">
        {c.offers.map((offer) => <article key={offer.id} className="flex gap-3 rounded-2xl border border-[#e1d6c5] bg-[#fbf8f1] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe4d1] text-[#8f6b3e]"><TicketPercent size={19} /></span><div><p className="font-semibold">{offer.title}</p><p className="mt-1 text-sm text-[#766c61]">{offer.description}</p>{offer.ends_at && <p className="mt-2 text-xs text-[#9b7846]">Fino al {day(offer.ends_at)}</p>}</div></article>)}
      </section>}
      <section className="mt-4 rounded-[22px] border border-[#e4dbcf] bg-[#fbf8f1] p-5 text-center">
        <p className="text-lg font-semibold tracking-[-.03em]">Mostrala al tuo barbiere</p><p className="mt-1 text-sm text-[#81766d]">Inquadra il QR per trovare subito la tua tessera.</p>
        <div className="mx-auto mt-4 w-[196px] rounded-2xl bg-white p-3 shadow-sm"><QrImage value={cardUrl(token)} className="w-full" /></div>
        <div className="mt-5 grid grid-cols-2 divide-x divide-[#e8dfd4]"><div><p className="text-2xl font-semibold text-[#8f6b3e]">{c.visits}</p><p className="text-[10px] uppercase tracking-[.15em] text-[#8a8074]">Visite</p></div><div><p className="text-2xl font-semibold text-[#8f6b3e]">{rewards}</p><p className="text-[10px] uppercase tracking-[.15em] text-[#8a8074]">Premi ricevuti</p></div></div>
        <button type="button" onClick={() => void saveCardImage()} disabled={isSavingImage} aria-busy={isSavingImage} className="btn-primary mt-5 min-h-12 w-full">
          <Download size={17} /> {isSavingImage ? 'Preparo la tessera…' : 'Salva la tessera in galleria'}
        </button>
        <p className="mt-2 text-xs leading-5 text-[#81766d]">Nel menu del telefono scegli “Salva immagine”. Il QR apre sempre la tessera aggiornata.</p>
        {saveImageMessage && <p role="status" className="mt-3 text-sm text-[#496246]">{saveImageMessage}</p>}
        {saveImageError && <p role="alert" className="mt-3 text-sm text-[#9b4437]">{saveImageError}</p>}
      </section>
      <ErrorBoundary FallbackComponent={ReminderErrorFallback} resetKey={token}>
        <PushReminderCard
          token={token}
          externalId={c.push_external_id}
          enabled={c.reminders_enabled}
          pushAvailable={c.push_available}
          optedIn={c.push_opted_in}
          afterDays={c.reminder_after_days}
        />
      </ErrorBoundary>
      <InstallApp className="btn-outline mt-4 min-h-11 w-full" />
      <p className="mt-5 text-center"><Link href="/?nuova=1" className="text-xs text-[#81766d] underline underline-offset-4">Questa non è la tua tessera?</Link></p>
      <p className="mt-4 text-center text-xs text-[#58637a]">{barberName(config.data?.shopName || c.shopName)} · A presto in barberia</p>
    </div>
  </main>;
}

type AdminSection = 'clienti' | 'promozioni' | 'promemoria' | 'negozio';
function AdminPage() {
  const qc = useQueryClient();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: false } });
  const login = useLoginAdmin();
  const logout = useLogoutAdmin();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [section, setSection] = useState<AdminSection>('clienti');
  const [search, setSearch] = useState('');
  const [chosenCustomer, setChosenCustomer] = useState<number | null>(null);
  const [formMode, setFormMode] = useState<'customer' | 'promo' | null>(null);
  const [editPromo, setEditPromo] = useState<Promo | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const { notice, setNotice } = useNotice();
  const config = useGetShopConfig();
  const shop = barberName(session.data?.shopName || config.data?.shopName);
  if (session.isLoading) return <main className="min-h-[100dvh] bg-[#f2eee7] p-5"><div className="skeleton mx-auto mt-20 h-72 max-w-md" /></main>;
  const authenticated = !!session.data?.ok;
  const doLogin = async (e: FormEvent) => {
    e.preventDefault(); setLoginError('');
    if (!password.trim()) { setLoginError('Inserisci la password per continuare.'); return; }
    try { await login.mutateAsync({ data: { password } }); await qc.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }); setPassword(''); }
    catch (err) { setLoginError(errorText(err)); }
  };
  if (!authenticated) return <main className="admin-login-page">
    <div className="admin-login-card">
      <div className="admin-login-photo"><img src={barberArtworkLogo} alt="" /><Link href="/" className="admin-login-back"><ArrowLeft size={15} /> Torna alla tessera</Link><div className="admin-login-photo-caption"><span>{shop}</span><strong>Area barbiere</strong></div></div>
      <div className="admin-login-content">
        <Brand shop={shop} /><div className="mt-8"><p className="eyebrow">Area riservata</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em]">Bentornato.</h1><p className="mt-2 text-sm text-[#81766d]">Accedi per gestire i clienti e le raccolte punti.</p></div>
        <form className="mt-7" onSubmit={doLogin}><input type="text" autoComplete="username" value="admin" readOnly tabIndex={-1} aria-hidden="true" className="sr-only" /><label className="label" htmlFor="admin-password">Password</label><input id="admin-password" data-testid="input-admin-password" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError && <p role="alert" className="mt-3 rounded-xl bg-[#f9e8e2] px-3 py-2 text-sm text-[#9b4437]">{loginError}</p>}
          <button className="btn-primary mt-5 w-full" disabled={login.isPending}>{login.isPending ? 'Accesso in corso…' : <>Entra nel pannello <ArrowRight size={17} /></>}</button>
        </form>
        <p className="mt-6 flex gap-2 border-t border-[#ebe4da] pt-5 text-xs leading-5 text-[#91877a]"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> I dati dei clienti sono accessibili solo al personale autorizzato.</p>
      </div>
    </div>
  </main>;
  const nav = (label: string, key: AdminSection, icon: ReactNode) => <button key={key} className={`nav-item ${section === key ? 'active' : ''}`} onClick={() => { setSection(key); setMobileNav(false); }} data-testid={`nav-${key}`}>{icon}{label}</button>;
  const logoutNow = async () => { try { await logout.mutateAsync(); await qc.invalidateQueries({ queryKey: getGetAdminSessionQueryKey() }); } catch (err) { setNotice(errorText(err)); } };
  return <div className="admin-shell flex">
    <aside className={`admin-sidebar fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col px-4 py-5 transition-transform md:static md:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-10 px-2"><Brand shop={shop} dark /><p className="ml-[54px] mt-1 text-[10px] uppercase tracking-[.16em] text-[#b9ad9b]">Gestione tessere</p></div>
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-[#a89a86]">Il negozio</p>
      <nav className="space-y-1">{nav('Clienti', 'clienti', <Users size={17} />)}{nav('Promozioni', 'promozioni', <Gift size={17} />)}{nav('Promemoria', 'promemoria', <BellRing size={17} />)}{nav('Locandina & QR', 'negozio', <Printer size={17} />)}</nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.05] p-4"><div className="flex items-center gap-2 text-sm font-medium"><span className="h-2 w-2 rounded-full bg-[#95b18c]" /> Pannello protetto</div><p className="mt-2 text-xs leading-5 text-[#b9ad9b]">Le tessere si aggiornano in tempo reale durante la visita.</p></div>
      <button onClick={logoutNow} className="mt-4 flex items-center gap-2 rounded-xl px-3 py-3 text-sm text-[#c9c0b4] hover:bg-white/10" data-testid="button-logout"><LogOut size={16} /> Esci dal pannello</button>
    </aside>
    {mobileNav && <button aria-label="Chiudi menu" onClick={() => setMobileNav(false)} className="fixed inset-0 z-30 bg-black/30 md:hidden" />}
    <main className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e4dbcf] bg-[#f2eee7]/95 px-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3"><button className="btn-outline px-2.5 py-2 md:hidden" onClick={() => setMobileNav(true)} aria-label="Apri menu"><Menu size={18} /></button><span className="text-xs text-[#8a8074]">Il tuo negozio</span><ChevronRight size={14} className="text-[#b5aa9b]" /><span className="text-sm font-semibold">{section === 'clienti' ? 'Clienti' : section === 'promozioni' ? 'Promozioni' : section === 'promemoria' ? 'Promemoria' : 'Locandina'}</span></div>
        <div className="flex items-center gap-2 text-xs text-[#746a5e]"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#e7ddcd] font-semibold text-[#755c37]">{initials(shop)}</span><span className="hidden sm:inline">{shop}</span></div>
      </header>
      <div className="mx-auto max-w-[1260px] px-4 py-6 sm:px-7 sm:py-8">
        {section === 'clienti' && <CustomersSection search={search} setSearch={setSearch} selected={chosenCustomer} setSelected={setChosenCustomer} onNew={() => setFormMode('customer')} />}
        {section === 'promozioni' && <PromosSection onNew={(kind) => { setEditPromo({ id: 0, kind, title: '', emoji: kind === 'punti' ? '✂' : '★', goal: kind === 'punti' ? 6 : null, reward: kind === 'punti' ? 'Un servizio in omaggio' : '', description: '', active: true, ends_at: null, live: true, created_at: '' }); setFormMode('promo'); }} onEdit={(promo) => { setEditPromo(promo); setFormMode('promo'); }} onNotice={setNotice} />}
        {section === 'promemoria' && <AdminReminderSettings onNotice={setNotice} />}
        {section === 'negozio' && <ShopSection shop={shop} />}
      </div>
    </main>
    {chosenCustomer !== null && <CustomerDetailModal id={chosenCustomer} close={() => setChosenCustomer(null)} onNotice={setNotice} />}
    {formMode === 'customer' && <CustomerFormModal close={() => setFormMode(null)} onCreated={(id) => { setFormMode(null); setChosenCustomer(id); }} onNotice={setNotice} />}
    {formMode === 'promo' && editPromo && <PromoFormModal promo={editPromo} close={() => { setFormMode(null); setEditPromo(null); }} onNotice={setNotice} />}
    <Notice text={notice} close={() => setNotice('')} />
  </div>;
}

function CustomersSection({ search, setSearch, selected, setSelected, onNew }: { search: string; setSearch: (v: string) => void; selected: number | null; setSelected: (id: number | null) => void; onNew: () => void }) {
  const query = useListCustomers({ q: search.trim() || undefined }, { query: { queryKey: getListCustomersQueryKey({ q: search.trim() || undefined }) } });
  const stats = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const promos = useListAdminPromos({ query: { queryKey: getListAdminPromosQueryKey() } });
  const [tokenInput, setTokenInput] = useState('');
  const [lookupToken, setLookupToken] = useState('');
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const tokenResult = useFindCustomerByToken(lookupToken, { query: { queryKey: ['/api/admin/token', lookupToken], enabled: !!lookupToken } });
  useEffect(() => { if (tokenResult.data) { setSelected(tokenResult.data.id); setLookupToken(''); setTokenInput(''); } }, [tokenResult.data, setSelected]);
  const lookupCustomer = useCallback((input: string) => {
    const match = input.match(/\/c\/([\w-]{8,80})(?:[/?#]|$)/);
    const value = match?.[1] || input.trim();
    if (!value) return;
    setLookupToken(value);
  }, []);
  const addByToken = () => lookupCustomer(tokenInput);
  const handleQrScan = useCallback((token: string) => {
    setTokenInput(token);
    setCameraScannerOpen(false);
    lookupCustomer(token);
  }, [lookupCustomer]);
  const activeProgram = promos.data?.find((p) => p.kind === 'punti' && p.live);
  return <section>
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="eyebrow">Il rapporto continua</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] sm:text-4xl">I tuoi clienti</h1><p className="mt-2 text-sm text-[#81766d]">Un volto alla volta, una visita alla volta.</p></div>
      <div className="grid w-full gap-2 sm:flex sm:w-auto">
        <button type="button" onClick={() => setCameraScannerOpen(true)} className="btn-outline w-full border-[#b08a50] text-[#755b34] sm:w-auto" data-testid="button-scan-qr"><Camera size={17} /> Scansione QR</button>
        <button onClick={onNew} className="btn-primary w-full sm:w-auto" data-testid="button-new-customer"><Plus size={17} /> Nuovo cliente</button>
      </div>
    </div>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Clienti" value={stats.data?.customers} icon={<Users size={17} />} loading={stats.isLoading} />
      <StatCard label="Timbri di oggi" value={stats.data?.today} icon={<Scissors size={17} />} loading={stats.isLoading} />
      <StatCard label="Premi pronti" value={stats.data?.ready} icon={<Gift size={17} />} loading={stats.isLoading} />
      <StatCard label="Premi consegnati" value={stats.data?.rewards} icon={<BadgeCheck size={17} />} loading={stats.isLoading} />
    </div>
    {stats.isError && <div className="mb-4"><ErrorState message={errorText(stats.error)} retry={() => stats.refetch()} /></div>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
      <section className="rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#968b7e]" size={17} /><input aria-label="Cerca clienti" className="field pl-10" placeholder="Cerca per nome o numero…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-customer" /></label>
          <div className="flex gap-2">
            <input aria-label="Codice QR cliente" className="field min-w-0 flex-1 sm:w-[180px]" placeholder="Incolla link o codice" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addByToken(); }} />
            <button type="button" onClick={addByToken} className="btn-outline min-w-11 px-3" aria-label="Apri tessera con codice" title="Apri tessera"><Search size={17} /></button>
          </div>
        </div>
        {tokenResult.isError && <p role="alert" className="mt-3 text-sm text-[#9b4437]">{errorText(tokenResult.error)}</p>}
        <div className="mt-4">
          {query.isLoading ? <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="skeleton h-[68px]" />)}</div>
          : query.isError ? <ErrorState message={errorText(query.error)} retry={() => query.refetch()} />
          : !query.data?.length ? <div className="rounded-2xl border border-dashed border-[#d9cfbf] px-5 py-12 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#efe7db] text-[#937447]"><Users size={21} /></span><h3 className="mt-4 font-semibold">{search ? 'Nessun cliente trovato' : 'La prossima visita inizia qui'}</h3><p className="mx-auto mt-1 max-w-sm text-sm text-[#81766d]">{search ? 'Prova con un altro nome o numero di cellulare.' : 'Crea una tessera per il tuo prossimo cliente.'}</p>{!search && <button onClick={onNew} className="btn-outline mt-4"><Plus size={15} /> Aggiungi cliente</button>}</div>
          : <div className="divide-y divide-[#eee8df]">{query.data.map((customer) => <CustomerRow key={customer.id} customer={customer} promo={activeProgram} onOpen={() => setSelected(customer.id)} />)}</div>}
        </div>
        {query.isFetching && !query.isLoading && <p className="mt-3 text-right text-xs text-[#91877a]">Aggiornamento…</p>}
      </section>
      <aside className="admin-atelier-tip rounded-2xl bg-[#e9e1d5] p-5">
        <div className="admin-tip-image"><img src={barberHaircutPhoto} alt="Taglio e rasatura da Da Barber Anas" loading="lazy" /></div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fbf8f1] text-[#927143]"><Sparkles size={19} /></span>
        <h2 className="mt-4 text-lg font-semibold tracking-[-.04em]">Un gesto semplice, una relazione che resta.</h2>
        <p className="mt-2 text-sm leading-6 text-[#756b60]">Apri una tessera per aggiungere o correggere i timbri durante l’appuntamento.</p>
        <div className="mt-5 flex items-center gap-2 border-t border-[#d8cebf] pt-4 text-xs text-[#756b60]"><Clock3 size={14} /> La lista si aggiorna dopo ogni modifica.</div>
      </aside>
    </div>
    {selected !== null && <span className="sr-only">Cliente selezionato {selected}</span>}
    {cameraScannerOpen && <QrCameraScanner onClose={() => setCameraScannerOpen(false)} onScan={handleQrScan} />}
  </section>;
}

function StatCard({ label, value, icon, loading }: { label: string; value?: number; icon: ReactNode; loading: boolean }) {
  return <div className="stat-card"><div className="flex items-center justify-between text-[#927143]">{icon}<span className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#8e8478]">{label}</span></div><p className="mt-3 text-3xl font-semibold tracking-[-.06em]">{loading ? <span className="skeleton inline-block h-8 w-12 align-middle" /> : value ?? '—'}</p></div>;
}

function CustomerRow({ customer, promo, onOpen }: { customer: AdminCustomer; promo?: Promo; onOpen: () => void }) {
  const progress = customer.progress.find((item) => item.promo_id === promo?.id)?.stamps || 0;
  const ready = !!promo && progress >= (promo.goal || 0);
  return <button onClick={onOpen} className="data-row w-full text-left hover:bg-[#f7f2e9] sm:px-2" data-testid={`row-customer-${customer.id}`}>
    <span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e9dfcf] text-xs font-bold text-[#765b35]">{initials(customer.name)}</span><span className="min-w-0"><span className="block truncate font-semibold">{customer.name}</span><span className="mt-0.5 block truncate text-xs text-[#81766d]">{customer.phone} · {customer.visits} {customer.visits === 1 ? 'visita' : 'visite'}</span></span></span>
    <span className="flex items-center gap-3">{ready ? <span className="inline-flex items-center gap-1 rounded-full bg-[#eee1c8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#795b2e]"><Gift size={12} /> Premio pronto</span> : promo ? <span className="hidden items-center gap-1 sm:flex">{Array.from({ length: Math.min(promo.goal || 0, 6) }, (_, i) => <i key={i} className={`h-2 w-2 rounded-full ${i < progress ? 'bg-[#b28a4d]' : 'border border-[#cfc4b4]'}`} />)}</span> : null}<ChevronRight size={16} className="text-[#aa9f91]" /></span>
  </button>;
}

function CustomerDetailModal({ id, close, onNotice }: { id: number; close: () => void; onNotice: (v: string) => void }) {
  const qc = useQueryClient();
  const detail = useGetCustomerDetail(id, { query: { queryKey: getGetCustomerDetailQueryKey(id), enabled: id > 0 } });
  const stamp = useStampCustomer();
  const unstamp = useUnstampCustomer();
  const redeem = useRedeemCustomerReward();
  const update = useUpdateCustomer();
  const remove = useDeleteCustomer();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  useEffect(() => { if (detail.data) { setName(detail.data.customer.name); setPhone(detail.data.customer.phone); } }, [detail.data]);
  const refreshRelated = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getGetCustomerDetailQueryKey(id) }),
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }),
    ]);
  };
  const action = async (kind: 'stamp' | 'unstamp' | 'redeem', program: CustomerProgram) => {
    const data = { promoId: program.id };
    try {
      if (kind === 'stamp') await stamp.mutateAsync({ id, data });
      if (kind === 'unstamp') await unstamp.mutateAsync({ id, data });
      if (kind === 'redeem') await redeem.mutateAsync({ id, data });
      await refreshRelated();
      onNotice(kind === 'stamp' ? 'Timbro aggiunto' : kind === 'unstamp' ? 'Timbro rimosso' : 'Premio consegnato');
    } catch (err) { onNotice(errorText(err)); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 8) { onNotice('Controlla nome e numero di cellulare.'); return; }
    try { await update.mutateAsync({ id, data: { name: name.trim(), phone: phone.trim() } }); await refreshRelated(); setEditing(false); onNotice('Modifiche salvate'); }
    catch (err) { onNotice(errorText(err)); }
  };
  const deleteCustomer = async () => {
    if (!detail.data || !window.confirm(`Eliminare la tessera di ${detail.data.customer.name}?`)) return;
    try { await remove.mutateAsync({ id }); await qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }); await qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() }); close(); onNotice('Tessera eliminata'); }
    catch (err) { onNotice(errorText(err)); }
  };
  const customer = detail.data?.customer;
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-label="Dettaglio cliente">
      <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Scheda cliente</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.05em]">{customer?.name || 'Dettaglio'}</h2>{customer && <p className="mt-1 text-sm text-[#81766d]">{customer.phone} · {customer.visits} visite</p>}</div><button onClick={close} className="btn-outline px-2.5 py-2" aria-label="Chiudi"><X size={18} /></button></div>
      {detail.isLoading ? <div className="space-y-3"><div className="skeleton h-36" /><div className="skeleton h-20" /></div> : detail.isError ? <ErrorState message={errorText(detail.error)} retry={() => detail.refetch()} /> : detail.data && <>
        <div className="max-h-[48dvh] space-y-3 overflow-y-auto pr-1">{detail.data.programs.length ? detail.data.programs.map((program) => {
          const isPending = stamp.isPending || unstamp.isPending || redeem.isPending;
          const full = program.stamps >= program.goal;
          return <article key={program.id} className="rounded-2xl border border-[#e6ddd0] bg-white/65 p-4">
            <div className="flex items-start justify-between"><div><h3 className="font-semibold">{program.title}</h3><p className="mt-1 text-xs text-[#81766d]">{program.reward}</p></div><b className="text-lg text-[#8c6b3d]">{program.stamps}<span className="text-sm font-normal text-[#94897c]">/{program.goal}</span></b></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><button disabled={isPending || full} onClick={() => action('stamp', program)} className="btn-gold w-full sm:w-auto" data-testid={`button-stamp-${program.id}`}><Plus size={15} /> Aggiungi timbro</button>{full && <button disabled={isPending} onClick={() => { if (window.confirm('Confermi la consegna del premio?')) action('redeem', program); }} className="btn-primary w-full sm:w-auto"><Gift size={15} /> Consegna premio</button>}{program.stamps > 0 && <button disabled={isPending} onClick={() => { if (window.confirm('Rimuovere l’ultimo timbro?')) action('unstamp', program); }} className="btn-outline w-full sm:w-auto">Togli timbro</button>}</div>
          </article>;
        }) : <div className="rounded-xl bg-[#f1ece3] p-4 text-sm text-[#81766d]">Nessuna raccolta punti attiva per questa tessera.</div>}</div>
        {customer && <div className="mt-4 flex flex-wrap gap-2"><a className="btn-outline" target="_blank" rel="noreferrer" href={cardUrl(customer.token)}><UserRound size={15} /> Apri tessera</a><button className="btn-outline" onClick={() => setEditing(!editing)}><Settings2 size={15} /> Modifica dati</button><a className="btn-outline" target="_blank" rel="noreferrer" href={`https://wa.me/${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Ciao ${customer.name.split(' ')[0]}, ecco la tua tessera: ${cardUrl(customer.token)}`)}`}><Mail size={15} /> Invia link</a></div>}
        {editing && <form onSubmit={save} className="mt-4 grid gap-3 rounded-2xl bg-[#f0eade] p-4 sm:grid-cols-2"><div><label className="label" htmlFor="edit-customer-name">Nome</label><input id="edit-customer-name" className="field" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} /></div><div><label className="label" htmlFor="edit-customer-phone">Cellulare</label><input id="edit-customer-phone" className="field" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" minLength={8} maxLength={30} /></div><div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={update.isPending}>Salva modifiche</button><button type="button" className="btn-outline" onClick={() => setEditing(false)}>Annulla</button><button type="button" onClick={deleteCustomer} className="ml-auto inline-flex items-center gap-2 rounded-xl border border-[#dfc9c0] px-3 text-sm text-[#9b4437]"><Trash2 size={15} /> Elimina</button></div></form>}
        <details className="mt-4 rounded-xl border border-[#e6ddd0] px-4 py-3"><summary className="cursor-pointer text-sm font-semibold">Storico attività</summary>{detail.data.events.length ? <div className="mt-3 divide-y divide-[#eee8df]">{detail.data.events.map((event, i) => <div key={`${event.created_at}-${i}`} className="flex justify-between gap-3 py-2 text-xs"><span className="font-medium">{event.type === 'iscrizione' ? 'Tessera creata' : event.type === 'timbro' ? 'Timbro aggiunto' : event.type === 'correzione' ? 'Timbro corretto' : event.type === 'omaggio' ? 'Premio consegnato' : 'Attività'}{event.promo ? ` · ${event.promo}` : ''}</span><span className="shrink-0 text-[#81766d]">{dateTime(event.created_at)}</span></div>)}</div> : <p className="mt-3 text-sm text-[#81766d]">Ancora nessuna attività registrata.</p>}</details>
      </>}
    </section>
  </div>;
}

function CustomerFormModal({ close, onCreated, onNotice }: { close: () => void; onCreated: (id: number) => void; onNotice: (v: string) => void }) {
  const qc = useQueryClient();
  const create = useCreateCustomer();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (name.trim().length < 2 || phone.replace(/\D/g, '').length < 8) { setError('Inserisci un nome e un numero validi.'); return; }
    try {
      const result = await create.mutateAsync({ data: { name: name.trim(), phone: phone.trim() } });
      await Promise.all([qc.invalidateQueries({ queryKey: getListCustomersQueryKey() }), qc.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() })]);
      onNotice('Tessera creata'); onCreated(result.customer.id);
    }
    catch (err) { setError(errorText(err)); }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label="Nuovo cliente">
    <div className="mb-5 flex justify-between"><div><p className="eyebrow">Nuova tessera</p><h2 className="mt-1 text-2xl font-semibold">Un nuovo cliente</h2></div><button className="btn-outline px-2 py-1.5" onClick={close}><X size={18} /></button></div>
    <form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="new-name">Nome e cognome</label><input id="new-name" className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} /></div><div><label className="label" htmlFor="new-phone">Numero di cellulare</label><input id="new-phone" className="field" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} minLength={8} maxLength={30} /></div>{error && <p role="alert" className="text-sm text-[#9b4437]">{error}</p>}<button className="btn-primary w-full" disabled={create.isPending}>{create.isPending ? 'Creo la tessera…' : 'Crea tessera'}</button></form>
  </section></div>;
}

function PromosSection({ onNew, onEdit, onNotice }: { onNew: (kind: 'punti' | 'offerta') => void; onEdit: (p: Promo) => void; onNotice: (v: string) => void }) {
  const promos = useListAdminPromos({ query: { queryKey: getListAdminPromosQueryKey() } });
  return <section>
    <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Premi e attenzioni</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] sm:text-4xl">Promozioni</h1><p className="mt-2 text-sm text-[#81766d]">Le raccolte punti e le offerte che vedono i tuoi clienti.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => onNew('punti')} className="btn-primary"><Scissors size={16} /> Raccolta punti</button><button onClick={() => onNew('offerta')} className="btn-outline"><TicketPercent size={16} /> Crea un’offerta</button></div></div>
    <div className="mb-5 grid gap-3 rounded-2xl border border-[#e4dbcf] bg-[#eae2d7] p-4 sm:grid-cols-2"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fbf8f1] text-[#8b6c3c]"><Scissors size={17} /></span><div><p className="font-semibold">Raccolte punti</p><p className="mt-1 text-xs leading-5 text-[#756b60]">Un programma di timbri separato per ogni servizio. La tessera predefinita resta su 6 timbri e 1 premio.</p></div></div><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fbf8f1] text-[#8b6c3c]"><TicketPercent size={17} /></span><div><p className="font-semibold">Offerte</p><p className="mt-1 text-xs leading-5 text-[#756b60]">Annunci visibili a tutti i clienti, con una data di fine facoltativa.</p></div></div></div>
    {promos.isLoading ? <div className="space-y-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div> : promos.isError ? <ErrorState message={errorText(promos.error)} retry={() => promos.refetch()} /> : !promos.data?.length ? <div className="rounded-2xl border border-dashed border-[#d9cfbf] p-12 text-center"><Gift size={28} className="mx-auto text-[#a38557]" /><h2 className="mt-4 font-semibold">Nessuna promozione ancora</h2><p className="mt-1 text-sm text-[#81766d]">Crea una raccolta o un’offerta per i tuoi clienti.</p></div> : <div className="space-y-3">{promos.data.map((promo) => <PromoRow key={promo.id} promo={promo} onEdit={() => onEdit(promo)} onNotice={onNotice} />)}</div>}
  </section>;
}

function PromoRow({ promo, onEdit, onNotice }: { promo: Promo; onEdit: () => void; onNotice: (v: string) => void }) {
  const qc = useQueryClient();
  const remove = useDeletePromo();
  const title = promo.kind === 'punti' ? 'Raccolta punti' : 'Offerta';
  const status = !promo.active ? 'Disattivata' : promo.live ? 'Attiva' : 'Scaduta';
  const del = async () => {
    if (!window.confirm(`Eliminare “${promo.title}”? Puoi anche disattivare la promozione senza rimuoverla.`)) return;
    try { await remove.mutateAsync({ id: promo.id }); await qc.invalidateQueries({ queryKey: getListAdminPromosQueryKey() }); await qc.invalidateQueries({ queryKey: getListPublicPromosQueryKey() }); onNotice('Promozione eliminata'); }
    catch (err) { onNotice(errorText(err)); }
  };
  return <article className="flex flex-col gap-4 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
    <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#efe4d1] text-[#8c6837]"><PromoGlyph kind={promo.kind} /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{promo.title}</h2><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${promo.active && promo.live ? 'bg-[#e4eddf] text-[#52704c]' : 'bg-[#eee8df] text-[#81766d]'}`}>{status}</span></div><p className="mt-1 text-sm text-[#81766d]">{promo.kind === 'punti' ? `${promo.goal || 0} timbri · premio: ${promo.reward}` : promo.description || 'Offerta per tutti i clienti'}{promo.ends_at ? ` · fino al ${day(promo.ends_at)}` : ''}</p></div></div>
    <div className="flex gap-2 sm:shrink-0"><button onClick={onEdit} className="btn-outline flex-1 sm:flex-none" data-testid={`button-edit-promo-${promo.id}`}><Settings2 size={15} /> Modifica</button><button disabled={remove.isPending} onClick={del} className="btn-outline px-3 text-[#9b4437]" aria-label={`Elimina ${promo.title}`}><Trash2 size={15} /></button></div>
  </article>;
}

function PromoFormModal({ promo, close, onNotice }: { promo: Promo; close: () => void; onNotice: (v: string) => void }) {
  const qc = useQueryClient();
  const create = useCreatePromo();
  const update = useUpdatePromo();
  const [title, setTitle] = useState(promo.title);
  const [goal, setGoal] = useState(String(promo.goal || 6));
  const [reward, setReward] = useState(promo.reward || '');
  const [description, setDescription] = useState(promo.description || '');
  const [end, setEnd] = useState(promo.ends_at?.slice(0, 10) || '');
  const [active, setActive] = useState(promo.active);
  const [error, setError] = useState('');
  const isProgram = promo.kind === 'punti';
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (title.trim().length < 2 || (isProgram && (!Number(goal) || Number(goal) < 1 || Number(goal) > 30 || !reward.trim()))) { setError('Controlla il nome, il numero di timbri e il premio.'); return; }
    const data: PromoInput = { kind: promo.kind, title: title.trim(), emoji: promo.emoji || '✂', goal: isProgram ? Number(goal) : null, reward: isProgram ? reward.trim() : '', description: description.trim(), active, ends_at: end || null };
    try {
      if (promo.id) await update.mutateAsync({ id: promo.id, data });
      else await create.mutateAsync({ data });
      await Promise.all([qc.invalidateQueries({ queryKey: getListAdminPromosQueryKey() }), qc.invalidateQueries({ queryKey: getListPublicPromosQueryKey() })]);
      onNotice(promo.id ? 'Promozione aggiornata' : 'Promozione creata'); close();
    } catch (err) { setError(errorText(err)); }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label={promo.id ? 'Modifica promozione' : 'Nuova promozione'}>
    <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">{isProgram ? 'Raccolta punti' : 'Comunicazione in negozio'}</p><h2 className="mt-1 text-2xl font-semibold">{promo.id ? 'Modifica promozione' : 'Crea promozione'}</h2></div><button onClick={close} className="btn-outline px-2 py-1.5"><X size={18} /></button></div>
    <form onSubmit={submit} className="space-y-4"><div><label className="label" htmlFor="promo-title">Nome</label><input id="promo-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} minLength={2} placeholder={isProgram ? 'Es. Taglio' : 'Es. Una cura in più'} /></div>
      {isProgram && <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="promo-goal">Timbri necessari</label><input id="promo-goal" className="field" type="number" inputMode="numeric" min={1} max={30} value={goal} onChange={(e) => setGoal(e.target.value)} /></div><div><label className="label" htmlFor="promo-reward">Premio</label><input id="promo-reward" className="field" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} placeholder="Es. Il prossimo taglio è in omaggio" /></div></div>}
      <div><label className="label" htmlFor="promo-description">{isProgram ? 'Note facoltative' : 'Descrizione'}</label><textarea id="promo-description" className="field min-h-24 resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder={isProgram ? 'Una nota per ricordare le condizioni' : 'Racconta brevemente la promozione'} /></div>
      <div><label className="label" htmlFor="promo-end">Scadenza facoltativa</label><input id="promo-end" className="field" type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f0eade] p-3 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[#9a7747]" /> Attiva e visibile sulle tessere</label>
      {error && <p role="alert" className="text-sm text-[#9b4437]">{error}</p>}
      <button className="btn-primary w-full" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? 'Salvataggio…' : promo.id ? 'Salva modifiche' : 'Crea promozione'}</button>
    </form>
  </section></div>;
}

function ShopSection({ shop }: { shop: string }) {
  const publicUrl = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return <section>
    <div className="mb-7"><p className="eyebrow">Il primo incontro</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.06em] sm:text-4xl">Locandina & QR</h1><p className="mt-2 text-sm text-[#81766d]">Un invito semplice da tenere al bancone o allo specchio.</p></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_350px]">
      <div className="rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-5 sm:p-7"><p className="eyebrow">QR per iscrizione</p><h2 className="mt-2 text-xl font-semibold">Fai partire la prossima tessera.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#81766d]">Il cliente inquadra il QR, inserisce nome e numero e ha subito la sua tessera sul telefono.</p>
        <div className="mt-6 grid gap-6 sm:grid-cols-[210px_1fr] sm:items-center"><div className="mx-auto w-[190px] rounded-2xl bg-white p-3 shadow-sm"><QrImage value={publicUrl} className="w-full" /></div><div><p className="text-xs font-semibold uppercase tracking-wider text-[#8e8478]">Link iscrizione</p><p className="mt-2 break-all rounded-xl bg-[#f0eade] p-3 text-sm text-[#655b50]">{publicUrl}</p><Link href="/locandina" target="_blank" className="btn-primary mt-4 w-full sm:w-auto"><Printer size={16} /> Apri locandina A4</Link></div></div>
      </div>
      <aside className="rounded-2xl bg-[#302821] p-6 text-[#f7f1e7]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#dfc48e]"><ShieldCheck size={20} /></span><h2 className="mt-4 text-lg font-semibold">Una stampa, molte visite.</h2><p className="mt-2 text-sm leading-6 text-[#c5b9a6]">Metti la locandina in un punto visibile. Il QR porta direttamente alla creazione della tessera digitale.</p><div className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-[#b9ad9b]"><p>Consiglio: stampa a colori e lascia uno spazio libero per il QR.</p></div></aside>
    </div>
  </section>;
}

function PosterPage() {
  const config = useGetShopConfig();
  const promos = useListPublicPromos();
  const shop = barberName(config.data?.shopName);
  const url = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return <main className="poster-page min-h-[100dvh] bg-[#e9e4d9] px-3 py-4 sm:px-8 sm:py-8">
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2"><Link href="/admin" className="btn-outline"><ArrowLeft size={15} /> Torna al pannello</Link><button onClick={() => window.print()} className="btn-primary"><Printer size={16} /> Stampa locandina</button></div>
    <article className="poster-sheet mx-auto flex flex-col items-center text-center">
      <div className="poster-image-header"><img src={barberArtworkLogo} alt="" /></div>
      <span className="poster-brand-mark grid h-16 w-16 place-items-center rounded-[18px]"><Scissors size={28} /></span>
      <h1 className="mt-5 text-4xl font-semibold tracking-[-.06em] sm:text-6xl">{shop}</h1>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[.3em] text-[#f0ce82] sm:text-sm">Tessera punti digitale</p>
      <div className="poster-stripe my-7 h-[5px] w-36 rounded-full" />
      <div className="space-y-3">{promos.isLoading ? <div className="skeleton h-16 w-64" /> : promos.data?.programs.slice(0, 2).map((program) => <div key={program.title} className="text-2xl font-semibold sm:text-3xl"><div className="flex items-center justify-center gap-3"><Scissors className="text-[#f0ce82]" />{program.goal} timbri · {program.title}</div><p className="mt-1 text-sm font-normal text-[#e6ddcb] sm:text-base">{program.reward}</p></div>)}</div>
      <div className="poster-qr rounded-[22px] border-[6px] border-[#d8b66b] bg-white p-4 sm:p-5"><QrImage value={url} className="w-full" /></div>
      <h2 className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Inquadra. Iscriviti. Torna.</h2>
      <p className="mt-3 max-w-md text-sm leading-6 text-[#e6ddcb] sm:text-base">La tua prossima visita è già un passo verso il premio.</p>
      <p className="poster-footer text-[10px] uppercase tracking-[.2em] text-[#d9c8aa]">{shop} · Ci vediamo presto</p>
    </article>
  </main>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={LandingPage} />
    <Route path="/c/:token" component={CustomerCardPage} />
    <Route path="/admin" component={AdminPage} />
    <Route path="/locandina" component={PosterPage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
