// Nettgrensesnittet: npm run ui  →  http://localhost:3000
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { håndterAlarm, alarmTilOppgave } from './hendelse.js';
import { lagPostmortem } from './postmortem.js';
import { lesJson } from './verktoy.js';

try {
  process.loadEnvFile();
} catch {
  // Ingen .env — da må ANTHROPIC_API_KEY være satt i miljøet.
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Mangler ANTHROPIC_API_KEY. Kopier .env.example til .env og lim inn nøkkelen.');
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const SIDE = path.join(import.meta.dirname, '..', 'public', 'index.html');

const json = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const lesBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (d) => {
      body += d;
      if (body.length > 200_000) reject(new Error('For stor forespørsel.'));
    });
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(SIDE));
    }

    if (url.pathname === '/api/data') {
      return json(res, { logger: lesJson('logger.json'), alarmer: lesJson('alarmer.json'), tjenester: lesJson('tjenester.json') });
    }

    // Server-sent events: hvert steg agenten tar, strømmes til nettleseren.
    if (url.pathname === '/api/kjor') {
      const alarm = lesJson('alarmer.json').find((a) => a.id === url.searchParams.get('alarm'));
      const oppgave = alarm ? alarmTilOppgave(alarm) : url.searchParams.get('tekst')?.trim();
      if (!oppgave) return json(res, { feil: 'Mangler alarm eller tekst.' }, 400);

      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      let lukket = false;
      res.on('close', () => (lukket = true));
      const pa = (e) => !lukket && res.write(`data: ${JSON.stringify(e)}\n\n`);
      try {
        await håndterAlarm({ oppgave, pa, skalStoppe: () => lukket });
      } catch (e) {
        pa({ type: 'stopp', grunn: e.message });
      }
      pa({ type: 'ferdig' });
      return res.end();
    }

    if (url.pathname === '/api/postmortem' && req.method === 'POST') {
      const { alarm, rapport, steg, utfort } = await lesBody(req);
      if (!rapport) return json(res, { feil: 'Mangler rapport.' }, 400);
      return json(res, { tekst: await lagPostmortem({ alarm, rapport, steg, utfort }) });
    }

    json(res, { feil: 'Ikke funnet.' }, 404);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, { feil: e.message }, 500);
    else res.end();
  }
});

server.listen(PORT, () => console.log(`🐺 Natteskiftet: http://localhost:${PORT}`));
