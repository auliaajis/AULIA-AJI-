import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Eye,
  EyeOff,
  ShieldAlert,
} from 'lucide-react';
import {
  CounselingService,
  Counselor,
  ProgramEvaluation,
  Student,
  ViolationRecord,
} from '../types';
import {
  formatTanggalIndonesia,
  getDaysSinceDate,
  isEvaluationDueFor14DayFollowUp,
} from '../utils/evaluationHelpers';
import {
  isRealNonDummyService,
  isRealNonDummyViolation,
} from '../utils/purgeDummyData';
import { showToast } from '../utils/toast';
import { getViolationRestitutionStatus } from './CatatPelanggaranForm';
import FollowUpCheckModal from './FollowUpCheckModal';
import PageHeaderBanner from './PageHeaderBanner';
import PengingatRestitusiWidget from './PengingatRestitusiWidget';
import PengingatTindakLanjutWidget from './PengingatTindakLanjutWidget';

export type PeringatanFilterTab = 'semua' | 'restitusi' | 'belum-dievaluasi' | 'followup';

interface PeringatanViewProps {
  students: Student[];
  violations: ViolationRecord[];
  services: CounselingService[];
  serviceEvaluations: ProgramEvaluation[];
  activeCounselor?: Counselor;
  initialFilter?: PeringatanFilterTab;
  onNavigateToTab: (tab: string, searchQuery?: string) => void;
  onEvaluateService?: (service: CounselingService) => void;
  onSaveServiceEvaluation?: (evaluation: ProgramEvaluation) => void;
}

export default function PeringatanView({
  students = [],
  violations = [],
  services = [],
  serviceEvaluations = [],
  activeCounselor,
  initialFilter = 'semua',
  onNavigateToTab,
  onEvaluateService,
  onSaveServiceEvaluation,
}: PeringatanViewProps) {
  const [activeTab, setActiveTab] = useState<PeringatanFilterTab>(initialFilter || 'semua');
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);
  const [followUpModalEval, setFollowUpModalEval] = useState<ProgramEvaluation | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setActiveTab(initialFilter);
    }
  }, [initialFilter]);

  // Filter strictly real (non-dummy) records
  const realViolations = useMemo(
    () => (violations || []).filter(isRealNonDummyViolation),
    [violations]
  );

  const realServices = useMemo(
    () => (services || []).filter(isRealNonDummyService),
    [services]
  );

  // 1. Overdue Restitution (> 7 days)
  const overdueRestitutions = useMemo(() => {
    const now = new Date();
    return realViolations.filter((v) => {
      if (getViolationRestitutionStatus(v) !== 'Proses Restitusi') return false;
      const dateStr = String(v.date || '').slice(0, 10);
      if (!dateStr) return false;
      const recordDate = new Date(dateStr);
      if (isNaN(recordDate.getTime())) return false;
      const diffDays = Math.floor((now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    });
  }, [realViolations]);

  // 2. Unevaluated Services (locked reminder)
  const unevaluatedServices = useMemo(() => {
    const evaluatedIds = new Set(
      (serviceEvaluations || []).map((ev) => String(ev.serviceId || '')).filter(Boolean)
    );
    return [...realServices]
      .filter((s) => s && s.id && !evaluatedIds.has(s.id))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [realServices, serviceEvaluations]);

  // 3. 14-day Follow-up checks
  const due14DayFollowUpEvals = useMemo(() => {
    const realServiceIds = new Set(realServices.map((s) => s.id));
    return (serviceEvaluations || []).filter((ev) => {
      if (!isEvaluationDueFor14DayFollowUp(ev)) return false;
      if (ev.serviceId && services.some((s) => s.id === ev.serviceId) && !realServiceIds.has(ev.serviceId)) {
        return false;
      }
      return true;
    });
  }, [serviceEvaluations, realServices, services]);

  // 4. Weekly due follow-ups from Blok D
  const weeklyDueFollowUps = useMemo(() => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const todayLocalDate = new Date(now.getTime() - tzOffset);
    const todayStr = todayLocalDate.toISOString().slice(0, 10);
    const weekAheadDate = new Date(todayLocalDate);
    weekAheadDate.setDate(weekAheadDate.getDate() + 7);
    const next7Str = weekAheadDate.toISOString().slice(0, 10);

    let completedSet = new Set<string>();
    let snoozedMap: Record<string, string> = {};
    try {
      const cRaw = localStorage.getItem('bk_completed_followups');
      if (cRaw) completedSet = new Set(JSON.parse(cRaw));
      const sRaw = localStorage.getItem('bk_snoozed_followups');
      if (sRaw) snoozedMap = JSON.parse(sRaw);
    } catch {}

    const todayMs = new Date(`${todayStr}T00:00:00`).getTime();
    const items: {
      service: CounselingService;
      dueDate: string;
      overdueDays: number;
      isToday: boolean;
      followUpText: string;
      studentLabel: string;
      studentClass: string;
    }[] = [];

    realServices.forEach((srv, idx) => {
      if (!srv || !srv.id || completedSet.has(srv.id)) return;
      const spec = (srv.specificDetails || {}) as Record<string, any>;
      const plan = spec.tindakLanjutPlan as
        | { tindakLanjutApa?: string; tindakLanjutTanggal?: string; statusTindakLanjut?: string }
        | undefined;
      if (
        plan?.statusTindakLanjut === 'Selesai' ||
        plan?.statusTindakLanjut === 'Sudah Ditindaklanjuti'
      ) {
        return;
      }

      let dueDate = '';
      if (snoozedMap[srv.id] && /^\d{4}-\d{2}-\d{2}$/.test(snoozedMap[srv.id])) {
        dueDate = snoozedMap[srv.id];
      } else if (plan?.tindakLanjutTanggal && /^\d{4}-\d{2}-\d{2}$/.test(plan.tindakLanjutTanggal)) {
        dueDate = plan.tindakLanjutTanggal;
      } else if (spec.jadwalEvaluasi && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalEvaluasi)) {
        dueDate = spec.jadwalEvaluasi;
      } else if (spec.jadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.jadwalPantau)) {
        dueDate = spec.jadwalPantau;
      } else if (spec.homeVisitJadwalPantau && /^\d{4}-\d{2}-\d{2}$/.test(spec.homeVisitJadwalPantau)) {
        dueDate = spec.homeVisitJadwalPantau;
      }

      if (!dueDate || dueDate > next7Str) return;

      let followUpText =
        String(plan?.tindakLanjutApa || '').trim() ||
        String(srv.followUp || '').trim() ||
        (Array.isArray(spec.tindakLanjut)
          ? spec.tindakLanjut.join(', ')
          : String(spec.tindakLanjut || '').trim());

      if (!followUpText || followUpText === '-' || followUpText.toLowerCase() === 'selesai') {
        if (!plan?.tindakLanjutTanggal) return;
        followUpText = `Tindak lanjut terjadwal (${srv.serviceType || 'Layanan BK'})`;
      }

      const dueMs = new Date(`${dueDate}T00:00:00`).getTime();
      const overdueDays = Math.max(0, Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24)));
      const firstStudent = srv.students?.[0];
      const rawName = firstStudent?.name || 'Siswa';
      const studentLabel = isPrivacyMode ? `Siswa ${idx + 1}` : rawName;
      const studentClass = firstStudent?.class || '-';

      items.push({
        service: srv,
        dueDate,
        overdueDays,
        isToday: dueDate === todayStr,
        followUpText,
        studentLabel,
        studentClass,
      });
    });

    return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [realServices, isPrivacyMode]);

  const totalAlerts =
    overdueRestitutions.length +
    unevaluatedServices.length +
    due14DayFollowUpEvals.length +
    weeklyDueFollowUps.length;

  const followUpCombinedCount = due14DayFollowUpEvals.length + weeklyDueFollowUps.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-[100px]">
      <PageHeaderBanner
        category="Siswa & Pemantauan"
        title="Pusat Peringatan & Tindak Lanjut"
        description="Daftar lengkap pengingat restitusi kasus, layanan yang belum dievaluasi, dan agenda cek follow-up siswa."
        icon={<BellRing className="w-5 h-5" />}
        badge={totalAlerts > 0 ? `${totalAlerts} Perlu Perhatian` : 'Semua Aman'}
        stats={[
          { label: 'Restitusi > 7 Hari', value: overdueRestitutions.length, color: overdueRestitutions.length > 0 ? 'text-rose-600' : 'text-emerald-700' },
          { label: 'Belum Dievaluasi', value: unevaluatedServices.length, color: unevaluatedServices.length > 0 ? 'text-amber-700' : 'text-emerald-700' },
          { label: 'Follow-up & Cek 14 Hari', value: followUpCombinedCount, color: followUpCombinedCount > 0 ? 'text-[#00685f]' : 'text-emerald-700' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrivacyMode((p) => !p)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                isPrivacyMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-white text-[#00685f] border-[#bcc9c6]/50 hover:bg-gray-50'
              }`}
            >
              {isPrivacyMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{isPrivacyMode ? 'Mode Privasi Aktif' : 'Mode Privasi'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab('data-siswa')}
              className="px-3.5 py-2 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <span>Buka Data Siswa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />

      {/* Segmented Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-gray-100 rounded-2xl border border-gray-200/80 w-fit flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('semua')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'semua' ? 'bg-[#00685f] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Semua ({totalAlerts})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('restitusi')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'restitusi' ? 'bg-[#00685f] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Restitusi ({overdueRestitutions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('belum-dievaluasi')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'belum-dievaluasi' ? 'bg-[#00685f] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Belum Dievaluasi ({unevaluatedServices.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('followup')}
          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'followup' ? 'bg-[#00685f] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Follow-up ({followUpCombinedCount})
        </button>
      </div>

      {totalAlerts === 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h3 className="text-base font-extrabold text-emerald-950">
            Tidak ada peringatan hari ini. Semua aman.
          </h3>
          <p className="text-xs text-emerald-800">
            Seluruh kasus restitusi, evaluasi layanan, dan tindak lanjut telah terpantau rapi.
          </p>
        </div>
      )}

      {/* 1. RESTITUSI */}
      {(activeTab === 'semua' || activeTab === 'restitusi') && (
        <div className="space-y-3">
          <PengingatRestitusiWidget
            violations={realViolations}
            isPrivacyMode={isPrivacyMode}
            onNavigateToTab={onNavigateToTab}
          />
        </div>
      )}

      {/* 2. BELUM DIEVALUASI */}
      {(activeTab === 'semua' || activeTab === 'belum-dievaluasi') && (
        <div className="bg-white border border-[#bcc9c6]/45 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-extrabold text-[#0b1c30]">
                  Layanan Belum Dievaluasi ({unevaluatedServices.length})
                </h3>
                <p className="text-xs text-[#3d4947]">
                  Badge &quot;Belum Dievaluasi&quot; terkunci sampai Form Evaluasi Layanan selesai diisi.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('evaluasi-program')}
              className="text-xs font-extrabold text-[#00685f] hover:underline self-start sm:self-center cursor-pointer shrink-0"
            >
              Buka Evaluasi Program →
            </button>
          </div>

          {unevaluatedServices.length === 0 ? (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-semibold">
              Semua layanan BK sudah dievaluasi.
            </p>
          ) : (
            <div className="space-y-2">
              {unevaluatedServices.map((srv, idx) => {
                const firstStudent = srv.students?.[0];
                const studentLabel = firstStudent
                  ? isPrivacyMode
                    ? `Siswa ${idx + 1}`
                    : `${firstStudent.name}${firstStudent.class ? ` (${firstStudent.class})` : ''}`
                  : 'Siswa';
                return (
                  <div
                    key={srv.id}
                    className="bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/40 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                          Belum Dievaluasi
                        </span>
                        <span className="text-xs font-extrabold text-[#0b1c30] truncate">
                          {srv.problem || srv.serviceType}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#3d4947] mt-0.5 tabular-nums">
                        {srv.serviceType} &middot; {studentLabel} &middot; {formatTanggalIndonesia(srv.date)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onEvaluateService
                          ? onEvaluateService(srv)
                          : onNavigateToTab('evaluasi-program')
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
                    >
                      Nilai Sekarang
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. FOLLOW-UP & CEK 14 HARI */}
      {(activeTab === 'semua' || activeTab === 'followup') && (
        <div className="space-y-4">
          <PengingatTindakLanjutWidget
            services={realServices}
            students={students}
            activeCounselor={activeCounselor}
            isPrivacyMode={isPrivacyMode}
            onNavigateToTab={onNavigateToTab}
          />

          {due14DayFollowUpEvals.length > 0 && (
            <div className="bg-white border border-[#00685f]/35 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0b1c30]">
                    Cek Follow-up (&ge; 14 Hari) ({due14DayFollowUpEvals.length})
                  </h3>
                  <p className="text-xs text-[#3d4947]">
                    Evaluasi layanan yang sudah melewati 14 hari tanpa cek ulang tindak lanjut.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {due14DayFollowUpEvals.map((ev, idx) => {
                  const linkedSrv = realServices.find((s) => s.id === ev.serviceId);
                  const rawName = linkedSrv?.students?.[0]?.name || ev.namaProgram || 'Siswa';
                  const labelName = isPrivacyMode ? `Siswa ${idx + 1}` : rawName;
                  return (
                    <div
                      key={ev.id}
                      className="bg-[#f8faf9] rounded-xl border border-[#bcc9c6]/50 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-[#0b1c30] truncate">
                          Cek Follow-up: {labelName}
                        </p>
                        <p className="text-[11px] text-[#3d4947] tabular-nums">
                          {ev.jenisMasalah || ev.bidang} &middot; Layanan {formatTanggalIndonesia(ev.tanggal)} (
                          {getDaysSinceDate(ev.tanggal)} hari lalu)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFollowUpModalEval(ev)}
                        className="px-3.5 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
                      >
                        Cek Follow-up
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {weeklyDueFollowUps.length > 0 && (
            <div className="bg-white border border-[#bcc9c6]/45 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0b1c30]">
                      Jadwal Tindak Lanjut Minggu Ini ({weeklyDueFollowUps.length})
                    </h3>
                    <p className="text-xs text-[#3d4947]">
                      Agenda tindak lanjut layanan BK yang jatuh tempo minggu ini atau terlewat.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToTab('riwayat-layanan')}
                  className="text-xs font-extrabold text-[#00685f] hover:underline cursor-pointer shrink-0"
                >
                  Lihat Riwayat →
                </button>
              </div>

              <div className="space-y-2">
                {weeklyDueFollowUps.map((item) => (
                  <div
                    key={item.service.id}
                    className={`rounded-xl border px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#f8faf9] ${
                      item.overdueDays > 0 ? 'border-rose-300 bg-rose-50/40' : 'border-[#bcc9c6]/50'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.overdueDays > 0 ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 tabular-nums">
                            Terlewat {item.overdueDays} hari
                          </span>
                        ) : item.isToday ? (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                            Jatuh Tempo Hari Ini
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/25">
                            Minggu Ini
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-[#0b1c30] truncate">
                          {item.studentLabel} ({item.studentClass}) &middot; {item.service.serviceType}
                        </span>
                      </div>
                      <p className="text-xs text-[#3d4947] line-clamp-1">{item.followUpText}</p>
                      <p className="text-[11px] font-semibold text-[#3d4947]/80 tabular-nums">
                        Jadwal: {formatTanggalIndonesia(item.dueDate)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onEvaluateService
                          ? onEvaluateService(item.service)
                          : onNavigateToTab('profil-siswa', item.service.students?.[0]?.id || item.service.students?.[0]?.name)
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
                    >
                      Tindak Lanjuti
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {followUpModalEval && (
        <FollowUpCheckModal
          isOpen={Boolean(followUpModalEval)}
          evaluation={followUpModalEval}
          onClose={() => setFollowUpModalEval(null)}
          onSave={(updatedEval) => {
            if (onSaveServiceEvaluation) {
              onSaveServiceEvaluation(updatedEval);
            }
            setFollowUpModalEval(null);
            showToast('Cek Follow-up berhasil disimpan!', 'success');
          }}
        />
      )}
    </div>
  );
}
