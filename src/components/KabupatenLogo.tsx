import React, { useState, useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface KabupatenLogoProps {
  className?: string;
  size?: number;
}

export default function KabupatenLogo({ className = '', size = 48 }: KabupatenLogoProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadLogo = () => {
      const saved = localStorage.getItem('bk_custom_kabupaten_logo');
      setCustomLogo(saved);
      setImageError(false);
    };

    loadLogo();

    window.addEventListener('storage', loadLogo);
    window.addEventListener('logo-update', loadLogo);

    return () => {
      window.removeEventListener('storage', loadLogo);
      window.removeEventListener('logo-update', loadLogo);
    };
  }, []);

  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-sm overflow-hidden border border-amber-600/15`}
      style={{ width: size, height: size }}
      id="kabupaten-logo-container"
    >
      {!imageError && customLogo ? (
        <img
          src={customLogo}
          alt="Logo Kabupaten"
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        /* A stunning governmental shield coat of arms vector placeholder */
        <svg 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{ width: size * 0.55, height: size * 0.55 }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 6v10M9 9h6M9 13h6" />
        </svg>
      )}
    </div>
  );
}
