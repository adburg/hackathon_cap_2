// Eskalering etter alvorlighet. Teams er eneste kanal som kan sendes på ekte, og
// bare hvis TEAMS_WEBHOOK_URL er satt i .env. Ring og SMS er simulert.
//   kritisk: Teams + ring primær (+ ring sekundær hvis ingen kvittering etter 5 min)
//   høy:     Teams + SMS til primær
//   middels/lav: bare Teams, ingen vekkes
const WEBHOOK = () => process.env.TEAMS_WEBHOOK_URL;

export async function sendVarsler(r) {
  const varsler = [await sendTeams(r)];

  if (r.alvorlighet === 'kritisk') {
    for (const v of r.vekk) {
      varsler.push({ kanal: 'ring', mottaker: `${v.navn} (${v.rolle}, ${v.tjeneste})`, tekst: kort(r), status: 'simulert' });
      if (v.rolle === 'primær') {
        varsler.push({ kanal: 'ring', mottaker: `${v.sekundaer} (sekundær, ${v.tjeneste})`, tekst: kort(r), status: 'planlagt', nar: 'hvis ikke kvittert etter 5 min' });
      }
    }
  } else if (r.alvorlighet === 'høy') {
    for (const v of r.vekk) {
      varsler.push({ kanal: 'sms', mottaker: `${v.navn} (${v.rolle}, ${v.tjeneste})`, tekst: kort(r), status: 'simulert' });
    }
  }
  return varsler;
}

const kort = (r) => `[${r.alvorlighet.toUpperCase()}] ${r.tittel}`;

async function sendTeams(r) {
  const tekst = [kort(r), r.hva_skjer, `Sannsynlig årsak: ${r.hypoteser[0]?.arsak ?? 'ukjent'} (${r.hypoteser[0]?.konfidens ?? 0} %)`,
    `Neste steg: ${r.neste_steg[0]?.handling ?? 'ingen'}`, 'Utkast fra AI-agent, verifiser før du handler.'];
  const varsel = { kanal: 'teams', mottaker: '#vakt-natteskiftet', tekst: tekst.join('\n'), status: 'simulert' };
  if (!WEBHOOK()) return varsel;

  try {
    const res = await fetch(WEBHOOK(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            type: 'AdaptiveCard', version: '1.4',
            body: tekst.map((t, i) => ({ type: 'TextBlock', text: t, wrap: true, weight: i === 0 ? 'Bolder' : 'Default' })),
          },
        }],
      }),
    });
    return { ...varsel, status: res.ok ? 'sendt' : 'feilet', detalj: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ...varsel, status: 'feilet', detalj: e.message };
  }
}
