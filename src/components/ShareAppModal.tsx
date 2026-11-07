import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Sparkles,
  MessageCircle,
  Globe,
  Smartphone
} from 'lucide-react';
import { getSchoolConfig } from '../utils/schoolConfig';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareAppModal({ isOpen, onClose }: ShareAppModalProps) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-enkczdk5xwplgl7fh6px6a-526011598781.asia-southeast1.run.app';
  const schoolName = getSchoolConfig().schoolName || 'SMP N 2 Susukan';

  // Rekomendasi Shortlink
  const shortlinkOptions = [
    {
      label: 'Rekomendasi Utama (s.id)',
      service: 's.id',
      suggestedUrl: 'https://s.id/sikap-bk',
      displayUrl: 's.id/sikap-bk',
      desc: 'Penyingkat tautan resmi & cepat Indonesia, gratis kustom alias nama sekolah',
      createUrl: `https://s.id/`,
    },
    {
      label: 'Rekomendasi Sekolah Khusus',
      service: 's.id',
      suggestedUrl: `https://s.id/bk-${schoolName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      displayUrl: `s.id/bk-${schoolName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      desc: 'Format tautan ringkas khusus nama sekolah Anda',
      createUrl: `https://s.id/`,
    },
    {
      label: 'Alternatif Global (Bitly)',
      service: 'Bitly',
      suggestedUrl: 'https://bit.ly/sikap-bk-app',
      displayUrl: 'bit.ly/sikap-bk-app',
      desc: 'Layanan tautan pendek internasional terpercaya',
      createUrl: 'https://bitly.com/',
    },
    {
      label: 'Alternatif Cepat (TinyURL)',
      service: 'TinyURL',
      suggestedUrl: 'https://tinyurl.com/sikap-bk',
      displayUrl: 'tinyurl.com/sikap-bk',
      desc: 'Langsung buat alias tanpa perlu login',
      createUrl: `https://tinyurl.com/create.php?url=${encodeURIComponent(currentUrl)}`,
    }
  ];

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType(null);
    }, 2500);
  };

  const handleShareWhatsApp = (urlToShare: string) => {
    const text = `Halo Bapak/Ibu Guru & Rekan Pendidik,\n\nBerikut adalah link akses Aplikasi *SIKAP-BK* (${schoolName}):\n🔗 ${urlToShare}\n\nSilakan klik tautan di atas untuk masuk ke sistem administrasi & layanan BK. Terima kasih!`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  // QR Code URL using Google Chart / QuickChart API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}&color=00685f&bgcolor=ffffff&qzone=2`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-200/80 overflow-hidden my-auto text-left"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#00685f] to-[#0b1c30] p-4 sm:p-5 text-white flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-300 border border-white/20 shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                    Tautan & Bagikan Aplikasi
                  </h3>
                  <span className="text-[10px] font-bold bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30">
                    SIKAP-BK
                  </span>
                </div>
                <p className="text-xs text-teal-100 font-medium mt-0.5">
                  Akses instan {schoolName} via link pendek atau QR Code
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* 1. URL Asli Aplikasi */}
            <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#00685f]" />
                  Tautan Asli Aplikasi (Cloud URL)
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Online 24/7
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="bg-white border border-gray-300 text-[#0b1c30] text-xs font-mono rounded-xl px-3 py-2.5 w-full select-all focus:outline-none focus:ring-2 focus:ring-[#00685f]/20"
                />
                <button
                  onClick={() => handleCopy(currentUrl, 'original')}
                  className="px-3.5 py-2.5 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
                  title="Salin Link Asli"
                >
                  {copiedType === 'original' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 2. Pilihan Rekomendasi Link Pendek (Shortlinks) */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-black text-[#0b1c30] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Rekomendasi Link Pendek & Mudah Dihafal
                </span>
                <span className="text-[10px] text-gray-500 font-medium">
                  Mudah diketik di browser/HP
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {shortlinkOptions.map((opt, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white hover:bg-teal-50/40 rounded-2xl border border-gray-200 hover:border-[#00685f]/40 transition-all flex flex-col justify-between group shadow-2xs"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                          {opt.label}
                        </span>
                        <span className="text-[9px] font-extrabold bg-[#00685f]/10 text-[#00685f] px-1.5 py-0.2 rounded">
                          {opt.service}
                        </span>
                      </div>
                      <div className="text-sm font-black text-[#00685f] font-mono tracking-tight break-all py-0.5">
                        {opt.displayUrl}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-tight mt-1 line-clamp-2">
                        {opt.desc}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleCopy(opt.suggestedUrl, `short_${idx}`)}
                        className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-teal-100 text-[#00685f] rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border border-gray-200 hover:border-teal-300 cursor-pointer"
                      >
                        {copiedType === `short_${idx}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(opt.suggestedUrl)}
                        className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer border border-emerald-200"
                        title="Bagikan ke WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={opt.createUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-gray-50 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer border border-gray-200"
                        title="Buka Website Penyingkat Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Fitur QR Code Scanner */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-white rounded-xl text-[#00685f] border border-gray-200 shadow-2xs">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-[#0b1c30]">
                      QR Code Akses Cepat Guru & Siswa
                    </h4>
                    <p className="text-[10px] text-gray-500 font-medium">
                      Scan kamera HP untuk membuka aplikasi tanpa mengetik
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQR(!showQR)}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 text-[#00685f] text-xs font-extrabold rounded-xl border border-gray-200 shadow-2xs transition-all cursor-pointer"
                >
                  {showQR ? 'Sembunyikan' : 'Tampilkan QR'}
                </button>
              </div>

              {showQR && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-gray-200 flex flex-col items-center text-center space-y-3"
                >
                  <div className="p-3 bg-white rounded-2xl border-2 border-[#00685f]/30 shadow-md">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code Aplikasi"
                      className="w-44 h-44 rounded-lg object-contain"
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#0b1c30]">
                      Scan QR dengan Kamera Smartphone
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                      Cocok ditempel di ruang BK, mading sekolah, atau grup WhatsApp
                    </p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* 4. Tips Cepat Menyingkat Link Sendiri di s.id (3 Langkah) */}
            <div className="p-3.5 bg-teal-50/60 rounded-2xl border border-teal-200/60 text-xs text-[#0b1c30] space-y-1.5">
              <span className="font-extrabold text-[#00685f] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                Cara Praktis Membuat Link Pendek Kustom Sendiri di s.id (Hanya 10 Detik):
              </span>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-700 font-medium pl-1">
                <li>Klik tombol <strong>Salin</strong> pada Tautan Asli Aplikasi di atas.</li>
                <li>Buka situs <a href="https://s.id" target="_blank" rel="noreferrer" className="text-[#00685f] font-bold underline hover:text-[#005049]">s.id</a> di browser Anda.</li>
                <li>Tempel (Paste) link dan ubah alias sesuai keinginan (contoh: <code>s.id/bksmp2susukan</code> atau <code>s.id/sikap-bk</code>), lalu simpan!</li>
              </ol>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="p-3.5 sm:p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleShareWhatsApp(currentUrl)}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Bagikan ke WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl transition-all border border-gray-200 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
