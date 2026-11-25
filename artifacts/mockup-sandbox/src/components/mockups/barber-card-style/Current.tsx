import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Gift, LockKeyhole, Menu, Scissors, ShieldCheck, Smartphone, TicketPercent, X } from 'lucide-react';
import './_group.css';
const photos = '/__mockup/images/';
const barberHero = photos + 'da-barber-anas-insegna.webp';
const barberHeroMobile = photos + 'da-barber-anas-insegna-mobile.webp';
const barberTools = photos + 'anas-barber-tools.jpg';
const useLocation = () => ['', (_url: string) => undefined] as const;
const Link = ({href, ...props}: React.ComponentProps<'a'>) => <a {...props} href={href} onClick={event => event.preventDefault()} />;
const InstallApp = ({className}: {className: string}) => <button type="button" className={className}>Installa app</button>;
const useGetShopConfig = () => ({ data: { shopName: 'Da Barber Anas' } });
const useListPublicPromos = () => ({ isPending: false, isError: false, data: { programs: [{title:'Taglio', goal:6, reward:'Il 7° taglio è gratis'}], offers: [] as {id:number;title:string;description:string;ends_at?:string}[] } });
const useRegisterCustomer = () => ({isPending:false, mutateAsync: async (_input: unknown) => ({created:true, token:'preview'})});
const useRecoverCustomerCard = useRegisterCustomer;

const barberName = (name?: string) => name ?? 'Da Barber Anas';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Si è verificato un errore. Riprova.';
const formatEnd = (value: string) => new Date(value).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });

export function Current() {
  const config = useGetShopConfig();
  const promos = useListPublicPromos();
  const register = useRegisterCustomer();
  const recover = useRecoverCustomerCard();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [, navigate] = useLocation();
  const shop = barberName(config.data?.shopName);
  const [program, ...otherPrograms] = promos.data?.programs ?? [];
  const classicCut = program?.goal === 6 && program.reward === 'Il 7° taglio è gratis';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Inserisci un numero di cellulare valido.');
      return;
    }
    if (!recovering && name.trim().length < 2) {
      setError('Scrivi il tuo nome e cognome.');
      return;
    }

    try {
      if (recovering) {
        const result = await recover.mutateAsync({ data: { phone: phone.trim() } });
        navigate(`/c/${result.token}`);
        return;
      }
      const result = await register.mutateAsync({ data: { name: name.trim(), phone: phone.trim() } });
      if (!result.created) setMessage('Hai già una tessera: eccola qui.');
      navigate(`/c/${result.token}`);
    } catch (requestError) {
      setError(errorText(requestError));
    }
  };

  return <main className="barber-renaissance">
    <header className="br-wrap br-header" onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}>
      <a className="br-brand" href="#inizio" aria-label={`${shop}, inizio`}>
        <span className="br-brandmark"><Scissors size={20} /></span>
        <span className="br-brandname">{shop}<small>Tessera fedeltà</small></span>
      </a>
      <nav id="barber-navigation" className={`br-nav${menuOpen ? ' is-open' : ''}`} aria-label="Navigazione principale">
        <a href="#premio" onClick={() => setMenuOpen(false)}>La tessera</a>
        <a href="#bottega" onClick={() => setMenuOpen(false)}>La bottega</a>
        <InstallApp className="br-install-link" />
        <Link className="br-nav-cta" href="/admin"><ShieldCheck size={13} /> Area barbiere</Link>
      </nav>
      <button type="button" className="br-mobile-menu" aria-label={menuOpen ? 'Chiudi la navigazione' : 'Apri la navigazione'} aria-expanded={menuOpen} aria-controls="barber-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </header>

    <div className="br-wrap br-hero" id="inizio">
      <section className="br-hero-copy">
        <div className="br-kicker">Il programma fedeltà</div>
        <h1 className="br-title">{classicCut ? <>Fai 6 tagli.<br /><em>Il 7° è gratis.</em></> : <>Il tuo taglio.<br /><em>La tua tessera.</em></>}</h1>
        <p className="br-lede">{classicCut ? 'Un timbro a ogni acquisto. La tessera è digitale: mostrala dal telefono quando passi in barberia.' : 'La tua tessera fedeltà, sempre a portata di mano. Creala o ritrovala dal telefono.'}</p>
        <div className="br-hero-actions">
          <a className="br-button" href="#tessera">Apri la tessera <ArrowRight size={15} /></a>
          <a className="br-textlink" href="#premio">Scopri come funziona</a>
        </div>
      </section>
      <div className="br-image-panel">
        <picture>
          <source media="(max-width: 760px)" srcSet={barberHeroMobile} type="image/webp" />
          <img src={barberHero} alt="L’insegna originale di Da Barber Anas sopra l’ingresso del locale" width={1100} height={639} fetchPriority="high" />
        </picture>
        <div className="br-photo-tag"><span aria-hidden="true" /><strong>Da Barber Anas</strong><small>Haircuts &amp; Shave</small></div>
      </div>
    </div>

    <section className="br-wrap br-reward" id="premio">
      <div className="br-reward-copy">
        <div className="br-kicker">Come funziona</div>
        <h2>{classicCut ? <>6 timbri.<br />Un taglio in regalo.</> : (program?.title ?? 'La tessera digitale.')}</h2>
        <p>{classicCut ? 'Mostra la tessera dal telefono: a ogni acquisto aggiungiamo un timbro. Dopo il sesto timbro, il taglio successivo è in omaggio.' : 'Mostra la tessera dal telefono e controlla i timbri che hai già raccolto.'}</p>
      </div>
      {program ? <div className="br-stamp-card" aria-label={`Tessera: ${program.goal} timbri. Premio: ${program.reward}`}>
        <div className="br-stamp-head"><span>{shop}</span><span>Tessera digitale</span></div>
        <div className="br-stamps" aria-hidden="true">{Array.from({ length: program.goal + 1 }, (_, index) => <span className="br-stamp" key={index}>{index === program.goal ? <Gift /> : <Scissors />}</span>)}</div>
        <div className="br-stamp-caption"><span>{program.goal} {program.goal === 1 ? 'timbro' : 'timbri'}</span><span>{program.reward}</span></div>
      </div> : <div className="br-stamp-card"><p>{promos.isPending ? 'Caricamento della raccolta…' : promos.isError ? 'Non riusciamo a caricare la raccolta in questo momento.' : 'Non ci sono raccolte attive al momento.'}</p></div>}
    </section>
    <div className="br-wrap br-rule" />

    <section className="br-wrap br-story" id="bottega">
      <div className="br-story-image"><img src={barberTools} alt="Rasoio e forbici preparati per il prossimo cliente" loading="lazy" /></div>
      <div className="br-story-copy">
        <div className="br-kicker">La barberia</div>
        <h2>Taglio e rasatura.</h2>
        <p>La tessera è il nostro modo di ringraziarti quando torni in barberia. Ti basta mostrarla al prossimo appuntamento.</p>
        <a className="br-textlink" href="#tessera">Porta la tessera con te <ArrowDown size={13} /></a>
      </div>
    </section>

    {otherPrograms.length > 0 || promos.data?.offers.length ? <section className="br-offers br-wrap">
      <h2 className="br-kicker">In bottega, adesso</h2>
      <div className="br-offer-list">
        {otherPrograms.map((entry, index) => <article key={`${entry.title}-${index}`}><Scissors size={20} /><div><h3>{entry.title} · {entry.goal} {entry.goal === 1 ? 'timbro' : 'timbri'}</h3><p>{entry.reward}</p></div></article>)}
        {promos.data?.offers.map((offer) => <article key={offer.id}><TicketPercent size={20} /><div><h3>{offer.title}</h3><p>{offer.description}</p>{offer.ends_at && <p>Fino al {formatEnd(offer.ends_at)}</p>}</div></article>)}
      </div>
    </section> : null}

    <section className="br-signup" id="tessera">
      <div className="br-wrap br-signup-grid">
        <div className="br-signup-copy">
          <div className="br-kicker">Iscrizione gratuita</div>
          <h2>La tua tessera è sul telefono.</h2>
          <p>Registrati in un minuto. La tessera digitale resta sul tuo telefono, pronta per il prossimo timbro.</p>
          <div className="br-trust"><ShieldCheck size={15} /> I tuoi dati servono solo a gestire la tessera.</div>
        </div>
        <div className="br-form-card">
          <div className="br-form-top">
            <div><div className="br-form-eyebrow">Tessera digitale</div><h3>{recovering ? 'Ritrova la tessera' : 'Crea la tessera'}</h3><p className="br-subtitle">{recovering ? 'La recuperiamo con il tuo numero.' : 'Ti bastano nome e numero di cellulare.'}</p></div>
            <span className="br-form-icon"><Smartphone size={20} /></span>
          </div>
          <form onSubmit={submit} noValidate>
            {!recovering && <><label className="br-field-label" htmlFor="customer-name">Nome e cognome</label><input className="br-field" id="customer-name" data-testid="input-name" autoComplete="name" maxLength={60} placeholder="Come ti chiami?" value={name} onChange={(event) => setName(event.target.value)} /></>}
            <label className="br-field-label" htmlFor="customer-phone">Numero di cellulare</label>
            <input className="br-field" id="customer-phone" data-testid="input-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="Es. 333 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
            {error && <p className="br-error" role="alert">{error}</p>}
            {message && <p className="br-success-message" role="status">{message}</p>}
            <button className="br-button br-form-submit" type="submit" data-testid="button-submit" disabled={register.isPending || recover.isPending}>{register.isPending || recover.isPending ? 'Un momento…' : recovering ? 'Ritrova la mia tessera' : 'Apri la tua tessera'} <ArrowRight size={15} /></button>
          </form>
          <button className="br-mode" type="button" onClick={() => { setRecovering(!recovering); setError(''); setMessage(''); }}>{recovering ? 'Non hai ancora una tessera? Creala' : 'Hai già una tessera? Ritrovala'}</button>
          <p className="br-form-privacy"><LockKeyhole size={12} /> Usiamo il tuo nome e numero solo per gestire la raccolta punti.</p>
        </div>
      </div>
    </section>
    <footer className="br-wrap br-footer"><span><strong>{shop}</strong> · Tessera fedeltà digitale</span><Link href="/admin">Area barbiere</Link></footer>
  </main>;
}
