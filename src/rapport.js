// Gjør modellens rapport trygg å bruke (navn slås opp i vaktlista i stedet for å
// stoles på) og formaterer den for konsollen.
import { lesJson } from './verktoy.js';

const RANG = { kritisk: 0, høy: 1, middels: 2, lav: 3 };

export function normaliser(r) {
  const tjenester = lesJson('tjenester.json');
  const rolle = (v) => (v === 'sekundær' ? 'sekundær' : 'primær');

  // Personnavn kommer alltid fra tjenester.json, aldri fra modellen.
  const vekk = (r.vekk ?? [])
    .map((v) => {
      const t = tjenester.find((x) => x.navn === v.tjeneste);
      if (!t) return null;
      return {
        navn: t.vakt[rolle(v.rolle)],
        rolle: rolle(v.rolle),
        tjeneste: t.navn,
        team: t.eier_team,
        sekundaer: t.vakt.sekundær,
        begrunnelse: v.begrunnelse ?? '',
      };
    })
    .filter(Boolean);

  const hypoteser = (r.hypoteser ?? [])
    .map((h) => ({
      arsak: h.arsak ?? '',
      konfidens: Math.min(100, Math.max(0, Math.round(Number(h.konfidens) || 0))),
      bevis: h.bevis ?? [],
      mangler: h.mangler ?? '',
    }))
    .sort((a, b) => b.konfidens - a.konfidens);

  return {
    alvorlighet: r.alvorlighet in RANG ? r.alvorlighet : 'middels',
    tjeneste: r.tjeneste ?? 'ukjent',
    tittel: r.tittel ?? '',
    hva_skjer: r.hva_skjer ?? '',
    hypoteser,
    vet_ikke: r.vet_ikke ?? [],
    neste_steg: r.neste_steg ?? [],
    vekk,
  };
}

export function tekstRapport(r, varsler = []) {
  const linjer = [`${r.alvorlighet.toUpperCase()} · ${r.tjeneste}`, r.tittel, '', r.hva_skjer, '', 'MULIGE ÅRSAKER'];
  for (const h of r.hypoteser) {
    linjer.push(`  ${String(h.konfidens).padStart(3)} %  ${h.arsak}`);
    for (const b of h.bevis) linjer.push(`         - ${b}`);
    if (h.mangler) linjer.push(`         ? ${h.mangler}`);
  }
  linjer.push('', 'VET IKKE', ...r.vet_ikke.map((v) => `  - ${v}`));
  linjer.push('', 'NESTE STEG', ...r.neste_steg.map((s, i) => `  ${i + 1}. ${s.handling}${s.kilde ? ` (${s.kilde})` : ''}`));
  linjer.push('', 'VEKK', ...(r.vekk.length ? r.vekk.map((v) => `  - ${v.navn} (${v.rolle}, ${v.team}): ${v.begrunnelse}`) : ['  Ingen trenger å vekkes.']));
  if (varsler.length) {
    linjer.push('', 'VARSLER', ...varsler.map((v) => `  [${v.status}] ${v.kanal} → ${v.mottaker}${v.nar ? ` (${v.nar})` : ''}`));
  }
  linjer.push('', 'Utkast fra en AI-agent. Verifiser før du handler.');
  return linjer.join('\n');
}
