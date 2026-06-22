# Vel-Regnskap

Dobbelt bokføring (double-entry bookkeeping) for en norsk velforening. En
nettleserbasert app som erstatter regnearket med et veiledet grensesnitt –
bygget for en kasserer uten regnskapsbakgrunn, og enkel å overlevere til en
etterfølger.

Alt kjører lokalt i nettleseren. Det finnes ingen server, og ingen data sendes
noe sted: regnskapet lagres i nettleserens IndexedDB på din egen maskin.

## Funksjoner

- **Dashbord** – saldo per konto, årsresultat hittil, ubetalt kontingent og
  løpende balansekontroll.
- **Kontoplan** – balansekontoer (bærer saldo mellom år) og resultatkontoer
  (nullstilles hvert år). Inngående/utgående balanse per regnskapsår.
- **Bilagsføring** – autonummererte bilag med streng dobbel bokføring,
  søkbare kontovelgere, kontoregulering mellom bankkontoer og splitting av en
  brutto Vipps-innbetaling på flere resultatkontoer. Redigering og annullering
  beholder bilagsnummer.
- **Reskontro** – medlemsregister per husstand med kontingentrutenett per år,
  utestående-oversikt og avstemming mot bokført kontingent.
- **Anleggsmidler** – eiendelsregister med 10 % lineær avskrivning, tilgang og
  bortskrivning. Avskrivning bokføres automatisk som bilag.
- **Årsoppstilling** – inngående balanse → inntekter → kostnader → resultat →
  avskrivninger → utgående balanse, med en kontrollblokk som går opp i null.
- **Noter** – auto-genererte noter for anleggsmidler, kontingentprinsipp og
  spesifiserte inntekts-/kostnadskontoer.
- **Årsavslutning** – veiledet avslutning: kjør avskrivning, gjennomgå,
  lås året og overfør utgående saldoer som inngående balanse i nytt år.
- **Sikkerhetskopi** – eksport/import til JSON, CSV-eksport av kassaboken, og
  utskrift/PDF av årsoppstilling og noter.

Regnskapsåret går fra 1. april til 31. mars. Beløp er i NOK og formateres som
`kr 1 000,00`.

## Bruke appen

Åpne nettsiden, så er du i gang – appen kommer med litt eksempeldata ved første
oppstart. Ta jevnlig **sikkerhetskopi** via «Eksporter (JSON)» i sidemenyen, og
bruk «Importer (JSON)» for å flytte regnskapet til en annen maskin.

## Kjøre lokalt (for utviklere)

Krever [Node.js](https://nodejs.org/) 20 eller nyere.

```bash
npm install      # installer avhengigheter
npm run dev      # start utviklingsserver (http://localhost:5173)
npm run build    # bygg produksjonsversjon til dist/
npm run preview  # forhåndsvis produksjonsbygget
```

Produksjonsbygget bruker relative stier (`base: "./"`), så `dist/index.html`
kan også åpnes direkte fra filsystemet uten en server.

## Publisering

Repoet er satt opp med GitHub Actions (`.github/workflows/deploy.yml`) som
bygger appen og publiserer den til GitHub Pages ved hver push til `main`.

For å aktivere: gå til **Settings → Pages** i GitHub-repoet og velg
**GitHub Actions** som kilde («Source»). Siden blir da tilgjengelig på
`https://berghrygh.github.io/IldjernetRegnskap/`.

## Teknologi

React + TypeScript + Vite + Tailwind CSS. Regnskapsmotoren ligger i
`src/domain/` og er adskilt fra grensesnittet i `src/views/`.
