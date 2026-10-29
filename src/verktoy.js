// Verktøyene til natteskift-agenten. Et verktøy er en definisjon (det modellen
// ser) og en kjør-funksjon (det som faktisk skjer). kjør: null betyr stub: den
// sendes ikke til modellen før dere implementerer den.
import fs from 'node:fs';
import path from 'node:path';

const DATA = path.join(import.meta.dirname, '..', 'data');
const lesJson = (fil) => JSON.parse(fs.readFileSync(path.join(DATA, fil), 'utf8'));

export const system = `Du tar første vakt når en alarm går om natta, før et menneske rekker å åpne laptopen.
Grav i loggene og de andre kildene til du har en hypotese om hva som skjer og hvorfor.
Skill mellom det du har sett i dataene og det du antar. Si eksplisitt hva du ikke vet.
En agent som gjetter på et produksjonsproblem er verre enn ingen agent.
Avslutt med en kort situasjonsrapport på norsk: alvorlighet, berørt tjeneste, sannsynlig årsak, hva du ikke vet, og foreslått neste steg.`;

export const eksempelOppgave =
  'ALARM kl 03:12 natt til 29. oktober: betaling: andel 5xx-svar siste 5 min er 9.4 % (terskel 5 %). Gjelder POST /betaling/trekk.';

// Godtar full ISO-tid eller bare "03:10" (tolkes som natt til 29. okt 2026, norsk tid).
function tilMs(tid) {
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(tid)) tid = `2026-10-29T${tid.padStart(5, '0')}+01:00`;
  const ms = Date.parse(tid);
  if (Number.isNaN(ms)) throw new Error(`Skjønner ikke tidspunktet «${tid}». Bruk f.eks. "03:10" eller "2026-10-29T03:10:00+01:00".`);
  return ms;
}

function sokILogger({ tjeneste, niva, fra, til, tekst, maks = 50 } = {}) {
  const fraMs = fra ? tilMs(fra) : -Infinity;
  const tilMsVerdi = til ? tilMs(til) : Infinity;
  const logger = lesJson('logger.json');
  const kjente = [...new Set(logger.map((l) => l.tjeneste))];
  if (tjeneste && !kjente.includes(tjeneste)) throw new Error(`Ukjent tjeneste «${tjeneste}». Gyldige: ${kjente.join(', ')}`);
  const treff = logger.filter((l) =>
    (!tjeneste || l.tjeneste === tjeneste) &&
    (!niva || l.nivå === niva.toUpperCase()) &&
    (!tekst || l.melding.toLowerCase().includes(tekst.toLowerCase())) &&
    Date.parse(l.tid) >= fraMs && Date.parse(l.tid) <= tilMsVerdi);

  const grense = Math.min(Math.max(Number(maks) || 50, 1), 200);
  if (treff.length === 0) return 'Ingen logglinjer matchet filteret. Prøv et bredere søk.';
  const linjer = treff.slice(0, grense).map((l) => `${l.tid} ${l.tjeneste} ${l.nivå} ${l.melding}`);
  if (treff.length > grense) linjer.push(`... ${treff.length - grense} linjer til. Snevre inn søket eller øk maks.`);
  return linjer.join('\n');
}

function hentRunbook({ tjeneste } = {}) {
  const dir = path.join(DATA, 'runbooks');
  const finnes = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  // Bare kjente navn slipper gjennom, så «../» ikke kan lese andre filer.
  if (!tjeneste || !finnes.includes(tjeneste)) {
    throw new Error(`Ingen runbook for «${tjeneste ?? ''}». Runbooks finnes for: ${finnes.join(', ')}`);
  }
  return fs.readFileSync(path.join(dir, `${tjeneste}.md`), 'utf8');
}

function sjekkDeployHistorikk({ tjeneste, siden } = {}) {
  const sidenMs = siden ? tilMs(siden) : -Infinity;
  const alle = lesJson('deploy-historikk.json');
  const kjente = [...new Set(alle.map((d) => d.tjeneste))];
  if (tjeneste && !kjente.includes(tjeneste)) throw new Error(`Ingen endringer registrert for «${tjeneste}». Tjenester med historikk: ${kjente.join(', ')}`);
  const treff = alle
    .filter((d) => (!tjeneste || d.tjeneste === tjeneste) && Date.parse(d.tid) > sidenMs)
    .sort((a, b) => Date.parse(b.tid) - Date.parse(a.tid));
  if (treff.length === 0) return 'Ingen endringer matchet filteret. Prøv en tidligere «siden» eller uten tjeneste.';
  return treff;
}

function finnLignendeHendelser({ tjeneste, tekst } = {}) {
  const alle = lesJson('hendelser.json');
  const kjente = [...new Set(alle.map((h) => h.tjeneste))];
  if (tjeneste && !kjente.includes(tjeneste)) throw new Error(`Ingen hendelser for «${tjeneste}». Tjenester med hendelser: ${kjente.join(', ')}`);
  const ord = (tekst ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  // Treff på hvert søkeord gir poeng, så «disk full» finner både «disk» og «full».
  const poeng = (h) => {
    const tekstmasse = [h.tittel, h.sammendrag, h.rotårsak, h.tiltak].join(' ').toLowerCase();
    return ord.filter((o) => tekstmasse.includes(o)).length;
  };
  const treff = alle
    .filter((h) => !tjeneste || h.tjeneste === tjeneste)
    .map((h) => ({ h, p: poeng(h) }))
    .filter(({ p }) => ord.length === 0 || p > 0)
    .sort((a, b) => b.p - a.p)
    .map(({ h }) => h);
  if (treff.length === 0) return 'Ingen tidligere hendelser matchet. Prøv færre eller andre søkeord, eller uten tjeneste.';
  return treff;
}

export const verktøy = [
  {
    definisjon: {
      name: 'sok_i_logger',
      description:
        'Søker i loggene fra natt til 29. oktober 2026 (ca 02:30-03:50). Alle filtre er valgfrie og kan kombineres. ' +
        'Tjenester: api-gateway, innlogging, betaling, sok, varsling, kunde-db. ' +
        'Start gjerne bredt (én tjeneste, et tidsvindu rundt alarmen) og snevre inn med tekst når du ser noe interessant. ' +
        'Husk at feilen ofte sitter i en annen tjeneste enn den som alarmerer.',
      input_schema: {
        type: 'object',
        properties: {
          tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "betaling".' },
          niva: { type: 'string', enum: ['INFO', 'WARN', 'ERROR'], description: 'Bare linjer med dette nivået.' },
          fra: { type: 'string', description: 'Fra og med tidspunkt, "03:00" eller full ISO-tid.' },
          til: { type: 'string', description: 'Til og med tidspunkt, "03:15" eller full ISO-tid.' },
          tekst: { type: 'string', description: 'Tekst som må finnes i meldingen (ikke skille på store/små bokstaver).' },
          maks: { type: 'number', description: 'Maks antall linjer tilbake. Standard 50, høyst 200.' },
        },
      },
    },
    kjør: async (input) => sokILogger(input),
  },
  {
    definisjon: {
      name: 'hent_runbook',
      description:
        'Henter runbooken for en tjeneste: hva teamet anbefaler å gjøre ved kjente feil, og hvem som skal vekkes. ' +
        'Sjekk datoen øverst. En gammel runbook kan beskrive oppsett som ikke finnes lenger, så sammenlign med det du ser i loggene.',
      input_schema: {
        type: 'object',
        properties: { tjeneste: { type: 'string', description: 'Tjenestenavn, f.eks. "sok".' } },
        required: ['tjeneste'],
      },
    },
    kjør: async (input) => hentRunbook(input),
  },
  {
    definisjon: {
      name: 'sjekk_deploy_historikk',
      description:
        'Viser utrullinger og konfigendringer, nyest først. Bruk den for å finne ut om noe ble endret rett før problemene startet. ' +
        'Husk at konfig- og cron-endringer også teller, og at en endring for flere dager siden kan slå inn først nå.',
      input_schema: {
        type: 'object',
        properties: {
          tjeneste: { type: 'string', description: 'Bare endringer for denne tjenesten. Utelat for alle.' },
          siden: { type: 'string', description: 'Bare endringer etter dette tidspunktet (ISO-tid).' },
        },
      },
    },
    kjør: async (input) => sjekkDeployHistorikk(input),
  },
  {
    definisjon: {
      name: 'finn_lignende_hendelser',
      description:
        'Søker i tidligere hendelser med post-mortem: hva skjedde, rotårsak, hva som ble gjort og hvor lenge det varte. ' +
        'Nyttig for å se om dette har skjedd før. Vær nøye med forskjellene: en hendelse som ligner, er ikke nødvendigvis samme feil.',
      input_schema: {
        type: 'object',
        properties: {
          tjeneste: { type: 'string', description: 'Bare hendelser for denne tjenesten.' },
          tekst: { type: 'string', description: 'Søkeord, f.eks. "disk" eller "timeout".' },
        },
      },
    },
    kjør: async (input) => finnLignendeHendelser(input),
  },
];
