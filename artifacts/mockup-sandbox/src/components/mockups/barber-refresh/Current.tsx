import { useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, Gift, Scissors, ShieldCheck, TicketPercent } from 'lucide-react';
import './_group.css';

export function Current() {
  const [recovering, setRecovering] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return <main className="barber-current min-h-screen overflow-hidden">
    <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex items-center gap-3"><span className="brand-mark"><Scissors size={20} /></span><span className="font-semibold tracking-[-.04em]">Anas Barber</span></div>
      <button className="inline-flex items-center gap-2 rounded-full border border-[#d8cfc1] bg-[#fbf8f1] px-4 py-2 text-xs font-semibold text-[#554b40]"><ShieldCheck size={15} /> Area barbiere</button>
    </header>
    <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-6 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-16 lg:py-14">
      <section>
        <div className="eyebrow mb-4 flex items-center gap-2"><span className="h-px w-7 bg-[#b28a4d]" /> LA TUA BARBERIA, SEMPRE CON TE</div>
        <h1 className="max-w-xl text-[clamp(2.7rem,7vw,5.4rem)] font-semibold leading-[1.04] tracking-[-.075em]">Ogni visita<br /><span className="text-[#9a7747]">conta davvero.</span></h1>
        <p className="mt-6 max-w-md text-base leading-7 text-[#746a5e]">Il tuo taglio preferito, una faccia amica e una tessera che non si perde più. Mostrala al prossimo appuntamento.</p>
        <div className="mt-8 flex items-center gap-4 text-sm text-[#756b60]"><div className="flex -space-x-2">{['A','M','L'].map((letter, i) => <span key={letter} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#f2eee7] text-xs font-bold ${i === 1 ? 'bg-[#dfc59b]' : 'bg-[#d9d0c3]'}`}>{letter}</span>)}</div><span>La cura di sempre, in formato digitale</span></div>
      </section>
      <section className="mx-auto w-full max-w-[470px] rounded-[28px] border border-[#e5ddd1] bg-[#fbf8f1] p-6 shadow-[0_28px_85px_rgba(54,41,25,.12)] sm:p-8">
        <div className="mb-7 flex items-start justify-between"><div><p className="eyebrow">Benvenuto</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.05em]">{recovering ? 'Ritrova la tessera' : 'Crea la tua tessera'}</h2><p className="mt-1 text-sm text-[#82796e]">{recovering ? 'La ritroviamo con il tuo numero.' : 'Ci vuole meno di un minuto.'}</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#efe4d1] text-[#8c6837]"><BadgeCheck size={23} /></div></div>
        <form onSubmit={submit}>{!recovering && <div className="mb-4"><label className="label">Nome e cognome</label><input className="field" placeholder="Come ti chiami?" value={name} onChange={(e) => setName(e.target.value)} /></div>}<div><label className="label">Numero di cellulare</label><input className="field" placeholder="Es. 333 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} /></div><button className="btn-primary mt-5 w-full">{recovering ? 'Ritrova la mia tessera' : 'Apri la tua tessera'} <ArrowRight size={17} /></button></form>
        <div className="mt-5 border-t border-[#ebe4da] pt-4 text-center"><button className="text-sm font-semibold text-[#80633d] underline underline-offset-4" onClick={() => setRecovering(!recovering)}>{recovering ? 'Non hai ancora una tessera? Creala' : 'Hai già una tessera? Ritrovala'}</button></div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#93897d]"><ShieldCheck size={14} /> Usiamo i tuoi dati solo per gestire la tessera punti.</p>
      </section>
    </div>
    <section className="border-y border-[#e4dbcf] bg-[#ede7dd]"><div className="mx-auto grid max-w-6xl gap-px px-5 py-7 sm:grid-cols-3 sm:px-8">
      <div className="flex items-center gap-3 py-3 sm:justify-center"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fbf8f1] text-[#987746]"><Scissors size={19} /></span><span className="text-sm font-medium">Un timbro a ogni visita</span></div>
      <div className="flex items-center gap-3 py-3 sm:justify-center"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fbf8f1] text-[#987746]"><Gift size={19} /></span><span className="text-sm font-medium">Un premio ti aspetta</span></div>
      <div className="flex items-center gap-3 py-3 sm:justify-center"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fbf8f1] text-[#987746]"><BadgeCheck size={19} /></span><span className="text-sm font-medium">Sempre sul tuo telefono</span></div>
    </div></section>
    <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8"><p className="eyebrow">In negozio adesso</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Piccole attenzioni, grandi ritorni.</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><article className="flex items-center gap-4 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#efe4d1] text-[#8c6837]"><Scissors size={20} /></span><div><h3 className="font-semibold">Taglio · 6 timbri</h3><p className="mt-1 text-sm text-[#81766d]">Il 7° taglio è gratis</p></div></article><article className="flex items-center gap-4 rounded-2xl border border-[#e4dbcf] bg-[#fbf8f1] p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#efe4d1] text-[#8c6837]"><TicketPercent size={20} /></span><div><h3 className="font-semibold">La cura di sempre</h3><p className="mt-1 text-sm text-[#81766d]">Un appuntamento alla volta.</p></div></article></div></section>
    <footer className="mx-auto flex max-w-6xl justify-between px-5 py-6 text-xs text-[#93897d] sm:px-8"><span>Anas Barber · Con cura, ogni giorno.</span><span>Tessera fedeltà digitale</span></footer>
  </main>;
}
