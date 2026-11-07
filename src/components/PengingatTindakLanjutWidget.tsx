import React, { useState, useMemo, useEffect } from 'react';
import { 
  BellRing, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  X, 
  Calendar, 
  User, 
  HeartHandshake, 
  Check, 
  ArrowRight,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import { CounselingService, Counselor, Student } from '../types';
import { showToast } from '../utils/toast';

interface PengingatTindakLanjutWidgetProps {
  services: CounselingService[];
  students?: Student[];
  activeCounselor?: Counselor;
  isPrivacyMode?: boolean;
  onNavigateToTab: (tab: string, searchQuery?: string) => void;
}

export interface FollowUpReminderItem {
  serviceId: string;
  studentName: string;
  studentClass: string;
  studentId?: string;
  serviceType: string;
  serviceDate: string;
  followUpText: string;
  dueDate: string;
  isOverdue: boolean;
  isToday: boolean;
}

const STORAGE_COMPLETED_KEY = 'bk_completed_followups';
const STORAGE_SNOOZED_KEY = 'bk_snoozed_followups';

export default function PengingatTindakLanjutWidget({
  services,
  students = [],
  activeCounselor,
  isPrivacyMode = false,
  onNavigateToTab
}: PengingatTindakLanjutWidgetProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Completed follow-ups IDs
  const [completedIds, setCompletedIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMPLETED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Snoozed follow-ups: { [serviceId: string]: string (YYYY-MM-DD) }
  const [snoozedMap, setSnoozedMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SNOOZED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Save to local storage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COMPLETED_KEY, JSON.stringify(completedIds));
    } catch (e) {
      console.error('Failed to save completed followups', e);
    }
  }, [completedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SNOOZED_KEY, JSON.stringify(snoozedMap));
    } catch (e) {
      console.error('Failed to save snoozed followups', e);
    }
  }, [snoozedMap]);

  // Today in YYYY-MM-DD format
  const todayStr = useMemo(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  // Compute reminder list
  const reminderItems = useMemo<FollowUpReminderItem[]>(() => {
    const list: FollowUpReminderItem[] = [];
    const completedSet = new Set(completedIds);

    // Counselor filter: only include current logged in counselor's records
    const counselorName = (activeCounselor?.name || '').trim().toLowerCase();

    services.forEach((s) => {
      // Ensure service belongs to this counselor if counselor is logged in
      if (counselorName && s.counselorName) {
        const srvCounselor = s.counselorName.trim().toLowerCase();
        if (srvCounselor !== counselorName && !srvCounselor.includes(counselorName) && !counselorName.includes(srvCounselor)) {
          return;
        }
      }

      // If marked complete, skip
      if (completedSet.has(s.id)) return;

      // Extract follow-up text
      let followUp = (s.followUp || '').trim();
      const spec = (s.specificDetails || {}) as Record<string, any>;
      
      if (!followUp && spec.tindakLanjut) {
        if (Array.isArray(spec.tindakLanjut)) {
          followUp = spec.tindakLanjut.join(', ');
        } else {
          followUp = String(spec.tindakLanjut);
        }
      }

      // If still no follow-up text, skip
      if (!followUp || followUp === '-' || followUp.toLowerCase() === 'selesai' || followUp.toLowerCase() === 'tidak ada') {
        return;
      }

      // Determine due date
      let dueDate = '';
      if (snoozedMap[s.id]) {
        dueDate = snoozedMap[s.id];
      } else if (spec.jadwalEvaluasi && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalEvaluasi)) {
        dueDate = spec.jadwalEvaluasi;
      } else if (spec.jadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalPantau)) {
        dueDate = spec.jadwalPantau;
      } else if (spec.homeVisitJadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.homeVisitJadwalPantau)) {
        dueDate = spec.homeVisitJadwalPantau;
      } else if (s.date && /^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
        // Default: 7 days after the service date
        const sDate = new Date(s.date);
        sDate.setDate(sDate.getDate() + 7);
        dueDate = sDate.toISOString().split('T')[0];
      } else {
        dueDate = todayStr;
      }

      // Extract student info
      const sAny = s as any;
      const firstStudent = s.students && s.students.length > 0 ? s.students[0] : null;
      const studentName = firstStudent?.name || sAny.studentName || 'Peserta Didik';
      const studentClass = firstStudent?.class || sAny.studentClass || '-';
      const studentId = firstStudent?.id || sAny.studentId;

      // Only include if due today or past due
      if (dueDate <= todayStr) {
        list.push({
          serviceId: s.id,
          studentName,
          studentClass,
          studentId,
          serviceType: s.serviceType || 'Layanan BK',
          serviceDate: s.date || todayStr,
          followUpText: followUp,
          dueDate,
          isOverdue: dueDate < todayStr,
          isToday: dueDate === todayStr,
        });
      }
    });

    // Sort: Overdue first (oldest due date first), then today's
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [services, activeCounselor, completedIds, snoozedMap, todayStr]);

  // Actions
  const handleComplete = (item: FollowUpReminderItem, index: number) => {
    setCompletedIds((prev) => [...prev, item.serviceId]);
    showToast(`Tindak lanjut untuk Siswa ${index + 1} (${item.studentClass}) berhasil diselesaikan!`, 'success');
  };

  const handleSnooze = (item: FollowUpReminderItem, index: number) => {
    // Add 3 days from today
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const newDueDate = d.toISOString().split('T')[0];

    setSnoozedMap((prev) => ({
      ...prev,
      [item.serviceId]: newDueDate,
    }));

    showToast(`Pemantauan Siswa ${index + 1} (${item.studentClass}) ditunda 3 hari (hingga ${newDueDate})`, 'info');
  };

  const handleViewStudentHistory = (item: FollowUpReminderItem) => {
    setIsModalOpen(false);
    onNavigateToTab('data-siswa', item.studentName);
  };

  const hasDueItems = reminderItems.length > 0;

  return (
    <>
      {/* 🔔 PENGINGAT TINDAK LANJUT WIDGET CARD */}
      <div className="w-full">
        {hasDueItems ? (
          <div
            onClick={() => setIsModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }}
            className="group relative overflow-hidden bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border-2 border-red-300 hover:border-red-500 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md transition-all cursor-pointer select-none"
          >
            {/* Visual background pulse */}
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-400/10 rounded-full blur-2xl group-hover:scale-125 transition-transform" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  <BellRing className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-2xs">
                      Perlu Pantau Hari Ini
                    </span>
                    <span className="text-xs font-bold text-red-700">
                      Jatuh Tempo: {reminderItems.length} Siswa
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-red-950 mt-0.5 tracking-tight">
                    Ada {reminderItems.length} Siswa Perlu Dipantau Hari Ini
                  </h3>
                  <p className="text-xs text-red-800 font-medium mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Tindak lanjut konseling atau kunjungan rumah membutuhkan evaluasi perkembangan peserta didik.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <span className="px-3 py-1.5 bg-white text-red-700 border border-red-200 rounded-xl text-xs font-black shadow-2xs group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 transition-all flex items-center gap-1.5">
                  <span>Lihat {reminderItems.length} Siswa</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            {/* Quick Chips of First 3 Students */}
            <div className="mt-3.5 pt-3 border-t border-red-200/70 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-red-900">Siswa:</span>
              {reminderItems.slice(0, 3).map((item, idx) => (
                <span
                  key={item.serviceId}
                  className="px-2.5 py-1 bg-white/90 text-red-900 rounded-lg text-xs font-bold border border-red-200 flex items-center gap-1 shadow-2xs"
                >
                  <span>Siswa {idx + 1} ({item.studentClass}) - {item.serviceType}</span>
                </span>
              ))}
              {reminderItems.length > 3 && (
                <span className="text-[11px] font-extrabold text-red-700">
                  +{reminderItems.length - 3} lainnya
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => setIsModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsModalOpen(true); }}
            className="group bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-emerald-700 text-white text-[10px] font-black rounded-full uppercase tracking-wider">
                    Status Terkendali
                  </span>
                  <span className="text-xs font-bold text-emerald-800">
                    Pengingat Tindak Lanjut
                  </span>
                </div>
                <h3 className="text-base font-black text-[#0b1c30] mt-0.5">
                  Tidak Ada Tindak Lanjut Hari Ini
                </h3>
                <p className="text-xs text-[#3d4947] font-medium mt-0.5">
                  Semua janji pemantauan, evaluasi konseling, dan tindak lanjut siswa berada dalam status tuntas atau terjadwal rapi.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="text-xs font-extrabold text-[#00685f] hover:text-[#005049] flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Riwayat Pengingat</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 📋 MODAL DAFTAR TINDAK LANJUT SISWA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl max-w-3xl w-full border border-gray-200 shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-[#0b1c30] to-teal-950 text-white flex items-center justify-between gap-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-300 border border-red-400/40 flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Daftar Siswa Perlu Dipantau Hari Ini
                  </h3>
                  <p className="text-xs text-teal-100/90 font-medium mt-0.5">
                    Guru BK: <span className="font-bold text-amber-300">{activeCounselor?.name || 'Guru BK'}</span> • Tanggal: {todayStr}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 max-h-[70vh] overflow-y-auto space-y-4">
              {reminderItems.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-emerald-50/50 rounded-2xl border border-emerald-200">
                  <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h4 className="text-base font-black text-emerald-950">
                    Tidak Ada Tindak Lanjut yang Tertunda Hari Ini!
                  </h4>
                  <p className="text-xs text-emerald-800 max-w-md mx-auto">
                    Seluruh target pemantauan perkembangan perilaku, disiplin, dan bimbingan siswa telah selesai diproses.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {reminderItems.map((item, idx) => (
                    <div
                      key={item.serviceId}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        item.isOverdue
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-white border-gray-200 hover:border-[#00685f]/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          {/* Student Header & Class */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-[#0b1c30]">
                              Siswa {idx + 1} ({item.studentClass}) - {item.serviceType}
                            </span>
                            {item.isOverdue ? (
                              <span className="px-2 py-0.5 bg-red-600 text-white rounded-md text-[10px] font-black uppercase">
                                Terlewat
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[10px] font-black uppercase">
                                Hari Ini
                              </span>
                            )}
                          </div>

                          {/* Detail Layanan Terakhir */}
                          <p className="text-xs text-gray-500 font-medium">
                            Sesi Layanan: <span className="font-semibold text-gray-700">{item.serviceDate}</span>
                          </p>

                          {/* Apa Tindak Lanjutnya */}
                          <div className="mt-2 p-3 bg-white rounded-xl border border-gray-200/90 text-xs">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 block mb-1">
                              Rencana Tindak Lanjut:
                            </span>
                            <p className="font-bold text-[#0b1c30] leading-relaxed">
                              {item.followUpText}
                            </p>
                          </div>

                          {/* Tanggal Janji Pantau */}
                          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 pt-1">
                            <Clock className="w-3.5 h-3.5 text-[#00685f]" />
                            <span>Jatuh Tempo Pantau: <strong className="text-[#0b1c30]">{item.dueDate}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* 3 Action Buttons */}
                      <div className="mt-4 pt-3.5 border-t border-gray-200/70 flex flex-wrap items-center justify-end gap-2">
                        {/* 1. Selesaikan */}
                        <button
                          type="button"
                          onClick={() => handleComplete(item, idx)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-2xs hover:shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Tandai pemantauan ini telah selesai dilakukan"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Selesaikan</span>
                        </button>

                        {/* 2. Tunda 3 Hari */}
                        <button
                          type="button"
                          onClick={() => handleSnooze(item, idx)}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Tunda jadwal pemantauan selama 3 hari ke depan"
                        >
                          <Clock className="w-4 h-4 text-amber-700" />
                          <span>Tunda 3 Hari</span>
                        </button>

                        {/* 3. Lihat Siswa */}
                        <button
                          type="button"
                          onClick={() => handleViewStudentHistory(item)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Buka profil dan riwayat lengkap siswa ini di halaman Data Siswa"
                        >
                          <User className="w-4 h-4 text-slate-600" />
                          <span>Lihat Siswa</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
              <span>Pengingat otomatis berdasarkan jadwal pemantauan layanan</span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-[#0b1c30] border border-gray-300 rounded-xl font-bold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
