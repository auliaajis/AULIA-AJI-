import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ShieldAlert, HeartHandshake, Calendar, Mail, Award, X } from 'lucide-react';

interface MobileFabProps {
  onNavigate: (view: string) => void;
}

export const MobileFab: React.FC<MobileFabProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      id: 'pelanggaran',
      label: 'Catat Pelanggaran',
      icon: <ShieldAlert className="w-4 h-4 text-red-600" />,
      color: 'bg-red-50 text-red-900 border-red-200 hover:bg-red-100',
    },
    {
      id: 'tambah-layanan',
      label: 'Konseling & Layanan BK',
      icon: <HeartHandshake className="w-4 h-4 text-emerald-600" />,
      color: 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100',
    },
    {
      id: 'absensi',
      label: 'Absensi Kelas Harian',
      icon: <Calendar className="w-4 h-4 text-teal-600" />,
      color: 'bg-teal-50 text-teal-900 border-teal-200 hover:bg-teal-100',
    },
    {
      id: 'panggilan-ortu',
      label: 'Surat Panggilan Ortu',
      icon: <Mail className="w-4 h-4 text-amber-600" />,
      color: 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100',
    },
    {
      id: 'apresiasi',
      label: 'Apresiasi & Prestasi',
      icon: <Award className="w-4 h-4 text-purple-600" />,
      color: 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100',
    },
  ];

  return (
    <div className="fixed bottom-6 right-5 z-40 sm:hidden flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40"
            />

            {/* Menu Items */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                visible: { opacity: 1, scale: 1, transition: { staggerChildren: 0.05 } },
                hidden: { opacity: 0, scale: 0.85 },
              }}
              className="relative z-50 mb-3 flex flex-col items-end gap-2 pr-1"
            >
              {actions.map((act) => (
                <motion.button
                  key={act.id}
                  variants={{
                    visible: { opacity: 1, y: 0, scale: 1 },
                    hidden: { opacity: 0, y: 10, scale: 0.9 },
                  }}
                  whileHover={{ scale: 1.04, x: -3 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate(act.id);
                  }}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border shadow-lg text-xs font-extrabold transition-all cursor-pointer min-h-[44px] ${act.color}`}
                >
                  <span>{act.label}</span>
                  <div className="p-1 rounded-xl bg-white shadow-2xs shrink-0">
                    {act.icon}
                  </div>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Trigger FAB Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative z-50 w-14 h-14 rounded-full bg-[#00685f] text-white shadow-2xl flex items-center justify-center transition-all cursor-pointer border-2 border-white/40 ${
          isOpen ? 'rotate-45 bg-gray-800' : ''
        }`}
        aria-label="Aksi Cepat BK"
        title="Menu Aksi Cepat"
      >
        <Plus className="w-7 h-7" />
      </motion.button>
    </div>
  );
};

export default MobileFab;
