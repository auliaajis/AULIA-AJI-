import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  Clock,
  Edit3,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Plus,
  Printer,
  Search,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  BKJournalEntry,
  CaseFinalStatus,
  CounselingService,
  Counselor,
  EvaluationFollowUpStatus,
  ProgramEvaluation,
  Student,
} from '../types';
import {
  ALASAN_TIDAK_TERTANGANI_OPTIONS,
  DEFAULT_TAHUN_AJARAN_OPTIONS,
  EVALUATION_6_SCORES_META,
  EVALUATION_FOLLOWUP_STATUS_OPTIONS,
  STANDARD_EVALUATION_BIDANG,
  STATUS_AKHIR_KASUS_OPTIONS,
  StandardEvaluationBidang,
  aggregateServicesForProgramPeriod,
  computeBaselineKondisiAwal,
  computeEvaluationPercentage,
  computeProgramFromServiceEvaluations,
  evaluationMatchesClassFilter,
  extractClassesFromService,
  formatTanggalIndonesia,
  getActiveRencanaTahunan,
  getCurrentPeriodDefaults,
  getDaysSinceDate,
  getEffectiveServiceEvalScore,
  getNormalizedEvidenceList,
  getSemesterFromDate,
  getTahunAjaranFromDate,
  isEvaluationDueFor14DayFollowUp,
  isServiceEvalFollowUpCompleted,
  mapServiceToEvaluationBidang,
  normalizeBidangTab,
  normalizeClassToken,
  resolveServiceCaseFinalStatus,
  serviceMatchesClassFilter,
} from '../utils/evaluationHelpers';
import {
  downloadGlobalEvaluationPDF,
  downloadKepsekReportPDF,
  downloadSingleEvaluationCardPDF,
} from '../utils/evaluationPdfGenerator';
import { exportBKProgramToExcel } from '../utils/bkExcelExporter';
import { getActiveSchoolId } from '../utils/schoolConfig';
import { getCloudCollectionData, subscribeCloudCollection } from '../utils/firestoreSync';
import EvaluasiWizardModal from './EvaluasiWizardModal';
import EvaluasiProgramWizardModal from './EvaluasiProgramWizardModal';
import FollowUpCheckModal from './FollowUpCheckModal';
import RencanaTahunanCard from './RencanaTahunanCard';
import { showToast } from '../utils/toast';

interface EvaluasiProgramViewProps {
  evaluations: ProgramEvaluation[];
  serviceEvaluations?: ProgramEvaluation[];
  services: CounselingService[];
  students: Student[];
  activeCounselor: Counselor;
  onSaveEvaluation: (evaluation: ProgramEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  onSaveServiceEvaluation?: (evaluation: ProgramEvaluation) => void;
  onDeleteServiceEvaluation?: (id: string) => void;
  onBack?: () => void;
}

const isNonArchivePlanDoc = (ev: ProgramEvaluation): boolean =>
  ev.evaluationScope === 'kebutuhan-awal' || ev.evaluationScope === 'rencana-tahunan';

const isProgramScopeEval = (ev: ProgramEvaluation): boolean => {
  if (isNonArchivePlanDoc(ev)) return false;
  if (ev.evaluationScope === 'program') return true;
  if (ev.evaluationScope === 'layanan') return false;
  if (ev.aggregatedSummary) return true;
  return !ev.serviceId;
};

export default function EvaluasiProgramView({
  evaluations,
  serviceEvaluations = [],
  services,
  students,
  activeCounselor,
  onSaveEvaluation,
  onDeleteEvaluation,
  onSaveServiceEvaluation,
  onDeleteServiceEvaluation,
  onBack,
}: EvaluasiProgramViewProps) {
  const [activeJalur, setActiveJalur] = useState<'program' | 'layanan'>('program');
  const [activeTab, setActiveTab] = useState<StandardEvaluationBidang>('Layanan Dasar');
  const [semesterFilter, setSemesterFilter] = useState<string>('Semua');
  const [tahunAjaranFilter, setTahunAjaranFilter] = useState<string>('Semua');
  const [classFilter, setClassFilter] = useState<string>('Semua');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Read-only journals state strictly from Firestore cloud store
  const [dailyJournals, setDailyJournals] = useState<BKJournalEntry[]>(() => {
    const sId = activeCounselor?.schoolId || getActiveSchoolId();
    return getCloudCollectionData<BKJournalEntry>('bk_daily_journals', sId);
  });

  useEffect(() => {
    const sId = activeCounselor?.schoolId || getActiveSchoolId();
    return subscribeCloudCollection<BKJournalEntry>(
      'bk_daily_journals',
      (data) => setDailyJournals(data),
      sId
    );
  }, [activeCounselor?.schoolId]);

  // Jalur 1 Modal: Evaluasi Layanan
  const [isServiceWizardOpen, setIsServiceWizardOpen] = useState(false);
  const [editingServiceEval, setEditingServiceEval] = useState<ProgramEvaluation | null>(null);
  const [presetServiceForWizard, setPresetServiceForWizard] = useState<CounselingService | null>(null);

  // Jalur 2 Modal: Evaluasi Program BK (Mandiri)
  const [isProgramWizardOpen, setIsProgramWizardOpen] = useState(false);
  const [editingProgramEval, setEditingProgramEval] = useState<ProgramEvaluation | null>(null);

  // Follow-up Check Modal (14 hari pasca layanan)
  const [followUpModalEval, setFollowUpModalEval] = useState<ProgramEvaluation | null>(null);

  // Separate evaluations cleanly while preserving legacy records and Rencana Tahunan docs
  const { programEvalRecords, serviceEvalRecords, kebutuhanPlans, legacyProgramIdsForService } =
    useMemo(() => {
      const legacyIds = new Set<string>();
      const progList: ProgramEvaluation[] = [];
      const needList: ProgramEvaluation[] = [];
      const srvMap = new Map<string, ProgramEvaluation>();

      (serviceEvaluations || []).forEach((ev) => {
        if (ev && ev.id && !isNonArchivePlanDoc(ev)) srvMap.set(ev.id, ev);
      });

      (evaluations || []).forEach((ev) => {
        if (!ev || !ev.id) return;
        if (isNonArchivePlanDoc(ev)) {
          if (ev.evaluationScope === 'kebutuhan-awal') needList.push(ev);
          return;
        }
        if (isProgramScopeEval(ev)) {
          progList.push(ev);
        } else {
          legacyIds.add(ev.id);
          if (!srvMap.has(ev.id)) {
            srvMap.set(ev.id, ev);
          }
        }
      });

      return {
        programEvalRecords: progList,
        serviceEvalRecords: Array.from(srvMap.values()),
        kebutuhanPlans: needList,
        legacyProgramIdsForService: legacyIds,
      };
    }, [evaluations, serviceEvaluations]);

  const combinedAllEvaluations = useMemo(() => {
    const map = new Map<string, ProgramEvaluation>();
    [...programEvalRecords, ...serviceEvalRecords].forEach((e) => map.set(e.id, e));
    return Array.from(map.values());
  }, [programEvalRecords, serviceEvalRecords]);

  // Active Tahun Ajaran for Rencana Program Tahunan (Kalkulasi AI — Tanpa Asesmen Awal)
  const periodDefaultsNow = getCurrentPeriodDefaults();
  const activeNeedSemester: 'Ganjil' | 'Genap' | 'Semua' =
    semesterFilter === 'Ganjil' || semesterFilter === 'Genap' ? semesterFilter : 'Semua';
  const activeNeedTa =
    tahunAjaranFilter !== 'Semua' ? tahunAjaranFilter : periodDefaultsNow.tahunAjaran;

  const activeRencanaTahunan = useMemo(
    () => getActiveRencanaTahunan(evaluations, activeNeedTa),
    [evaluations, activeNeedTa]
  );

  // Filter options derived cleanly from real data
  const availableTahunAjaran = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAHUN_AJARAN_OPTIONS);
    services.forEach((s) => s.date && set.add(getTahunAjaranFromDate(s.date)));
    combinedAllEvaluations.forEach((e) => set.add(e.tahunAjaran || getTahunAjaranFromDate(e.tanggal)));
    dailyJournals.forEach((j) => j.date && set.add(getTahunAjaranFromDate(j.date)));
    return Array.from(set).sort().reverse();
  }, [services, combinedAllEvaluations, dailyJournals]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((st) => st.class && set.add(normalizeClassToken(st.class)));
    services.forEach((srv) =>
      (srv.students || []).forEach((st) => st.class && set.add(normalizeClassToken(st.class)))
    );
    return Array.from(set).filter(Boolean).sort();
  }, [students, services]);

  // Period + Class filtered real collections
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      const sem = getSemesterFromDate(srv.date);
      const ta = getTahunAjaranFromDate(srv.date);
      if (semesterFilter !== 'Semua' && sem !== semesterFilter) return false;
      if (tahunAjaranFilter !== 'Semua' && ta !== tahunAjaranFilter) return false;
      if (classFilter !== 'Semua' && !serviceMatchesClassFilter(srv, classFilter)) return false;
      return true;
    });
  }, [services, semesterFilter, tahunAjaranFilter, classFilter]);

  const filteredJournals = useMemo(() => {
    return dailyJournals.filter((j) => {
      const sem = getSemesterFromDate(j.date);
      const ta = getTahunAjaranFromDate(j.date);
      if (semesterFilter !== 'Semua' && sem !== semesterFilter) return false;
      if (tahunAjaranFilter !== 'Semua' && ta !== tahunAjaranFilter) return false;
      if (classFilter !== 'Semua') {
        const tgt = normalizeClassToken(j.target || '');
        if (!tgt.includes(normalizeClassToken(classFilter))) return false;
      }
      return true;
    });
  }, [dailyJournals, semesterFilter, tahunAjaranFilter, classFilter]);

  const filteredStudents = useMemo(() => {
    if (classFilter === 'Semua') return students;
    const norm = normalizeClassToken(classFilter);
    return students.filter((st) => normalizeClassToken(st.class) === norm);
  }, [students, classFilter]);

  const filterEvalList = (list: ProgramEvaluation[]) => {
    return list.filter((ev) => {
      const sem = ev.semester || getSemesterFromDate(ev.tanggal);
      const ta = ev.tahunAjaran || getTahunAjaranFromDate(ev.tanggal);
      if (semesterFilter !== 'Semua' && sem !== semesterFilter) return false;
      if (tahunAjaranFilter !== 'Semua' && ta !== tahunAjaranFilter) return false;
      if (classFilter !== 'Semua' && !evaluationMatchesClassFilter(ev, classFilter)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hay = `${ev.namaProgram} ${ev.bidang} ${ev.kelas} ${ev.hasil} ${ev.tindakLanjut}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  };

  const filteredProgramEvaluations = useMemo(
    () => filterEvalList(programEvalRecords),
    [programEvalRecords, semesterFilter, tahunAjaranFilter, classFilter, searchTerm]
  );

  const filteredServiceEvaluations = useMemo(
    () => filterEvalList(serviceEvalRecords),
    [serviceEvalRecords, semesterFilter, tahunAjaranFilter, classFilter, searchTerm]
  );

  const filteredAllEvaluations = useMemo(() => {
    const map = new Map<string, ProgramEvaluation>();
    [...filteredProgramEvaluations, ...filteredServiceEvaluations].forEach((e) => map.set(e.id, e));
    return Array.from(map.values());
  }, [filteredProgramEvaluations, filteredServiceEvaluations]);

  const evaluatedServiceIds = useMemo(
    () => new Set(serviceEvalRecords.map((e) => e.serviceId).filter(Boolean)),
    [serviceEvalRecords]
  );

  // Global Summary KPIs: evaluation metrics strictly sourced from Evaluasi Layanan (`filteredServiceEvaluations`),
  // while `filteredServices` is used ONLY for Total Layanan and Sudah vs Belum Dievaluasi.
  const globalStats = useMemo(() => {
    const totalServicesCount = filteredServices.length;
    const totalStudentsCount = filteredStudents.length;
    const totalJournalsCount = filteredJournals.length;

    const evaluatedInFilterCount = filteredServices.filter((s) => evaluatedServiceIds.has(s.id)).length;
    const unevaluatedInFilterCount = Math.max(0, totalServicesCount - evaluatedInFilterCount);

    const scores = filteredServiceEvaluations
      .map((e) => getEffectiveServiceEvalScore(e))
      .filter((v) => v > 0);
    const avg6Skor =
      scores.length > 0
        ? (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(2)
        : '0.00';

    const deltas = filteredServiceEvaluations
      .map((e) => e.followUpCheck?.delta)
      .filter((d): d is number => typeof d === 'number');
    const avgDelta =
      deltas.length > 0
        ? Number((deltas.reduce((sum, v) => sum + v, 0) / deltas.length).toFixed(2))
        : null;

    const completedFollowUps = filteredServiceEvaluations.filter((e) =>
      isServiceEvalFollowUpCompleted(e)
    ).length;
    const pctTindakLanjutSelesai =
      filteredServiceEvaluations.length > 0
        ? Math.round((completedFollowUps / filteredServiceEvaluations.length) * 100)
        : 0;
    const ongoingFollowUps = Math.max(0, filteredServiceEvaluations.length - completedFollowUps);
    const due14DaysCount = filteredServiceEvaluations.filter((e) =>
      isEvaluationDueFor14DayFollowUp(e)
    ).length;

    return {
      totalServicesCount,
      evaluatedInFilterCount,
      unevaluatedInFilterCount,
      totalStudentsCount,
      totalJournalsCount,
      avg6Skor,
      avgDelta,
      pctTindakLanjutSelesai,
      ongoingFollowUps,
      due14DaysCount,
    };
  }, [filteredServices, filteredStudents, filteredJournals, filteredServiceEvaluations, evaluatedServiceIds]);

  const activeSourceList =
    activeJalur === 'program' ? filteredProgramEvaluations : filteredServiceEvaluations;

  const isMultiBidangProgramEval = (ev: ProgramEvaluation): boolean =>
    Boolean(
      (Array.isArray(ev.bidangList) && ev.bidangList.length > 0) ||
        String(ev.bidang || '').toLowerCase().includes('semua')
    );

  // Tab-specific evaluations (comprehensive 4-bidang Program evaluations appear cleanly across tabs)
  const tabEvaluations = useMemo(() => {
    return activeSourceList.filter((ev) => {
      if (activeJalur === 'program' && isMultiBidangProgramEval(ev)) return true;
      return normalizeBidangTab(ev.bidang) === activeTab;
    });
  }, [activeSourceList, activeTab, activeJalur]);

  // Live Program BK aggregation strictly from filled Evaluasi Layanan
  const live4BidangFromEvals = useMemo(() => {
    const defaults = getCurrentPeriodDefaults();
    const sem: 'Ganjil' | 'Genap' =
      semesterFilter === 'Ganjil' || semesterFilter === 'Genap' ? semesterFilter : defaults.semester;
    const ta = tahunAjaranFilter === 'Semua' ? defaults.tahunAjaran : tahunAjaranFilter;
    return computeProgramFromServiceEvaluations({
      services,
      serviceEvaluations: serviceEvalRecords,
      semester: sem,
      tahunAjaran: ta,
      classFilter,
      activeCounselor,
    });
  }, [services, serviceEvalRecords, semesterFilter, tahunAjaranFilter, classFilter, activeCounselor]);

  // Live direct count of real services for the active Tab + Period Filter (for header metadata only)
  const activeTabDirectAggregation = useMemo(() => {
    const sem: 'Ganjil' | 'Genap' | 'Semua' =
      semesterFilter === 'Ganjil' || semesterFilter === 'Genap' ? semesterFilter : 'Semua';
    return aggregateServicesForProgramPeriod(
      services,
      activeTab,
      sem,
      tahunAjaranFilter,
      classFilter
    );
  }, [services, activeTab, semesterFilter, tahunAjaranFilter, classFilter]);

  const unevaluatedTabServices = useMemo(() => {
    return filteredServices.filter((srv) => {
      if (mapServiceToEvaluationBidang(srv) !== activeTab) return false;
      if (evaluatedServiceIds.has(srv.id)) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const hay = `${srv.problem || ''} ${srv.serviceType || ''} ${(srv.students || [])
          .map((s) => `${s.name} ${s.class}`)
          .join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filteredServices, activeTab, evaluatedServiceIds, searchTerm]);

  const tabCounts = useMemo(() => {
    const map: Record<StandardEvaluationBidang, { evals: number; services: number }> = {
      'Layanan Dasar': { evals: 0, services: 0 },
      'Layanan Responsif': { evals: 0, services: 0 },
      'Perencanaan Individual': { evals: 0, services: 0 },
      'Dukungan Sistem': { evals: 0, services: 0 },
    };
    activeSourceList.forEach((ev) => {
      if (activeJalur === 'program' && isMultiBidangProgramEval(ev)) {
        STANDARD_EVALUATION_BIDANG.forEach((b) => {
          map[b].evals += 1;
        });
      } else {
        map[normalizeBidangTab(ev.bidang)].evals += 1;
      }
    });
    filteredServices.forEach((srv) => {
      map[mapServiceToEvaluationBidang(srv)].services += 1;
    });
    return map;
  }, [activeSourceList, filteredServices, activeJalur]);

  // Handlers for Jalur 1 (Evaluasi Layanan)
  const handleOpenServiceWizard = (presetSrv?: CounselingService | null) => {
    setActiveJalur('layanan');
    setEditingServiceEval(null);
    setPresetServiceForWizard(presetSrv || null);
    setIsServiceWizardOpen(true);
  };

  const handleOpenEditServiceWizard = (ev: ProgramEvaluation) => {
    setPresetServiceForWizard(null);
    setEditingServiceEval(ev);
    setIsServiceWizardOpen(true);
  };

  const handleSaveServiceFromWizard = (
    savedEval: ProgramEvaluation,
    printPdfAfterSave?: boolean
  ) => {
    const payload: ProgramEvaluation = { ...savedEval, evaluationScope: 'layanan' };
    if (onSaveServiceEvaluation) {
      onSaveServiceEvaluation(payload);
    } else {
      onSaveEvaluation(payload);
    }
    setIsServiceWizardOpen(false);
    setEditingServiceEval(null);
    setPresetServiceForWizard(null);
    setActiveJalur('layanan');
    showToast('Evaluasi Layanan berhasil disimpan!', 'success');
    if (printPdfAfterSave) {
      downloadSingleEvaluationCardPDF(payload, activeCounselor);
    }
  };

  // Handlers for Jalur 2 (Evaluasi Program BK)
  const handleOpenProgramWizard = () => {
    setActiveJalur('program');
    setEditingProgramEval(null);
    setIsProgramWizardOpen(true);
  };

  const handleOpenEditProgramWizard = (ev: ProgramEvaluation) => {
    setEditingProgramEval(ev);
    setIsProgramWizardOpen(true);
  };

  const handleSaveProgramFromWizard = (
    savedEval: ProgramEvaluation,
    printPdfAfterSave?: boolean
  ) => {
    const payload: ProgramEvaluation = { ...savedEval, evaluationScope: 'program', serviceId: '' };
    onSaveEvaluation(payload);
    setIsProgramWizardOpen(false);
    setEditingProgramEval(null);
    setActiveJalur('program');
    showToast('Evaluasi Program BK berhasil disimpan!', 'success');
    if (printPdfAfterSave) {
      downloadSingleEvaluationCardPDF(payload, activeCounselor);
    }
  };

  const handleQuickUpdateFollowUpStatus = (
    ev: ProgramEvaluation,
    nextStatus: EvaluationFollowUpStatus
  ) => {
    const updated: ProgramEvaluation = {
      ...ev,
      statusTindakLanjut: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    const isProgramItem = isProgramScopeEval(ev);
    if (!isProgramItem && !legacyProgramIdsForService.has(ev.id) && onSaveServiceEvaluation) {
      onSaveServiceEvaluation(updated);
    } else {
      onSaveEvaluation(updated);
    }
    showToast(`Status tindak lanjut diperbarui ke "${nextStatus}".`, 'success');
  };

  const handleQuickUpdateCaseStatus = (
    ev: ProgramEvaluation,
    nextCaseStatus: CaseFinalStatus,
    alasan?: string
  ) => {
    const updated: ProgramEvaluation = {
      ...ev,
      statusAkhirKasus: nextCaseStatus,
      alasanTidakTertangani:
        nextCaseStatus === 'Tidak Tertangani' ? alasan || ev.alasanTidakTertangani || 'Di Luar Kewenangan BK' : '',
      updatedAt: new Date().toISOString(),
    };
    if (!legacyProgramIdsForService.has(ev.id) && onSaveServiceEvaluation) {
      onSaveServiceEvaluation(updated);
    } else {
      onSaveEvaluation(updated);
    }
    showToast(`Status akhir kasus diperbarui: "${nextCaseStatus}".`, 'success');
  };

  const handleDeleteClick = (ev: ProgramEvaluation) => {
    const isProgramItem = isProgramScopeEval(ev);
    if (!isProgramItem && !legacyProgramIdsForService.has(ev.id) && onDeleteServiceEvaluation) {
      onDeleteServiceEvaluation(ev.id);
    } else {
      onDeleteEvaluation(ev.id);
    }
  };

  const handlePrintGlobalPdf = () => {
    downloadGlobalEvaluationPDF({
      evaluations: filteredProgramEvaluations,
      serviceEvaluations: filteredServiceEvaluations,
      services: filteredServices,
      students: filteredStudents,
      journals: filteredJournals,
      activeCounselor,
      semesterFilter,
      tahunAjaranFilter,
      classFilter,
    });
  };

  const handleExportKepsekPdf = () => {
    downloadKepsekReportPDF({
      tahunAjaran: activeNeedTa,
      semester: activeNeedSemester,
      rencanaTahunan: activeRencanaTahunan,
      services,
      serviceEvaluations: serviceEvalRecords,
      programEvaluations: programEvalRecords,
      activeCounselor,
    });
  };

  const handleExportExcel = () => {
    exportBKProgramToExcel({
      tahunAjaran: activeNeedTa,
      semester: activeNeedSemester,
      rencanaTahunan: activeRencanaTahunan,
      services,
      serviceEvaluations: serviceEvalRecords,
      programEvaluations: programEvalRecords,
    });
  };

  const followUpStatusClass = (status: EvaluationFollowUpStatus) => {
    if (status === 'Selesai' || status === 'Sudah Ditindaklanjuti') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (status === 'Tidak Berhasil' || status === 'Perlu Rujukan') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (status === 'Belum Dikerjakan') {
      return 'bg-slate-100 text-slate-700 border-slate-300';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const handleSaveFollowUpCheckModal = (updatedEval: ProgramEvaluation) => {
    const isProgramItem = isProgramScopeEval(updatedEval);
    if (!isProgramItem && !legacyProgramIdsForService.has(updatedEval.id) && onSaveServiceEvaluation) {
      onSaveServiceEvaluation(updatedEval);
    } else {
      onSaveEvaluation(updatedEval);
    }
    setFollowUpModalEval(null);
    showToast(
      `Follow-up tersimpan! Status: ${updatedEval.statusTindakLanjut} (Delta ${
        (updatedEval.followUpCheck?.delta ?? 0) >= 0 ? '+' : ''
      }${updatedEval.followUpCheck?.delta?.toFixed(2) ?? '0.00'})`,
      'success'
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-[100px]">
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-[#00685f] border border-[#bcc9c6]/50 rounded-xl text-sm font-bold shadow-2xs transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>
      )}

      {/* Top Header Banner */}
      <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 shadow-2xs p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#e6f4f1] border border-[#00685f]/20 text-[#00685f] flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#00685f]/10 px-2.5 py-0.5 rounded-md border border-[#00685f]/15">
              2 Jalur Evaluasi Sejajar &amp; Mandiri
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0b1c30] tracking-tight mt-1">
              Evaluasi Layanan &amp; Program BK
            </h1>
            <p className="text-xs sm:text-sm text-[#3d4947] mt-1 max-w-2xl">
              Pilih langsung jalur evaluasi yang Anda butuhkan: Evaluasi per Sesi Layanan atau Evaluasi Program BK per Bidang &amp; Periode secara mandiri.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
          <button
            type="button"
            onClick={handleExportKepsekPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Export PDF Kepsek</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#e6f4f1] text-[#00685f] border border-[#00685f]/40 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handlePrintGlobalPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#0b1c30] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Laporan Lengkap</span>
          </button>
        </div>
      </div>

      {/* 2 KARTU UTAMA SEJAJAR & MANDIRI (Menu Setara, Bukan Bertingkat) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kartu 1: Evaluasi Layanan */}
        <div
          onClick={() => handleOpenServiceWizard(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenServiceWizard(null);
            }
          }}
          className="bg-white hover:bg-[#e6f4f1]/35 rounded-2xl border-2 border-[#00685f]/30 hover:border-[#00685f] p-5 shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-4 group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f]">
                  Jalur 1 &middot; Per Kegiatan
                </span>
                <h2 className="text-lg font-extrabold text-[#0b1c30] mt-0.5">
                  Evaluasi Layanan
                </h2>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-1 leading-relaxed">
                  Menilai pelaksanaan dan hasil layanan individual, kelompok, atau klasikal langsung dari daftar layanan BK.
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-[#00685f] bg-[#e6f4f1] px-2.5 py-1 rounded-xl shrink-0 tabular-nums">
              {serviceEvalRecords.length} Dok
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-[#3d4947] tabular-nums">
              {services.length} layanan real tersedia
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00685f] group-hover:bg-[#005049] text-white text-xs font-bold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Mulai Evaluasi Layanan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>

        {/* Kartu 2: Evaluasi Program BK */}
        <div
          onClick={handleOpenProgramWizard}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenProgramWizard();
            }
          }}
          className="bg-white hover:bg-slate-50/90 rounded-2xl border-2 border-[#0b1c30]/25 hover:border-[#0b1c30] p-5 shadow-2xs transition-all cursor-pointer flex flex-col justify-between gap-4 group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#0b1c30] text-white flex items-center justify-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0b1c30]">
                  Jalur 2 &middot; Mandiri 4 Bidang Sekaligus
                </span>
                <h2 className="text-lg font-extrabold text-[#0b1c30] mt-0.5">
                  Evaluasi Program BK
                </h2>
                <p className="text-xs sm:text-sm text-[#3d4947] mt-1 leading-relaxed">
                  Langsung evaluasi 4 Bidang Program BK sekaligus per Semester/Tahun Ajaran; seluruh data layanan &amp; siswa unik disinkronkan otomatis dari database.
                </p>
              </div>
            </div>
            <span className="text-xs font-extrabold text-[#0b1c30] bg-gray-100 px-2.5 py-1 rounded-xl shrink-0 tabular-nums">
              {programEvalRecords.length} Dok
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-[#3d4947]">
              Tanpa syarat Evaluasi Layanan terlebih dahulu
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b1c30] group-hover:bg-slate-800 text-white text-xs font-bold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Mulai Evaluasi Program</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan Global OTOMATIS dari Evaluasi Layanan (6 Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Layanan Real</span>
            <Layers className="w-4 h-4 text-[#00685f]" />
          </div>
          <p className="text-2xl font-extrabold text-[#0b1c30] mt-2 tabular-nums">
            {globalStats.totalServicesCount}
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5 tabular-nums">
            {globalStats.evaluatedInFilterCount} dinilai &middot; {globalStats.unevaluatedInFilterCount} belum
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Rata 6 Skor</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-[#00685f] mt-2 tabular-nums">
            {globalStats.avg6Skor}
            <span className="text-xs font-semibold text-[#3d4947]"> / 5</span>
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5">Dari Evaluasi Layanan</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delta Follow-up</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p
            className={`text-2xl font-extrabold mt-2 tabular-nums ${
              globalStats.avgDelta === null
                ? 'text-slate-400'
                : globalStats.avgDelta > 0
                  ? 'text-emerald-600'
                  : 'text-amber-600'
            }`}
          >
            {globalStats.avgDelta === null
              ? 'Belum'
              : `${globalStats.avgDelta >= 0 ? '+' : ''}${globalStats.avgDelta.toFixed(2)}`}
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5">Baseline ke Cek 14 Hari</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">RTL Selesai</span>
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-[#0b1c30] mt-2 tabular-nums">
            {globalStats.pctTindakLanjutSelesai}%
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5 tabular-nums">
            {globalStats.ongoingFollowUps} tindak lanjut aktif
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cek 14 Hari</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2 tabular-nums">
            {globalStats.due14DaysCount}
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5">Perlu cek ulang</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs">
          <div className="flex items-center justify-between text-[#3d4947]">
            <span className="text-[11px] font-bold uppercase tracking-wider">Siswa &amp; Jurnal</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold text-[#0b1c30] mt-2 tabular-nums">
            {globalStats.totalStudentsCount}
          </p>
          <p className="text-[11px] text-[#3d4947] mt-0.5 tabular-nums">
            {globalStats.totalJournalsCount} jurnal tercatat
          </p>
        </div>
      </div>

      {/* Filter Periode (Semester, Tahun Ajaran) & Kelas */}
      <div className="bg-white p-4 rounded-2xl border border-[#bcc9c6]/40 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#0b1c30]">
          <Filter className="w-4 h-4 text-[#00685f]" />
          <span>Filter Periode &amp; Kelas</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#3d4947] mb-1">
              Semester
            </label>
            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-[#f8faf9] text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            >
              <option value="Semua">Semua Semester</option>
              <option value="Ganjil">Semester Ganjil (Jul – Des)</option>
              <option value="Genap">Semester Genap (Jan – Jun)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#3d4947] mb-1">
              Tahun Ajaran
            </label>
            <select
              value={tahunAjaranFilter}
              onChange={(e) => setTahunAjaranFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-[#f8faf9] text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            >
              <option value="Semua">Semua Tahun Ajaran</option>
              {availableTahunAjaran.map((ta) => (
                <option key={ta} value={ta}>
                  {ta}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#3d4947] mb-1">
              Kelas
            </label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-[#f8faf9] text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
            >
              <option value="Semua">Semua Kelas</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-[#3d4947] mb-1">
              Cari Program / Hasil
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari program atau kendala..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-[#f8faf9] text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pemilih Arsip Jalur (Setara & Terpisah) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="bg-gray-100 p-1.5 rounded-2xl inline-grid grid-cols-2 gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveJalur('program')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeJalur === 'program'
                ? 'bg-[#0b1c30] text-white shadow-2xs'
                : 'text-[#3d4947] hover:bg-white/70'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Evaluasi Program BK ({filteredProgramEvaluations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveJalur('layanan')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeJalur === 'layanan'
                ? 'bg-[#00685f] text-white shadow-2xs'
                : 'text-[#3d4947] hover:bg-white/70'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Evaluasi Layanan ({filteredServiceEvaluations.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            activeJalur === 'program' ? handleOpenProgramWizard() : handleOpenServiceWizard(null)
          }
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>
            {activeJalur === 'program' ? 'Tambah Evaluasi Program BK' : 'Tambah Evaluasi Layanan'}
          </span>
        </button>
      </div>

      {/* 4 Tab Bidang Program BK */}
      <div className="bg-gray-100 p-1.5 rounded-2xl grid grid-cols-2 lg:grid-cols-4 gap-1.5">
        {STANDARD_EVALUATION_BIDANG.map((tab) => {
          const isActive = activeTab === tab;
          const counts = tabCounts[tab];
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isActive
                  ? 'bg-[#00685f] text-white shadow-2xs'
                  : 'text-[#3d4947] hover:bg-white/70'
              }`}
            >
              <span className="truncate">{tab}</span>
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg tabular-nums shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white text-[#0b1c30]'
                }`}
              >
                {counts.evals}
              </span>
            </button>
          );
        })}
      </div>

      {/* Daftar Evaluasi pada Tab Aktif */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0b1c30]">
              {activeJalur === 'program'
                ? `Arsip Evaluasi Program BK — ${activeTab}`
                : `Arsip Evaluasi Layanan — ${activeTab}`}
            </h2>
            <p className="text-xs text-[#3d4947] tabular-nums">
              {tabEvaluations.length} dokumen tercatat &middot; {activeTabDirectAggregation.totalServices}{' '}
              layanan real ({activeTabDirectAggregation.totalStudentsServed} siswa dilayani) pada filter ini
            </p>
          </div>
        </div>

        {/* Rencana Program Tahunan (Kalkulasi AI — Tanpa Asesmen Awal) + Live Direct Aggregation Banner */}
        {activeJalur === 'program' && (
          <div className="space-y-4">
            <RencanaTahunanCard
              tahunAjaran={activeNeedTa}
              programEvaluations={evaluations}
              serviceEvaluations={serviceEvalRecords}
              services={services}
              activeCounselor={activeCounselor}
              onSaveEvaluation={onSaveEvaluation}
            />

            <div className="p-4 rounded-2xl bg-[#e6f4f1]/60 border border-[#00685f]/25 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                    Agregasi Evaluasi Program BK — Dari Evaluasi Layanan ({live4BidangFromEvals.semester}{' '}
                    {live4BidangFromEvals.tahunAjaran})
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-[#0b1c30] tabular-nums">
                    {live4BidangFromEvals.evaluatedServicesCount} Dinilai /{' '}
                    {live4BidangFromEvals.totalServicesInPeriod} Total (
                    {live4BidangFromEvals.servicesTerlaksana} Terlaksana ·{' '}
                    {live4BidangFromEvals.servicesDibatalkan} Batal) &middot; Rata 6 Skor:{' '}
                    {live4BidangFromEvals.rata6SkorGlobal.toFixed(2)}/5
                  </p>
                  <p className="text-[11px] font-bold text-[#00685f] tabular-nums">
                    Total Kasus: {live4BidangFromEvals.caseSummary.totalKasus} &middot; Tuntas:{' '}
                    {live4BidangFromEvals.caseSummary.tuntas} &middot; Masih Berproses:{' '}
                    {live4BidangFromEvals.caseSummary.masihBerproses} &middot; Dirujuk:{' '}
                    {live4BidangFromEvals.caseSummary.dirujuk} &middot; Tidak Tertangani:{' '}
                    {live4BidangFromEvals.caseSummary.tidakTertangani}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenProgramWizard}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0b1c30] hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0 self-start sm:self-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Susun Evaluasi Program (4 Bidang)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 tabular-nums">
                {STANDARD_EVALUATION_BIDANG.map((bName) => {
                  const b = live4BidangFromEvals.bidangBuckets[bName];
                  return (
                    <div
                      key={bName}
                      className="bg-white/90 px-3 py-2 rounded-xl border border-[#bcc9c6]/40 text-xs"
                    >
                      <p className="font-bold text-[#0b1c30] truncate">{bName}</p>
                      <p className="text-[11px] font-semibold text-[#00685f]">
                        {b.evaluatedCount}/{b.totalServices} Dinilai &middot; Skor {b.rata6Skor.toFixed(2)}/5
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tabEvaluations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#bcc9c6]/40 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#e6f4f1] text-[#00685f] flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-extrabold text-[#0b1c30]">
                {activeJalur === 'program'
                  ? `Belum Ada Evaluasi Program BK pada Bidang ${activeTab}`
                  : `Belum Ada Evaluasi Layanan pada Bidang ${activeTab}`}
              </h3>
              <p className="text-xs sm:text-sm text-[#3d4947]">
                {activeJalur === 'program'
                  ? 'Evaluasi Program BK dapat dibuat langsung tanpa menunggu Evaluasi Layanan selesai. Data layanan otomatis teragregasi dari periode yang Anda pilih.'
                  : 'Mulai evaluasi per layanan dari daftar layanan real di bawah ini atau buat melalui Wizard Evaluasi Layanan.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                activeJalur === 'program'
                  ? handleOpenProgramWizard()
                  : handleOpenServiceWizard(null)
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {activeJalur === 'program'
                  ? 'Buat Evaluasi Program Pertama'
                  : 'Buat Evaluasi Layanan Pertama'}
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {tabEvaluations.map((ev) => {
              const pct = computeEvaluationPercentage(ev.realisasi, ev.target);
              const evidences = getNormalizedEvidenceList(ev.buktiFoto);
              const isProg = isProgramScopeEval(ev);
              return (
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl border border-[#bcc9c6]/50 shadow-2xs overflow-hidden"
                >
                  <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-bold text-[#00685f]">{ev.bidang}</span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="font-semibold text-[#0b1c30]">
                          {isProg ? 'Evaluasi Program BK' : 'Evaluasi Layanan'}
                        </span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="font-medium text-[#3d4947] tabular-nums">
                          {formatTanggalIndonesia(ev.tanggal)}
                        </span>
                        <span className="text-gray-300">&middot;</span>
                        <span className="font-semibold text-[#0b1c30]">
                          {ev.kelas || 'Semua Kelas'}
                        </span>
                        {ev.semester && (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-[#3d4947]">
                              {ev.semester} {ev.tahunAjaran}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-[#0b1c30]">{ev.namaProgram}</h3>
                      {ev.aggregatedSummary && (
                        <p className="text-[11px] font-semibold text-[#00685f] tabular-nums">
                          Agregasi Services: {ev.aggregatedSummary.totalServices} Layanan &middot;{' '}
                          {ev.aggregatedSummary.totalStudentsServed} Siswa Dilayani
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border ${followUpStatusClass(
                          ev.statusTindakLanjut
                        )}`}
                      >
                        {ev.statusTindakLanjut}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadSingleEvaluationCardPDF(ev, activeCounselor)}
                        className="p-2 rounded-xl border border-[#bcc9c6]/60 text-[#0b1c30] hover:bg-gray-50 cursor-pointer"
                        title="Cetak Kartu Evaluasi PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          isProg
                            ? handleOpenEditProgramWizard(ev)
                            : handleOpenEditServiceWizard(ev)
                        }
                        className="p-2 rounded-xl border border-[#bcc9c6]/60 text-[#00685f] hover:bg-[#e6f4f1] cursor-pointer"
                        title="Edit Evaluasi"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(ev)}
                        className="p-2 rounded-xl border border-[#bcc9c6]/60 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus Evaluasi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
                    {/* Header Metrics Bar */}
                    {isProg ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8faf9] p-3 rounded-xl border border-[#bcc9c6]/30 tabular-nums">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Sudah vs Belum Dinilai
                          </span>
                          <span className="font-extrabold text-[#0b1c30]">
                            {ev.programMetrics?.evaluatedServicesCount ?? ev.realisasi} /{' '}
                            {ev.programMetrics?.totalServicesInPeriod ?? ev.realisasi} layanan
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Rata-rata 6 Skor
                          </span>
                          <span className="font-extrabold text-[#00685f]">
                            {Number(ev.nilai || 0).toFixed(2)} / 5
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Delta Follow-up
                          </span>
                          <span className="font-extrabold text-[#0b1c30]">
                            {ev.programMetrics?.rataRataDeltaFollowUp !== null &&
                            ev.programMetrics?.rataRataDeltaFollowUp !== undefined
                              ? `${ev.programMetrics.rataRataDeltaFollowUp >= 0 ? '+' : ''}${ev.programMetrics.rataRataDeltaFollowUp.toFixed(2)}`
                              : 'Belum Dicek'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            % RTL Selesai
                          </span>
                          <span className="font-extrabold text-emerald-700">
                            {ev.programMetrics?.persenTindakLanjutSelesai ?? pct ?? 0}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8faf9] p-3 rounded-xl border border-[#bcc9c6]/30 tabular-nums">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Konteks Masalah
                          </span>
                          <span className="font-extrabold text-[#0b1c30]">
                            {ev.jenisMasalah || '-'}
                            {ev.layananKeBerapa ? ` (Sesi #${ev.layananKeBerapa})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Teknik &amp; Tujuan
                          </span>
                          <span className="font-extrabold text-[#00685f]">
                            {ev.teknikDipakai || ev.jenisLayanan || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Skor 6 Dimensi
                          </span>
                          <span className="font-extrabold text-amber-600">
                            {ev.scores6
                              ? `${ev.scores6.totalSkor}/30 (${ev.scores6.rataRata}/5 · ${ev.scores6.kategori})`
                              : `${ev.nilai || 0} / 5 ★`}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                            Baseline &amp; Delta
                          </span>
                          <span className="font-extrabold text-[#0b1c30]">
                            {ev.baseline
                              ? `${(
                                  ev.baseline.skorKondisiAwal ??
                                  computeBaselineKondisiAwal(ev.baseline)
                                ).toFixed(2)}/5`
                              : '-'}
                            {ev.followUpCheck
                              ? ` → Δ ${ev.followUpCheck.delta >= 0 ? '+' : ''}${ev.followUpCheck.delta.toFixed(2)}`
                              : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Evaluasi Layanan Details: 6 Scores + Baseline Retrospektif + AI Otak Konselor + Follow-up Check */}
                    {!isProg && ev.scores6 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 tabular-nums">
                        {EVALUATION_6_SCORES_META.map((m) => (
                          <div
                            key={m.key}
                            className="p-2 rounded-xl bg-white border border-[#bcc9c6]/40 text-xs"
                          >
                            <p className="text-[10px] font-bold text-[#3d4947] truncate">{m.label}</p>
                            <p className="text-sm font-extrabold text-[#0b1c30] mt-0.5">
                              {ev.scores6?.[m.key] ?? '-'} / 5
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isProg && ev.baseline && (
                      <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/70 text-[11px] flex flex-wrap items-center justify-between gap-2 tabular-nums">
                        <span className="font-bold text-amber-900">
                          Baseline Retrospektif (Keparahan {ev.baseline.keparahan}/5 &middot; Frekuensi{' '}
                          {ev.baseline.frekuensi}/5 &middot; Motivasi Awal {ev.baseline.motivasiAwal}/5)
                        </span>
                        {ev.baseline.baselineDariIngatan && (
                          <span className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 font-bold text-[10px]">
                            baselineDariIngatan: true
                          </span>
                        )}
                      </div>
                    )}

                    {!isProg && ev.aiAnalysis && (
                      <div className="p-3.5 rounded-xl bg-[#e6f4f1]/50 border border-[#00685f]/25 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-[#00685f] inline-flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Analisis AI Otak Konselor</span>
                          </span>
                        </div>
                        <p className="text-[#0b1c30] leading-relaxed">
                          {ev.aiAnalysis.interpretasiKontekstual}
                        </p>
                        {ev.aiAnalysis.kekuatanSpesifik && (
                          <p className="text-[#3d4947]">
                            <strong className="text-[#0b1c30]">Kekuatan Spesifik:</strong>{' '}
                            {ev.aiAnalysis.kekuatanSpesifik}
                          </p>
                        )}
                        {ev.aiAnalysis.areaPerbaikanSpesifik && (
                          <p className="text-[#3d4947]">
                            <strong className="text-[#0b1c30]">Area Perbaikan:</strong>{' '}
                            {ev.aiAnalysis.areaPerbaikanSpesifik}
                          </p>
                        )}
                        {ev.aiAnalysis.rekomendasiTindakLanjut?.ringkasan && (
                          <p className="text-[#00685f] font-semibold">
                            <strong>Rekomendasi Tindak Lanjut:</strong>{' '}
                            {ev.aiAnalysis.rekomendasiTindakLanjut.ringkasan}
                          </p>
                        )}
                      </div>
                    )}

                    {!isProg && ev.followUpCheck && (
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex flex-wrap items-center justify-between gap-2 tabular-nums">
                        <div className="space-y-0.5">
                          <span className="font-extrabold text-emerald-900 block">
                            Hasil Cek Follow-up ({formatTanggalIndonesia(ev.followUpCheck.checkedAt)})
                          </span>
                          <span className="text-emerald-800">
                            Skor Sekarang: {ev.followUpCheck.skorPerubahanSekarang}/5 &middot;{' '}
                            {ev.followUpCheck.masalahBerulang
                              ? 'Masalah Berulang'
                              : 'Tidak Berulang'}{' '}
                            {ev.followUpCheck.catatan ? `· "${ev.followUpCheck.catatan}"` : ''}
                          </span>
                        </div>
                        <span className="font-extrabold text-sm text-emerald-700">
                          Delta: {ev.followUpCheck.delta >= 0 ? '+' : ''}
                          {ev.followUpCheck.delta.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Evaluasi Program Details (5 Lapisan Profesional) */}
                    {isProg && ev.aiCompletenessNotice && (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-semibold">
                        {ev.aiCompletenessNotice}
                      </div>
                    )}

                    {isProg && ev.programMetrics?.caseSummary && (
                      <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 text-xs tabular-nums flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-[#0b1c30]">
                          Rekap Kasus: Total {ev.programMetrics.caseSummary.totalKasus} · Tuntas{' '}
                          {ev.programMetrics.caseSummary.tuntas} · Berproses{' '}
                          {ev.programMetrics.caseSummary.masihBerproses} · Dirujuk{' '}
                          {ev.programMetrics.caseSummary.dirujuk} · Tidak Tertangani{' '}
                          {ev.programMetrics.caseSummary.tidakTertangani}
                        </span>
                      </div>
                    )}

                    {isProg && (ev.aiPerbandinganKebutuhan || ev.kebutuhanAwal?.kebutuhanUtama?.length) && (
                      <div className="p-3 rounded-xl bg-[#e6f4f1]/45 border border-[#00685f]/25 text-xs space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                          Kebutuhan Awal vs Realisasi
                        </span>
                        {ev.kebutuhanAwal?.kebutuhanUtama?.length ? (
                          <p className="font-bold text-[#0b1c30]">
                            Fokus Awal: {ev.kebutuhanAwal.kebutuhanUtama.join(' & ')} (
                            {ev.kebutuhanAwal.caraMenentukan})
                          </p>
                        ) : null}
                        {ev.aiPerbandinganKebutuhan && (
                          <p className="text-[#3d4947]">{ev.aiPerbandinganKebutuhan}</p>
                        )}
                      </div>
                    )}

                    {isProg && (ev.aiEvaluasiStakeholder || ev.suaraStakeholder) && (
                      <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/40 text-xs space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0b1c30] block">
                          Suara Stakeholder
                        </span>
                        <p className="text-[#3d4947]">
                          {ev.aiEvaluasiStakeholder ||
                            'Suara stakeholder belum terkumpul, evaluasi ini masih dari sudut pandang Guru BK saja.'}
                        </p>
                      </div>
                    )}

                    {isProg && ev.rencanaPerbaikan && (
                      <div className="p-3 rounded-xl bg-[#f8faf9] border border-[#00685f]/25 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <p>
                          <strong className="text-emerald-800">Lanjutkan:</strong>{' '}
                          {ev.rencanaPerbaikan.lanjutkan || '-'}
                        </p>
                        <p>
                          <strong className="text-rose-800">Hentikan:</strong>{' '}
                          {ev.rencanaPerbaikan.hentikan || '-'}
                        </p>
                        <p>
                          <strong className="text-amber-800">Ubah:</strong>{' '}
                          {ev.rencanaPerbaikan.ubah || '-'}
                        </p>
                        <p>
                          <strong className="text-[#0b1c30]">Butuh Dukungan:</strong>{' '}
                          {ev.rencanaPerbaikan.butuhDukungan || '-'}
                        </p>
                      </div>
                    )}

                    {isProg &&
                      Array.isArray(ev.aiProgramPerMasalah) &&
                      ev.aiProgramPerMasalah.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                            Analisis Program per Jenis Masalah
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {ev.aiProgramPerMasalah.map((item) => (
                              <div
                                key={item.jenisMasalah}
                                className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/40 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <strong className="text-[#0b1c30]">{item.jenisMasalah}</strong>
                                </div>
                                <p className="text-[#3d4947]">{item.ringkasanEvaluasi}</p>
                                <p className="text-[#00685f] font-semibold">
                                  Rekomendasi: {item.rekomendasiStrategis}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {Array.isArray(ev.bidangList) && ev.bidangList.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {ev.bidangList.map((bItem) => {
                          return (
                            <div
                              key={bItem.bidang}
                              className="p-2.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/40 text-xs space-y-0.5 tabular-nums"
                            >
                              <div className="flex items-center justify-between gap-1 font-extrabold text-[#0b1c30]">
                                <span className="truncate">{bItem.bidang}</span>
                                <span className="text-amber-600 shrink-0">{bItem.nilai}/5★</span>
                              </div>
                              <p className="text-[11px] font-semibold text-[#00685f]">
                                {bItem.totalServices} Evaluasi &middot; {bItem.realisasi} Siswa Unik
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs">
                      {ev.hasil && (
                        <p className="text-[#3d4947] leading-relaxed">
                          <strong className="text-[#0b1c30]">Hasil Singkat:</strong> {ev.hasil}
                        </p>
                      )}
                      {ev.kendala && (
                        <p className="text-[#3d4947] leading-relaxed">
                          <strong className="text-[#0b1c30]">Kendala:</strong> {ev.kendala}
                        </p>
                      )}
                      {ev.tindakLanjut && (
                        <p className="text-[#3d4947] leading-relaxed">
                          <strong className="text-[#0b1c30]">Tindak Lanjut:</strong> {ev.tindakLanjut}
                          {ev.penanggungJawabTindakLanjut && (
                            <span className="font-semibold text-[#0b1c30]">
                              {' '}
                              &middot; PJ: {ev.penanggungJawabTindakLanjut}
                            </span>
                          )}
                          {ev.tanggalTindakLanjut && (
                            <span className="text-[#00685f] font-semibold tabular-nums">
                              {' '}
                              (Rencana: {formatTanggalIndonesia(ev.tanggalTindakLanjut)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        {evidences.slice(0, 3).map((f, idx) => (
                          <div
                            key={idx}
                            className="w-12 h-10 rounded-lg border border-[#bcc9c6]/50 overflow-hidden bg-gray-50 flex items-center justify-center"
                            title={f.name}
                          >
                            {f.dataUrl.startsWith('data:image/') ? (
                              <img src={f.dataUrl} alt={f.name} className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-4 h-4 text-[#00685f]" />
                            )}
                          </div>
                        ))}
                        {!isProg && (
                          <button
                            type="button"
                            onClick={() => setFollowUpModalEval(ev)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                              isEvaluationDueFor14DayFollowUp(ev)
                                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                                : 'bg-[#e6f4f1] hover:bg-[#d3ece7] text-[#00685f] border-[#00685f]/30'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              {ev.followUpCheck
                                ? 'Edit Cek Follow-up'
                                : isEvaluationDueFor14DayFollowUp(ev)
                                  ? `Cek Follow-up (${getDaysSinceDate(ev.tanggal)} Hari)`
                                  : 'Cek Follow-up'}
                            </span>
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                          <span className="font-bold text-[#3d4947]">Status Tindak Lanjut:</span>
                          {EVALUATION_FOLLOWUP_STATUS_OPTIONS.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleQuickUpdateFollowUpStatus(ev, st)}
                              className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                                ev.statusTindakLanjut === st
                                  ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                                  : 'bg-white text-[#3d4947] border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>

                        {/* Lapisan 3: Status Akhir Kasus (hanya pada layanan yang SUDAH dievaluasi, dapat diubah kapan saja) */}
                        {!isProg && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-bold text-[#00685f]">Status Akhir Kasus:</span>
                            {STATUS_AKHIR_KASUS_OPTIONS.map((cs) => {
                              const resolvedCs = resolveServiceCaseFinalStatus(ev);
                              const activeCs = resolvedCs === cs;
                              return (
                                <button
                                  key={cs}
                                  type="button"
                                  onClick={() => handleQuickUpdateCaseStatus(ev, cs)}
                                  className={`px-2 py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                                    activeCs
                                      ? cs === 'Dirujuk ke Psikolog / Pihak Luar'
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : cs === 'Tidak Tertangani'
                                          ? 'bg-rose-600 text-white border-rose-600'
                                          : 'bg-[#00685f] text-white border-[#00685f]'
                                      : 'bg-white text-[#3d4947] border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  {cs}
                                </button>
                              );
                            })}
                            {resolveServiceCaseFinalStatus(ev) === 'Tidak Tertangani' && (
                              <select
                                value={ev.alasanTidakTertangani || ''}
                                onChange={(e) =>
                                  handleQuickUpdateCaseStatus(
                                    ev,
                                    'Tidak Tertangani',
                                    e.target.value
                                  )
                                }
                                className="px-2 py-1 rounded-lg border border-rose-300 bg-rose-50 text-[11px] font-bold text-rose-900"
                              >
                                <option value="">Alasan (Opsional)</option>
                                {ALASAN_TIDAK_TERTANGANI_OPTIONS.map((al) => (
                                  <option key={al} value={al}>
                                    {al}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Layanan Real pada Bidang ini yang Belum Dievaluasi (hanya pada tab Evaluasi Layanan) */}
        {activeJalur === 'layanan' && unevaluatedTabServices.length > 0 && (
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xs overflow-hidden mt-6">
            <div className="px-4 sm:px-5 py-3.5 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-[#0b1c30]">
                  Layanan Belum Dievaluasi ({activeTab})
                </h3>
                <p className="text-xs text-[#3d4947]">
                  Badge &quot;Belum Dievaluasi&quot; terkunci hingga Form Evaluasi Layanan diisi untuk layanan ini.
                </p>
              </div>
              <span className="text-xs font-extrabold text-amber-800 bg-white px-2.5 py-1 rounded-xl border border-amber-300 tabular-nums shrink-0">
                {unevaluatedTabServices.length} Belum Dievaluasi
              </span>
            </div>
            <div className="divide-y divide-gray-100 max-h-[340px] overflow-y-auto">
              {unevaluatedTabServices.slice(0, 15).map((srv) => (
                <div
                  key={srv.id}
                  className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[#f8faf9]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300">
                        Belum Dievaluasi
                      </span>
                      <p className="text-sm font-bold text-[#0b1c30] truncate">
                        {srv.problem || srv.serviceType}
                      </p>
                    </div>
                    <p className="text-xs text-[#3d4947] tabular-nums mt-0.5">
                      {srv.serviceType} &middot; {formatTanggalIndonesia(srv.date)} &middot; Kelas{' '}
                      {extractClassesFromService(srv)} &middot; {(srv.students || []).length} siswa
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenServiceWizard(srv)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold shrink-0 cursor-pointer self-start sm:self-center"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Nilai Sekarang</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Jalur 1 Wizard Modal: Evaluasi Layanan */}
      {isServiceWizardOpen && (
        <EvaluasiWizardModal
          isOpen={isServiceWizardOpen}
          onClose={() => {
            setIsServiceWizardOpen(false);
            setEditingServiceEval(null);
            setPresetServiceForWizard(null);
          }}
          onSave={handleSaveServiceFromWizard}
          services={services}
          activeCounselor={activeCounselor}
          initialEvaluation={editingServiceEval}
          presetService={presetServiceForWizard}
          availableClasses={availableClasses}
        />
      )}

      {/* Jalur 2 Wizard Modal: Evaluasi Program BK (Mandiri) */}
      {isProgramWizardOpen && (
        <EvaluasiProgramWizardModal
          isOpen={isProgramWizardOpen}
          onClose={() => {
            setIsProgramWizardOpen(false);
            setEditingProgramEval(null);
          }}
          onSave={handleSaveProgramFromWizard}
          services={services}
          serviceEvaluations={serviceEvalRecords}
          kebutuhanPlans={kebutuhanPlans}
          rencanaTahunan={activeRencanaTahunan}
          allProgramEvaluations={evaluations}
          onSaveKebutuhanPlan={onSaveEvaluation}
          onUpdateServiceEvaluation={(updatedEval) => {
            if (!legacyProgramIdsForService.has(updatedEval.id) && onSaveServiceEvaluation) {
              onSaveServiceEvaluation(updatedEval);
            } else {
              onSaveEvaluation(updatedEval);
            }
          }}
          activeCounselor={activeCounselor}
          initialEvaluation={editingProgramEval}
          presetBidang={activeTab}
          presetSemester={semesterFilter === 'Semua' ? undefined : semesterFilter}
          presetTahunAjaran={tahunAjaranFilter === 'Semua' ? undefined : tahunAjaranFilter}
          presetClassFilter={classFilter}
          availableClasses={availableClasses}
        />
      )}

      {/* Modal Cek Follow-up 14 Hari */}
      {followUpModalEval && (
        <FollowUpCheckModal
          isOpen={Boolean(followUpModalEval)}
          evaluation={followUpModalEval}
          onClose={() => setFollowUpModalEval(null)}
          onSave={handleSaveFollowUpCheckModal}
        />
      )}
    </div>
  );
}
