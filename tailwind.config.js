/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Wabi-Sabi Modern Palette
        washi: '#F9F7F2',        // Paper White
        hinomaru: '#BC002D',     // Japanese Red
        sumi: '#2C2C2C',         // Charcoal Ink
        matcha: '#6B8E23',       // Matcha Green
        kintsugi: '#E9B824',     // Gold Repair
        bamboo: '#87A96B',       // Bamboo Green
        sakura: '#FFB7C5'        // Cherry Blossom Pink
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        mincho: ['Noto Serif JP', 'serif']
      },
      boxShadow: {
        'washi': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'hanko': '0 4px 12px rgba(188, 0, 45, 0.15)'
      }
    }
  },
  plugins: []
}
