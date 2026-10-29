Oppgave 02
🐺 Natteskiftet
Assistenten som tar første vakt når noe ryker

Megakart over Natteskiftet: en gotisk by klokka tre om natta med seks vakttårn, ett i brann, og en elv av loggruller.
Bålet er der golemen starter. Tåkeportene låser dere opp selv.
Input: en alarm eller feilmelding (mock-data er helt fint — lag et knippe realistiske)
Verktøyet triagerer: hvor alvorlig, hvilken tjeneste, hva skjedde sist dette oppsto
Output: en kort situasjonsrapport med foreslått neste steg
🤖 Agent-komponenten
Agenten har verktøy: sok_i_logger, hent_runbook, sjekk_deploy_historikk, finn_lignende_hendelser
Den leser alarmen, bestemmer selv hvilke verktøy den trenger, og graver til den har en hypotese
Den sier hva den ikke vet — en agent som gjetter på et produksjonsproblem er verre enn ingen agent
⭐ Bonuspoeng: Utkast til post-mortem generert automatisk når hendelsen lukkes • Agenten foreslår hvem som bør vekkes, basert på hvem som eier tjenesten • Tidslinje-visning av hva agenten gjorde, steg for steg

Verdi: Kortere vei fra alarm til diagnose. Og den som har vakt slipper å starte helt på bar bakke kl. 03.
⚰️ Startrepoet
Fem alarmer, 256 logglinjer, runbooks, deploy-historikk og ti tidligere hendelser for seks tjenester. Agentløkka kjører fra første npm start.

🔥 sok_i_logger
🔒 hent_runbook
🔒 sjekk_deploy_historikk
🔒 finn_lignende_hendelser
