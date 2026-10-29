// Agent-løkken. Hele «agent-greia» er dette: spør modellen, kjør verktøyene
// den ber om, send resultatene tilbake, gjenta til den er ferdig.
// Løkka forteller hva den gjør via pa(hendelse), slik at både konsollen og
// nettgrensesnittet kan vise det samme forløpet.
import Anthropic from '@anthropic-ai/sdk';

const MODELL = process.env.MODELL ?? 'claude-sonnet-5-5';

// Stopper en agent som går i ring før den brenner opp kostnadstaket.
const MAX_ITERASJONER = Number(process.env.MAX_ITERASJONER ?? 12);

const FORHANDSVIS_TEGN = 600;

export async function kjørAgent({ system, oppgave, verktøy, pa = () => {}, skalStoppe = () => false }) {
  // Opprettes her og ikke på toppnivå: index.js laster .env først etter at
  // importene er kjørt, så en klient på toppnivå ser aldri nøkkelen.
  const klient = new Anthropic();
  const aktive = verktøy.filter((v) => v.kjør);
  const etterNavn = new Map(aktive.map((v) => [v.definisjon.name, v]));
  const hendelse = (e) => pa({ ...e, tid: Date.now() });

  const messages = [{ role: 'user', content: oppgave }];
  let purret = false;

  for (let i = 1; i <= MAX_ITERASJONER; i++) {
    if (skalStoppe()) return {};

    const svar = await klient.messages.create({
      model: MODELL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      system,
      tools: aktive.map((v) => v.definisjon),
      messages,
    });

    messages.push({ role: 'assistant', content: svar.content });

    for (const blokk of svar.content) {
      if (blokk.type === 'text' && blokk.text.trim()) hendelse({ type: 'tekst', tekst: blokk.text });
    }

    if (svar.stop_reason === 'refusal') {
      hendelse({ type: 'stopp', grunn: `Modellen avslo (${svar.stop_details?.category ?? 'ukjent grunn'}).` });
      return {};
    }
    if (svar.stop_reason === 'max_tokens') {
      hendelse({ type: 'stopp', grunn: 'Svaret ble kuttet (max_tokens).' });
      return {};
    }

    const kall = svar.content.filter((b) => b.type === 'tool_use');
    if (kall.length === 0) {
      // Modellen ble «ferdig» uten å levere rapporten. Én påminnelse, så gir vi opp.
      if (svar.stop_reason === 'end_turn' && !purret) {
        purret = true;
        messages.push({ role: 'user', content: 'Lever situasjonsrapporten nå med verktøyet lever_rapport.' });
        continue;
      }
      hendelse({ type: 'stopp', grunn: 'Agenten avsluttet uten å levere rapport.' });
      return {};
    }

    // Modellen kan be om flere verktøy samtidig. Alle resultatene må tilbake
    // i én og samme melding.
    let rapport = null;
    const resultater = [];
    for (const k of kall) {
      hendelse({ type: 'verktoy', id: k.id, navn: k.name, input: k.input });
      const v = etterNavn.get(k.name);
      if (v?.avslutter) rapport = k.input;
      resultater.push(await kjørVerktøy(v, k, etterNavn, hendelse));
    }
    if (rapport) return { rapport };
    messages.push({ role: 'user', content: resultater });
  }

  hendelse({ type: 'stopp', grunn: `Stoppet etter ${MAX_ITERASJONER} runder (MAX_ITERASJONER).` });
  return {};
}

async function kjørVerktøy(v, kall, etterNavn, hendelse) {
  if (!v) return feil(kall, `Ukjent verktøy «${kall.name}». Gyldige: ${[...etterNavn.keys()].join(', ')}`, hendelse);
  try {
    const resultat = await v.kjør(kall.input);
    const tekst = typeof resultat === 'string' ? resultat : JSON.stringify(resultat, null, 2);
    hendelse({ type: 'resultat', id: kall.id, navn: kall.name, tegn: tekst.length, forhandsvis: tekst.slice(0, FORHANDSVIS_TEGN) });
    return { type: 'tool_result', tool_use_id: kall.id, content: tekst };
  } catch (e) {
    return feil(kall, e.message, hendelse);
  }
}

function feil(kall, melding, hendelse) {
  hendelse({ type: 'resultat', id: kall.id, navn: kall.name, feil: true, forhandsvis: melding, tegn: melding.length });
  return { type: 'tool_result', tool_use_id: kall.id, content: melding, is_error: true };
}
