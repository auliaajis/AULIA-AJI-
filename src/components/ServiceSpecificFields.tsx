import React from 'react';
import { BKComponentType, BKServiceType, ServiceSpecificDetails } from '../types';
import {
  getServiceFormConfig,
  ServiceFormCategory,
  SKKPD_ASPEK_LIST,
  SUB_AKTIVITAS_DUKUNGAN_SISTEM
} from '../utils/bkKomprehensif';
import {
  BookOpen,
  Target,
  HeartHandshake,
  ShieldAlert,
  Home,
  Scale,
  UserPlus,
  HelpCircle,
  Network,
  Sparkles,
  Layers,
  FileCheck,
  Check
} from 'lucide-react';

interface ServiceSpecificFieldsProps {
  serviceType: BKServiceType | string;
  bkComponent?: BKComponentType;
  details: ServiceSpecificDetails;
  onChange: (updatedDetails: ServiceSpecificDetails) => void;
}

export default function ServiceSpecificFields({
  serviceType,
  bkComponent,
  details,
  onChange,
}: ServiceSpecificFieldsProps) {
  const config = getServiceFormConfig(serviceType, bkComponent);

  const updateField = (key: keyof ServiceSpecificDetails, value: any) => {
    onChange({
      ...details,
      [key]: value,
    });
  };

  // Render Header according to Pillar
  const renderCardHeader = (icon: React.ReactNode, title: string, subtitle: string) => (
    <div className="flex items-center gap-2.5 pb-3 border-b border-[#bcc9c6]/20 mb-4">
      <div className="p-2 bg-[#00685f]/10 text-[#00685f] rounded-xl flex-shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#0b1c30]">
          {title}
        </h4>
        <p className="text-[11px] text-[#3d4947]/75 font-semibold mt-0.5">
          {subtitle}
        </p>
      </div>
    </div>
  );

  // 1. PILAR 1: LAYANAN DASAR (KLASIKAL, KELOMPOK, MEDIA, INFORMASI, ORIENTASI)
  if (config.formCategory === 'klasikal_dasar') {
    const tahapPresets = ['Pengenalan (Pengetahuan)', 'Akomodasi (Sikap & Nilai)', 'Tindakan (Keterampilan Perilaku)'];

    const metodePresets = [
      'Diskusi Kelompok',
      'Ceramah Interaktif',
      'Brainstorming',
      'Role Playing / Simulasi',
      'Problem Based Learning',
      'Games & Ice Breaking',
      'Sinema Edukasi (Video)',
    ];

    const mediaPresets = [
      'LCD Proyektor & Slide PPT',
      'Lembar Kerja Siswa (LKPD)',
      'Video Pembelajaran Inspiratif',
      'Poster & Papan Bimbingan',
      'Modul / Booklet BK',
    ];

    return (
      <div className="bg-[#f8faf9] border border-[#00685f]/25 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <BookOpen className="w-4 h-4 text-[#00685f]" />,
          'Spesifikasi Layanan Dasar & RPL Standar Dinas (Pilar 1)',
          'Standar Kompetensi Kemandirian (SKKPD), metode, media, dan evaluasi hasil (Laiseg)'
        )}

        {/* Aspek SKKPD */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1.5">
            Aspek Perkembangan SKKPD (Standar Kemandirian Siswa)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {SKKPD_ASPEK_LIST.map((asp) => {
              const isPicked = details.aspekSkkpd === asp.label;
              return (
                <button
                  key={asp.id}
                  type="button"
                  onClick={() => updateField('aspekSkkpd', asp.label)}
                  title={asp.desc}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-[#00685f]/40 hover:bg-teal-50/40'
                  }`}
                >
                  {asp.label}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.aspekSkkpd || ''}
            onChange={(e) => updateField('aspekSkkpd', e.target.value)}
            placeholder="Ketik atau pilih aspek perkembangan SKKPD..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Tahap Capaian Internalisasi */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1.5">
            Tahap Capaian Internalisasi Kemandirian
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {tahapPresets.map((t) => {
              const isSelected = details.tahapCapaian === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateField('tahapCapaian', t)}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                      : 'bg-white text-[#3d4947] border-gray-200 hover:border-[#00685f]/40 hover:bg-teal-50/30'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{t}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Metode & Teknik Layanan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Metode & Teknik Bimbingan (RPL)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {metodePresets.map((m) => {
              const isPicked = (details.metodeLayanan || '').includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.metodeLayanan || '')
                        .split(', ')
                        .filter((item) => item !== m)
                        .join(', ');
                      updateField('metodeLayanan', updated);
                    } else {
                      const updated = details.metodeLayanan
                        ? `${details.metodeLayanan}, ${m}`
                        : m;
                      updateField('metodeLayanan', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-[#00685f]/15 text-[#00685f] border-[#00685f]/30'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {m}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.metodeLayanan || ''}
            onChange={(e) => updateField('metodeLayanan', e.target.value)}
            placeholder="Ketik atau pilih metode layanan (contoh: Diskusi Kelompok, Ceramah Interaktif, Brainstorming)..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Media & Alat Peraga */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Media & Alat Bantu Bimbingan
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mediaPresets.map((med) => {
              const isPicked = (details.mediaLayanan || '').includes(med);
              return (
                <button
                  key={med}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.mediaLayanan || '')
                        .split(', ')
                        .filter((item) => item !== med)
                        .join(', ');
                      updateField('mediaLayanan', updated);
                    } else {
                      const updated = details.mediaLayanan
                        ? `${details.mediaLayanan}, ${med}`
                        : med;
                      updateField('mediaLayanan', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-[#00685f]/15 text-[#00685f] border-[#00685f]/30'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {med}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.mediaLayanan || ''}
            onChange={(e) => updateField('mediaLayanan', e.target.value)}
            placeholder="Ketik atau pilih media bimbingan (contoh: LCD Proyektor, Video Edukasi, LKPD Siswa)..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Evaluasi Proses & Antusiasme Siswa */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#0b1c30] mb-1">
              Catatan Evaluasi Proses & Keaktifan Kelas
            </label>
            <input
              type="text"
              value={details.evaluasiProses || ''}
              onChange={(e) => updateField('evaluasiProses', e.target.value)}
              placeholder="Contoh: 85% siswa berpartisipasi aktif dalam diskusi..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] outline-none font-semibold text-[#0b1c30]"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#0b1c30] mb-1">
              Evaluasi Hasil (Laiseg: UCA)
            </label>
            <input
              type="text"
              value={details.evaluasiHasil || ''}
              onChange={(e) => updateField('evaluasiHasil', e.target.value)}
              placeholder="Contoh: Siswa memahami konsep & membuat rencana aksi..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#00685f]/20 focus:border-[#00685f] outline-none font-semibold text-[#0b1c30]"
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. PILAR 2: PEMINATAN & PERENCANAAN INDIVIDUAL
  if (config.formCategory === 'peminatan_karir') {
    const peminatanPresets = [
      'Studi Lanjut SMA / SMK / MA / Perguruan Tinggi',
      'Peminatan Mata Pelajaran & Jurusan',
      'Eksplorasi Profesi & Karir Masa Depan',
      'Penyaluran Bakat & Ekstrakurikuler',
      'Pengembangan Minat Khusus',
    ];

    const dasarAsesmenPresets = [
      'Nilai Rapor Semester 1–4',
      'Hasil Angket Kebutuhan Peserta Didik (AKPD)',
      'Tes Psikologi / Minat Bakat',
      'Konsultasi Orang Tua & Portofolio',
      'Angket Gaya Belajar Siswa',
    ];

    return (
      <div className="bg-blue-50/40 border border-blue-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <Target className="w-4 h-4 text-blue-700" />,
          'Spesifikasi Perencanaan Individual & Karir (Pilar 2)',
          'Pemetaan potensi, asesmen minat bakat, dan rencana studi lanjut masa depan'
        )}

        {/* Aspek Peminatan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Fokus Aspek Peminatan / Karir
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {peminatanPresets.map((p) => {
              const isSelected = details.bidangPeminatan === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateField('bidangPeminatan', p)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.bidangPeminatan || ''}
            onChange={(e) => updateField('bidangPeminatan', e.target.value)}
            placeholder="Atau ketik fokus peminatan khusus..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Dasar Asesmen / Pemetaan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Dasar Pemetaan / Hasil Asesmen Siswa
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {dasarAsesmenPresets.map((da) => {
              const isPicked = (details.dasarAsesmen || '').includes(da);
              return (
                <button
                  key={da}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.dasarAsesmen || '')
                        .split(', ')
                        .filter((item) => item !== da)
                        .join(', ');
                      updateField('dasarAsesmen', updated);
                    } else {
                      const updated = details.dasarAsesmen
                        ? `${details.dasarAsesmen}, ${da}`
                        : da;
                      updateField('dasarAsesmen', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {da}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.dasarAsesmen || ''}
            onChange={(e) => updateField('dasarAsesmen', e.target.value)}
            placeholder="Contoh: Nilai Rapor Semester 1-4, Hasil Angket AKPD, Wawancara Minat Siswa..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Potensi / Kekuatan Siswa & Rencana Aksi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-[#0b1c30] mb-1">
              Potensi & Kekuatan Dominan Siswa
            </label>
            <input
              type="text"
              value={details.potensiKekuatan || ''}
              onChange={(e) => updateField('potensiKekuatan', e.target.value)}
              placeholder="Contoh: Logika sains tinggi, berbakat desain grafis, kemampuan komunikasi publik..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-600 outline-none font-semibold text-[#0b1c30]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#0b1c30] mb-1">
              Rencana Aksi Siswa (Action Plan)
            </label>
            <input
              type="text"
              value={details.rencanaAksiSiswa || ''}
              onChange={(e) => updateField('rencanaAksiSiswa', e.target.value)}
              placeholder="Contoh: Mengikuti pendalaman materi IPA, mendaftar seleksi klub robotik..."
              className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-200 focus:border-blue-600 outline-none font-semibold text-[#0b1c30]"
            />
          </div>
        </div>
      </div>
    );
  }

  // 3. PILAR 3: MEDIASI & ADVOKASI KONFLIK
  if (config.formCategory === 'mediasi_konflik') {
    const pemicuPresets = [
      'Kesalahpahaman di Media Sosial / Chat',
      'Ejekan / Celaan Fisik (Body Shaming)',
      'Perselisihan Permainan / Olahraga',
      'Friksi Kelompok / Genk Pertemanan',
      'Pinjam Meminjam Barang Tanpa Izin',
    ];

    return (
      <div className="bg-rose-50/40 border border-rose-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <ShieldAlert className="w-4 h-4 text-rose-700" />,
          'Spesifikasi Mediasi & Resolusi Konflik (Pilar 3)',
          'Rekonsiliasi damai, klarifikasi kedua pihak, dan butir kesepakatan tertulis'
        )}

        {/* Pihak-Pihak yang Bersengketa */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Pihak-Pihak yang Berselisih
          </label>
          <input
            type="text"
            value={details.pihakBersengketa || ''}
            onChange={(e) => updateField('pihakBersengketa', e.target.value)}
            placeholder="Contoh: Siswa A (Kelas 8A) dengan Siswa B (Kelas 8C) beserta perwakilan teman sebaya..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-200 focus:border-rose-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Pemicu Perselisihan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Faktor Pemicu / Akar Konflik
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pemicuPresets.map((pem) => {
              const isPicked = (details.akarMasalah || '').includes(pem);
              return (
                <button
                  key={pem}
                  type="button"
                  onClick={() => updateField('akarMasalah', pem)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-rose-300'
                  }`}
                >
                  {pem}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.akarMasalah || ''}
            onChange={(e) => updateField('akarMasalah', e.target.value)}
            placeholder="Uraikan faktor pemicu perselisihan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-200 focus:border-rose-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Butir Kesepakatan Damai */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Butir Kesepakatan Damai & Rekonsiliasi
          </label>
          <textarea
            rows={2}
            value={details.kesepakatanDamai || ''}
            onChange={(e) => updateField('kesepakatanDamai', e.target.value)}
            placeholder="Contoh: Kedua pihak saling memaafkan secara tulus, menghapus postingan provokatif di medsos, dan berkomitmen tidak mengulangi perselisihan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-200 focus:border-rose-600 outline-none font-semibold text-[#0b1c30] resize-none"
          />
        </div>
      </div>
    );
  }

  // 4. PILAR 3: HOME VISIT (KUNJUNGAN RUMAH)
  if (config.formCategory === 'home_visit') {
    const pihakDitemuiPresets = [
      'Ayah Kandung',
      'Ibu Kandung',
      'Kedua Orang Tua',
      'Kakek / Nenek',
      'Wali / Kerabat Terdekat',
    ];

    return (
      <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <Home className="w-4 h-4 text-amber-700" />,
          'Spesifikasi Kunjungan Rumah / Home Visit (Pilar 3)',
          'Verifikasi lingkungan keluarga, wawancara orang tua/wali, dan kesepakatan pendampingan di rumah'
        )}

        {/* Alamat Kunjungan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Alamat / Lokasi Kunjungan
          </label>
          <input
            type="text"
            value={details.alamatKunjungan || ''}
            onChange={(e) => updateField('alamatKunjungan', e.target.value)}
            placeholder="Alamat domisili tempat tinggal siswa yang dikunjungi..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Pihak Keluarga yang Ditemui */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Pihak Keluarga yang Ditemui di Rumah
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pihakDitemuiPresets.map((pk) => {
              const isPicked = (details.pihakDitemui || '').includes(pk);
              return (
                <button
                  key={pk}
                  type="button"
                  onClick={() => updateField('pihakDitemui', pk)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {pk}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.pihakDitemui || ''}
            onChange={(e) => updateField('pihakDitemui', e.target.value)}
            placeholder="Contoh: Ibu Kandung (Ibu Rahmawati) dan Kakak Siswa..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Hasil Observasi & Kesepakatan Keluarga */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Hasil Observasi Lingkungan & Komitmen Orang Tua
          </label>
          <textarea
            rows={2}
            value={details.hasilObservasiKeluarga || ''}
            onChange={(e) => updateField('hasilObservasiKeluarga', e.target.value)}
            placeholder="Contoh: Suasana rumah tenang, orang tua berkomitmen membatasi waktu keluar malam anak dan memastikan anak hadir tepat waktu setiap hari..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30] resize-none"
          />
        </div>
      </div>
    );
  }

  // 5. PILAR 3: KONFERENSI KASUS (CASE CONFERENCE)
  if (config.formCategory === 'konferensi_kasus') {
    const pesertaPresets = [
      'Kepala Sekolah / Wakasek',
      'Guru BK / Konselor',
      'Wali Kelas',
      'Guru Mata Pelajaran',
      'Orang Tua / Wali Siswa',
      'Tim Kesiswaan / Disiplin',
    ];

    return (
      <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <Scale className="w-4 h-4 text-amber-700" />,
          'Spesifikasi Konferensi Kasus (Pilar 3)',
          'Musyawarah komprehensif penanganan kasus khusus bersama dewan guru dan pihak berwenang'
        )}

        {/* Peserta Konferensi */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Daftar Peserta Sidang Konferensi Kasus
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pesertaPresets.map((ps) => {
              const isPicked = (details.pesertaKonferensi || '').includes(ps);
              return (
                <button
                  key={ps}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.pesertaKonferensi || '')
                        .split(', ')
                        .filter((item) => item !== ps)
                        .join(', ');
                      updateField('pesertaKonferensi', updated);
                    } else {
                      const updated = details.pesertaKonferensi
                        ? `${details.pesertaKonferensi}, ${ps}`
                        : ps;
                      updateField('pesertaKonferensi', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {ps}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.pesertaKonferensi || ''}
            onChange={(e) => updateField('pesertaKonferensi', e.target.value)}
            placeholder="Ketik daftar lengkap peserta konferensi..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>
      </div>
    );
  }

  // 6. PILAR 3: ALIH TANGAN KASUS (REFERRAL)
  if (config.formCategory === 'referral') {
    const lembagaPresets = [
      'Puskesmas / Tenaga Medis Terdekat',
      'Psikolog Klinis / Lembaga Psikologi Terapan',
      'Psikiater / RSUD Poli Jiwa',
      'Dinas Sosial / UPTD Perlindungan Anak (PPA)',
      'Lembaga Bantuan Hukum (LBH)',
    ];

    return (
      <div className="bg-red-50/40 border border-red-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <UserPlus className="w-4 h-4 text-red-700" />,
          'Spesifikasi Alih Tangan Kasus / Referral (Pilar 3)',
          'Rujukan resmi ke profesional/instansi ahli untuk kasus di luar kewenangan guru BK'
        )}

        {/* Lembaga Rujukan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Lembaga / Profesional Ahli Rujukan
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {lembagaPresets.map((lem) => {
              const isPicked = details.lembagaRujukan === lem;
              return (
                <button
                  key={lem}
                  type="button"
                  onClick={() => updateField('lembagaRujukan', lem)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-red-600 text-white border-red-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-red-300'
                  }`}
                >
                  {lem}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.lembagaRujukan || ''}
            onChange={(e) => updateField('lembagaRujukan', e.target.value)}
            placeholder="Nama lembaga atau nama dokter/psikolog rujukan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Alasan / Indikasi Khusus Rujukan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Alasan & Pertimbangan Rujukan Khusus
          </label>
          <textarea
            rows={2}
            value={details.alasanRujukan || ''}
            onChange={(e) => updateField('alasanRujukan', e.target.value)}
            placeholder="Contoh: Gejala depresi mendalam dan kecenderungan melukai diri yang memerlukan diagnosa klinis dan terapi psikiatri..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-200 focus:border-red-600 outline-none font-semibold text-[#0b1c30] resize-none"
          />
        </div>
      </div>
    );
  }

  // 7. PILAR 3: KONSULTASI GURU & ORANG TUA
  if (config.formCategory === 'konsultasi') {
    const konsultiPresets = [
      'Wali Kelas',
      'Guru Mata Pelajaran',
      'Orang Tua / Wali Murid',
      'Pembina Ekstrakurikuler / OSIS',
      'Tim Disiplin / Kesiswaan',
    ];

    return (
      <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <HelpCircle className="w-4 h-4 text-amber-700" />,
          'Spesifikasi Layanan Konsultasi (Pilar 3)',
          'Diskusi pemecahan masalah siswa bersama guru mata pelajaran, wali kelas, atau orang tua'
        )}

        {/* Pihak Konsulti */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Pihak yang Berkonsultasi (Konsulti)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {konsultiPresets.map((kp) => {
              const isPicked = details.pihakKonsulti === kp;
              return (
                <button
                  key={kp}
                  type="button"
                  onClick={() => updateField('pihakKonsulti', kp)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {kp}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.pihakKonsulti || ''}
            onChange={(e) => updateField('pihakKonsulti', e.target.value)}
            placeholder="Contoh: Wali Kelas 8B (Ibu Ratna, M.Pd)..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>
      </div>
    );
  }

  // 8. PILAR 3: KONSELING INDIVIDUAL / KELOMPOK (DEFAULT RESPONSIF)
  if (config.formCategory === 'konseling_responsif') {
    const akarMasalahPresets = [
      'Kecemasan / Stres Tugas & Ujian',
      'Tekanan Relasi Teman Sebaya',
      'Disharmoni / Konflik Keluarga di Rumah',
      'Pengaruh Gawai / Game Online',
      'Krisis Percaya Diri & Penerimaan Diri',
      'Hambatan Motivasi & Konsentrasi Belajar',
    ];

    const pendekatanPresets = [
      'Cognitive Behavioral Therapy (CBT - Restrukturisasi Pikiran)',
      'Konseling Realitas (WDEP - Keinginan, Evaluasi & Rencana)',
      'Solution-Focused Brief Counseling (SFBC - Solusi Singkat)',
      'Person-Centered (Pendekatan Humanistik Empatik)',
      'Behavioral Therapy (Kontrak Perilaku & Penguatan Positif)',
      'Rational Emotive Behavior Therapy (REBT)',
    ];

    return (
      <div className="bg-amber-50/40 border border-amber-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <HeartHandshake className="w-4 h-4 text-amber-700" />,
          'Spesifikasi Konseling Responsif (Pilar 3)',
          'Diagnosa akar masalah, pendekatan konseling teoretis, dan kontrak komitmen perubahan'
        )}

        {/* Akar Masalah */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Akar Masalah / Faktor Pemicu Utama
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {akarMasalahPresets.map((am) => {
              const isPicked = (details.akarMasalah || '').includes(am);
              return (
                <button
                  key={am}
                  type="button"
                  onClick={() => updateField('akarMasalah', am)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {am}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.akarMasalah || ''}
            onChange={(e) => updateField('akarMasalah', e.target.value)}
            placeholder="Ketik atau pilih akar pemicu permasalahan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Pendekatan Konseling */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Pendekatan / Teknik Konseling yang Diterapkan
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendekatanPresets.map((pen) => {
              const isPicked = details.pendekatanKonseling === pen;
              return (
                <button
                  key={pen}
                  type="button"
                  onClick={() => updateField('pendekatanKonseling', pen)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {pen}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.pendekatanKonseling || ''}
            onChange={(e) => updateField('pendekatanKonseling', e.target.value)}
            placeholder="Pendekatan atau teknik konseling yang digunakan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Komitmen Konseli */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Komitmen Tindakan Perubahan Konseli (Action Plan)
          </label>
          <input
            type="text"
            value={details.komitmenKonseli || ''}
            onChange={(e) => updateField('komitmenKonseli', e.target.value)}
            placeholder="Contoh: Mengatur jadwal tidur malam pukul 21.30, menerapkan relaksasi pernapasan saat cemas..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>
      </div>
    );
  }

  // 9. PILAR 4: DUKUNGAN SISTEM (KOLABORASI, KEMITRAAN, MANAJEMEN, MGBK, SUPERVISI)
  if (config.formCategory === 'dukungan_sistem') {
    const bentukPresets = [
      'Rapat Koordinasi Dewan Guru & Wali Kelas',
      'Kegiatan Musyawarah Guru BK (MGBK)',
      'Penyusunan Program Tahunan / RPL BK',
      'Kemitraan Lembaga Luar (Puskesmas / Instansi)',
      'Evaluasi & Supervisi Akuntabilitas Program',
    ];

    const mitraPresets = [
      'Wali Kelas 7, 8, dan 9',
      'Guru Mata Pelajaran Terkait',
      'Tim Puskesmas / Tenaga Kesehatan',
      'Pengurus & Anggota MGBK Kabupaten/Kota',
      'Kepala Sekolah & Komite Sekolah',
    ];

    const dokumenPresets = [
      'Notulen Hasil Rapat Koordinasi',
      'Naskah MoU Kemitraan Kerjasama',
      'Dokumen RPL & Matriks Program BK',
      'Sertifikat Kegiatan Pengembangan Keprofesian',
      'Format Rekapitulasi Laporan Semester',
    ];

    return (
      <div className="bg-purple-50/40 border border-purple-200 rounded-2xl p-5 space-y-4 shadow-2xs">
        {renderCardHeader(
          <Layers className="w-4 h-4 text-purple-700" />,
          'Spesifikasi Dukungan Sistem Standar Dinas (Pilar 4)',
          'Kegiatan non-bidang: Manajemen program, kolaborasi guru, kemitraan lembaga, dan pengembangan profesi MGBK'
        )}

        {/* Klasifikasi Sub-Aktivitas Sistem */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1.5">
            Klasifikasi Sub-Aktivitas Sistem (Standar POP BK)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            {SUB_AKTIVITAS_DUKUNGAN_SISTEM.map((sa) => {
              const isSelected = details.subAktivitasSistem === sa.label;
              return (
                <button
                  key={sa.id}
                  type="button"
                  onClick={() => updateField('subAktivitasSistem', sa.label)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-purple-600 bg-purple-100/70 text-purple-900 ring-2 ring-purple-400/30 shadow-2xs'
                      : 'border-gray-200 bg-white hover:bg-purple-50/40 text-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{sa.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-700 shrink-0" />}
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium line-clamp-1 mt-0.5">{sa.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bentuk Kegiatan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Bentuk & Jenis Kegiatan Sistem
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {bentukPresets.map((bg) => {
              const isSelected = details.bentukKegiatan === bg;
              return (
                <button
                  key={bg}
                  type="button"
                  onClick={() => updateField('bentukKegiatan', bg)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300'
                  }`}
                >
                  {bg}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.bentukKegiatan || ''}
            onChange={(e) => updateField('bentukKegiatan', e.target.value)}
            placeholder="Atau ketik bentuk kegiatan khusus..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Mitra / Pihak yang Terlibat */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Pihak / Mitra yang Terlibat
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mitraPresets.map((mp) => {
              const isPicked = (details.mitraTerlibat || '').includes(mp);
              return (
                <button
                  key={mp}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.mitraTerlibat || '')
                        .split(', ')
                        .filter((item) => item !== mp)
                        .join(', ');
                      updateField('mitraTerlibat', updated);
                    } else {
                      const updated = details.mitraTerlibat
                        ? `${details.mitraTerlibat}, ${mp}`
                        : mp;
                      updateField('mitraTerlibat', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {mp}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.mitraTerlibat || ''}
            onChange={(e) => updateField('mitraTerlibat', e.target.value)}
            placeholder="Contoh: Wali Kelas 8A-8F, Guru BK Kabupaten, Puskesmas Pembantu..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>

        {/* Dokumen / Output yang Dihasilkan */}
        <div>
          <label className="block text-xs font-bold text-[#0b1c30] mb-1">
            Dokumen / Bukti Output Kegiatan
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {dokumenPresets.map((dp) => {
              const isPicked = (details.dokumenOutput || '').includes(dp);
              return (
                <button
                  key={dp}
                  type="button"
                  onClick={() => {
                    if (isPicked) {
                      const updated = (details.dokumenOutput || '')
                        .split(', ')
                        .filter((item) => item !== dp)
                        .join(', ');
                      updateField('dokumenOutput', updated);
                    } else {
                      const updated = details.dokumenOutput
                        ? `${details.dokumenOutput}, ${dp}`
                        : dp;
                      updateField('dokumenOutput', updated);
                    }
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                    isPicked
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {isPicked ? '✓ ' : '+ '}
                  {dp}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            value={details.dokumenOutput || ''}
            onChange={(e) => updateField('dokumenOutput', e.target.value)}
            placeholder="Contoh: Notulen Rapat Koordinasi, Format Rekapitulasi Kasus Bulanan..."
            className="w-full px-3.5 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 outline-none font-semibold text-[#0b1c30]"
          />
        </div>
      </div>
    );
  }

  return null;
}
