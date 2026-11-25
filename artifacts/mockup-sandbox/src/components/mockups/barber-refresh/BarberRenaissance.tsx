import { useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Check, Gift, LockKeyhole, Menu, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import './_group.css';

export function BarberRenaissance() {
  const [recovering, setRecovering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (phone.replace(/\D/g, '').length < 8) {
      setError('Inserisci un numero di cellulare valido.');
      return;
    }
    if (!recovering && name.trim().length < 2) {
      setError('Scrivi il tuo nome e cognome.');
      return;
    }
    setSubmitted(true);
  };

  return (
    <main className="barber-renaissance">
      <style>{`
        .barber-renaissance {
          --ink: #20362f; --deep: #172923; --paper: #f3eee3; --cream: #faf7ef;
          --red: #a44336; --gold: #c69a59; --muted: #77756c; --line: #dcd4c5;
          min-height: 100dvh; background: var(--paper); color: var(--ink);
          font-family: 'Poppins', sans-serif; overflow: hidden;
        }
        .barber-renaissance * { box-sizing: border-box; }
        .br-wrap { width: min(1200px, calc(100% - 56px)); margin: 0 auto; }
        .br-topline { height: 8px; background: repeating-linear-gradient(135deg,var(--red) 0 14px,var(--cream) 14px 28px,var(--ink) 28px 42px,var(--cream) 42px 56px); }
        .br-header { display:flex; justify-content:space-between; align-items:center; padding: 22px 0; }
        .br-brand { display:flex; align-items:center; gap:12px; color:var(--ink); text-decoration:none; }
        .br-brandmark { width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--ink);color:#e5c28b; }
        .br-brandname { font-size:16px;font-weight:700;letter-spacing:-.04em;line-height:1.1; }
        .br-brandname small { display:block;margin-top:5px;font-size:9px;font-weight:600;letter-spacing:.19em;text-transform:uppercase;color:var(--muted); }
        .br-nav { display:flex;align-items:center;gap:31px;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase; }
        .br-nav a { color:var(--ink);text-decoration:none; }
        .br-nav a:hover { color:var(--red); }
        .br-nav .br-nav-cta { padding:12px 17px;border:1px solid var(--ink);border-radius:2px; }
        .br-mobile-menu { display:none;background:none;border:0;color:var(--ink); }
        .br-hero { display:grid;grid-template-columns:1.03fr .97fr;min-height:600px;align-items:stretch; }
        .br-hero-copy { position:relative;display:flex;flex-direction:column;justify-content:center;padding:62px 56px 64px 0; }
        .br-kicker { display:flex;align-items:center;gap:10px;color:var(--red);font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase; }
        .br-kicker:before { content:'';width:31px;height:1px;background:var(--red); }
        .br-title { max-width:620px;margin:25px 0 19px;font-size:clamp(46px,6.3vw,82px);line-height:.99;letter-spacing:-.075em;font-weight:600; }
        .br-title em { font-style:normal;color:var(--red); }
        .br-lede { max-width:440px;margin:0;color:#65665e;font-size:14px;line-height:1.9; }
        .br-hero-actions { display:flex;align-items:center;gap:22px;margin-top:31px; }
        .br-button { display:inline-flex;align-items:center;justify-content:center;gap:12px;padding:15px 20px;background:var(--red);color:#fff9ee;text-decoration:none;border:0;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:transform .2s,opacity .2s; }
        .br-button:hover { transform:translateY(-2px); }
        .br-textlink { color:var(--ink);font-size:11px;font-weight:600;text-decoration:none;border-bottom:1px solid #b7ad9c;padding-bottom:4px; }
        .br-image-panel { position:relative;min-height:550px;margin:14px 0 28px; }
        .br-image-panel img { display:block;width:100%;height:100%;min-height:550px;object-fit:cover;object-position:57% center; }
        .br-photo-tag { position:absolute;left:-20px;bottom:35px;max-width:220px;padding:15px 18px;background:var(--cream);box-shadow:0 12px 30px #1c241d25; }
        .br-photo-tag strong { display:block;font-family:Georgia,serif;font-size:19px;font-weight:500;font-style:italic; }
        .br-photo-tag span { display:block;margin-top:5px;color:var(--muted);font-size:9px;letter-spacing:.14em;text-transform:uppercase; }
        .br-roundel { position:absolute;top:28px;right:24px;width:90px;height:90px;border-radius:50%;display:grid;place-items:center;text-align:center;background:var(--red);color:#fff6e9;font-size:9px;font-weight:700;letter-spacing:.12em;line-height:1.5;text-transform:uppercase;transform:rotate(9deg); }
        .br-rule { height:1px;background:var(--line); }
        .br-reward { display:grid;grid-template-columns:.86fr 1.14fr;gap:58px;padding:55px 0 57px;align-items:center; }
        .br-reward-copy .br-kicker { color:#8d6940; }
        .br-reward-copy .br-kicker:before { background:#8d6940; }
        .br-reward-copy h2 { margin:15px 0 11px;font-size:34px;line-height:1.12;letter-spacing:-.06em;font-weight:600; }
        .br-reward-copy p { max-width:370px;margin:0;color:#6d6b63;font-size:12px;line-height:1.8; }
        .br-stamp-card { position:relative;padding:25px 29px 21px;background:var(--ink);color:#f7f0e2;box-shadow:9px 9px 0 #d4c8b5; }
        .br-stamp-head { display:flex;justify-content:space-between;align-items:center;margin-bottom:18px; }
        .br-stamp-head span:first-child { font-size:9px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#d7c49e; }
        .br-stamp-head span:last-child { font-family:Georgia,serif;font-size:15px;font-style:italic;color:#e4d7c1; }
        .br-stamps { display:grid;grid-template-columns:repeat(7,1fr);gap:10px; }
        .br-stamp { aspect-ratio:1;border:1px dashed #879187;border-radius:50%;display:grid;place-items:center;color:#c0b8a8; }
        .br-stamp svg { width:18px;height:18px; }
        .br-stamp:last-child { background:var(--gold);border:1px solid var(--gold);color:var(--ink); }
        .br-stamp-caption { display:flex;justify-content:space-between;margin-top:15px;color:#d3c9b7;font-size:9px;letter-spacing:.08em;text-transform:uppercase; }
        .br-story { display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:70px;padding:34px 0 78px; }
        .br-story-image { height:310px;overflow:hidden; }
        .br-story-image img { width:100%;height:100%;object-fit:cover;object-position:center 56%;display:block; }
        .br-story-copy { max-width:430px; }
        .br-story-copy h2 { margin:16px 0 14px;font-size:35px;line-height:1.12;letter-spacing:-.06em; }
        .br-story-copy p { color:#6d6b63;font-size:12px;line-height:1.9; }
        .br-signup { position:relative;background:var(--deep);color:var(--cream);padding:64px 0 70px; }
        .br-signup:after { content:'';position:absolute;inset:0 0 0 auto;width:34%;background:linear-gradient(90deg,var(--deep),transparent),url('/__mockup/images/anas-barber-tools.jpg') center/cover;opacity:.14;pointer-events:none; }
        .br-signup-grid { position:relative;z-index:1;display:grid;grid-template-columns:.92fr 1.08fr;gap:70px;align-items:center; }
        .br-signup-copy .br-kicker { color:#d7b77e; }
        .br-signup-copy .br-kicker:before { background:#d7b77e; }
        .br-signup-copy h2 { max-width:440px;margin:17px 0 14px;font-size:clamp(34px,4vw,50px);line-height:1.07;letter-spacing:-.065em; }
        .br-signup-copy p { max-width:390px;color:#d1d1c5;font-size:12px;line-height:1.8; }
        .br-trust { display:flex;gap:9px;align-items:center;margin-top:24px;color:#c2c9bd;font-size:10px; }
        .br-form-card { background:var(--cream);color:var(--ink);padding:30px 34px;max-width:500px;margin-left:auto;box-shadow:12px 12px 0 #c69a5940; }
        .br-form-top { display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:23px; }
        .br-form-eyebrow { color:var(--red);font-size:9px;font-weight:700;letter-spacing:.17em;text-transform:uppercase; }
        .br-form-card h3 { margin:7px 0 5px;font-size:23px;letter-spacing:-.06em; }
        .br-form-card .br-subtitle { margin:0;color:var(--muted);font-size:11px; }
        .br-form-icon { width:42px;height:42px;background:#e8dfcc;display:grid;place-items:center;color:#8c673b; }
        .br-field-label { display:block;margin:15px 0 7px;color:#4b5149;font-size:10px;font-weight:700;letter-spacing:.04em; }
        .br-field { width:100%;height:47px;padding:0 13px;background:#fffdf8;border:1px solid #d8d2c6;border-radius:0;color:var(--ink);font-family:inherit;font-size:12px;outline:none; }
        .br-field:focus { border-color:#a44336;box-shadow:0 0 0 3px #a443361b; }
        .br-form-submit { width:100%;margin-top:19px; }
        .br-mode { display:block;margin:16px auto 0;padding:0;border:0;background:none;color:#7b5d38;font-family:inherit;font-size:10px;font-weight:600;text-decoration:underline;text-underline-offset:4px;cursor:pointer; }
        .br-form-privacy { display:flex;align-items:flex-start;gap:7px;margin:15px 0 0;color:#89887f;font-size:9px;line-height:1.6; }
        .br-error { margin:12px 0 0;padding:10px;background:#f4e3dc;color:#9c392c;font-size:11px; }
        .br-success { padding:20px 2px 12px;text-align:center; }
        .br-success-mark { width:44px;height:44px;margin:0 auto 13px;display:grid;place-items:center;border-radius:50%;background:#e3e9dd;color:#41614b; }
        .br-success h3 { margin:0 0 8px;font-size:22px; }
        .br-success p { margin:0;color:#676d63;font-size:12px;line-height:1.7; }
        .br-footer { display:flex;justify-content:space-between;gap:20px;padding:20px 0;color:#99988b;font-size:9px;letter-spacing:.04em; }
        .br-footer strong { color:var(--ink);font-weight:700; }
        @media (max-width:760px) {
          .br-wrap { width:calc(100% - 36px); }
          .br-header { padding:16px 0; }
          .br-nav { display:none; }
          .br-mobile-menu { display:block; }
          .br-hero { display:flex;flex-direction:column;min-height:0; }
          .br-hero-copy { padding:38px 0 30px; }
          .br-title { font-size:clamp(48px,13vw,69px);margin:19px 0 15px; }
          .br-lede { font-size:12px; }
          .br-hero-actions { margin-top:23px;gap:16px; }
          .br-button { padding:14px 15px;font-size:10px; }
          .br-image-panel { margin:0 0 31px;min-height:0;height:370px; }
          .br-image-panel img { min-height:0; }
          .br-photo-tag { left:10px;bottom:14px; }
          .br-roundel { top:14px;right:13px;width:74px;height:74px;font-size:8px; }
          .br-reward { grid-template-columns:1fr;gap:24px;padding:39px 0 44px; }
          .br-reward-copy h2 { font-size:30px; }
          .br-stamp-card { padding:20px 17px 17px;box-shadow:6px 6px 0 #d4c8b5; }
          .br-stamps { gap:6px; }
          .br-stamp svg { width:14px;height:14px; }
          .br-story { grid-template-columns:1fr;gap:23px;padding:15px 0 47px; }
          .br-story-image { height:245px; }
          .br-story-copy h2 { font-size:31px; }
          .br-signup { padding:43px 0 48px; }
          .br-signup-grid { grid-template-columns:1fr;gap:25px; }
          .br-signup-copy h2 { font-size:38px; }
          .br-form-card { padding:24px 20px;margin:0; }
          .br-footer { flex-direction:column;gap:7px;padding:17px 0; }
        }
        @media (prefers-reduced-motion: reduce) { .br-renaissance *, .br-renaissance *:before, .br-renaissance *:after { transition:none!important;scroll-behavior:auto!important; } }
      `}</style>

      <div className="br-topline" />
      <header className="br-wrap br-header">
        <a className="br-brand" href="#inizio" aria-label="Anas Barber, inizio">
          <span className="br-brandmark"><Scissors size={20} /></span>
          <span className="br-brandname">ANAS BARBER<small>Barberia di quartiere</small></span>
        </a>
        <nav className="br-nav" aria-label="Navigazione principale">
          <a href="#premio">La tessera</a>
          <a href="#bottega">La bottega</a>
          <a className="br-nav-cta" href="#tessera">La tua tessera <ArrowRight size={13} /></a>
        </nav>
        <button className="br-mobile-menu" aria-label="Vai alla tessera" onClick={() => document.getElementById('tessera')?.scrollIntoView({ behavior: 'smooth' })}><Menu size={22} /></button>
      </header>

      <div className="br-wrap br-hero" id="inizio">
        <section className="br-hero-copy">
          <div className="br-kicker">Una barberia, una comunità</div>
          <h1 className="br-title">Il tuo posto.<br />Il tuo taglio.<br /><em>La settima è nostra.</em></h1>
          <p className="br-lede">Qui ci si conosce per nome. Ogni visita lascia il segno — e dopo sei tagli, il prossimo te lo offriamo noi.</p>
          <div className="br-hero-actions">
            <a className="br-button" href="#tessera">Apri la tessera <ArrowRight size={15} /></a>
            <a className="br-textlink" href="#premio">Scopri come funziona</a>
          </div>
        </section>
        <div className="br-image-panel">
          <img src="/__mockup/images/anas-barber-hero.jpg" alt="Il barbiere al lavoro nella bottega Anas Barber" />
          <div className="br-roundel">Il rituale<br />continua<br />con te</div>
          <div className="br-photo-tag"><strong>Fatto con calma, fatto bene.</strong><span>Da Anas, in bottega</span></div>
        </div>
      </div>

      <section className="br-wrap br-reward" id="premio">
        <div className="br-reward-copy">
          <div className="br-kicker">Fedeltà, senza complicazioni</div>
          <h2>Sei visite.<br />Un taglio in regalo.</h2>
          <p>Una tessera semplice come una stretta di mano. Mostrala dal telefono: a ogni acquisto aggiungiamo un timbro. Al settimo taglio, paghiamo noi.</p>
        </div>
        <div className="br-stamp-card" aria-label="Tessera: sei timbri e il settimo taglio in regalo">
          <div className="br-stamp-head"><span>Tessera Anas Barber</span><span>Il prossimo è il tuo.</span></div>
          <div className="br-stamps">{Array.from({ length: 7 }, (_, index) => <span className="br-stamp" key={index}>{index === 6 ? <Gift /> : <Scissors />}</span>)}</div>
          <div className="br-stamp-caption"><span>6 timbri · uno a ogni acquisto</span><span>7° taglio gratis</span></div>
        </div>
      </section>
      <div className="br-wrap br-rule" />

      <section className="br-wrap br-story" id="bottega">
        <div className="br-story-image"><img src="/__mockup/images/anas-barber-tools.jpg" alt="Rasoio e forbici preparati per il prossimo cliente" /></div>
        <div className="br-story-copy">
          <div className="br-kicker">Il valore delle cose fatte bene</div>
          <h2>Un buon taglio.<br />E il piacere di tornare.</h2>
          <p>Il rasoio affilato, il caffè pronto, due parole sul quartiere. La nostra bottega è un posto familiare, dove la cura non finisce davanti allo specchio.</p>
          <a className="br-textlink" href="#tessera">Porta la tessera con te <ArrowDown size={13} /></a>
        </div>
      </section>

      <section className="br-signup" id="tessera">
        <div className="br-wrap br-signup-grid">
          <div className="br-signup-copy">
            <div className="br-kicker">La tua tessera, sempre a portata</div>
            <h2>Ci vediamo alla prossima visita.</h2>
            <p>Registrati in un minuto. La tessera digitale resta sul tuo telefono, pronta per il prossimo timbro.</p>
            <div className="br-trust"><ShieldCheck size={15} /> I tuoi dati servono solo a gestire la tessera.</div>
          </div>
          <div className="br-form-card">
            {submitted ? <div className="br-success" role="status">
              <span className="br-success-mark"><Check size={21} /></span>
              <h3>{recovering ? 'Tessera ritrovata.' : 'Benvenuto in bottega.'}</h3>
              <p>La tua richiesta è pronta. Alla prossima visita, ricordati di mostrarci la tessera.</p>
            </div> : <>
              <div className="br-form-top">
                <div><div className="br-form-eyebrow">{recovering ? 'Bentornato' : 'La tua tessera digitale'}</div><h3>{recovering ? 'Ritrova la tessera' : 'Comincia da qui.'}</h3><p className="br-subtitle">{recovering ? 'La recuperiamo con il tuo numero.' : 'Pochi dati, un minuto soltanto.'}</p></div>
                <span className="br-form-icon"><Sparkles size={20} /></span>
              </div>
              <form onSubmit={submit} noValidate>
                {!recovering && <><label className="br-field-label" htmlFor="br-name">Nome e cognome</label><input className="br-field" id="br-name" autoComplete="name" placeholder="Come ti chiami?" value={name} onChange={(event) => setName(event.target.value)} /></>}
                <label className="br-field-label" htmlFor="br-phone">Numero di cellulare</label>
                <input className="br-field" id="br-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="Es. 333 123 4567" value={phone} onChange={(event) => setPhone(event.target.value)} />
                {error && <p className="br-error" role="alert">{error}</p>}
                <button className="br-button br-form-submit" type="submit">{recovering ? 'Ritrova la mia tessera' : 'Apri la tua tessera'} <ArrowRight size={15} /></button>
              </form>
              <button className="br-mode" type="button" onClick={() => { setRecovering(!recovering); setError(''); setSubmitted(false); }}>{recovering ? 'Non hai ancora una tessera? Creala' : 'Hai già una tessera? Ritrovala'}</button>
              <p className="br-form-privacy"><LockKeyhole size={12} /> Usiamo il tuo nome e numero solo per gestire la raccolta punti.</p>
            </>}
          </div>
        </div>
      </section>
      <footer className="br-wrap br-footer"><span><strong>Anas Barber</strong> · La cura di sempre, nel cuore del quartiere.</span><span>Una visita alla volta. Sei timbri, il settimo taglio è nostro.</span></footer>
    </main>
  );
}
