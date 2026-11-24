# Tessera punti digitale — Barbiere

Web app con due parti:

- **Tessera del cliente** (PWA): il cliente si iscrive con nome e cellulare, salva la tessera sulla Home del telefono, vede i timbri aggiornarsi da soli e mostra il suo QR in negozio.
- **Pannello di gestione** (`/admin`): il barbiere, da telefono o tablet, scansiona il QR (o cerca il cliente per nome/numero) e aggiunge i timbri; consegna i premi; crea nuove promozioni.

## Promozioni
Dalla scheda **Promozioni** del pannello si creano:
- **Raccolte punti**: ognuna con i suoi timbri sulla stessa tessera (es. *Taglio: 6 timbri → il 7° è gratis*, *Barba: 5 timbri → la 6ª è gratis*). Numero di timbri, premio, icona e scadenza sono configurabili.
- **Offerte**: annunci che compaiono sulla tessera di tutti i clienti (es. *Barba -50% questo sabato*), con scadenza facoltativa.

Le promozioni si possono disattivare senza perdere i timbri dei clienti. Alla prima accensione viene creata la raccolta *Taglio 6 + 1 gratis*.

## Pagine
| Percorso | Cosa fa |
|---|---|
| `/` | Iscrizione cliente / recupero tessera con il numero |
| `/c/<codice>` | Tessera del cliente (con QR). Se il barbiere è loggato, mostra anche i tasti per il timbro |
| `/admin` | Pannello di gestione (password) |
| `/locandina` | Locandina A4 da stampare con il QR di iscrizione |

## Avvio su Replit
1. Importa il repository da GitHub.
2. Aggiungi il database **PostgreSQL** di Replit: la variabile `DATABASE_URL` viene creata in automatico. Le tabelle si creano da sole al primo avvio.
3. Premi **Run** (`npm start`). Per la pubblicazione: Deploy → Autoscale.

Senza `DATABASE_URL` l'app parte comunque con un archivio in memoria (solo per prove: i dati si perdono al riavvio).

## Variabili (Secrets) facoltative
| Nome | Predefinito | Note |
|---|---|---|
| `ADMIN_PASSWORD` | `Anas` | Password del pannello |
| `SHOP_NAME` | `Anas Barber` | Nome mostrato su tessera, pannello e locandina |
| `SESSION_SECRET` | derivato dalla password | Chiave per firmare il login |
| `PORT` | `5000` | |

## Tecnica
Node.js senza framework, unica dipendenza `pg`. QR generati lato server (encoder incluso in `lib/qrcode`, licenza Apache 2.0). Lettura QR nel pannello con la fotocamera (BarcodeDetector o jsQR).
