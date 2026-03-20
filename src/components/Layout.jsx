import React from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Layout - Minimal sidebar navigation (Wabi-Sabi aesthetic)
 */
export default function Layout({ children }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: '🏠', label: 'Home' },
    { path: '/dictation', icon: '🎧', label: 'Dictation' },
    { path: '/flashcards', icon: '🃏', label: 'Flashcards' },
    { path: '/verbs', icon: '📝', label: 'Verbs' },
    { path: '/translation', icon: '🥋', label: 'Dojo' },
    { path: '/writing', icon: '✍️', label: 'Writing' },
    { path: '/kanji', icon: '📖', label: 'Kanji' },
    { path: '/dungeon', icon: '⚔️', label: 'Dungeon' }
  ];

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Sidebar Desktop - Nascosta su mobile */}
      <aside className="hidden md:flex w-20 bg-white border-r border-gray-100 flex-col items-center py-8 gap-6 shadow-washi">
        {/* Logo */}
        <div className="mb-4">
          <div className="w-12 h-12 rounded-full bg-hinomaru flex items-center justify-center text-white font-bold text-xl font-mincho">
            日
          </div>
        </div>

        {/* Nav Items */}
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex flex-col items-center gap-1 transition-all ${
                isActive ? 'text-hinomaru' : 'text-gray-400 hover:text-sumi'
              }`}
              title={item.label}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-hinomaru mt-1" />
              )}
            </Link>
          );
        })}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* Bottom Nav Mobile - Visibile solo su mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex justify-around items-center py-2 px-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 min-w-0 flex-1 transition-all ${
                  isActive ? 'text-hinomaru' : 'text-gray-400'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[9px] font-medium truncate max-w-full">{item.label}</span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-hinomaru" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
