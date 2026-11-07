import React, { useState } from 'react';
import {
  X,
  Printer,
  FileText,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  Clock3,
  XCircle,
  ExternalLink,
  Edit,
  Trash2,
  ArrowRight,
  ShieldCheck,
  HeartHandshake,
  Sparkles,
  BookOpen,
  Share2,
  FileCheck,
  FileSpreadsheet,
  AlertCircle,
  Download
} from 'lucide-react';
import { CounselingService } from '../types';
import { getPilarBadge, getComponentColorConfig } from '../utils/bkKomprehensif';
import { exportSingleServiceToIcs } from '../utils/calendarSync';
import {
  downloadServicePDF,
  downloadCommitmentLetterPDF,
  downloadBeritaAcaraLayananPDF
} from '../utils/pdfGenerator';

function formatIndonesianDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface LayananDetailModalProps {
  service: CounselingService | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (service: CounselingService) => void;
  onDelete: (serviceId: string) => void;
  onUpdateStatus?: (serviceId: string, status: 'Terjadwal' | 'Selesai' | 'Dibatalkan') => void;
  onScheduleFollowUp?: (service: CounselingService) => void;
}

export default function LayananDetailModal({
  service,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
  onScheduleFollowUp,
}: LayananDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'detail' | 'spesifikasi' | 'dokumentasi'>('detail');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !service) return null;

  const pilar = getPilarBadge(service.bkComponent || service.serviceType);
  const colorCfg = getComponentColorConfig(service.bkComponent || service.serviceType);

  const handlePrintService = () => {
    setIsExporting(true);
    try {
      downloadServicePDF(service);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintCommitment = () => {
    setIsExporting(true);
    try {
      downloadCommitmentLetterPDF(service);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintBeritaAcara = () => {
    setIsExporting(true);
    try {
      downloadBeritaAcaraLayananPDF(service);
    } finally {
      setIsExporting(false);
    }
  };

  const specificDetails = service.specificDetails;
  const hasSpecificDetails =
    specificDetails &&
    Object.values(specificDetails).some((val) => typeof val === 'string' && val.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden border border-[#bcc9c6]/40 my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-[#f8faf9] border-b border-[#bcc9c6]/30 px-6 py-4.5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${pilar.badgeClass}`}
              >
                {pilar.pilar} • {pilar.name}
              </span>
              {service.bidangBimbingan && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                    service.bidangBimbingan.includes('Non-Bidang')
                      ? 'bg-purple-100 text-purple-900 border-purple-300'
                      : 'bg-[#00685f]/10 text-[#00685f] border-[#00685f]/20'
                  }`}
                >
                  {service.bidangBimbingan.includes('Non-Bidang') ? 'Non-Bidang (Dukungan Sistem)' : `Bidang: ${service.bidangBimbingan}`}
                </span>
              )}
              {service.targetType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  {service.targetType}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] leading-snug">
              {service.serviceType}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#3d4947] mt-1.5">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#00685f]" />
                {formatIndonesianDate(service.date)}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                {service.startTime} - {service.endTime} WIB
              </span>
              {service.counselorName && (
                <span className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-[#00685f]" />
                  {service.counselorName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Quick Bar */}
        <div className="px-6 py-2.5 bg-gray-50 border-b border-[#bcc9c6]/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#3d4947]">Status Sesi:</span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                service.status === 'Selesai'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : service.status === 'Dibatalkan'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {service.status === 'Selesai' && <CheckCircle2 className="w-3.5 h-3.5" />}
              {service.status === 'Terjadwal' && <Clock3 className="w-3.5 h-3.5" />}
              {service.status === 'Dibatalkan' && <XCircle className="w-3.5 h-3.5" />}
              {service.status}
            </span>
          </div>

          {onUpdateStatus && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-medium">Ubah cepat:</span>
              {service.status !== 'Selesai' && (
                <button
                  onClick={() => onUpdateStatus(service.id, 'Selesai')}
                  className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-2xs"
                >
                  ✓ Tandai Selesai
                </button>
              )}
              {service.status !== 'Terjadwal' && (
                <button
                  onClick={() => onUpdateStatus(service.id, 'Terjadwal')}
                  className="px-2.5 py-1 text-[11px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition shadow-2xs"
                >
                  ⏱ Jadwalkan Ulang
                </button>
              )}
              {service.status !== 'Dibatalkan' && (
                <button
                  onClick={() => onUpdateStatus(service.id, 'Dibatalkan')}
                  className="px-2 py-1 text-[11px] font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-rose-100 hover:text-rose-700 transition"
                >
                  Batalkan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="px-6 border-b border-gray-200 flex items-center gap-4 text-xs font-bold text-gray-600">
          <button
            onClick={() => setActiveTab('detail')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'detail'
                ? 'border-[#00685f] text-[#00685f]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📋 Ringkasan & Uraian Sesi
          </button>
          {hasSpecificDetails && (
            <button
              onClick={() => setActiveTab('spesifikasi')}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'spesifikasi'
                  ? 'border-[#00685f] text-[#00685f]'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              ⚙️ Spesifikasi & Parameter Layanan
            </button>
          )}
          <button
            onClick={() => setActiveTab('dokumentasi')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'dokumentasi'
                ? 'border-[#00685f] text-[#00685f]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            📷 Dokumentasi & Ekspor PDF
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[62vh] overflow-y-auto space-y-5">
          {activeTab === 'detail' && (
            <>
              {/* Peserta Didik / Konseli */}
              <div className="bg-[#f8faf9] rounded-xl p-4 border border-[#bcc9c6]/30">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#00685f]" />
                    Peserta Didik / Konseli Terlibat ({service.students?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(service.students || []).map((st) => (
                    <div
                      key={st.id || st.nis}
                      className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-[#bcc9c6]/40 text-xs shadow-2xs"
                    >
                      <div className="w-6 h-6 rounded-full bg-[#00685f]/10 text-[#00685f] flex items-center justify-center font-bold text-[10px]">
                        {st.name?.charAt(0) || 'S'}
                      </div>
                      <div>
                        <div className="font-bold text-[#0b1c30]">{st.name}</div>
                        <div className="text-[10px] text-gray-500">
                          Kelas {st.class} • NISN: {st.nis || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!service.students || service.students.length === 0) && (
                    <span className="text-xs text-gray-500 italic">
                      Tidak ada peserta didik spesifik yang ditautkan.
                    </span>
                  )}
                </div>
              </div>

              {/* Pokok Bahasan / Isu Utama */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] mb-1">
                  Topik / Pokok Bahasan Layanan
                </label>
                <div className="p-3.5 bg-white border border-[#bcc9c6]/40 rounded-xl text-xs sm:text-sm font-semibold text-[#0b1c30] shadow-2xs">
                  {service.problem || '-'}
                </div>
              </div>

              {/* Uraian Proses & Dinamika */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-[#0b1c30] mb-1">
                  Uraian Proses & Dinamika Pelaksanaan
                </label>
                <div className="p-3.5 bg-white border border-[#bcc9c6]/40 rounded-xl text-xs sm:text-sm text-[#3d4947] whitespace-pre-wrap leading-relaxed shadow-2xs">
                  {service.description || '-'}
                </div>
              </div>

              {/* Hasil & Tindak Lanjut Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-3.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-emerald-900 mb-1">
                    Hasil / Output Layanan & Komitmen
                  </label>
                  <p className="text-xs sm:text-sm text-emerald-950 whitespace-pre-wrap leading-relaxed">
                    {service.output || '-'}
                  </p>
                </div>

                <div className="bg-teal-50/50 border border-teal-200/60 rounded-xl p-3.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-teal-900 mb-1">
                    Rencana Tindak Lanjut (RTL)
                  </label>
                  <p className="text-xs sm:text-sm text-teal-950 whitespace-pre-wrap leading-relaxed">
                    {service.followUp || '-'}
                  </p>
                </div>
              </div>
            </>
          )}

          {activeTab === 'spesifikasi' && hasSpecificDetails && (
            <div className="space-y-4">
              <div className="bg-[#f8faf9] border border-[#00685f]/20 rounded-xl p-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#00685f] mb-3">
                  Rincian Parameter Layanan Berdasarkan Pilar BK
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {specificDetails?.aspekSkkpd && (
                    <div className="p-2.5 bg-white rounded-lg border border-teal-200 col-span-full">
                      <span className="font-bold text-[#00685f] block mb-0.5">Aspek Perkembangan SKKPD:</span>
                      <span className="font-semibold text-[#0b1c30]">
                        {specificDetails.aspekSkkpd}
                      </span>
                    </div>
                  )}
                  {specificDetails?.tahapCapaian && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">Tahap Capaian Kemandirian:</span>
                      <span className="font-semibold text-[#0b1c30]">
                        {specificDetails.tahapCapaian}
                      </span>
                    </div>
                  )}
                  {specificDetails?.subAktivitasSistem && (
                    <div className="p-2.5 bg-white rounded-lg border border-purple-200 col-span-full">
                      <span className="font-bold text-purple-700 block mb-0.5">Sub-Aktivitas Dukungan Sistem:</span>
                      <span className="font-semibold text-purple-950">
                        {specificDetails.subAktivitasSistem}
                      </span>
                    </div>
                  )}
                  {specificDetails?.metodeLayanan && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">Metode / Teknik:</span>
                      <span className="font-semibold text-[#0b1c30]">
                        {specificDetails.metodeLayanan}
                      </span>
                    </div>
                  )}
                  {specificDetails?.mediaLayanan && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">Media / Instrumen:</span>
                      <span className="font-semibold text-[#0b1c30]">
                        {specificDetails.mediaLayanan}
                      </span>
                    </div>
                  )}
                  {specificDetails?.pendekatanKonseling && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">
                        Pendekatan Konseling:
                      </span>
                      <span className="font-semibold text-[#00685f]">
                        {specificDetails.pendekatanKonseling}
                      </span>
                    </div>
                  )}
                  {specificDetails?.akarMasalah && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200 col-span-full">
                      <span className="font-bold text-gray-500 block mb-0.5">
                        Akar Masalah / Faktor Pemicu:
                      </span>
                      <span className="text-[#0b1c30]">{specificDetails.akarMasalah}</span>
                    </div>
                  )}
                  {specificDetails?.komitmenKonseli && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200 col-span-full">
                      <span className="font-bold text-emerald-700 block mb-0.5">
                        Komitmen Diri Konseli:
                      </span>
                      <span className="font-medium text-emerald-950">
                        {specificDetails.komitmenKonseli}
                      </span>
                    </div>
                  )}
                  {specificDetails?.kesepakatanDamai && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200 col-span-full">
                      <span className="font-bold text-teal-700 block mb-0.5">
                        Kesepakatan Mediasi Damai:
                      </span>
                      <span className="font-medium text-teal-950">
                        {specificDetails.kesepakatanDamai}
                      </span>
                    </div>
                  )}
                  {specificDetails?.pesertaKonferensi && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200 col-span-full">
                      <span className="font-bold text-gray-500 block mb-0.5">
                        Peserta Konferensi Kasus:
                      </span>
                      <span className="text-[#0b1c30]">{specificDetails.pesertaKonferensi}</span>
                    </div>
                  )}
                  {specificDetails?.alamatKunjungan && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">
                        Alamat Kunjungan Rumah:
                      </span>
                      <span className="text-[#0b1c30]">{specificDetails.alamatKunjungan}</span>
                    </div>
                  )}
                  {specificDetails?.pihakDitemui && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">Pihak Ditemui:</span>
                      <span className="text-[#0b1c30]">{specificDetails.pihakDitemui}</span>
                    </div>
                  )}
                  {specificDetails?.lembagaRujukan && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200 col-span-full">
                      <span className="font-bold text-purple-700 block mb-0.5">
                        Lembaga Rujukan (Referral):
                      </span>
                      <span className="font-semibold text-purple-950">
                        {specificDetails.lembagaRujukan}
                      </span>
                    </div>
                  )}
                  {specificDetails?.bidangPeminatan && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-blue-700 block mb-0.5">
                        Pilihan Peminatan / Karir:
                      </span>
                      <span className="font-semibold text-blue-950">
                        {specificDetails.bidangPeminatan}
                      </span>
                    </div>
                  )}
                  {specificDetails?.rencanaAksiSiswa && (
                    <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                      <span className="font-bold text-gray-500 block mb-0.5">
                        Action Plan Siswa:
                      </span>
                      <span className="text-[#0b1c30]">{specificDetails.rencanaAksiSiswa}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dokumentasi' && (
            <div className="space-y-4">
              {/* Foto Bukti / Lampiran */}
              <div className="bg-[#f8faf9] border border-[#bcc9c6]/30 rounded-xl p-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#0b1c30] mb-3">
                  Bukti Foto & Lampiran Dokumen
                </h4>
                {service.proofPhotoUrl ? (
                  <div className="space-y-2">
                    <img
                      src={service.proofPhotoUrl}
                      alt="Bukti Layanan"
                      className="max-h-64 rounded-xl border border-gray-200 object-cover shadow-2xs"
                    />
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{service.proofPhotoName || 'Foto Bukti Pelaksanaan Layanan'}</span>
                      {service.driveViewUrl && (
                        <a
                          href={service.driveViewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#00685f] font-bold hover:underline"
                        >
                          Buka di Google Drive <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                    <p>Tidak ada foto bukti yang dilampirkan pada sesi ini.</p>
                  </div>
                )}
              </div>

              {/* Lembar Ekspor Dokumen Resmi */}
              <div className="bg-white border border-[#00685f]/20 rounded-xl p-4">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-[#00685f] mb-2">
                  Ekspor Dokumen Layanan Resmi (Format POP BK)
                </h4>
                <p className="text-xs text-gray-600 mb-3">
                  Unduh lembar dokumen resmi bertanda tangan digital konselor untuk keperluan arsip
                  administrasi dan akreditasi sekolah.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  <button
                    onClick={handlePrintService}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#00685f] text-white rounded-xl text-xs font-bold hover:bg-[#005049] transition shadow-2xs"
                  >
                    <Printer className="w-4 h-4" /> Cetak Rekam Layanan
                  </button>
                  <button
                    onClick={handlePrintCommitment}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold hover:bg-emerald-800 transition shadow-2xs"
                  >
                    <FileCheck className="w-4 h-4" /> Lembar Komitmen
                  </button>
                  <button
                    onClick={handlePrintBeritaAcara}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 transition shadow-2xs"
                  >
                    <FileText className="w-4 h-4" /> Berita Acara
                  </button>
                  <button
                    onClick={() => exportSingleServiceToIcs(service)}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#00685f]/10 text-[#00685f] hover:bg-[#00685f] hover:text-white border border-[#00685f]/30 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                    title="Ekspor jadwal sesi ini ke format .ics (Google Calendar / Kalender HP)"
                  >
                    <Calendar className="w-4 h-4" /> Ekspor .ics (Kalender)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-[#f8faf9] border-t border-[#bcc9c6]/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Hapus
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-300">
                <span className="text-xs font-bold text-rose-700">Yakin hapus sesi?</span>
                <button
                  onClick={() => {
                    onDelete(service.id);
                    onClose();
                  }}
                  className="px-2 py-0.5 bg-rose-600 text-white text-xs font-bold rounded hover:bg-rose-700"
                >
                  Ya, Hapus
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300"
                >
                  Batal
                </button>
              </div>
            )}

            <button
              onClick={() => {
                onClose();
                onEdit(service);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#0b1c30] hover:bg-gray-100 border border-[#bcc9c6]/50 transition"
            >
              <Edit className="w-3.5 h-3.5 text-[#00685f]" /> Edit Sesi
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSingleServiceToIcs(service)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
              title="Unduh file kalender .ics sesi ini untuk diimpor ke Google Calendar / Kalender HP"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" /> Ekspor .ics
            </button>

            {onScheduleFollowUp && (
              <button
                onClick={() => {
                  onClose();
                  onScheduleFollowUp(service);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-50 text-[#00685f] border border-[#00685f]/30 hover:bg-teal-100 rounded-xl text-xs font-bold transition shadow-2xs"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Jadwalkan Sesi Lanjutan
              </button>
            )}
            <button
              onClick={handlePrintService}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#00685f] text-white hover:bg-[#005049] rounded-xl text-xs font-bold transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" /> Cetak PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
