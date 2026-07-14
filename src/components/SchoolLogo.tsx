import React, { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
// @ts-ignore
import schoolLogoImg from '../assets/images/school_kop_logo_1784009756955.jpg';

interface SchoolLogoProps {
  className?: string;
  size?: number;
}

export default function SchoolLogo({ className = '', size = 48 }: SchoolLogoProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadLogo = () => {
      const saved = localStorage.getItem('bk_custom_school_logo');
      setCustomLogo(saved);
      setImageError(false); // Reset error status
    };

    loadLogo();

    window.addEventListener('storage', loadLogo);
    window.addEventListener('logo-update', loadLogo);

    return () => {
      window.removeEventListener('storage', loadLogo);
      window.removeEventListener('logo-update', loadLogo);
    };
  }, []);

  const logoSrc = customLogo || schoolLogoImg;

  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center bg-gradient-to-br from-[#00685f] to-[#004d46] text-white shadow-sm overflow-hidden border border-[#00685f]/15`}
      style={{ width: size, height: size }}
      id="school-logo-container"
    >
      {!imageError && logoSrc ? (
        <img
          src={logoSrc}
          alt="Logo SMP Negeri 2 Susukan"
          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
      )}
    </div>
  );
}



