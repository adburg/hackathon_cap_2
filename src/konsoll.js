// Skriver agentens forløp til terminalen.
const grå = (t) => `\x1b[90m${t}\x1b[0m`;
const oransje = (t) => `\x1b[38;5;208m${t}\x1b[0m`;
const grønn = (t) => `\x1b[32m${t}\x1b[0m`;

export function konsollPa(e) {
  if (e.type === 'tekst') console.log(grå(e.tekst));
  else if (e.type === 'verktoy') console.log(oransje(`→ ${e.navn}`) + grå(` ${JSON.stringify(e.input)}`));
  else if (e.type === 'resultat') console.log(e.feil ? oransje(`  ✖ ${e.forhandsvis}`) : grønn(`  ✓ ${e.tegn} tegn tilbake`));
  else if (e.type === 'stopp') console.log(oransje(`\n✖ ${e.grunn}`));
}
