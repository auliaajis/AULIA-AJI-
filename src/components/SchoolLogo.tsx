import React, { useState, useEffect } from 'react';
import { GraduationCap } from 'lucide-react';
// @ts-ignore
import schoolLogoImg from '../assets/images/school_kop_logo_1784009756955.jpg';
import { getSchoolConfig, getActiveSchoolId } from '../utils/schoolConfig';

interface SchoolLogoProps {
  className?: string;
  size?: number;
  schoolId?: string;
}

export default function SchoolLogo({ className = '', size = 48, schoolId }: SchoolLogoProps) {
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('SMP N 2 Susukan');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadLogo = () => {
      const cfg = getSchoolConfig(schoolId);
      setSchoolName(cfg.schoolName || 'Sekolah');
      const activeId = schoolId || getActiveSchoolId();
      const savedCustom =
        cfg.customSchoolLogo ||
        cfg.customLogo ||
        localStorage.getItem(`bk_custom_school_logo_${activeId}`) ||
        localStorage.getItem('bk_custom_school_logo');

      if (savedCustom) {
        setCustomLogo(savedCustom);
      } else if (activeId === 'sch_20320123') {
        setCustomLogo(schoolLogoImg);
      } else {
        setCustomLogo(null);
      }
      setImageError(false);
    };

    loadLogo();

    window.addEventListener('storage', loadLogo);
    window.addEventListener('logo-update', loadLogo);
    window.addEventListener('bk_school_config_updated', loadLogo);
    window.addEventListener('bk_school_changed', loadLogo);

    return () => {
      window.removeEventListener('storage', loadLogo);
      window.removeEventListener('logo-update', loadLogo);
      window.removeEventListener('bk_school_config_updated', loadLogo);
      window.removeEventListener('bk_school_changed', loadLogo);
    };
  }, [schoolId]);

  const logoSrc = customLogo || (schoolId && schoolId !== 'sch_20320123' ? null : schoolLogoImg);

  return (
    <div 
      className={`${className} rounded-full flex items-center justify-center bg-gradient-to-br from-[#00685f] to-[#004d46] text-white shadow-sm overflow-hidden border border-[#00685f]/15`}
      style={{ width: size, height: size }}
      id="school-logo-container"
    >
      {!imageError && logoSrc ? (
        <img
          src={logoSrc}
          alt={`Logo ${schoolName}`}
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



