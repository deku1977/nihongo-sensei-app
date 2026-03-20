# 🎌 Nihongo Sensei - Protocollo di Sessione
# MultiTools - Offline-First Modular Electron Platform
[EFFICIENCY RULES]
- Sii estremamente conciso. Salta le introduzioni e le conclusioni di cortesia.
- Non mostrare output di log o print ridondanti nel codice.
- Usa una struttura snella: separa logica (Main), UI (Renderer) e servizi (Security/SSH).
- Documenta ogni funzione con JSDoc sintetico.
- Se un file esiste già, proponi solo le modifiche (diff) invece di riscrivere l'intero file per risparmiare token.
- Fai riferimento ai file di architettura README solo quando necessario

## 🔊 Regola Generazione Audio
- **MAI** inviare Kanji direttamente al TTS.
- **SEMPRE** convertire il testo in Hiragana prima di richiedere l'audio. 
- Esempio: Inviare `ただしく` invece di `正しく` per garantire la pronuncia corretta.

> **⚠️ IMPORTANTE:** Non utilizzare le API di Google Cloud per il TTS o la Traduzione. Usa le librerie basate sugli endpoint pubblici (come `google-tts-api`) che abbiamo già testato nel progetto legacy. Non richiedere all'utente chiavi API `.env` per queste funzioni. lo script è in ./script/generate-audio-tts.js
# TODO
"Claude, è ora di affrontare i contatori giapponesi. Crea un nuovo modulo chiamato CounterTemple.jsx e il relativo database src/database/counters_n5.json.

Specifiche del Modulo:

Database: Inserisci i contatori N5 principali: 〜つ (generico), 〜枚 (piatti), 〜本 (lunghi), 〜台 (macchine), 〜人 (persone) e 〜歳 (età). Includi le irregolarità fonetiche (es. ippon, sanbon).

Interfaccia: Mostra una sfida del tipo: 'Conta 3 bottiglie' o 'Ho 20 anni'. L'utente deve rispondere in Kanji o Hiragana.

Feedback Intelligente: Se l'utente sbaglia, spiega PERCHÉ (es: 'Per le bottiglie, che sono oggetti lunghi, usa 〜本').

Audio: Usa la nostra logica consolidata (ja-JP, rate 0.8) per far sentire la pronuncia corretta, specialmente per le eccezioni come 'ippon' o 'hitori'.

Dashboard: Aggiungi il link al nuovo modulo nella Dashboard con un'icona a tema (es. un abaco o dei cubi)."