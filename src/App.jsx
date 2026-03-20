import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import DictationMaster from './modules/DictationMaster';
import FlashCards from './modules/FlashCards';
import VerbLab from './modules/VerbLab';
import KakiBoard from './modules/KakiBoard';
import KanjiWidget from './modules/KanjiWidget';
import BattleDungeon from './modules/BattleDungeon';
import TranslationDojo from './modules/TranslationDojo';
import CounterTemple from './modules/CounterTemple';

/**
 * App Root - Nihongo Sensei SPA
 * Wabi-Sabi Modern Design
 */
export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/dictation" element={<DictationMaster />} />
        <Route path="/flashcards" element={<FlashCards />} />
        <Route path="/verbs" element={<VerbLab />} />
        <Route path="/writing" element={<KakiBoard />} />
        <Route path="/kanji" element={<KanjiWidget />} />
        <Route path="/dungeon" element={<BattleDungeon />} />
        <Route path="/translation" element={<TranslationDojo />} />
        <Route path="/counters" element={<CounterTemple />} />
      </Routes>
    </Layout>
  );
}
