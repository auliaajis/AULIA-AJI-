import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Edit3,
  FileImage,
  FileText,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  CounselingService,
  Counselor,
  EvaluationEvidenceFile,
  EvaluationFollowUpStatus,
  ProgramAiPerProblemItem,
  ProgramBidangEvaluationItem,
  ProgramEvaluation,
} from '../types';
import {
  BIDANG_HEX_COLORS,
  DEFAULT_TAHUN_AJARAN_OPTIONS,
  EMPTY_BLOCK_PLACEHOLDER,
  EVALUATION_FOLLOWUP_STATUS_OPTIONS,
  EVALUATION_JENIS_MASALAH,
  KENDALA_TERBESAR_REFLEKSI_OPTIONS,
  ProgramFromEvaluationsResult,
  STANDARD_EVALUATION_BIDANG,
  StandardEvaluationBidang,
  Step2ProgramAiDrafts,
  UNCOLLECTED_PLACEHOLDER,
  buildKendalaPenjelasDraft,
  buildKendalaTailoredSupport,
  buildLocalStep2Drafts,
  compressImageToDataUrl,
  computeEvaluationPercentage,
  computeProgramFromServiceEvaluations,
  formatTanggalIndonesia,
  getActiveRencanaTahunan,
  getNormalizedEvidenceList,
  getCurrentPeriodDefaults,
  getTahunAjaranFromDate,
  hasRealStakeholderVoices,
  isLegacyJenisMasalah,
  isUncollectedPlaceholderText,
  mapJenisMasalahToBidang,
  mapLegacyProblemToStandardJenisMasalah,
  normalizeClassToken,
  syncProgramFromServiceEvaluations,
} from '../utils/evaluationHelpers';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { showToast } from '../utils/toast';
import {
  CounselorSemesterReflection,
  EvaluationJenisMasalah,
  InitialProgramNeedPlan,
  NextSemesterImprovementPlan,
  ProgramStakeholderVoices,
  RencanaTahunanData,
} from '../types';

interface EvaluasiProgramWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (evaluation: ProgramEvaluation, printPdfAfterSave?: boolean) => void;
  services: CounselingService[];
  serviceEvaluations?: ProgramEvaluation[];
  kebutuhanPlans?: ProgramEvaluation[];
  rencanaTahunan?: RencanaTahunanData | null;
  allProgramEvaluations?: ProgramEvaluation[];
  onSaveKebutuhanPlan?: (plan: ProgramEvaluation) => void;
  onUpdateServiceEvaluation?: (updatedEval: ProgramEvaluation) => void;
  activeCounselor: Counselor;
  initialEvaluation?: ProgramEvaluation | null;
  presetBidang?: string;
  presetSemester?: string;
  presetTahunAjaran?: string;
  presetClassFilter?: string;
  availableClasses: string[];
}

const STEP_TITLES = [
  { num: 1, label: 'Periode, Rencana & Data' },
  { num: 2, label: 'Draf AI: 4 Bidang, Refleksi & Rencana' },
  { num: 3, label: 'AI Evaluasi 5 Lapisan' },
  { num: 4, label: 'Rating & Bukti Kegiatan' },
  { num: 5, label: 'Preview 9 Bagian & Simpan' },
];

const EMOJI_RATINGS = [
  { value: 1, emoji: '😞', label: 'Kurang' },
  { value: 2, emoji: '😐', label: 'Cukup' },
  { value: 3, emoji: '🙂', label: 'Baik' },
  { value: 4, emoji: '😊', label: 'Puas' },
  { value: 5, emoji: '🤩', label: 'Sangat Puas' },
];

const buildDefaultProgramTitle = (semester: string, tahunAjaran: string): string =>
  `Evaluasi Program BK - Semester ${semester} ${tahunAjaran}`;

const buildBidangListFromEvalSync = (
  sync: ProgramFromEvaluationsResult,
  existingList?: ProgramBidangEvaluationItem[]
): ProgramBidangEvaluationItem[] => {
  const prevMap = new Map<string, ProgramBidangEvaluationItem>();
  (existingList || []).forEach((item) => {
    if (item && item.bidang) prevMap.set(item.bidang, item);
  });

  return STANDARD_EVALUATION_BIDANG.map((bidangName) => {
    const bucket = sync.bidangBuckets[bidangName];
    const prev = prevMap.get(bidangName);
    const derivedNilai =
      bucket.rata6Skor > 0 ? Math.max(1, Math.min(5, Math.round(bucket.rata6Skor))) : prev?.nilai || 0;
    return {
      bidang: bidangName,
      totalServices: bucket.totalServices,
      evaluatedCount: bucket.evaluatedCount,
      unevaluatedCount: bucket.unevaluatedCount,
      totalStudentsUnique: bucket.totalStudentsUnique,
      inPeriodCount: bucket.totalServices,
      outsidePeriodCount: 0,
      target: null,
      realisasi: bucket.totalStudentsUnique,
      nilai: derivedNilai,
      rata6Skor: bucket.rata6Skor,
      kondisiAwal: prev?.kondisiAwal || '',
      kondisiSetelah: prev?.kondisiSetelah || '',
      activityTitles: bucket.activityTitles.slice(0, 10),
    };
  });
};

export default function EvaluasiProgramWizardModal({
  isOpen,
  onClose,
  onSave,
  services,
  serviceEvaluations = [],
  kebutuhanPlans = [],
  rencanaTahunan,
  allProgramEvaluations = [],
  onUpdateServiceEvaluation,
  activeCounselor,
  initialEvaluation,
  presetSemester,
  presetTahunAjaran,
  presetClassFilter,
  availableClasses,
}: EvaluasiProgramWizardModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const schoolConfig = getSchoolConfig();
  const periodDefaults = getCurrentPeriodDefaults();

  const initialSemester: 'Ganjil' | 'Genap' =
    initialEvaluation?.semester === 'Genap' || initialEvaluation?.semester === 'Ganjil'
      ? initialEvaluation.semester
      : presetSemester === 'Genap' || presetSemester === 'Ganjil'
        ? presetSemester
        : periodDefaults.semester;

  const initialTa =
    initialEvaluation?.tahunAjaran ||
    (presetTahunAjaran && presetTahunAjaran !== 'Semua' ? presetTahunAjaran : '2026/2027');

  const initialClass =
    presetClassFilter && presetClassFilter !== 'Semua' ? presetClassFilter : 'Semua';

  const initialSync = computeProgramFromServiceEvaluations({
    services,
    serviceEvaluations,
    semester: initialSemester,
    tahunAjaran: initialTa,
    classFilter: initialClass,
    activeCounselor,
  });

  const [step, setStep] = useState<number>(1);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(initialClass);
  const [hasCustomTitle, setHasCustomTitle] = useState<boolean>(
    Boolean(
      initialEvaluation?.namaProgram &&
        !initialEvaluation.namaProgram.startsWith('Evaluasi Program BK - Semester')
    )
  );
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<ProgramFromEvaluationsResult>(initialSync);

  const [aiPerMasalah, setAiPerMasalah] = useState<ProgramAiPerProblemItem[]>(
    initialEvaluation?.aiProgramPerMasalah || []
  );
  const [aiCompletenessNotice, setAiCompletenessNotice] = useState<string>(
    initialEvaluation?.aiCompletenessNotice || ''
  );
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const matchedPeriodNeedPlan = useMemo(() => {
    return (kebutuhanPlans || []).find(
      (kp) =>
        kp.evaluationScope === 'kebutuhan-awal' &&
        (kp.semester || 'Ganjil') === initialSemester &&
        (kp.tahunAjaran || '2026/2027') === initialTa
    );
  }, [kebutuhanPlans, initialSemester, initialTa]);

  const [kebutuhanAwal, setKebutuhanAwal] = useState<InitialProgramNeedPlan>(() => {
    if (initialEvaluation?.kebutuhanAwal) return initialEvaluation.kebutuhanAwal;
    if (matchedPeriodNeedPlan?.kebutuhanAwal) return matchedPeriodNeedPlan.kebutuhanAwal;
    return {
      kebutuhanUtama: [],
      caraMenentukan: 'Angket Siswa',
    };
  });

  const [suaraStakeholder, setSuaraStakeholder] = useState<ProgramStakeholderVoices>(
    initialEvaluation?.suaraStakeholder || {
      suaraSiswa: '',
      suaraWaliKelas: '',
      suaraKepsekOrtu: '',
    }
  );

  const [refleksiKonselor, setRefleksiKonselor] = useState<CounselorSemesterReflection>(
    initialEvaluation?.refleksiKonselor || {
      teknikBerhasil: '',
      teknikGagalDiubah: '',
      kendalaTerbesar: '',
      kendalaPenjelas: '',
    }
  );

  const [rencanaPerbaikan, setRencanaPerbaikan] = useState<NextSemesterImprovementPlan>(
    initialEvaluation?.rencanaPerbaikan || {
      lanjutkan: '',
      hentikan: '',
      ubah: '',
      butuhDukungan: '',
    }
  );

  const [aiPerbandinganKebutuhan, setAiPerbandinganKebutuhan] = useState<string>(
    initialEvaluation?.aiPerbandinganKebutuhan || ''
  );
  const [aiEvaluasiStakeholder, setAiEvaluasiStakeholder] = useState<string>(
    initialEvaluation?.aiEvaluasiStakeholder || ''
  );
  const [aiInterpretasiKasus, setAiInterpretasiKasus] = useState<string>(
    initialEvaluation?.aiInterpretasiKasus || ''
  );
  const [aiEvaluasiRefleksi, setAiEvaluasiRefleksi] = useState<string>(
    initialEvaluation?.aiEvaluasiRefleksi || ''
  );

  const [formData, setFormData] = useState<ProgramEvaluation>(() => {
    const seededBidangList = buildBidangListFromEvalSync(
      initialSync,
      initialEvaluation?.bidangList
    );

    if (initialEvaluation) {
      return {
        ...initialEvaluation,
        bidang: 'Semua Bidang (4 Pilar BK)',
        namaProgram:
          initialEvaluation.namaProgram || buildDefaultProgramTitle(initialSemester, initialTa),
        buktiFoto: getNormalizedEvidenceList(initialEvaluation.buktiFoto),
        semester: initialSemester,
        tahunAjaran: initialTa,
        bidangList: seededBidangList,
      };
    }

    return {
      id: `eval-prog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serviceId: '',
      bidang: 'Semua Bidang (4 Pilar BK)',
      namaProgram: buildDefaultProgramTitle(initialSemester, initialTa),
      kelas:
        initialClass !== 'Semua'
          ? `Kelas ${initialClass}`
          : initialSync.classesSummary || 'Semua Kelas',
      target: null,
      realisasi: initialSync.totalUniqueStudents,
      kondisiAwal: '',
      kondisiSetelah: '',
      hasil: '',
      kendala: '',
      tindakLanjut: '',
      tanggalTindakLanjut: '',
      statusTindakLanjut: 'Belum Dikerjakan',
      nilai:
        initialSync.rata6SkorGlobal > 0
          ? Math.max(1, Math.min(5, Math.round(initialSync.rata6SkorGlobal)))
          : 0,
      feedbackSiswaNilai: 0,
      feedbackSiswaKomentar: '',
      feedbackWaliNama: '',
      feedbackWaliKomentar: '',
      buktiFoto: [],
      tanggal: todayIso,
      createdBy: activeCounselor.name || 'Guru BK',
      jenisLayanan: 'Evaluasi Program BK (Dari Evaluasi Layanan)',
      guruBk: activeCounselor.name || 'Guru BK',
      semester: initialSemester,
      tahunAjaran: initialTa,
      schoolId: getActiveSchoolId(),
      schoolName: schoolConfig.schoolName || 'SMP N 2 Susukan',
      counselorId: activeCounselor.id,
      evaluationScope: 'program',
      bidangList: seededBidangList,
    };
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Langkah 2 Assisted AI Drafts & Editing state
  const [step2DraftsCache, setStep2DraftsCache] = useState<Step2ProgramAiDrafts>(() =>
    buildLocalStep2Drafts({
      syncResult: initialSync,
      kebutuhanAwal: initialEvaluation?.kebutuhanAwal || matchedPeriodNeedPlan?.kebutuhanAwal,
      rencanaTahunan:
        initialEvaluation?.rencanaTahunan ||
        (allProgramEvaluations && allProgramEvaluations.length > 0
          ? getActiveRencanaTahunan(allProgramEvaluations, initialTa)
          : rencanaTahunan || getActiveRencanaTahunan([], initialTa)),
    })
  );
  const [isDraftingStep2, setIsDraftingStep2] = useState(false);
  const [lastDraftedSignature, setLastDraftedSignature] = useState<string>('');
  const [manualEditedKeys, setManualEditedKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    if (initialEvaluation) {
      (initialEvaluation.bidangList || []).forEach((b) => {
        if (!isUncollectedPlaceholderText(b.kondisiAwal)) keys.add(`bidang:${b.bidang}:awal`);
        if (!isUncollectedPlaceholderText(b.kondisiSetelah)) keys.add(`bidang:${b.bidang}:setelah`);
      });
      if (!isUncollectedPlaceholderText(initialEvaluation.suaraStakeholder?.suaraSiswa)) {
        keys.add('stakeholder:suaraSiswa');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.suaraStakeholder?.suaraWaliKelas)) {
        keys.add('stakeholder:suaraWaliKelas');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.suaraStakeholder?.suaraKepsekOrtu)) {
        keys.add('stakeholder:suaraKepsekOrtu');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.refleksiKonselor?.teknikBerhasil)) {
        keys.add('refleksi:teknikBerhasil');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.refleksiKonselor?.teknikGagalDiubah)) {
        keys.add('refleksi:teknikGagalDiubah');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.refleksiKonselor?.kendalaTerbesar)) {
        keys.add('refleksi:kendalaTerbesar');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.refleksiKonselor?.kendalaPenjelas)) {
        keys.add('refleksi:kendalaPenjelas');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.rencanaPerbaikan?.lanjutkan)) {
        keys.add('perbaikan:lanjutkan');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.rencanaPerbaikan?.hentikan)) {
        keys.add('perbaikan:hentikan');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.rencanaPerbaikan?.ubah)) {
        keys.add('perbaikan:ubah');
      }
      if (!isUncollectedPlaceholderText(initialEvaluation.rencanaPerbaikan?.butuhDukungan)) {
        keys.add('perbaikan:butuhDukungan');
      }
    }
    return keys;
  });
  const [editingFieldKeys, setEditingFieldKeys] = useState<Set<string>>(() => new Set());
  const [isFixLainnyaOpen, setIsFixLainnyaOpen] = useState(false);
  const [lainnyaReclassMap, setLainnyaReclassMap] = useState<Record<string, EvaluationJenisMasalah>>({});

  const currentSemester: 'Ganjil' | 'Genap' =
    formData.semester === 'Genap' ? 'Genap' : 'Ganjil';
  const currentTa = formData.tahunAjaran || '2026/2027';

  const activeRencanaForPeriod = useMemo<RencanaTahunanData>(() => {
    if (allProgramEvaluations && allProgramEvaluations.length > 0) {
      return getActiveRencanaTahunan(allProgramEvaluations, currentTa);
    }
    if (rencanaTahunan && rencanaTahunan.tahunAjaran === currentTa) {
      return rencanaTahunan;
    }
    return getActiveRencanaTahunan([], currentTa);
  }, [allProgramEvaluations, rencanaTahunan, currentTa]);

  useEffect(() => {
    if (initialEvaluation?.kebutuhanAwal) return;
    const found = (kebutuhanPlans || []).find(
      (kp) =>
        kp.evaluationScope === 'kebutuhan-awal' &&
        (kp.semester || 'Ganjil') === currentSemester &&
        (kp.tahunAjaran || '2026/2027') === currentTa
    );
    if (found?.kebutuhanAwal) {
      setKebutuhanAwal(found.kebutuhanAwal);
    }
  }, [currentSemester, currentTa, kebutuhanPlans, initialEvaluation?.kebutuhanAwal]);

  const runLiveSync = useCallback(
    async (
      targetSem: 'Ganjil' | 'Genap',
      targetTa: string,
      targetClass: string,
      showFeedbackToast: boolean
    ) => {
      setIsSyncing(true);
      try {
        const result = await syncProgramFromServiceEvaluations({
          semester: targetSem,
          tahunAjaran: targetTa,
          classFilter: targetClass,
          activeCounselor,
          fallbackServices: services,
          fallbackServiceEvaluations: serviceEvaluations,
        });
        setSyncResult(result);
        setFormData((prev) => {
          const nextBidangList = buildBidangListFromEvalSync(result, prev.bidangList);
          return {
            ...prev,
            bidang: 'Semua Bidang (4 Pilar BK)',
            semester: targetSem,
            tahunAjaran: targetTa,
            namaProgram: hasCustomTitle
              ? prev.namaProgram
              : buildDefaultProgramTitle(targetSem, targetTa),
            kelas:
              targetClass !== 'Semua'
                ? `Kelas ${targetClass}`
                : result.classesSummary || 'Semua Kelas',
            realisasi: result.totalUniqueStudents,
            nilai:
              result.rata6SkorGlobal > 0
                ? Math.max(1, Math.min(5, Math.round(result.rata6SkorGlobal)))
                : 0,
            bidangList: nextBidangList,
          };
        });
        if (showFeedbackToast) {
          showToast(
            `Tersinkron: ${result.evaluatedServicesCount} Evaluasi Layanan terisi (${result.unevaluatedServicesCount} layanan belum dievaluasi).`,
            'success'
          );
        }
      } catch (err) {
        console.error('Sinkronisasi program dari Evaluasi Layanan gagal:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [activeCounselor, hasCustomTitle, services, serviceEvaluations]
  );

  useEffect(() => {
    if (!isOpen) return;
    runLiveSync(currentSemester, currentTa, selectedClassFilter, false);
  }, [isOpen, currentSemester, currentTa, selectedClassFilter, runLiveSync]);

  const tahunAjaranOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_TAHUN_AJARAN_OPTIONS);
    services.forEach((s) => s.date && set.add(getTahunAjaranFromDate(s.date)));
    serviceEvaluations.forEach((e) => e.tanggal && set.add(getTahunAjaranFromDate(e.tanggal)));
    if (formData.tahunAjaran) set.add(formData.tahunAjaran);
    return Array.from(set).sort().reverse();
  }, [services, serviceEvaluations, formData.tahunAjaran]);

  const classOptionsForFilter = useMemo(() => {
    const set = new Set<string>(availableClasses.map((c) => normalizeClassToken(c)).filter(Boolean));
    services.forEach((s) =>
      (s.students || []).forEach((st) => {
        if (st.class) set.add(normalizeClassToken(st.class));
      })
    );
    return Array.from(set).sort();
  }, [availableClasses, services]);

  const applyStep2Drafts = useCallback(
    (drafts: Step2ProgramAiDrafts, forceOverwrite: boolean) => {
      setStep2DraftsCache(drafts);
      const edited = forceOverwrite ? new Set<string>() : manualEditedKeys;
      if (forceOverwrite) {
        setManualEditedKeys(new Set());
        setEditingFieldKeys(new Set());
      }

      setFormData((prev) => {
        const baseList =
          prev.bidangList && prev.bidangList.length === 4
            ? prev.bidangList
            : buildBidangListFromEvalSync(syncResult);
        const nextList = baseList.map((item) => {
          const d = drafts.bidangDrafts[item.bidang as StandardEvaluationBidang];
          if (!d) return { ...item, target: null };
          const kAwal = `bidang:${item.bidang}:awal`;
          const kSetelah = `bidang:${item.bidang}:setelah`;
          const shouldSetAwal =
            forceOverwrite || (!edited.has(kAwal) && !item.kondisiAwal.trim());
          const shouldSetSetelah =
            forceOverwrite || (!edited.has(kSetelah) && !item.kondisiSetelah.trim());
          return {
            ...item,
            target: null,
            kondisiAwal: shouldSetAwal ? d.kondisiAwal : item.kondisiAwal || d.kondisiAwal,
            kondisiSetelah: shouldSetSetelah
              ? d.kondisiSetelah
              : item.kondisiSetelah || d.kondisiSetelah,
          };
        });
        return { ...prev, bidangList: nextList };
      });

      setSuaraStakeholder((prev) => ({
        suaraSiswa:
          forceOverwrite || (!edited.has('stakeholder:suaraSiswa') && !prev.suaraSiswa?.trim())
            ? drafts.stakeholderDraft.suaraSiswa
            : prev.suaraSiswa || UNCOLLECTED_PLACEHOLDER,
        suaraWaliKelas:
          forceOverwrite ||
          (!edited.has('stakeholder:suaraWaliKelas') && !prev.suaraWaliKelas?.trim())
            ? drafts.stakeholderDraft.suaraWaliKelas
            : prev.suaraWaliKelas || UNCOLLECTED_PLACEHOLDER,
        suaraKepsekOrtu:
          forceOverwrite ||
          (!edited.has('stakeholder:suaraKepsekOrtu') && !prev.suaraKepsekOrtu?.trim())
            ? drafts.stakeholderDraft.suaraKepsekOrtu
            : prev.suaraKepsekOrtu || UNCOLLECTED_PLACEHOLDER,
      }));

      setRefleksiKonselor((prev) => ({
        teknikBerhasil:
          forceOverwrite ||
          (!edited.has('refleksi:teknikBerhasil') && !prev.teknikBerhasil?.trim())
            ? drafts.refleksiDraft.teknikBerhasil
            : prev.teknikBerhasil || EMPTY_BLOCK_PLACEHOLDER,
        teknikGagalDiubah:
          forceOverwrite ||
          (!edited.has('refleksi:teknikGagalDiubah') && !prev.teknikGagalDiubah?.trim())
            ? drafts.refleksiDraft.teknikGagalDiubah
            : prev.teknikGagalDiubah || EMPTY_BLOCK_PLACEHOLDER,
        kendalaTerbesar:
          forceOverwrite ||
          (!edited.has('refleksi:kendalaTerbesar') && !prev.kendalaTerbesar?.trim())
            ? drafts.refleksiDraft.kendalaTerbesar
            : prev.kendalaTerbesar || drafts.refleksiDraft.kendalaTerbesar,
        kendalaPenjelas:
          forceOverwrite ||
          (!edited.has('refleksi:kendalaPenjelas') && !prev.kendalaPenjelas?.trim())
            ? drafts.refleksiDraft.kendalaPenjelas
            : prev.kendalaPenjelas || EMPTY_BLOCK_PLACEHOLDER,
      }));

      setRencanaPerbaikan((prev) => ({
        lanjutkan:
          forceOverwrite || (!edited.has('perbaikan:lanjutkan') && !prev.lanjutkan?.trim())
            ? drafts.rencanaPerbaikanDraft.lanjutkan
            : prev.lanjutkan || EMPTY_BLOCK_PLACEHOLDER,
        hentikan:
          forceOverwrite || (!edited.has('perbaikan:hentikan') && !prev.hentikan?.trim())
            ? drafts.rencanaPerbaikanDraft.hentikan
            : prev.hentikan || EMPTY_BLOCK_PLACEHOLDER,
        ubah:
          forceOverwrite || (!edited.has('perbaikan:ubah') && !prev.ubah?.trim())
            ? drafts.rencanaPerbaikanDraft.ubah
            : prev.ubah || EMPTY_BLOCK_PLACEHOLDER,
        butuhDukungan:
          forceOverwrite ||
          (!edited.has('perbaikan:butuhDukungan') && !prev.butuhDukungan?.trim())
            ? drafts.rencanaPerbaikanDraft.butuhDukungan
            : prev.butuhDukungan || EMPTY_BLOCK_PLACEHOLDER,
      }));
    },
    [manualEditedKeys, syncResult]
  );

  const generateStep2Drafts = useCallback(
    async (forceOverwrite: boolean, showNotification: boolean) => {
      const localDrafts = buildLocalStep2Drafts({
        syncResult,
        kebutuhanAwal,
        rencanaTahunan: activeRencanaForPeriod,
      });
      // Instant deterministic fill so user never sees empty blanks
      applyStep2Drafts(localDrafts, forceOverwrite);

      const sig = `${currentSemester}|${currentTa}|${selectedClassFilter}|${syncResult.evaluatedServicesCount}|${syncResult.unevaluatedServicesCount}|${activeRencanaForPeriod.totalTarget}|${activeRencanaForPeriod.fokusUtama}`;
      setLastDraftedSignature(sig);
      setIsDraftingStep2(true);

      try {
        const res = await fetch('/api/gemini/draft-program-step2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            semester: currentSemester,
            tahunAjaran: currentTa,
            syncSummary: {
              totalServicesInPeriod: syncResult.totalServicesInPeriod,
              servicesTerlaksana: syncResult.servicesTerlaksana,
              servicesDibatalkan: syncResult.servicesDibatalkan,
              evaluatedServicesCount: syncResult.evaluatedServicesCount,
              unevaluatedServicesCount: syncResult.unevaluatedServicesCount,
              pendingFollowUpCount: syncResult.pendingFollowUpCount,
              rata6SkorGlobal: syncResult.rata6SkorGlobal,
              rataRataDeltaFollowUp: syncResult.rataRataDeltaFollowUp,
              persenTindakLanjutSelesai: syncResult.persenTindakLanjutSelesai,
              caseSummary: syncResult.caseSummary,
            },
            bidangBucketsSummary: STANDARD_EVALUATION_BIDANG.map((bName) => {
              const b = syncResult.bidangBuckets[bName];
              return {
                bidang: bName,
                totalServices: b.totalServices,
                evaluatedCount: b.evaluatedCount,
                unevaluatedCount: b.unevaluatedCount,
                rata6Skor: b.rata6Skor,
                avgKeparahan: b.avgKeparahan,
                avgFrekuensi: b.avgFrekuensi,
                avgMotivasiAwal: b.avgMotivasiAwal,
                avgDeltaFollowUp: b.avgDeltaFollowUp,
                followUpCheckedCount: b.followUpCheckedCount,
                persenRtlSelesai: b.persenRtlSelesai,
              };
            }),
            byJenisMasalah: syncResult.byJenisMasalah,
            byTeknik: syncResult.byTeknik,
            kebutuhanAwal,
            rencanaTahunan: activeRencanaForPeriod,
            sampleFeedbackSiswa: syncResult.sampleFeedbackSiswa,
            sampleFeedbackWali: syncResult.sampleFeedbackWali,
          }),
        });
        const json = await res.json();
        if (json?.bidangDrafts && json?.refleksiDraft && json?.rencanaPerbaikanDraft) {
          const mergedDrafts: Step2ProgramAiDrafts = {
            bidangDrafts: {
              'Layanan Dasar':
                json.bidangDrafts['Layanan Dasar'] || localDrafts.bidangDrafts['Layanan Dasar'],
              'Layanan Responsif':
                json.bidangDrafts['Layanan Responsif'] ||
                localDrafts.bidangDrafts['Layanan Responsif'],
              'Perencanaan Individual':
                json.bidangDrafts['Perencanaan Individual'] ||
                localDrafts.bidangDrafts['Perencanaan Individual'],
              'Dukungan Sistem':
                json.bidangDrafts['Dukungan Sistem'] || localDrafts.bidangDrafts['Dukungan Sistem'],
            },
            stakeholderDraft: json.stakeholderDraft || localDrafts.stakeholderDraft,
            refleksiDraft: json.refleksiDraft || localDrafts.refleksiDraft,
            rencanaPerbaikanDraft: json.rencanaPerbaikanDraft || localDrafts.rencanaPerbaikanDraft,
          };
          applyStep2Drafts(mergedDrafts, forceOverwrite);
          if (showNotification) {
            showToast('Seluruh draf Langkah 2 berhasil dibuat ulang oleh AI.', 'success');
          }
        }
      } catch (err) {
        console.warn('Step 2 AI draft fallback active:', err);
        if (showNotification) {
          showToast('Draf Langkah 2 disusun otomatis dari data lokal.', 'info');
        }
      } finally {
        setIsDraftingStep2(false);
      }
    },
    [
      activeRencanaForPeriod,
      applyStep2Drafts,
      currentSemester,
      currentTa,
      kebutuhanAwal,
      selectedClassFilter,
      syncResult,
    ]
  );

  useEffect(() => {
    if (!isOpen || step !== 2) return;
    const sig = `${currentSemester}|${currentTa}|${selectedClassFilter}|${syncResult.evaluatedServicesCount}|${syncResult.unevaluatedServicesCount}|${activeRencanaForPeriod.totalTarget}|${activeRencanaForPeriod.fokusUtama}`;
    if (sig !== lastDraftedSignature && !isDraftingStep2) {
      generateStep2Drafts(false, false);
    }
  }, [
    isOpen,
    step,
    currentSemester,
    currentTa,
    selectedClassFilter,
    syncResult.evaluatedServicesCount,
    syncResult.unevaluatedServicesCount,
    activeRencanaForPeriod.totalTarget,
    activeRencanaForPeriod.fokusUtama,
    lastDraftedSignature,
    isDraftingStep2,
    generateStep2Drafts,
  ]);

  if (!isOpen) return null;

  const activeBidangList: ProgramBidangEvaluationItem[] =
    formData.bidangList && formData.bidangList.length === 4
      ? formData.bidangList
      : buildBidangListFromEvalSync(syncResult);

  const totalTargetAllBidang =
    formData.target !== null && formData.target !== undefined && String(formData.target) !== ''
      ? Number(formData.target)
      : null;

  const overallRealisasi = syncResult.totalUniqueStudents;
  const overallPercentage = computeEvaluationPercentage(
    syncResult.totalServicesInPeriod,
    totalTargetAllBidang
  );

  const lainnyaEvaluations = syncResult.matchedEvaluations.filter((ev) => {
    const jm = String(ev.jenisMasalah || 'Lainnya').trim();
    return jm === 'Lainnya' || isLegacyJenisMasalah(jm);
  });

  const markManualEdited = (key: string) => {
    setManualEditedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const toggleEditingField = (key: string, forceOn?: boolean) => {
    setEditingFieldKeys((prev) => {
      const next = new Set(prev);
      if (forceOn === true) next.add(key);
      else if (forceOn === false) next.delete(key);
      else if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveLainnyaReclassification = async () => {
    if (!onUpdateServiceEvaluation) {
      showToast('Handler pembaruan evaluasi layanan belum tersedia.', 'warning');
      return;
    }
    let updatedCount = 0;
    lainnyaEvaluations.forEach((ev) => {
      const chosen = lainnyaReclassMap[ev.id];
      if (chosen && chosen !== 'Lainnya') {
        const nextBidang = mapJenisMasalahToBidang(chosen);
        onUpdateServiceEvaluation({
          ...ev,
          jenisMasalah: chosen,
          bidang: ev.bidang || nextBidang,
          updatedAt: new Date().toISOString(),
        });
        updatedCount += 1;
      }
    });
    if (updatedCount === 0) {
      showToast('Pilih kategori masalah baru (selain Lainnya) minimal pada 1 evaluasi.', 'warning');
      return;
    }
    setIsFixLainnyaOpen(false);
    showToast(`${updatedCount} klasifikasi masalah berhasil diperbarui.`, 'success');
    await runLiveSync(currentSemester, currentTa, selectedClassFilter, false);
  };

  const updateBidangItem = (
    bidangName: StandardEvaluationBidang,
    patch: Partial<ProgramBidangEvaluationItem>
  ) => {
    setFormData((prev) => {
      const currentList =
        prev.bidangList && prev.bidangList.length > 0
          ? prev.bidangList
          : buildBidangListFromEvalSync(syncResult);
      const updatedList = currentList.map((item) =>
        item.bidang === bidangName ? { ...item, ...patch, target: null } : item
      );
      return {
        ...prev,
        bidangList: updatedList,
      };
    });
  };

  const handlePeriodOrClassChange = (
    nextSemester: 'Ganjil' | 'Genap',
    nextTa: string,
    nextClass: string
  ) => {
    setSelectedClassFilter(nextClass);
    setFormData((prev) => ({
      ...prev,
      semester: nextSemester,
      tahunAjaran: nextTa,
      namaProgram: hasCustomTitle
        ? prev.namaProgram
        : buildDefaultProgramTitle(nextSemester, nextTa),
    }));
  };

  const handleGenerateAiPerMasalah = async () => {
    if (syncResult.evaluatedServicesCount === 0) {
      showToast(
        'Belum ada Evaluasi Layanan yang terisi pada periode ini untuk dianalisis AI.',
        'warning'
      );
      return;
    }
    setIsAnalyzingAi(true);
    try {
      const response = await fetch('/api/gemini/analyze-program-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semester: currentSemester,
          tahunAjaran: currentTa,
          totalServicesInPeriod: syncResult.totalServicesInPeriod,
          servicesTerlaksana: syncResult.servicesTerlaksana,
          servicesDibatalkan: syncResult.servicesDibatalkan,
          evaluatedServicesCount: syncResult.evaluatedServicesCount,
          unevaluatedServicesCount: syncResult.unevaluatedServicesCount,
          pendingFollowUpCount: syncResult.pendingFollowUpCount,
          byJenisMasalah: syncResult.byJenisMasalah,
          byTeknik: syncResult.byTeknik,
          rataRataDeltaFollowUp: syncResult.rataRataDeltaFollowUp,
          persenTindakLanjutSelesai: syncResult.persenTindakLanjutSelesai,
          kebutuhanAwal,
          suaraStakeholder,
          caseSummary: syncResult.caseSummary,
          refleksiKonselor,
        }),
      });
      const json = await response.json();
      if (json?.perMasalah) {
        setAiPerMasalah(json.perMasalah);
        setAiCompletenessNotice(json.completenessNotice || '');
        setAiPerbandinganKebutuhan(json.perbandinganKebutuhan || '');
        setAiEvaluasiStakeholder(json.evaluasiStakeholder || '');
        setAiInterpretasiKasus(json.interpretasiKasus || '');
        setAiEvaluasiRefleksi(json.evaluasiRefleksi || '');
        if (json.rencanaPerbaikan) {
          setRencanaPerbaikan((prev) => ({
            lanjutkan:
              !isUncollectedPlaceholderText(prev.lanjutkan)
                ? prev.lanjutkan
                : json.rencanaPerbaikan.lanjutkan || '',
            hentikan:
              !isUncollectedPlaceholderText(prev.hentikan)
                ? prev.hentikan
                : json.rencanaPerbaikan.hentikan || '',
            ubah:
              !isUncollectedPlaceholderText(prev.ubah)
                ? prev.ubah
                : json.rencanaPerbaikan.ubah || '',
            butuhDukungan:
              !isUncollectedPlaceholderText(prev.butuhDukungan)
                ? prev.butuhDukungan
                : json.rencanaPerbaikan.butuhDukungan || '',
          }));
        }
        const summaryJoined = [
          json.completenessNotice,
          json.perbandinganKebutuhan,
          ...json.perMasalah.map(
            (m: ProgramAiPerProblemItem) => `[${m.jenisMasalah}] ${m.ringkasanEvaluasi}`
          ),
        ]
          .filter(Boolean)
          .join('\n\n');
        const rtlJoined = json.perMasalah
          .map((m: ProgramAiPerProblemItem) => `[${m.jenisMasalah}] ${m.rekomendasiStrategis}`)
          .join('\n');
        setFormData((p) => ({
          ...p,
          hasil: summaryJoined,
          tindakLanjut: p.tindakLanjut || rtlJoined,
        }));
        showToast('Evaluasi Program 5 Lapisan & Draft Rencana Perbaikan selesai disusun AI.', 'success');
      }
    } catch (err) {
      console.error('AI program per problem error:', err);
      showToast('Gagal menghubungi layanan analisis program AI.', 'error');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const existing = getNormalizedEvidenceList(formData.buktiFoto);
    const remainingSlots = Math.max(0, 3 - existing.length);
    if (remainingSlots <= 0) {
      showToast('Maksimal 3 file bukti kegiatan.', 'warning');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const toProcess = files.slice(0, remainingSlots);
      const compressed: EvaluationEvidenceFile[] = [];
      for (const f of toProcess) {
        compressed.push(await compressImageToDataUrl(f));
      }
      setFormData((prev) => ({
        ...prev,
        buktiFoto: [...getNormalizedEvidenceList(prev.buktiFoto), ...compressed],
      }));
      showToast(`${compressed.length} lampiran bukti ditambahkan.`, 'success');
    } catch {
      showToast('Gagal memproses file lampiran.', 'error');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemoveEvidence = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      buktiFoto: getNormalizedEvidenceList(prev.buktiFoto).filter((_, i) => i !== index),
    }));
  };

  const handleFinalSave = (printPdf: boolean) => {
    if (!formData.namaProgram.trim()) {
      showToast('Judul Evaluasi Program BK wajib diisi.', 'warning');
      setStep(1);
      return;
    }

    const nowIso = new Date().toISOString();
    const isIncomplete =
      syncResult.unevaluatedServicesCount > 0 ||
      syncResult.pendingFollowUpCount > 0 ||
      syncResult.evaluatedServicesCount === 0;
    const computedNotice =
      aiCompletenessNotice ||
      (isIncomplete
        ? `Kesimpulan ini masih sementara karena ${syncResult.unevaluatedServicesCount} layanan belum dievaluasi / ${syncResult.pendingFollowUpCount} belum ada follow-up.`
        : `Seluruh ${syncResult.evaluatedServicesCount} layanan periode ${currentSemester} ${currentTa} telah dievaluasi.`);

    const schoolIdNow = formData.schoolId || getActiveSchoolId();
    const schoolNameNow = formData.schoolName || schoolConfig.schoolName || 'SMP N 2 Susukan';

    const hasStakeholder = hasRealStakeholderVoices(suaraStakeholder);
    const defaultStakeholderNotice = hasStakeholder
      ? aiEvaluasiStakeholder || 'Suara stakeholder telah dikumpulkan bersama evaluasi Guru BK.'
      : 'Suara stakeholder belum terkumpul, evaluasi ini masih dari sudut pandang Guru BK saja.';

    const finalDoc: ProgramEvaluation = {
      ...formData,
      id: formData.id || `eval-prog-${Date.now()}`,
      serviceId: '',
      bidang: 'Semua Bidang (4 Pilar BK)',
      namaProgram: formData.namaProgram.trim(),
      kelas: formData.kelas.trim() || 'Semua Kelas',
      target:
        totalTargetAllBidang !== null &&
        totalTargetAllBidang !== undefined &&
        String(totalTargetAllBidang) !== ''
          ? Number(totalTargetAllBidang)
          : null,
      realisasi: overallRealisasi,
      nilai:
        syncResult.rata6SkorGlobal > 0
          ? Math.max(1, Math.min(5, Math.round(syncResult.rata6SkorGlobal)))
          : formData.nilai || 0,
      semester: currentSemester,
      tahunAjaran: currentTa,
      tanggal: formData.tanggal || todayIso,
      createdBy: formData.createdBy || activeCounselor.name || 'Guru BK',
      guruBk: formData.guruBk || activeCounselor.name || 'Guru BK',
      jenisLayanan: 'Evaluasi Program BK (Agregasi Evaluasi Layanan)',
      schoolId: schoolIdNow,
      schoolName: schoolNameNow,
      counselorId: formData.counselorId || activeCounselor.id,
      createdAt: formData.createdAt || nowIso,
      updatedAt: nowIso,
      evaluationScope: 'program',
      bidangList: activeBidangList,
      rencanaTahunan: activeRencanaForPeriod,
      ...(initialEvaluation?.kebutuhanAwal || kebutuhanAwal.kebutuhanUtama.length > 0
        ? { kebutuhanAwal }
        : {}),
      suaraStakeholder,
      refleksiKonselor,
      rencanaPerbaikan,
      aiPerbandinganKebutuhan,
      aiEvaluasiStakeholder: defaultStakeholderNotice,
      aiInterpretasiKasus,
      aiEvaluasiRefleksi,
      programMetrics: {
        totalServicesInPeriod: syncResult.totalServicesInPeriod,
        servicesTerlaksana: syncResult.servicesTerlaksana,
        servicesDibatalkan: syncResult.servicesDibatalkan,
        servicesTerjadwal: syncResult.servicesTerjadwal,
        evaluatedServicesCount: syncResult.evaluatedServicesCount,
        unevaluatedServicesCount: syncResult.unevaluatedServicesCount,
        rataRataDeltaFollowUp: syncResult.rataRataDeltaFollowUp,
        followUpCheckedCount: syncResult.followUpCheckedCount,
        pendingFollowUpCount: syncResult.pendingFollowUpCount,
        persenTindakLanjutSelesai: syncResult.persenTindakLanjutSelesai,
        byJenisMasalah: syncResult.byJenisMasalah,
        byTeknik: syncResult.byTeknik,
        caseSummary: syncResult.caseSummary,
      },
      aiProgramPerMasalah: aiPerMasalah,
      aiCompletenessNotice: computedNotice,
      aggregatedSummary: {
        totalServices: syncResult.totalServicesInPeriod,
        totalStudentsServed: syncResult.totalUniqueStudents,
        totalServicesRead: syncResult.evaluatedServicesCount,
        syncedAt: syncResult.syncedAtFormatted,
        activityTitles: syncResult.matchedEvaluations
          .slice(0, 12)
          .map((e) => e.namaProgram),
      },
    };
    onSave(finalDoc, printPdf);
  };

  const evidenceList = getNormalizedEvidenceList(formData.buktiFoto);
  const isProgramIncomplete =
    syncResult.unevaluatedServicesCount > 0 ||
    syncResult.pendingFollowUpCount > 0 ||
    syncResult.evaluatedServicesCount === 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#0b1c30]/55 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl border border-[#bcc9c6]/50 shadow-xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header + Progress Bar */}
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-[#bcc9c6]/40 bg-[#f8faf9]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#00685f]">
                Evaluasi Program BK — Data Hanya Dari Evaluasi Layanan
              </p>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] tracking-tight">
                Langkah {step} dari 5 — {STEP_TITLES[step - 1].label}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#3d4947] hover:bg-gray-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3.5">
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[#0b1c30] transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {STEP_TITLES.map((item) => {
                const isActive = step === item.num;
                const isDone = step > item.num;
                return (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => setStep(item.num)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                        : isDone
                          ? 'bg-[#e6f4f1] text-[#00685f] border-[#00685f]/30'
                          : 'bg-white text-[#3d4947] border-[#bcc9c6]/40 opacity-75'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 tabular-nums ${
                        isActive
                          ? 'bg-white text-[#0b1c30]'
                          : isDone
                            ? 'bg-[#00685f] text-white'
                            : 'bg-gray-100 text-[#3d4947]'
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" /> : item.num}
                    </span>
                    <span className="text-[11px] font-bold truncate hidden sm:inline">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-white">
          {/* ==================== STEP 1 ==================== */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#bcc9c6]/40 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#0b1c30]">
                    <Calendar className="w-4 h-4 text-[#00685f]" />
                    <span>Periode Evaluasi Program BK (Semua 4 Bidang)</span>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => runLiveSync(currentSemester, currentTa, selectedClassFilter, true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Evaluasi Layanan'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">Semester</label>
                    <select
                      value={currentSemester}
                      onChange={(e) =>
                        handlePeriodOrClassChange(
                          e.target.value === 'Genap' ? 'Genap' : 'Ganjil',
                          currentTa,
                          selectedClassFilter
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    >
                      <option value="Ganjil">Semester Ganjil (1 Jul – 31 Des)</option>
                      <option value="Genap">Semester Genap (1 Jan – 30 Jun)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Tahun Ajaran
                    </label>
                    <select
                      value={currentTa}
                      onChange={(e) =>
                        handlePeriodOrClassChange(currentSemester, e.target.value, selectedClassFilter)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    >
                      {tahunAjaranOptions.map((ta) => (
                        <option key={ta} value={ta}>
                          {ta}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Filter Kelas (Opsional)
                    </label>
                    <select
                      value={selectedClassFilter}
                      onChange={(e) =>
                        handlePeriodOrClassChange(currentSemester, currentTa, e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    >
                      <option value="Semua">Semua Kelas Binaan</option>
                      {classOptionsForFilter.map((cls) => (
                        <option key={cls} value={cls}>
                          Kelas {cls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Judul Evaluasi Program BK
                    </label>
                    <input
                      type="text"
                      value={formData.namaProgram}
                      onChange={(e) => {
                        setHasCustomTitle(true);
                        setFormData((p) => ({ ...p, namaProgram: e.target.value }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Tanggal Evaluasi
                    </label>
                    <input
                      type="date"
                      value={formData.tanggal}
                      onChange={(e) => setFormData((p) => ({ ...p, tanggal: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm text-[#0b1c30]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">Guru BK</label>
                    <input
                      type="text"
                      value={formData.guruBk || formData.createdBy}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, guruBk: e.target.value, createdBy: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm text-[#0b1c30]"
                    />
                  </div>
                </div>
              </div>

              {/* TARGET RENCANA TAHUNAN vs REALISASI (SEMESTER INI — 4 BIDANG) */}
              <div className="p-4 rounded-2xl border border-[#00685f]/30 bg-[#f8faf9] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                      Rencana Tahunan {currentTa} vs Realisasi Semester {currentSemester}
                    </span>
                    <h4 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                      Target Semester (1/2 Target Tahunan) vs Layanan Terlaksana — 4 Bidang BK
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-[#e6f4f1] text-[#00685f] text-[11px] font-bold">
                      Fokus: {activeRencanaForPeriod.fokusUtama}
                    </span>
                    {activeRencanaForPeriod.isOverloaded && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold">
                        Beban Tahunan {activeRencanaForPeriod.totalTarget} (&gt;400)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 tabular-nums">
                  {STANDARD_EVALUATION_BIDANG.map((bName) => {
                    const annualTarget =
                      bName === 'Layanan Dasar'
                        ? activeRencanaForPeriod.targetLayananDasar
                        : bName === 'Layanan Responsif'
                          ? activeRencanaForPeriod.targetLayananResponsif
                          : bName === 'Perencanaan Individual'
                            ? activeRencanaForPeriod.targetPerencanaanIndividual
                            : activeRencanaForPeriod.targetDukunganSistem;
                    const semesterTarget = Math.max(1, Math.round((annualTarget || 0) / 2));
                    const bucket = syncResult.bidangBuckets[bName];
                    const realisasiCount = bucket?.totalServices || 0;
                    const pct = Math.round((realisasiCount / semesterTarget) * 100);
                    const barColor = BIDANG_HEX_COLORS[bName] || '#00685f';
                    const statusBadge =
                      pct >= 100
                        ? { label: 'Tercapai', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
                        : pct >= 70
                          ? { label: 'Sesuai Jalur', cls: 'bg-[#e6f4f1] text-[#00685f] border-[#00685f]/30' }
                          : { label: 'Belum', cls: 'bg-amber-100 text-amber-900 border-amber-300' };

                    return (
                      <div
                        key={bName}
                        className="p-3 rounded-xl bg-white border border-[#bcc9c6]/50 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: barColor }}
                            />
                            <p className="text-xs font-extrabold text-[#0b1c30] truncate">{bName}</p>
                          </div>
                          <span
                            className={`px-1.5 py-0.5 rounded-md border text-[10px] font-extrabold shrink-0 ${statusBadge.cls}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="font-extrabold text-[#0b1c30]">
                            {realisasiCount} / {semesterTarget} sesi
                          </span>
                          <span className="font-extrabold" style={{ color: barColor }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
                          />
                        </div>
                        <p className="text-[10px] text-[#3d4947]">
                          {bucket?.evaluatedCount || 0} dievaluasi · Target tahun: {annualTarget}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Warning if incomplete / empty */}
              {isProgramIncomplete && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">Status Kelengkapan Data Evaluasi Layanan:</p>
                    <p className="mt-0.5">
                      {syncResult.evaluatedServicesCount === 0
                        ? `Belum ada Evaluasi Layanan yang terisi pada Semester ${currentSemester} ${currentTa} (${syncResult.unevaluatedServicesCount} layanan belum dievaluasi). Skor & kesimpulan hanya ditarik dari Evaluasi Layanan yang sudah diisi.`
                        : `Kesimpulan masih bersifat sementara karena ${syncResult.unevaluatedServicesCount} layanan belum dievaluasi dan ${syncResult.pendingFollowUpCount} evaluasi belum memiliki cek follow-up 14 hari.`}
                    </p>
                  </div>
                </div>
              )}

              {/* 5 Key Program Metrics derived ONLY from Evaluasi Layanan */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
                <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
                  <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                    Terlaksana vs Batal
                  </span>
                  <p className="text-xl font-extrabold text-[#0b1c30] mt-1">
                    {syncResult.servicesTerlaksana} / {syncResult.servicesDibatalkan}
                  </p>
                  <p className="text-[11px] text-[#3d4947]">
                    Total {syncResult.totalServicesInPeriod} ({syncResult.servicesTerjadwal} terjadwal)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#e6f4f1]/60 border border-[#00685f]/25">
                  <span className="text-[10px] font-bold uppercase text-[#00685f] block">
                    Sudah vs Belum Dievaluasi
                  </span>
                  <p className="text-xl font-extrabold text-[#00685f] mt-1">
                    {syncResult.evaluatedServicesCount} / {syncResult.totalServicesInPeriod}
                  </p>
                  <p className="text-[11px] text-[#3d4947]">
                    {syncResult.unevaluatedServicesCount} layanan menunggu nilai
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
                  <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                    Rata-rata 6 Skor Global
                  </span>
                  <p className="text-xl font-extrabold text-[#0b1c30] mt-1">
                    {syncResult.rata6SkorGlobal > 0 ? `${syncResult.rata6SkorGlobal} / 5` : '0 / 5'}
                  </p>
                  <p className="text-[11px] text-[#3d4947]">Hanya dari Evaluasi Layanan</p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50">
                  <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                    Delta Baseline → Follow-up
                  </span>
                  <p
                    className={`text-xl font-extrabold mt-1 ${
                      syncResult.rataRataDeltaFollowUp === null
                        ? 'text-gray-400'
                        : syncResult.rataRataDeltaFollowUp >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                    }`}
                  >
                    {syncResult.rataRataDeltaFollowUp !== null
                      ? `${syncResult.rataRataDeltaFollowUp >= 0 ? '+' : ''}${syncResult.rataRataDeltaFollowUp}`
                      : 'Belum ada'}
                  </p>
                  <p className="text-[11px] text-[#3d4947]">
                    {syncResult.followUpCheckedCount} cek 14 hari
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-bold uppercase text-[#3d4947] block">
                    Status Kasus &amp; Rujukan
                  </span>
                  <p className="text-xl font-extrabold text-[#00685f] mt-1">
                    {syncResult.caseSummary.tuntas} / {syncResult.caseSummary.totalKasus}
                  </p>
                  <p className="text-[11px] text-[#3d4947]">
                    {syncResult.caseSummary.dirujuk} dirujuk · {syncResult.caseSummary.tidakTertangani} tdk tertangani
                  </p>
                </div>
              </div>

              {/* Rata-rata 6 Skor per Bidang (4 Bidang Sekaligus) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
                {STANDARD_EVALUATION_BIDANG.map((bName) => {
                  const b = syncResult.bidangBuckets[bName];
                  return (
                    <div
                      key={bName}
                      className="p-3.5 rounded-xl border border-[#bcc9c6]/50 bg-white space-y-1.5"
                    >
                      <p className="text-xs font-extrabold text-[#0b1c30]">{bName}</p>
                      <p className="text-lg font-extrabold text-[#00685f]">
                        {b.rata6Skor > 0 ? `${b.rata6Skor} / 5` : 'Belum dinilai'}
                      </p>
                      <p className="text-[11px] text-[#3d4947]">
                        {b.evaluatedCount} Evaluasi · {b.unevaluatedCount} Belum · {b.totalStudentsUnique}{' '}
                        Siswa
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Rata-rata per Jenis Masalah & Rata-rata per Teknik */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-[#bcc9c6]/50 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#f8faf9] border-b border-gray-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30]">
                      Rata-rata per Jenis Masalah (Dari Evaluasi Layanan)
                    </h4>
                  </div>
                  {syncResult.byJenisMasalah.length === 0 ? (
                    <p className="p-4 text-xs text-[#3d4947] italic">
                      Belum ada Evaluasi Layanan terisi untuk dikelompokkan berdasarkan jenis masalah.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 text-xs tabular-nums">
                      {syncResult.byJenisMasalah.map((pm) => (
                        <div key={pm.jenisMasalah} className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-extrabold text-[#0b1c30]">
                                {pm.jenisMasalah} ({pm.totalEvaluasi}x)
                              </p>
                              {(pm.jenisMasalah === 'Lainnya' || isLegacyJenisMasalah(pm.jenisMasalah)) &&
                                onUpdateServiceEvaluation && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFixLainnyaOpen(true);
                                    setStep(2);
                                  }}
                                  className="px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-extrabold cursor-pointer"
                                >
                                  Perbaiki Klasifikasi
                                </button>
                              )}
                            </div>
                            <p className="text-[11px] text-[#3d4947]">
                              Teknik dominan: {pm.teknikDominan} · Selesai: {pm.persenSelesai}%
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-extrabold text-[#00685f]">{pm.rataRataSkor} / 5</p>
                            <p className="text-[10px] text-[#3d4947]">
                              Delta:{' '}
                              {pm.rataRataDelta !== null
                                ? `${pm.rataRataDelta >= 0 ? '+' : ''}${pm.rataRataDelta}`
                                : '-'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-[#bcc9c6]/50 rounded-2xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#f8faf9] border-b border-gray-100">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b1c30]">
                      Rata-rata per Teknik Konseling (Dari Evaluasi Layanan)
                    </h4>
                  </div>
                  {syncResult.byTeknik.length === 0 ? (
                    <p className="p-4 text-xs text-[#3d4947] italic">
                      Belum ada Evaluasi Layanan terisi untuk mengukur efektivitas teknik.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 text-xs tabular-nums">
                      {syncResult.byTeknik.map((tk) => (
                        <div key={tk.teknik} className="px-4 py-2.5 flex items-center justify-between gap-2">
                          <div>
                            <p className="font-extrabold text-[#0b1c30]">
                              {tk.teknik} ({tk.totalEvaluasi} sesi)
                            </p>
                            <p className="text-[11px] text-[#3d4947]">
                              Tindak lanjut selesai: {tk.persenSelesai}%
                            </p>
                          </div>
                          <span className="font-extrabold text-[#00685f] shrink-0">
                            {tk.rataRataSkor} / 5
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== STEP 2: 3 BLOK DRAF AI RINGAN (USER SETUJU / EDIT 1-2 KALIMAT) ==================== */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Badge Kuning Wajib jika data < 50% terisi */}
              {(syncResult.totalServicesInPeriod === 0 ||
                syncResult.evaluatedServicesCount / syncResult.totalServicesInPeriod < 0.5) && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold">
                        Data belum representatif, draf ini masih sementara.
                      </p>
                      <p className="text-[11px] mt-0.5">
                        Baru {syncResult.evaluatedServicesCount} dari {syncResult.totalServicesInPeriod}{' '}
                        layanan periode ini yang sudah dievaluasi ({syncResult.unevaluatedServicesCount}{' '}
                        belum dievaluasi).
                      </p>
                    </div>
                  </div>
                  {isDraftingStep2 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-900">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Menyusun draf AI...
                    </span>
                  )}
                </div>
              )}

              {/* Tombol Perbaiki Klasifikasi jika ada data lama masuk kategori "Lainnya" */}
              {lainnyaEvaluations.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#f8faf9] border border-amber-300 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-[#0b1c30]">
                      <span className="font-extrabold">Klasifikasi Jenis Masalah Lama / &quot;Lainnya&quot;</span>{' '}
                      <span className="text-[#3d4947]">
                        ({lainnyaEvaluations.length} evaluasi masih tercatat sebagai kategori lama atau &quot;Lainnya&quot;)
                      </span>
                    </div>
                    {onUpdateServiceEvaluation && (
                      <button
                        type="button"
                        onClick={() => setIsFixLainnyaOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-extrabold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isFixLainnyaOpen ? 'Tutup Perbaikan' : 'Perbaiki Klasifikasi'}</span>
                      </button>
                    )}
                  </div>

                  {isFixLainnyaOpen && (
                    <div className="space-y-2 pt-2 border-t border-amber-200">
                      {lainnyaEvaluations.map((ev) => {
                        const suggested = mapLegacyProblemToStandardJenisMasalah(ev.jenisMasalah);
                        const currentVal =
                          lainnyaReclassMap[ev.id] ||
                          (EVALUATION_JENIS_MASALAH.includes(ev.jenisMasalah as EvaluationJenisMasalah)
                            ? (ev.jenisMasalah as EvaluationJenisMasalah)
                            : suggested);
                        return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-xl bg-white border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-[#0b1c30] truncate">{ev.namaProgram}</p>
                            <p className="text-[11px] text-[#3d4947]">
                              {formatTanggalIndonesia(ev.tanggal)} · {ev.teknikDipakai || ev.jenisLayanan} · Label saat ini:{' '}
                              <span className="font-bold text-amber-800">{ev.jenisMasalah || 'Lainnya'}</span>
                            </p>
                          </div>
                          <select
                            value={currentVal}
                            onChange={(e) =>
                              setLainnyaReclassMap((prev) => ({
                                ...prev,
                                [ev.id]: e.target.value as EvaluationJenisMasalah,
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-xl border border-[#00685f]/50 bg-[#f8faf9] text-xs font-bold text-[#0b1c30]"
                          >
                            {EVALUATION_JENIS_MASALAH.map((jm) => (
                              <option key={jm} value={jm}>
                                {jm}
                              </option>
                            ))}
                          </select>
                        </div>
                        );
                      })}
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveLainnyaReclassification}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs font-bold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Simpan Klasifikasi Baru</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 1 Field Opsional Tunggal di Atas Blok 1 */}
              <div className="p-4 rounded-2xl border border-[#00685f]/25 bg-[#f8faf9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                    Target Total Layanan Semester Ini (Opsional)
                  </label>
                  <p className="text-[11px] text-[#3d4947]">
                    Realisasi tercatat: {syncResult.totalServicesInPeriod} layanan periode {currentSemester}{' '}
                    {currentTa}. Tidak perlu mengisi target per bidang.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="number"
                    min={0}
                    value={formData.target ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormData((p) => ({
                        ...p,
                        target: v === '' ? null : Math.max(0, parseInt(v, 10) || 0),
                      }));
                    }}
                    placeholder="Opsional (angka)"
                    className="w-36 px-3 py-2 rounded-xl border border-[#bcc9c6]/70 bg-white text-xs sm:text-sm font-extrabold tabular-nums text-[#0b1c30]"
                  />
                  {overallPercentage !== null && (
                    <span className="px-2.5 py-1.5 rounded-xl bg-[#e6f4f1] text-[#00685f] text-xs font-extrabold tabular-nums">
                      {overallPercentage}%
                    </span>
                  )}
                </div>
              </div>

              {/* BLOK 1 — RINGKASAN PER BIDANG (Otomatis dari AI, Boleh Di-Edit) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                      Blok 1 dari 3
                    </span>
                    <h3 className="text-sm font-extrabold text-[#0b1c30]">
                      Ringkasan Per Bidang (Otomatis dari AI, Boleh Di-Edit)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeBidangList.map((item) => {
                    const bName = item.bidang as StandardEvaluationBidang;
                    const draft = step2DraftsCache.bidangDrafts[bName] || {
                      kondisiAwal: EMPTY_BLOCK_PLACEHOLDER,
                      kondisiSetelah: EMPTY_BLOCK_PLACEHOLDER,
                    };
                    const awalKey = `bidang:${bName}:awal`;
                    const setelahKey = `bidang:${bName}:setelah`;
                    const isCardEditing =
                      editingFieldKeys.has(awalKey) || editingFieldKeys.has(setelahKey);
                    const awalVal = item.kondisiAwal || draft.kondisiAwal || EMPTY_BLOCK_PLACEHOLDER;
                    const setelahVal =
                      item.kondisiSetelah || draft.kondisiSetelah || EMPTY_BLOCK_PLACEHOLDER;

                    return (
                      <div
                        key={bName}
                        className="rounded-2xl border border-[#bcc9c6]/50 bg-white overflow-hidden flex flex-col justify-between"
                      >
                        <div className="px-4 py-3 bg-[#f8faf9] border-b border-gray-100 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-extrabold text-[#0b1c30]">{bName}</h4>
                            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-lg bg-[#e6f4f1] text-[#00685f] tabular-nums">
                              {item.rata6Skor ? `${item.rata6Skor} / 5` : '0 / 5'}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-[#3d4947] tabular-nums">
                            {item.evaluatedCount || 0} Evaluasi terisi · {item.unevaluatedCount || 0}{' '}
                            Belum dievaluasi · Rata-rata 6 Skor:{' '}
                            <strong>{item.rata6Skor ? `${item.rata6Skor} / 5` : '0 / 5'}</strong> (dari{' '}
                            {item.evaluatedCount || 0} layanan)
                          </p>
                        </div>

                        <div className="p-3.5 space-y-2.5 flex-1">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <label className="text-[11px] font-bold text-[#0b1c30]">
                                Kondisi Awal (Draf AI, bisa diedit)
                              </label>
                              {isUncollectedPlaceholderText(awalVal) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateBidangItem(bName, { kondisiAwal: draft.kondisiAwal });
                                    markManualEdited(awalKey);
                                  }}
                                  className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                                >
                                  Buat Ulang Draf AI
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              readOnly={!isCardEditing}
                              value={awalVal}
                              onClick={() => toggleEditingField(awalKey, true)}
                              onChange={(e) => {
                                markManualEdited(awalKey);
                                updateBidangItem(bName, {
                                  kondisiAwal: e.target.value || EMPTY_BLOCK_PLACEHOLDER,
                                });
                              }}
                              className={`w-full px-3 py-2 rounded-xl border text-xs text-[#0b1c30] ${
                                isCardEditing
                                  ? 'border-[#00685f] bg-white'
                                  : 'border-[#bcc9c6]/50 bg-[#f8faf9]'
                              }`}
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <label className="text-[11px] font-bold text-[#00685f]">
                                Perubahan Setelah Program (Draf AI, bisa diedit)
                              </label>
                              {isUncollectedPlaceholderText(setelahVal) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateBidangItem(bName, { kondisiSetelah: draft.kondisiSetelah });
                                    markManualEdited(setelahKey);
                                  }}
                                  className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                                >
                                  Buat Ulang Draf AI
                                </button>
                              )}
                            </div>
                            <textarea
                              rows={2}
                              readOnly={!isCardEditing}
                              value={setelahVal}
                              onClick={() => toggleEditingField(setelahKey, true)}
                              onChange={(e) => {
                                markManualEdited(setelahKey);
                                updateBidangItem(bName, {
                                  kondisiSetelah: e.target.value || EMPTY_BLOCK_PLACEHOLDER,
                                });
                              }}
                              className={`w-full px-3 py-2 rounded-xl border text-xs text-[#0b1c30] ${
                                isCardEditing
                                  ? 'border-[#00685f] bg-white'
                                  : 'border-[#bcc9c6]/50 bg-[#f8faf9]'
                              }`}
                            />
                          </div>
                        </div>

                        <div className="px-3.5 py-2 bg-[#f8faf9] border-t border-gray-100 flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              updateBidangItem(bName, {
                                kondisiAwal: draft.kondisiAwal,
                                kondisiSetelah: draft.kondisiSetelah,
                              });
                              toggleEditingField(awalKey, false);
                              toggleEditingField(setelahKey, false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-[#e6f4f1] hover:bg-[#d3ece7] text-[#00685f] text-[10px] font-extrabold cursor-pointer"
                          >
                            Pakai Draf AI
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextEdit = !isCardEditing;
                              toggleEditingField(awalKey, nextEdit);
                              toggleEditingField(setelahKey, nextEdit);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                              isCardEditing
                                ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                                : 'bg-white text-[#0b1c30] border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {isCardEditing ? 'Selesai Edit' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              markManualEdited(awalKey);
                              markManualEdited(setelahKey);
                              updateBidangItem(bName, {
                                kondisiAwal: EMPTY_BLOCK_PLACEHOLDER,
                                kondisiSetelah: EMPTY_BLOCK_PLACEHOLDER,
                              });
                              toggleEditingField(awalKey, false);
                              toggleEditingField(setelahKey, false);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-gray-100 text-[#3d4947] border border-gray-200 text-[10px] font-bold cursor-pointer"
                          >
                            Kosongkan
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* BLOK 2 — SUARA STAKEHOLDER + REFLEKSI KONSELOR */}
              <div className="p-4 rounded-2xl border border-[#bcc9c6]/60 bg-[#f8faf9] space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                    Blok 2 dari 3 · 1x Akhir Semester
                  </span>
                  <h3 className="text-sm font-extrabold text-[#0b1c30]">
                    Suara Stakeholder &amp; Refleksi Konselor
                  </h3>
                </div>

                {/* A. Suara Stakeholder (Opsional, Boleh Kosong) */}
                <div className="p-3.5 rounded-xl bg-white border border-[#bcc9c6]/50 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-[#0b1c30]">
                      A. Suara Stakeholder (Opsional, Boleh Kosong — 1 Kalimat)
                    </h4>
                    <span className="text-[10px] font-semibold text-[#3d4947]">
                      Jika dibiarkan &quot;Belum terkumpul&quot;, AI tetap jujur bahwa evaluasi dari Guru BK saja.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {(
                      [
                        {
                          key: 'suaraSiswa',
                          label: 'Suara Siswa',
                          draftVal: step2DraftsCache.stakeholderDraft.suaraSiswa,
                        },
                        {
                          key: 'suaraWaliKelas',
                          label: 'Suara Wali Kelas',
                          draftVal: step2DraftsCache.stakeholderDraft.suaraWaliKelas,
                        },
                        {
                          key: 'suaraKepsekOrtu',
                          label: 'Suara Kepala Sekolah / Orang Tua',
                          draftVal: step2DraftsCache.stakeholderDraft.suaraKepsekOrtu,
                        },
                      ] as const
                    ).map((st) => {
                      const val = suaraStakeholder[st.key] || st.draftVal || UNCOLLECTED_PLACEHOLDER;
                      const editKey = `stakeholder:${st.key}`;
                      return (
                        <div key={st.key} className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-[11px] font-bold text-[#0b1c30]">{st.label}</label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  markManualEdited(editKey);
                                  setSuaraStakeholder((p) => ({
                                    ...p,
                                    [st.key]: st.draftVal || UNCOLLECTED_PLACEHOLDER,
                                  }));
                                }}
                                className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                              >
                                Pakai Draf AI
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={val}
                            onChange={(e) => {
                              markManualEdited(editKey);
                              setSuaraStakeholder((p) => ({
                                ...p,
                                [st.key]: e.target.value,
                              }));
                            }}
                            onBlur={() => {
                              if (!String(suaraStakeholder[st.key] || '').trim()) {
                                setSuaraStakeholder((p) => ({
                                  ...p,
                                  [st.key]: UNCOLLECTED_PLACEHOLDER,
                                }));
                              }
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs text-[#0b1c30]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* B. Refleksi Konselor (AI Buatkan Draf, User Melengkapi Alasan) */}
                <div className="p-3.5 rounded-xl bg-white border border-[#bcc9c6]/50 space-y-3">
                  <h4 className="text-xs font-extrabold text-[#0b1c30]">
                    B. Refleksi Konselor (AI Buatkan Draf, Lengkapi Alasan 1–2 Kalimat)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-bold text-[#0b1c30]">
                          1. Teknik paling berhasil
                        </label>
                        <div className="flex items-center gap-1.5">
                          {isUncollectedPlaceholderText(refleksiKonselor.teknikBerhasil) && (
                            <button
                              type="button"
                              onClick={() => generateStep2Drafts(false, false)}
                              className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
                            >
                              Buat Ulang Draf AI
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setRefleksiKonselor((p) => ({
                                ...p,
                                teknikBerhasil: step2DraftsCache.refleksiDraft.teknikBerhasil,
                              }));
                            }}
                            className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                          >
                            Pakai Draf AI
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        value={
                          refleksiKonselor.teknikBerhasil ||
                          step2DraftsCache.refleksiDraft.teknikBerhasil ||
                          EMPTY_BLOCK_PLACEHOLDER
                        }
                        onChange={(e) => {
                          markManualEdited('refleksi:teknikBerhasil');
                          setRefleksiKonselor((p) => ({ ...p, teknikBerhasil: e.target.value }));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs text-[#0b1c30]"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <label className="text-[11px] font-bold text-[#0b1c30]">
                          2. Teknik gagal / tidak cocok
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setRefleksiKonselor((p) => ({
                              ...p,
                              teknikGagalDiubah: step2DraftsCache.refleksiDraft.teknikGagalDiubah,
                            }))
                          }
                          className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                        >
                          Pakai Draf AI
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={
                          refleksiKonselor.teknikGagalDiubah ||
                          step2DraftsCache.refleksiDraft.teknikGagalDiubah ||
                          EMPTY_BLOCK_PLACEHOLDER
                        }
                        onChange={(e) => {
                          markManualEdited('refleksi:teknikGagalDiubah');
                          setRefleksiKonselor((p) => ({
                            ...p,
                            teknikGagalDiubah: e.target.value,
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs text-[#0b1c30]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-bold text-[#0b1c30] mb-1">
                        3. Kendala Terbesar (Rekomendasi AI)
                      </label>
                      <select
                        value={
                          refleksiKonselor.kendalaTerbesar ||
                          step2DraftsCache.refleksiDraft.kendalaTerbesar ||
                          'Waktu'
                        }
                        onChange={(e) => {
                          const nextKendala = e.target.value;
                          markManualEdited('refleksi:kendalaTerbesar');
                          const nextPenjelas = buildKendalaPenjelasDraft(
                            nextKendala,
                            syncResult.unevaluatedServicesCount,
                            syncResult.servicesDibatalkan
                          );
                          const nextDukungan = buildKendalaTailoredSupport(
                            nextKendala,
                            syncResult.caseSummary.dirujuk
                          );
                          setRefleksiKonselor((p) => ({
                            ...p,
                            kendalaTerbesar: nextKendala,
                            kendalaPenjelas: !manualEditedKeys.has('refleksi:kendalaPenjelas')
                              ? nextPenjelas
                              : p.kendalaPenjelas,
                          }));
                          if (!manualEditedKeys.has('perbaikan:butuhDukungan')) {
                            setRencanaPerbaikan((p) => ({ ...p, butuhDukungan: nextDukungan }));
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs font-bold text-[#0b1c30]"
                      >
                        {KENDALA_TERBESAR_REFLEKSI_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <label className="text-[11px] font-bold text-[#0b1c30]">
                          1 Kalimat Penjelas Kendala (Draf AI, bisa diedit)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setRefleksiKonselor((p) => ({
                              ...p,
                              kendalaPenjelas: step2DraftsCache.refleksiDraft.kendalaPenjelas,
                            }))
                          }
                          className="text-[10px] font-bold text-[#00685f] hover:underline cursor-pointer"
                        >
                          Pakai Draf AI
                        </button>
                      </div>
                      <input
                        type="text"
                        value={
                          refleksiKonselor.kendalaPenjelas ||
                          step2DraftsCache.refleksiDraft.kendalaPenjelas ||
                          EMPTY_BLOCK_PLACEHOLDER
                        }
                        onChange={(e) => {
                          markManualEdited('refleksi:kendalaPenjelas');
                          setRefleksiKonselor((p) => ({
                            ...p,
                            kendalaPenjelas: e.target.value,
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs text-[#0b1c30]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* BLOK 3 — RENCANA PERBAIKAN SEMESTER DEPAN (AI Buatkan Draf, User Setuju / Edit) */}
              <div className="p-4 rounded-2xl border border-[#0b1c30]/20 bg-[#f8faf9] space-y-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] block">
                    Blok 3 dari 3
                  </span>
                  <h3 className="text-sm font-extrabold text-[#0b1c30]">
                    Rencana Perbaikan Semester Depan (Draf AI, Baca &amp; Edit Jika Perlu)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      {
                        key: 'lanjutkan',
                        label: '1. LANJUTKAN',
                        colorClass: 'border-emerald-200',
                        labelColor: 'text-emerald-800',
                        draftVal: step2DraftsCache.rencanaPerbaikanDraft.lanjutkan,
                      },
                      {
                        key: 'hentikan',
                        label: '2. HENTIKAN',
                        colorClass: 'border-rose-200',
                        labelColor: 'text-rose-800',
                        draftVal: step2DraftsCache.rencanaPerbaikanDraft.hentikan,
                      },
                      {
                        key: 'ubah',
                        label: '3. UBAH',
                        colorClass: 'border-amber-200',
                        labelColor: 'text-amber-800',
                        draftVal: step2DraftsCache.rencanaPerbaikanDraft.ubah,
                      },
                      {
                        key: 'butuhDukungan',
                        label: '4. BUTUH DUKUNGAN APA',
                        colorClass: 'border-[#bcc9c6]/70',
                        labelColor: 'text-[#0b1c30]',
                        draftVal: step2DraftsCache.rencanaPerbaikanDraft.butuhDukungan,
                      },
                    ] as const
                  ).map((blk) => {
                    const editKey = `perbaikan:${blk.key}`;
                    const isEditingBlk = editingFieldKeys.has(editKey);
                    const curVal =
                      rencanaPerbaikan[blk.key] || blk.draftVal || EMPTY_BLOCK_PLACEHOLDER;
                    return (
                      <div
                        key={blk.key}
                        className={`p-3 rounded-xl bg-white border ${blk.colorClass} space-y-1.5`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className={`text-[11px] font-extrabold ${blk.labelColor}`}>
                            {blk.label}
                          </label>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRencanaPerbaikan((p) => ({
                                  ...p,
                                  [blk.key]: blk.draftVal || EMPTY_BLOCK_PLACEHOLDER,
                                }));
                                toggleEditingField(editKey, false);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-[#e6f4f1] text-[#00685f] text-[10px] font-extrabold cursor-pointer"
                            >
                              Pakai Draf AI
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleEditingField(editKey)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                                isEditingBlk
                                  ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                                  : 'bg-white text-[#0b1c30] border-gray-300'
                              }`}
                            >
                              {isEditingBlk ? 'Selesai' : 'Edit'}
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={2}
                          readOnly={!isEditingBlk}
                          value={curVal}
                          onClick={() => toggleEditingField(editKey, true)}
                          onChange={(e) => {
                            markManualEdited(editKey);
                            setRencanaPerbaikan((p) => ({
                              ...p,
                              [blk.key]: e.target.value || EMPTY_BLOCK_PLACEHOLDER,
                            }));
                          }}
                          className={`w-full px-3 py-2 rounded-xl border text-xs text-[#0b1c30] ${
                            isEditingBlk
                              ? 'border-[#00685f] bg-white'
                              : 'border-gray-200 bg-[#f8faf9]'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tombol Bawah Khusus Langkah 2 */}
              <div className="p-3.5 rounded-2xl bg-[#f8faf9] border border-[#bcc9c6]/50 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={isDraftingStep2}
                  onClick={() => generateStep2Drafts(true, true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#0b1c30] border border-[#bcc9c6]/70 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {isDraftingStep2 ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00685f]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#00685f]" />
                  )}
                  <span>Buat Ulang Semua Draf AI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    applyStep2Drafts(step2DraftsCache, false);
                    setStep(3);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan &amp; Lanjut ke Langkah 3</span>
                </button>
              </div>
            </div>
          )}

          {/* ==================== STEP 3: AI PER JENIS MASALAH ==================== */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/45 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                        AI Analisis Program per Jenis Masalah
                      </h4>
                      <p className="text-[11px] text-[#3d4947]">
                        Menyusun kesimpulan & strategi terpisah untuk setiap jenis masalah dari Evaluasi Layanan terisi.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzingAi}
                    onClick={handleGenerateAiPerMasalah}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {isAnalyzingAi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isAnalyzingAi ? 'Menganalisis...' : 'Analisis AI per Jenis Masalah'}</span>
                  </button>
                </div>

                {(aiCompletenessNotice || isProgramIncomplete) && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-semibold">
                    {aiCompletenessNotice ||
                      `Kesimpulan ini masih sementara karena ${syncResult.unevaluatedServicesCount} layanan belum dievaluasi / ${syncResult.pendingFollowUpCount} belum ada follow-up.`}
                  </div>
                )}

                {aiPerbandinganKebutuhan && (
                  <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[#00685f] block">
                      Kebutuhan Awal vs Realisasi
                    </span>
                    <textarea
                      rows={2}
                      value={aiPerbandinganKebutuhan}
                      onChange={(e) => setAiPerbandinganKebutuhan(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                    />
                  </div>
                )}

                {aiEvaluasiStakeholder && (
                  <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[#0b1c30] block">
                      Sintesis Suara Stakeholder
                    </span>
                    <textarea
                      rows={2}
                      value={aiEvaluasiStakeholder}
                      onChange={(e) => setAiEvaluasiStakeholder(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                    />
                  </div>
                )}

                {aiInterpretasiKasus && (
                  <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-purple-800 block">
                      Interpretasi Status Kasus &amp; Rujukan Profesional
                    </span>
                    <textarea
                      rows={2}
                      value={aiInterpretasiKasus}
                      onChange={(e) => setAiInterpretasiKasus(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                    />
                  </div>
                )}

                {aiEvaluasiRefleksi && (
                  <div className="p-3 rounded-xl bg-white border border-purple-200 text-xs space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-[#3d4947] block">
                      Catatan Kendala Sistemik (Dari Refleksi Konselor)
                    </span>
                    <textarea
                      rows={2}
                      value={aiEvaluasiRefleksi}
                      onChange={(e) => setAiEvaluasiRefleksi(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                    />
                  </div>
                )}

                {aiPerMasalah.length > 0 && (
                  <div className="space-y-2.5">
                    {aiPerMasalah.map((item, idx) => (
                      <div
                        key={item.jenisMasalah + idx}
                        className="p-3.5 rounded-xl bg-white border border-purple-200 space-y-2"
                      >
                        <p className="text-xs font-extrabold text-purple-800 uppercase">
                          Masalah: {item.jenisMasalah}
                        </p>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#3d4947] mb-1">
                            Evaluasi Dampak
                          </label>
                          <textarea
                            rows={2}
                            value={item.ringkasanEvaluasi}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setAiPerMasalah((prev) =>
                                prev.map((m, i) =>
                                  i === idx ? { ...m, ringkasanEvaluasi: nextVal } : m
                                )
                              );
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#00685f] mb-1">
                            Rekomendasi Strategis
                          </label>
                          <textarea
                            rows={2}
                            value={item.rekomendasiStrategis}
                            onChange={(e) => {
                              const nextVal = e.target.value;
                              setAiPerMasalah((prev) =>
                                prev.map((m, i) =>
                                  i === idx ? { ...m, rekomendasiStrategis: nextVal } : m
                                )
                              );
                            }}
                            className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-[#0b1c30]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0b1c30] mb-1">
                    Ringkasan Hasil Program (Opsional)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.hasil}
                    onChange={(e) => setFormData((p) => ({ ...p, hasil: e.target.value }))}
                    placeholder="Otomatis terisi dari AI per jenis masalah atau tulis catatan tambahan..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 text-sm text-[#0b1c30]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0b1c30] mb-1">
                    Rencana Tindak Lanjut Program
                  </label>
                  <textarea
                    rows={2}
                    value={formData.tindakLanjut}
                    onChange={(e) => setFormData((p) => ({ ...p, tindakLanjut: e.target.value }))}
                    placeholder="Rencana perbaikan program BK periode selanjutnya..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 text-sm text-[#0b1c30]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Tanggal Rencana Tindak Lanjut
                    </label>
                    <input
                      type="date"
                      value={formData.tanggalTindakLanjut}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, tanggalTindakLanjut: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Status Tindak Lanjut
                    </label>
                    <select
                      value={formData.statusTindakLanjut}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          statusTindakLanjut: e.target.value as EvaluationFollowUpStatus,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs sm:text-sm font-semibold"
                    >
                      {EVALUATION_FOLLOWUP_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== STEP 4: RATING & BUKTI PELAKSANAAN (OPSIONAL) ==================== */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl border border-[#00685f]/30 bg-[#e6f4f1]/45 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <p className="font-extrabold text-[#0b1c30]">
                    Rencana Perbaikan Semester Depan sudah disusun &amp; disetujui di Langkah 2
                  </p>
                  <p className="text-[11px] text-[#3d4947]">
                    Lengkapi rating kepuasan atau bukti foto/PDF pelaksanaan program (boleh dilewati jika opsional).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#00685f]/40 text-[#00685f] font-bold cursor-pointer"
                >
                  Edit Rencana di Langkah 2
                </button>
              </div>

              <div className="p-4 rounded-2xl border border-[#bcc9c6]/50 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1c30]">
                  Feedback Rating Program (Opsional)
                </h4>
                <div className="grid grid-cols-5 gap-2">
                  {EMOJI_RATINGS.map((item) => {
                    const active = formData.feedbackSiswaNilai === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({ ...p, feedbackSiswaNilai: item.value }))
                        }
                        className={`p-2 rounded-xl border text-center cursor-pointer ${
                          active
                            ? 'bg-[#e6f4f1] border-[#00685f] text-[#00685f]'
                            : 'bg-white border-[#bcc9c6]/50 text-[#3d4947]'
                        }`}
                      >
                        <div className="text-lg">{item.emoji}</div>
                        <div className="text-[10px] font-bold mt-1">
                          {item.value}★ {item.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[#bcc9c6]/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#0b1c30]">
                    Bukti Pelaksanaan Program (Maks 3 File, Opsional)
                  </h4>
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#00685f] text-white text-xs font-bold cursor-pointer">
                    {isUploadingPhoto ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Upload ({evidenceList.length}/3)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      disabled={evidenceList.length >= 3 || isUploadingPhoto}
                      onChange={handleUploadEvidence}
                      className="hidden"
                    />
                  </label>
                </div>
                {evidenceList.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {evidenceList.map((file, idx) => (
                      <div key={idx} className="rounded-xl border border-[#bcc9c6]/50 overflow-hidden">
                        {file.dataUrl.startsWith('data:image/') ? (
                          <img src={file.dataUrl} alt={file.name} className="w-full h-24 object-cover" />
                        ) : (
                          <div className="h-24 flex items-center justify-center bg-[#f8faf9]">
                            <FileText className="w-6 h-6 text-[#00685f]" />
                          </div>
                        )}
                        <div className="px-2 py-1 flex items-center justify-between bg-white text-[11px]">
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidence(idx)}
                            className="text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STEP 5: PREVIEW LAPORAN AKHIR 9 BAGIAN BERURUTAN ==================== */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="border border-[#0b1c30]/20 rounded-2xl overflow-hidden bg-white">
                <div className="bg-[#0b1c30] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300">
                      Preview Evaluasi Program BK — 9 Bagian Berurutan
                    </p>
                    <h3 className="text-base font-extrabold">{formData.namaProgram}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Periode</span>
                  </button>
                </div>

                <div className="p-4 sm:p-5 space-y-4 text-xs">
                  {/* Peringatan Jujur Kelengkapan Data */}
                  {isProgramIncomplete && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 font-semibold">
                      {aiCompletenessNotice ||
                        `Peringatan Data Tidak Lengkap: Kesimpulan masih sementara karena ${syncResult.unevaluatedServicesCount} layanan belum dievaluasi dan ${syncResult.pendingFollowUpCount} evaluasi belum memiliki cek follow-up 14 hari.`}
                    </div>
                  )}

                  {/* 1. Target vs Realisasi (4 Bidang) */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-2 tabular-nums">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-extrabold text-[#0b1c30] uppercase">
                        1. Target vs Realisasi (4 Bidang Program BK)
                      </h4>
                      <span className="text-[11px] font-bold text-[#00685f]">
                        Target Total Semester: {totalTargetAllBidang ?? 'Opsional'} · Realisasi:{' '}
                        {syncResult.totalServicesInPeriod} Layanan ({overallRealisasi} Siswa)
                        {overallPercentage !== null ? ` · ${overallPercentage}%` : ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {activeBidangList.map((b) => {
                        return (
                          <div key={b.bidang} className="p-2.5 rounded-lg bg-white border border-gray-200">
                            <p className="font-bold text-[#0b1c30] truncate">{b.bidang}</p>
                            <p className="text-[#00685f] font-bold">
                              {b.evaluatedCount ?? b.totalServices} Evaluasi · {b.realisasi} Siswa · Skor{' '}
                              {b.rata6Skor || b.nilai || 0}/5
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Layanan Terlaksana vs Batal */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <div>
                      <h4 className="font-extrabold text-[#0b1c30] uppercase">
                        2. Layanan Terlaksana vs Batal
                      </h4>
                      <p className="text-[#3d4947] mt-0.5">
                        Total Periode Ini: <strong>{syncResult.totalServicesInPeriod}</strong> layanan ·{' '}
                        <strong className="text-[#00685f]">{syncResult.servicesTerlaksana} Terlaksana</strong> ·{' '}
                        <strong className="text-rose-700">{syncResult.servicesDibatalkan} Dibatalkan</strong> ·{' '}
                        {syncResult.servicesTerjadwal} Terjadwal ({syncResult.evaluatedServicesCount} sudah dievaluasi)
                      </p>
                    </div>
                  </div>

                  {/* 3. Rata-rata Skor per Jenis Masalah & Teknik */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-2 tabular-nums">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      3. Rata-rata Skor per Jenis Masalah &amp; Teknik (Rata Global: {syncResult.rata6SkorGlobal}/5)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-lg bg-white border border-gray-200 space-y-1">
                        <p className="font-bold text-[#00685f]">Per Jenis Masalah</p>
                        {syncResult.byJenisMasalah.length === 0 ? (
                          <p className="text-[#3d4947] italic">Belum ada data Evaluasi Layanan.</p>
                        ) : (
                          syncResult.byJenisMasalah.map((m) => (
                            <p key={m.jenisMasalah}>
                              • <strong>{m.jenisMasalah}</strong> ({m.totalEvaluasi}x): {m.rataRataSkor}/5 · Dominan: {m.teknikDominan}
                            </p>
                          ))
                        )}
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-gray-200 space-y-1">
                        <p className="font-bold text-[#00685f]">Per Teknik Konseling</p>
                        {syncResult.byTeknik.length === 0 ? (
                          <p className="text-[#3d4947] italic">Belum ada data teknik.</p>
                        ) : (
                          syncResult.byTeknik.map((t) => (
                            <p key={t.teknik}>
                              • <strong>{t.teknik}</strong> ({t.totalEvaluasi} sesi): {t.rataRataSkor}/5 · Selesai {t.persenSelesai}%
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. Delta Baseline -> Follow-up */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 tabular-nums">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      4. Delta Baseline → Follow-up 14 Hari
                    </h4>
                    <p className="mt-0.5 text-[#3d4947]">
                      Rata-rata Delta Follow-up:{' '}
                      <strong className="text-[#00685f]">
                        {syncResult.rataRataDeltaFollowUp !== null
                          ? `${syncResult.rataRataDeltaFollowUp >= 0 ? '+' : ''}${syncResult.rataRataDeltaFollowUp}`
                          : 'Belum ada cek follow-up'}
                      </strong>{' '}
                      ({syncResult.followUpCheckedCount} sudah dicek, {syncResult.pendingFollowUpCount} menunggu) · Ketuntasan RTL:{' '}
                      <strong>{syncResult.persenTindakLanjutSelesai}%</strong>
                    </p>
                  </div>

                  {/* 5. Kasus Tuntas / Masih Berproses / Rujukan / Tidak Tertangani */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-1.5 tabular-nums">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      5. Kasus Tuntas / Masih Berproses / Rujukan / Tidak Tertangani
                    </h4>
                    <p className="font-semibold text-[#0b1c30]">
                      Total Kasus: {syncResult.caseSummary.totalKasus} · Tuntas: {syncResult.caseSummary.tuntas} · Masih Berproses: {syncResult.caseSummary.masihBerproses} · Dirujuk: {syncResult.caseSummary.dirujuk} · Tidak Tertangani: {syncResult.caseSummary.tidakTertangani}
                    </p>
                    {aiInterpretasiKasus && <p className="text-[#3d4947]">{aiInterpretasiKasus}</p>}
                  </div>

                  {/* 6. Target Rencana Tahunan vs Realisasi */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-1">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      6. Fokus Rencana Tahunan vs Realisasi
                    </h4>
                    <p className="font-semibold text-[#00685f]">
                      Fokus Tahunan ({currentTa}): {activeRencanaForPeriod.fokusUtama} · Target Tahunan{' '}
                      {activeRencanaForPeriod.totalTarget} Layanan
                      {kebutuhanAwal.kebutuhanUtama.length > 0
                        ? ` (Arsip fokus sebelumnya: ${kebutuhanAwal.kebutuhanUtama.join(' & ')})`
                        : ''}
                    </p>
                    <p className="text-[#3d4947]">
                      {aiPerbandinganKebutuhan ||
                        (syncResult.byJenisMasalah[0]
                          ? `Layanan terbanyak dijalankan: ${syncResult.byJenisMasalah[0].jenisMasalah} (${syncResult.byJenisMasalah[0].totalEvaluasi}x). Jalankan Analisis AI pada Langkah 3 untuk audit kesesuaian.`
                          : 'Belum ada data perbandingan rencana tahunan vs layanan berjalan.')}
                    </p>
                  </div>

                  {/* 7. Suara Stakeholder */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-1">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      7. Suara Stakeholder
                    </h4>
                    {!hasRealStakeholderVoices(suaraStakeholder) ? (
                      <p className="italic text-amber-900">
                        Suara stakeholder belum terkumpul, evaluasi ini masih dari sudut pandang Guru BK saja.
                      </p>
                    ) : (
                      <div className="space-y-0.5 text-[#3d4947]">
                        {!isUncollectedPlaceholderText(suaraStakeholder.suaraSiswa) && (
                          <p>
                            <strong>Siswa:</strong> &ldquo;{suaraStakeholder.suaraSiswa}&rdquo;
                          </p>
                        )}
                        {!isUncollectedPlaceholderText(suaraStakeholder.suaraWaliKelas) && (
                          <p>
                            <strong>Wali Kelas:</strong> &ldquo;{suaraStakeholder.suaraWaliKelas}&rdquo;
                          </p>
                        )}
                        {!isUncollectedPlaceholderText(suaraStakeholder.suaraKepsekOrtu) && (
                          <p>
                            <strong>Kepala Sekolah / Orang Tua:</strong> &ldquo;
                            {suaraStakeholder.suaraKepsekOrtu}&rdquo;
                          </p>
                        )}
                        {aiEvaluasiStakeholder && <p className="text-[#0b1c30] mt-1">{aiEvaluasiStakeholder}</p>}
                      </div>
                    )}
                  </div>

                  {/* 8. Refleksi Konselor */}
                  <div className="p-3.5 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-1">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      8. Refleksi Konselor
                    </h4>
                    <p>
                      <strong>Teknik Berhasil:</strong> {refleksiKonselor.teknikBerhasil || '-'}
                    </p>
                    <p>
                      <strong>Perlu Diubah:</strong> {refleksiKonselor.teknikGagalDiubah || '-'}
                    </p>
                    <p>
                      <strong>Kendala Sistemik:</strong>{' '}
                      {refleksiKonselor.kendalaTerbesar
                        ? `${refleksiKonselor.kendalaTerbesar}${refleksiKonselor.kendalaPenjelas ? ` — ${refleksiKonselor.kendalaPenjelas}` : ''}`
                        : '-'}
                    </p>
                  </div>

                  {/* 9. Rencana Perbaikan Semester Depan */}
                  <div className="p-3.5 rounded-xl bg-[#e6f4f1]/60 border border-[#00685f]/30 space-y-1.5">
                    <h4 className="font-extrabold text-[#0b1c30] uppercase">
                      9. Rencana Perbaikan Semester Depan
                    </h4>
                    <p>
                      <strong className="text-emerald-800">Lanjutkan:</strong>{' '}
                      {rencanaPerbaikan.lanjutkan || '-'}
                    </p>
                    <p>
                      <strong className="text-rose-800">Hentikan:</strong>{' '}
                      {rencanaPerbaikan.hentikan || '-'}
                    </p>
                    <p>
                      <strong className="text-amber-800">Ubah:</strong> {rencanaPerbaikan.ubah || '-'}
                    </p>
                    <p>
                      <strong className="text-[#0b1c30]">Butuh Dukungan:</strong>{' '}
                      {rencanaPerbaikan.butuhDukungan || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-[#bcc9c6]/40 bg-[#f8faf9] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#0b1c30] border border-[#bcc9c6]/70 text-xs sm:text-sm font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-[#3d4947] border border-[#bcc9c6]/70 text-xs sm:text-sm font-bold cursor-pointer"
              >
                Batal
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(5, s + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                <span>{step === 4 ? 'Lewati / Next' : 'Next'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleFinalSave(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Evaluasi Program</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalSave(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0b1c30] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Simpan & Cetak PDF</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
