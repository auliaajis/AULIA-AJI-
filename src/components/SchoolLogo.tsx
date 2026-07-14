import React from 'react';
import { GraduationCap } from 'lucide-react';

interface SchoolLogoProps {
  className?: string;
  size?: number;
}

export default function SchoolLogo({ className = '', size = 48 }: SchoolLogoProps) {
  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center bg-gradient-to-br from-[#00685f] to-[#004d46] text-white shadow-sm border border-[#00685f]/10`}
      style={{ width: size, height: size }}
      id="school-logo-container"
    >
      <GraduationCap style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
    </div>
  );
}


