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
# ✅ COMPLETATO - Responsive Design KakiBoard
Layout completamente responsivo implementato:
- Mobile (<768px): Canvas 65vw, layout verticale, bottom nav bar
- Tablet (768px-1023px): Canvas 400px, sidebar visibile
- Desktop (1024px+): Canvas 450px, layout affiancato, sidebar sinistra
- Aspect ratio 1:1 mantenuto su tutti i device
- Font e spaziature dinamici con breakpoint md: e lg:

# TODO
Prossime feature da implementare (se richieste)