import React from 'react';

/**
 * BotAssistFAB - Floating Action Button Widget (React / Tailwind CSS)
 *
 * Requirements Met:
 * 1. Fixed positioning: `fixed bottom-6 right-6 z-50`
 * 2. Fully circular widget: `w-14 h-14 rounded-full`
 * 3. Text label hidden, displaying only the Bot SVG icon
 * 4. Deep green accent scheme (#15803d) with vibrant hover & active scaling
 * 5. Pulsing green status indicator light in top-right corner
 * 6. Preserves click callback to trigger chat modal / drawer
 *
 * @param {Function} onClick - Trigger function to open Bot Assist modal / drawer
 * @param {boolean} isOpen - Optional flag if drawer is currently open
 */
export default function BotAssistFAB({ onClick, isOpen = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open Kisan Bot Assist"
      title="Ask Kisan Sahayak AI Bot (24x7 Voice & Chat)"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 via-emerald-700 to-green-900 text-white shadow-xl shadow-emerald-900/30 border-2 border-emerald-300/40 hover:border-emerald-300 hover:scale-105 active:scale-95 hover:shadow-2xl hover:shadow-emerald-600/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/50 transition-all duration-300 group"
    >
      {/* Status indicator light: Pulsing Green Dot in top-right */}
      <span className="absolute top-1 right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-white" />
      </span>

      {/* Bot Icon (centered, no text label) */}
      <svg
        className="w-6 h-6 text-white transition-transform duration-300 group-hover:rotate-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </button>
  );
}
