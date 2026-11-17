import React from 'react';
import { Bot } from 'lucide-react';

interface FloatingSiBecikProps {
  visible: boolean;
  badgeCount: number;
  onClick: () => void;
}

export default function FloatingSiBecik({
  visible,
  badgeCount,
  onClick,
}: FloatingSiBecikProps) {
  if (!visible) return null;

  const displayBadge = badgeCount > 9 ? '9+' : String(badgeCount);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buka Asisten AI Si Becik"
      title="Si Becik — Asisten AI Guru BK"
      style={{
        position: 'fixed',
        bottom: 'calc(88px + env(safe-area-inset-bottom))',
        right: '16px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        zIndex: 999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        background: '#1A5C4A',
      }}
      className="flex items-center justify-center text-white border-2 border-teal-200/40 cursor-pointer transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#00685f]/50"
    >
      <Bot className="w-6 h-6 text-white" strokeWidth={2.2} />

      {badgeCount > 0 && (
        <span
          aria-label={`${badgeCount} pemberitahuan Si Becik`}
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-sm leading-none"
        >
          {displayBadge}
        </span>
      )}
    </button>
  );
}
