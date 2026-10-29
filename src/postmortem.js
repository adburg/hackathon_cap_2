// Utkast til post-mortem når hendelsen lukkes. Bygger bare på det agenten og
// mennesket faktisk har registrert, og markerer resten som uavklart.
import Anthropic from '@anthropic-ai/sdk';

const MODELL = process.env.MODELL ?? 'claude-sonnet-5-5';

const SYSTEM = `Du skriver et utkast til post-mortem på norsk (bokmål) for en driftshendelse.
Bruk KUN grunnlaget du får. Finn ikke på tidspunkter, tall eller årsaker. Det som ikke står i grunnlaget, skrives som «Må avklares».
Skille tydelig mellom bekreftet (sett i data) og antatt (hypotese med konfidens).
Format (markdown, kort og konkret):
## Sammendrag
## Påvirkning
## Tidslinje
## Årsak
## Hva ble gjort
## Hva gikk bra / dårlig
## Oppfølging (konkrete tiltak med forslag til eier-team)
## Må avklares`;

export async function lagPostmortem({ alarm, rapport, steg = [], utfort = '' }) {
  const klient = new Anthropic();
  const grunnlag = JSON.stringify({ alarm, agentens_rapport: rapport, agentens_steg: steg, utført_av_menneske: utfort || '(ikke oppgitt)' }, null, 2);
  const svar = await klient.messages.create({
    model: MODELL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Skriv post-mortem-utkastet.\n\n${grunnlag}` }],
  });
  return svar.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}
