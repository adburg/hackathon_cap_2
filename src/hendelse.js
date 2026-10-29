// Hele flyten fra alarm til rapport og varsler. Brukes av både konsollen og nettgrensesnittet.
import { kjørAgent } from './agent.js';
import { system, verktøy } from './verktoy.js';
import { normaliser } from './rapport.js';
import { sendVarsler } from './varsling.js';

export function alarmTilOppgave(a) {
  const kl = new Date(a.tid).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' }).replace('.', ':');
  return `ALARM kl ${kl} natt til 29. oktober (${a.id}, ${a.alvorlighet}): ${a.tittel}. ${a.tekst}`;
}

export async function håndterAlarm({ oppgave, pa = () => {}, skalStoppe }) {
  pa({ type: 'start', oppgave, tid: Date.now() });
  const { rapport: rå } = await kjørAgent({ system, oppgave, verktøy, pa, skalStoppe });
  if (!rå) return {};

  const rapport = normaliser(rå);
  pa({ type: 'rapport', rapport, tid: Date.now() });
  const varsler = await sendVarsler(rapport);
  pa({ type: 'varsel', varsler, tid: Date.now() });
  return { rapport, varsler };
}
