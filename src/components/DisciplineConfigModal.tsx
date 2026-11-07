import React, { useState } from 'react';
import { Settings, X, Save, RotateCcw, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import { DisciplineConfig, getDisciplineConfig, saveDisciplineConfig, resetDisciplineConfig } from '../utils/disciplineConfig';
import { showToast } from '../utils/toast';

interface DisciplineConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: (config: DisciplineConfig) => void;
}

export const DisciplineConfigModal: React.FC<DisciplineConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [config, setConfig] = useState<DisciplineConfig>(() => getDisciplineConfig());

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveDisciplineConfig(config);
    onConfigSaved(saved);
    showToast('Konfigurasi fitur pendisiplinan berhasil disimpan!', 'success');
    onClose();
  };

  const handleReset = () => {
    if (confirm('Kembalikan konfigurasi pendisiplinan ke setelan bawaan?')) {
      const reset = resetDisciplineConfig();
      setConfig(reset);
      onConfigSaved(reset);
      showToast('Konfigurasi dikembalikan ke setelan awal', 'info');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-[#bcc9c6]/40 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0b1c30] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00685f] flex items-center justify-center text-white">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Konfigurasi Fitur Pendisiplinan</h3>
              <p className="text-[11px] text-teal-300 font-medium">Pengaturan ambang rekomendasi, penomoran, & navigasi</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section 1: Ambang Batas Siswa Perlu Pembinaan */}
          <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
            <h4 className="text-xs font-black uppercase text-[#00685f] flex items-center gap-1.5 tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>1. Kriteria Rekomendasi Siswa Disiplin</span>
            </h4>
            <p className="text-[11px] text-gray-600 font-medium">
              Tentukan batasan jumlah Alpa dan bobot pelanggaran agar siswa otomatis muncul di daftar rekomendasi.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Minimal Kehadiran Alpa:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={config.minAlpaCount}
                    onChange={(e) => setConfig({ ...config, minAlpaCount: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full px-3 py-2 bg-white border border-[#bcc9c6]/50 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#00685f] outline-none"
                  />
                  <span className="text-xs font-bold text-gray-500 whitespace-nowrap">kali alpa</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Minimal Poin Pelanggaran:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.minViolationPoints}
                    onChange={(e) => setConfig({ ...config, minViolationPoints: Math.max(0, parseInt(e.target.value) || 0) })}
                    className="w-full px-3 py-2 bg-white border border-[#bcc9c6]/50 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#00685f] outline-none"
                  />
                  <span className="text-xs font-bold text-gray-500 whitespace-nowrap">poin</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Format Penomoran Dokumen */}
          <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
            <h4 className="text-xs font-black uppercase text-[#00685f] flex items-center gap-1.5 tracking-wider">
              <FileText className="w-4 h-4" />
              <span>2. Penomoran Dokumen & Identitas Konselor</span>
            </h4>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0b1c30]">
                  Format / Prefix Nomor Surat Perjanjian:
                </label>
                <input
                  type="text"
                  value={config.letterNumberPrefix}
                  onChange={(e) => setConfig({ ...config, letterNumberPrefix: e.target.value })}
                  placeholder="Contoh: SP/SMPN2SSK"
                  className="w-full px-3 py-2 bg-white border border-[#bcc9c6]/50 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#00685f] outline-none"
                />
                <p className="text-[10px] text-gray-500">Nomor dibuat otomatis: [Prefix]-[Tahun]/[Nomor Urut]</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0b1c30]">
                    Nama Konselor / Guru BK Default:
                  </label>
                  <input
                    type="text"
                    value={config.defaultCounselorName}
                    onChange={(e) => setConfig({ ...config, defaultCounselorName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#bcc9c6]/50 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#00685f] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0b1c30]">
                    Jabatan Saksi Default:
                  </label>
                  <input
                    type="text"
                    value={config.defaultWitnessTitle}
                    onChange={(e) => setConfig({ ...config, defaultWitnessTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#bcc9c6]/50 rounded-lg text-xs font-bold text-[#0b1c30] focus:ring-1 focus:ring-[#00685f] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Kemudahan Operasional & Tampilan */}
          <div className="space-y-3 p-4 bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/30">
            <h4 className="text-xs font-black uppercase text-[#00685f] flex items-center gap-1.5 tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              <span>3. Navigasi & Kemudahan Layar</span>
            </h4>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoScrollOnSelect}
                onChange={(e) => setConfig({ ...config, autoScrollOnSelect: e.target.checked })}
                className="mt-0.5 rounded text-[#00685f] focus:ring-[#00685f]"
              />
              <div>
                <span className="text-xs font-bold text-[#0b1c30]">
                  Otomatis geser layar langsung ke formulir saat memilih fitur atau siswa
                </span>
                <p className="text-[11px] text-gray-500">
                  Mencegah kebingungan di perangkat ponsel sehingga guru langsung melihat formulir yang dipilih.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={config.showAiBanner}
                onChange={(e) => setConfig({ ...config, showAiBanner: e.target.checked })}
                className="mt-0.5 rounded text-[#00685f] focus:ring-[#00685f]"
              />
              <div>
                <span className="text-xs font-bold text-[#0b1c30]">
                  Tampilkan banner Asisten AI BK di atas form
                </span>
                <p className="text-[11px] text-gray-500">
                  Dapat disembunyikan agar tampilan formulir lebih ringkas dan langsung ke isian.
                </p>
              </div>
            </label>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-red-600 px-3 py-2 rounded-xl border border-gray-200 hover:border-red-200 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Standar</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all active:scale-97"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Konfigurasi</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
