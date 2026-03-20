# 🎌 Nihongo Sensei

Modern Japanese learning platform with multi-level JLPT support (N5→N1), offline-first architecture, and Wabi-Sabi design philosophy.

## 📖 Overview

Nihongo Sensei is a standalone React/Vite application for Japanese language learning. Features include kanji writing practice with stroke order validation, dictation exercises with phonetic feedback, SRS flashcards, verb conjugation drills, and a daily kanji widget—all with dynamic JLPT level filtering.

## 🏗️ Architecture

```
src/
├── modules/
│   ├── KakiBoard.jsx          # Kanji writing practice (Canvas + SVG stroke order)
│   ├── DictationMaster.jsx    # Audio dictation with phonetic markers
│   ├── FlashCards.jsx         # SRS flashcard system (kanji + sentences)
│   ├── VerbLab.jsx            # Verb conjugation trainer
│   ├── BattleDungeon.jsx      # Wave-based combat learning (Kanji + Verbs + Boss dictation)
│   └── KanjiWidget.jsx        # Daily kanji widget
├── database/
│   ├── kanji_master.json      # Multi-level kanji database (N5-N1)
│   └── sentences.json         # Example sentences with furigana
├── components/
│   ├── Dashboard.jsx          # Main hub with progress tracking
│   └── Settings.jsx           # JLPT level selection + daily cards config
└── hooks/
    ├── useJLPTLevels.js       # Centralized level management
    └── useDailyCardsTarget.js # Daily flashcards target (5-50)

public/
├── kanji/                     # SVG files from KanjiVG (e.g., 065e5.svg → 日)
└── audio/
    ├── kanji/                 # TTS audio for kanji readings
    └── dictation/             # TTS audio for sentences
```

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS (custom Wabi-Sabi palette)
- **Routing**: React Router v6
- **Data**: JSON-based local database
- **Audio**: Web Audio API (procedural feedback) + Google TTS (free endpoint)
- **SVG Processing**: KanjiVG format parser

## 📋 Master Scripts

The project includes three powerful automation scripts for database management:

| Script | Description | Usage |
|--------|-------------|-------|
| **master-sync-kanji.js** | Downloads kanji metadata, SVG stroke order files, and generates TTS audio using **hiragana readings** (not kanji) | `node scripts/master-sync-kanji.js --level=N5 [--limit=10] [--skip-audio] [--skip-svg]` |
| **master-sync-sentences.js** | Fetches sentences from Tatoeba API, annotates with phonetic markers, translates to Italian, and generates TTS audio | `node scripts/master-sync-sentences.js --kanji=日本 [--limit=50] [--skip-audio] [--skip-translate]` |
| **maintenance-tool.js** | Database auditing and audio repair tool | `node scripts/maintenance-tool.js audit`<br>`node scripts/maintenance-tool.js repair-audio --kanji=正しく --reading=ただしく`<br>`node scripts/maintenance-tool.js repair-audio --sentence=9999`<br>`node scripts/maintenance-tool.js repair-audio --all-sentences` |

### Master Scripts Parameters

#### master-sync-kanji.js
- `--level=N5` - JLPT level (N5, N4, N3, N2, N1)
- `--limit=10` - Process only first N kanji (optional, for testing)
- `--skip-audio` - Skip TTS audio generation
- `--skip-svg` - Skip SVG download from KanjiVG

#### master-sync-sentences.js
- `--kanji=日本` - Filter sentences containing these kanji (optional)
- `--limit=50` - Number of new sentences to download (default: 50)
- `--skip-audio` - Skip TTS audio generation
- `--skip-translate` - Skip Italian translation

#### maintenance-tool.js
- `audit` - Generate complete report of missing SVG/audio files
- `repair-audio --kanji=X --reading=Y` - Regenerate audio for a specific kanji with correct pronunciation (uses hiragana reading)
- `repair-audio --sentence=9999` - Regenerate audio for a specific sentence (uses reading field from JSON)
- `repair-audio --all-sentences` - Regenerate audio for ALL sentences (overwrites existing files, uses reading field for correct pronunciation)

### ⚠️ Critical Audio Fix

**All TTS audio generation now uses hiragana/katakana readings instead of kanji to ensure correct pronunciation.**

Example:
- ❌ OLD: `正しく` → "masashiku" (incorrect)
- ✅ NEW: `ただしく` → "tadashiku" (correct)

The `audio_text` field in `kanji_master.json` tracks the hiragana reading used for TTS generation.

## 🚀 Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repo-url>
cd nihongo-sensei-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Populate Database

```bash
# Download N5 kanji with metadata, SVG, and audio
node scripts/master-sync-kanji.js --level=N5

# Download N4 kanji (skip audio for faster testing)
node scripts/master-sync-kanji.js --level=N4 --skip-audio

# Download sentences with audio
node scripts/master-sync-sentences.js --kanji=日本人 --limit=20

# Audit database completeness
node scripts/maintenance-tool.js audit
```

### JLPT Level Configuration

1. Open the app: `http://localhost:5173`
2. Click **Settings** (⚙️ button in Dashboard)
3. Select desired JLPT levels (N5, N4, etc.)
4. Configure daily cards target (5-50 new cards per day)
5. All modules (Dashboard, Flashcards, KakiBoard) will automatically filter content

## 🎨 Design Philosophy

**Wabi-Sabi** principles guide the UI:
- Imperfect beauty in handwriting practice
- Natural color palette (Matcha green, Hinomaru red, Sumi black)
- Minimalist interface with focused functionality
- Progress over perfection (celebrate 70%+ scores)

## 📊 Features

### KakiBoard (Kanji Writing Practice)
- Canvas-based drawing with stroke order hints
- Real-time feedback with similarity scoring
- Progressive hint system (shows only next stroke)
- Glitter effects for 90%+ scores
- Procedural sound feedback (Web Audio API)

### Dictation Master
- Audio playback with phonetic markers
- Vowel devoicing indicators: `で[す]`, `ま[す]`
- G-nasalization markers: `[が]`
- Character-by-character input with real-time feedback

### FlashCards SRS
- Intelligent priority system (errors → new → review)
- Anki-style feedback buttons (1-4 difficulty)
- Multi-source deck (curriculum + kanji + dictation errors)
- Configurable daily target (5-50 cards via Settings)
- Dynamic multi-level support (labels adapt to selected JLPT levels)
- Keyboard shortcuts support (1-4 for ratings, arrows for navigation)

### Verb Lab
- Dynamic conjugation for Godan, Ichidan, Irregular verbs
- Interactive form selection
- Pronunciation guide with audio

### Battle Dungeon
- Wave-based combat learning challenge with Boss Battle finale
- Adaptive difficulty based on selected JLPT levels (N5: 3 waves → N1: 12 waves)
- Mixed enemy types: Kanji reading (accepts all On/Kun readings) + Verb conjugation
- Spirit system: verb enemies grant +10% Spirit, multiplying damage dealt (max 2x at 100% Spirit)
- Boss Battle: dictation challenge from sentences.json with audio playback
- Kana-agnostic input validation (ひらがな = ヒラガナ)
- No-spoiler feedback system (shows character accuracy without revealing answer)
- Progress tracking: XP rewards, dungeon completion stats saved to localStorage
- Procedural difficulty scaling:
  - N5: 3 waves, 100 Boss HP, 100 Player HP
  - N4: 5 waves, 150 Boss HP, 100 Player HP
  - N3: 7 waves, 200 Boss HP, 120 Player HP
  - N2: 9 waves, 250 Boss HP, 120 Player HP
  - N1: 12 waves, 300 Boss HP, 150 Player HP

### Translation Dojo (N5 Masu)
- Bidirectional translation practice: IT↔JP (Production & Comprehension modes)
- Double validation: accepts both Kanji and Hiragana answers
- Smart flexibility: validates grammatically correct answers even without explicit subject
- LiveFeedbackInput integration: real-time visual feedback in IT→JP mode
- Toggle Furigana: show/hide reading above Kanji
- Audio playback with intelligent chunking:
  - Database reading fields contain strategic spaces after particles (は, を, に, etc.)
  - Audio splits on spaces for natural breathing pauses
  - TTS fallback using hiragana reading (never kanji) for correct pronunciation
  - Rate: 0.75 for clarity
- SRS integration: failed translations automatically repeated
- Dual validation logic:
  - IT→JP: accepts kanji, hiragana, and alternative forms
  - JP→IT: keyword matching (70% threshold) for Italian answers

## 🗂️ Database Structure

### kanji_master.json
```json
{
  "N5": [
    {
      "kanji": "日",
      "onyomi": "ニチ、ジツ",
      "kunyomi": "ひ、-び、-か",
      "meaning": "day, sun, Japan",
      "strokes": 4,
      "audio_text": "ニチ、ジツ、ひ、-び、-か",
      "examples": [
        {
          "word": "日本",
          "reading": "にほん",
          "meaning": "Japan",
          "audio_text": "にほん"
        }
      ]
    }
  ],
  "N4": [...],
  "N3": [...],
  "N2": [...],
  "N1": [...]
}
```

### sentences.json
```json
[
  {
    "id": 123456,
    "japanese": "日本人です。",
    "reading": "にほんじんです。",
    "reading_annotated": "にほんじんで[す]。",
    "english": "I am Japanese.",
    "italian": "Sono giapponese."
  }
]
```

## 🔧 Troubleshooting

### Audio pronunciation is wrong
Use maintenance tool to regenerate with correct reading:
```bash
node scripts/maintenance-tool.js repair-audio --kanji=正しく --reading=ただしく
```

### SVG stroke order not displaying
Check if SVG files exist in `public/kanji/`:
```bash
node scripts/maintenance-tool.js audit
```

Download missing files:
```bash
node scripts/master-sync-kanji.js --level=N5 --skip-audio
```

### UI shows old kanji counts after sync
Clear localStorage cache:
1. Go to Settings page
2. Click "Pulisci LocalStorage" button
3. Page will reload with updated data

## 📝 Development Notes

- All scripts use ES modules (`import`/`export`)
- Audio generation uses free Google TTS endpoint (no API key required)
- SVG files sourced from [KanjiVG](https://github.com/KanjiVG/kanjivg)
- Sentences sourced from [Tatoeba Project](https://tatoeba.org)
- Multi-level system is fully dynamic: works with any JLPT level combination (N5+N4, N2+N1, etc.)
- FlashCards daily target configurable via slider in Settings (persisted in localStorage)

## 📄 License

MIT License

## 🙏 Credits

- **KanjiVG**: Stroke order SVG database
- **Tatoeba Project**: Example sentences corpus
- **Google Translate**: Free TTS endpoint

---

**For detailed development status and next steps, see `stato_attuale.md`**
