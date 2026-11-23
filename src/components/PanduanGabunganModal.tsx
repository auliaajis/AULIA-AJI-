import React, { useState } from 'react';
import { BookOpen, HelpCircle, X } from 'lucide-react';
import UserManualModal from './UserManualModal';
import PanduanBskap2022Modal from './PanduanBskap2022Modal';

interface PanduanGabunganModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'cara-pakai' | 'bskap-2022';
}

export default function PanduanGabunganModal({
  isOpen,
  onClose,
  initialTab = 'cara-pakai',
}: PanduanGabunganModalProps) {
  const [activeTab, setActiveTab] = useState<'cara-pakai' | 'bskap-2022'>(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1c30]/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-[#bcc9c6]/40 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#00685f] text-white px-5 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-white/15 border border-white/20 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black tracking-tight truncate">
                Panduan Aplikasi &amp; BK
              </h2>
              <p className="text-xs text-teal-100 font-medium truncate">
                Petunjuk penggunaan SIKAP-BK (langkah demi langkah) &amp; Panduan Resmi BK BSKAP 2022
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2 Segmented Tabs */}
        <div className="px-4 py-3 bg-[#f8faf9] border-b border-[#bcc9c6]/30 shrink-0">
          <div className="inline-flex flex-wrap items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-[#bcc9c6]/40">
            <button
              type="button"
              onClick={() => setActiveTab('cara-pakai')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'cara-pakai'
                  ? 'bg-[#00685f] text-white shadow-xs'
                  : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/70'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Cara Pakai Aplikasi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bskap-2022')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'bskap-2022'
                  ? 'bg-[#00685f] text-white shadow-xs'
                  : 'text-[#3d4947] hover:text-[#0b1c30] hover:bg-white/70'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Panduan Resmi BK BSKAP 2022</span>
            </button>
          </div>
        </div>

        {/* Active Tab Body */}
        {activeTab === 'cara-pakai' ? (
          <UserManualModal isOpen={true} onClose={onClose} embedded />
        ) : (
          <PanduanBskap2022Modal isOpen={true} onClose={onClose} embedded />
        )}
      </div>
    </div>
  );
}
