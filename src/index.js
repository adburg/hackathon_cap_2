// Startpunktet: npm start -- "spørsmålet ditt"
import { håndterAlarm } from './hendelse.js';
import { eksempelOppgave } from './verktoy.js';
import { konsollPa } from './konsoll.js';
import { tekstRapport } from './rapport.js';

try {
  process.loadEnvFile();
} catch {
  // Ingen .env — da må ANTHROPIC_API_KEY være satt i miljøet.
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Mangler ANTHROPIC_API_KEY. Kopier .env.example til .env og lim inn nøkkelen.');
  process.exit(1);
}

const oppgave = process.argv.slice(2).join(' ') || eksempelOppgave;
console.log(`\n🎃 ${oppgave}\n`);

const { rapport, varsler } = await håndterAlarm({ oppgave, pa: konsollPa });
if (rapport) console.log(`\n${tekstRapport(rapport, varsler)}`);
