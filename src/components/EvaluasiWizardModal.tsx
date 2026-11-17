import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Loader2,
  Printer,
  Save,
  Search,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  CounselingService,
  Counselor,
  EvaluationFollowUpStatus,
  EvaluationJenisMasalah,
  EvaluationTeknikType,
  EvaluationTujuanType,
  ProgramEvaluation,
  ServiceEvaluation6Scores,
  ServiceEvaluationAiAnalysis,
  ServiceEvaluationBaseline,
} from '../types';
import {
  EVALUATION_4_KLASIKAL_SCORES_META,
  EVALUATION_6_SCORES_META,
  EVALUATION_FOLLOWUP_STATUS_OPTIONS,
  EVALUATION_JENIS_MASALAH,
  EVALUATION_TEKNIK_OPTIONS,
  EVALUATION_TUJUAN_OPTIONS,
  STANDARD_EVALUATION_BIDANG,
  compute6ScoreSummary,
  computeBaselineKondisiAwal,
  extractClassesFromService,
  formatTanggalIndonesia,
  getSemesterFromDate,
  getStudentServiceOrdinal,
  getTahunAjaranFromDate,
  inferJenisMasalahFromService,
  inferTeknikFromService,
  inferTujuanFromService,
  isServiceKlasikalType,
  mapJenisMasalahToBidang,
  mapServiceToEvaluationBidang,
} from '../utils/evaluationHelpers';
import { getActiveSchoolId, getSchoolConfig } from '../utils/schoolConfig';
import { showToast } from '../utils/toast';

interface EvaluasiWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (evaluation: ProgramEvaluation, printPdfAfterSave?: boolean) => void;
  services: CounselingService[];
  activeCounselor: Counselor;
  initialEvaluation?: ProgramEvaluation | null;
  presetService?: CounselingService | null;
  availableClasses?: string[];
}

export default function EvaluasiWizardModal({
  isOpen,
  onClose,
  onSave,
  services,
  activeCounselor,
  initialEvaluation,
  presetService,
}: EvaluasiWizardModalProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const schoolConfig = getSchoolConfig();

  const resolvedInitialService = useMemo(() => {
    if (presetService) return presetService;
    if (initialEvaluation?.serviceId) {
      return services.find((s) => s.id === initialEvaluation.serviceId) || null;
    }
    return null;
  }, [presetService, initialEvaluation, services]);

  const [step, setStep] = useState<'A' | 'B'>('A');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    resolvedInitialService?.id || initialEvaluation?.serviceId || ''
  );
  const [serviceSearch, setServiceSearch] = useState('');

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) || resolvedInitialService || null,
    [services, selectedServiceId, resolvedInitialService]
  );

  // Langkah A — Konteks + Baseline Retrospektif (otomatis pre-fill dari Blok B layanan bila ada)
  const [jenisMasalah, setJenisMasalah] = useState<EvaluationJenisMasalah>(() => {
    if (initialEvaluation?.jenisMasalah) return initialEvaluation.jenisMasalah;
    return inferJenisMasalahFromService(resolvedInitialService);
  });
  const [alasanMasalahLainnya, setAlasanMasalahLainnya] = useState<string>(
    initialEvaluation?.alasanMasalahLainnya ||
      resolvedInitialService?.specificDetails?.blokB?.alasanMasalahLainnya ||
      ''
  );
  const [bidang, setBidang] = useState<string>(() => {
    if (initialEvaluation?.bidang) return initialEvaluation.bidang;
    if (resolvedInitialService) return mapServiceToEvaluationBidang(resolvedInitialService);
    return mapJenisMasalahToBidang(inferJenisMasalahFromService(resolvedInitialService));
  });
  const [bidangManuallyChanged, setBidangManuallyChanged] = useState<boolean>(
    Boolean(initialEvaluation?.bidang)
  );
  const [teknikDipakai, setTeknikDipakai] = useState<EvaluationTeknikType>(() => {
    if (initialEvaluation?.teknikDipakai) {
      return initialEvaluation.teknikDipakai === 'Kelompok'
        ? 'Konseling Kelompok'
        : initialEvaluation.teknikDipakai;
    }
    return inferTeknikFromService(resolvedInitialService);
  });
  const [tujuanLayanan, setTujuanLayanan] = useState<EvaluationTujuanType>(() => {
    if (initialEvaluation?.tujuanLayanan) return initialEvaluation.tujuanLayanan;
    return inferTujuanFromService(resolvedInitialService);
  });

  const [keparahan, setKeparahan] = useState<number>(
    initialEvaluation?.baseline?.keparahan ??
      resolvedInitialService?.specificDetails?.blokB?.baseline?.keparahan ??
      3
  );
  const [frekuensi, setFrekuensi] = useState<number>(
    initialEvaluation?.baseline?.frekuensi ??
      resolvedInitialService?.specificDetails?.blokB?.baseline?.frekuensi ??
      3
  );
  const [motivasiAwal, setMotivasiAwal] = useState<number>(
    initialEvaluation?.baseline?.motivasiAwal ??
      resolvedInitialService?.specificDetails?.blokB?.baseline?.motivasiAwal ??
      3
  );

  // Langkah B — Skor + Tindak Lanjut + Hasil/Kendala
  const [scoresDraft, setScoresDraft] = useState<
    Pick<
      ServiceEvaluation6Scores,
      | 'ketercapaianTujuan'
      | 'perubahanPerilaku'
      | 'keterlibatanSiswa'
      | 'keterbukaanSiswa'
      | 'kesesuaianTeknik'
      | 'kesiapanTindakLanjut'
    >
  >(() => ({
    ketercapaianTujuan: initialEvaluation?.scores6?.ketercapaianTujuan ?? 4,
    perubahanPerilaku: initialEvaluation?.scores6?.perubahanPerilaku ?? 4,
    keterlibatanSiswa: initialEvaluation?.scores6?.keterlibatanSiswa ?? 4,
    keterbukaanSiswa: initialEvaluation?.scores6?.keterbukaanSiswa ?? 4,
    kesesuaianTeknik: initialEvaluation?.scores6?.kesesuaianTeknik ?? 4,
    kesiapanTindakLanjut: initialEvaluation?.scores6?.kesiapanTindakLanjut ?? 4,
  }));

  const defaultPlanDate = useMemo(() => {
    const blokDDate = resolvedInitialService?.specificDetails?.tindakLanjutPlan?.tindakLanjutTanggal;
    if (blokDDate) return blokDDate;
    const base = resolvedInitialService?.date ? new Date(resolvedInitialService.date) : new Date();
    base.setDate(base.getDate() + 14);
    return isNaN(base.getTime()) ? todayIso : base.toISOString().slice(0, 10);
  }, [resolvedInitialService, todayIso]);

  const [tindakLanjutApa, setTindakLanjutApa] = useState<string>(
    initialEvaluation?.tindakLanjut ||
      resolvedInitialService?.specificDetails?.tindakLanjutPlan?.tindakLanjutApa ||
      resolvedInitialService?.followUp ||
      ''
  );
  const [tanggalTindakLanjut, setTanggalTindakLanjut] = useState<string>(
    initialEvaluation?.tanggalTindakLanjut || defaultPlanDate
  );
  const [penanggungJawab, setPenanggungJawab] = useState<string>(
    initialEvaluation?.penanggungJawabTindakLanjut ||
      resolvedInitialService?.specificDetails?.tindakLanjutPlan?.penanggungJawab ||
      resolvedInitialService?.counselorName ||
      activeCounselor.name ||
      'Guru BK'
  );
  const [statusTindakLanjut, setStatusTindakLanjut] = useState<EvaluationFollowUpStatus>(
    initialEvaluation?.statusTindakLanjut || 'Belum Dikerjakan'
  );
  const [hasilSingkat, setHasilSingkat] = useState<string>(
    initialEvaluation?.hasil || resolvedInitialService?.output || ''
  );
  const [kendala, setKendala] = useState<string>(initialEvaluation?.kendala || '');

  // AI Counselor Brain state
  const [aiAnalysis, setAiAnalysis] = useState<ServiceEvaluationAiAnalysis | null>(
    initialEvaluation?.aiAnalysis || null
  );
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return [...services]
      .filter((s) => {
        if (!q) return true;
        const hay = `${s.problem || ''} ${s.serviceType || ''} ${(s.students || [])
          .map((st) => `${st.name} ${st.class}`)
          .join(' ')}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [services, serviceSearch]);

  if (!isOpen) return null;

  const isKlasikalMode = isServiceKlasikalType(selectedService?.serviceType, teknikDipakai);
  const scores6 = compute6ScoreSummary(scoresDraft, { isKlasikal: isKlasikalMode });
  const baselineObj: ServiceEvaluationBaseline = {
    keparahan,
    frekuensi,
    motivasiAwal,
    baselineDariIngatan: true,
    skorKondisiAwal: computeBaselineKondisiAwal({ keparahan, frekuensi, motivasiAwal }),
  };

  const layananKeBerapa = selectedService
    ? getStudentServiceOrdinal(services, selectedService)
    : initialEvaluation?.layananKeBerapa || 1;

  const primaryStudent = selectedService?.students?.[0];
  const studentDisplayLabel =
    primaryStudent
      ? selectedService!.students.length > 1
        ? `${primaryStudent.name} (+${selectedService!.students.length - 1} siswa)`
        : primaryStudent.name
      : initialEvaluation?.namaProgram || 'Peserta Didik';

  const serviceClassLabel = selectedService
    ? extractClassesFromService(selectedService)
    : initialEvaluation?.kelas || 'Umum';

  const handleSelectServiceInLangkahA = (srv: CounselingService) => {
    setSelectedServiceId(srv.id);
    const inferredMasalah = inferJenisMasalahFromService(srv);
    setJenisMasalah(inferredMasalah);
    if (srv.specificDetails?.blokB?.alasanMasalahLainnya) {
      setAlasanMasalahLainnya(srv.specificDetails.blokB.alasanMasalahLainnya);
    }
    if (!bidangManuallyChanged) {
      setBidang(mapServiceToEvaluationBidang(srv) || mapJenisMasalahToBidang(inferredMasalah));
    }
    setTeknikDipakai(inferTeknikFromService(srv));
    setTujuanLayanan(inferTujuanFromService(srv));
    if (srv.specificDetails?.blokB?.baseline) {
      setKeparahan(srv.specificDetails.blokB.baseline.keparahan ?? 3);
      setFrekuensi(srv.specificDetails.blokB.baseline.frekuensi ?? 3);
      setMotivasiAwal(srv.specificDetails.blokB.baseline.motivasiAwal ?? 3);
    }
    if (!tindakLanjutApa) {
      setTindakLanjutApa(srv.specificDetails?.tindakLanjutPlan?.tindakLanjutApa || srv.followUp || '');
    }
    if (!hasilSingkat && srv.output) setHasilSingkat(srv.output);
    if (srv.specificDetails?.tindakLanjutPlan?.tindakLanjutTanggal) {
      setTanggalTindakLanjut(srv.specificDetails.tindakLanjutPlan.tindakLanjutTanggal);
    }
    if (srv.specificDetails?.tindakLanjutPlan?.penanggungJawab || srv.counselorName) {
      setPenanggungJawab(
        srv.specificDetails?.tindakLanjutPlan?.penanggungJawab || srv.counselorName || 'Guru BK'
      );
    }
  };

  const handleJenisMasalahChange = (nextMasalah: EvaluationJenisMasalah) => {
    setJenisMasalah(nextMasalah);
    if (nextMasalah !== 'Lainnya') setAlasanMasalahLainnya('');
    if (!bidangManuallyChanged) {
      setBidang(mapJenisMasalahToBidang(nextMasalah));
    }
  };

  const handleAnalyzeWithAi = async () => {
    setIsAnalyzingAi(true);
    try {
      const response = await fetch('/api/gemini/analyze-service-evaluation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenisMasalah,
          alasanMasalahLainnya,
          bidang,
          teknikDipakai,
          tujuanLayanan,
          baseline: baselineObj,
          scores6,
          isKlasikal: isKlasikalMode,
          layananKeBerapa,
          studentLabel: studentDisplayLabel,
          kelas: serviceClassLabel,
          specificDetails: selectedService?.specificDetails || {},
          serviceNotes: {
            problem: selectedService?.problem || initialEvaluation?.namaProgram || '',
            description: selectedService?.description || '',
            output: selectedService?.output || hasilSingkat || '',
            followUp: selectedService?.followUp || tindakLanjutApa || '',
          },
          tindakLanjutPlan: {
            apa: tindakLanjutApa,
            tanggal: tanggalTindakLanjut,
            penanggungJawab,
          },
          hasilSingkat,
          kendala,
        }),
      });
      const json = await response.json();
      if (json?.analysis) {
        setAiAnalysis(json.analysis);
        showToast('Analisis Otak Konselor AI selesai dirumuskan.', 'success');
      } else {
        showToast('AI belum mengembalikan hasil analisis.', 'warning');
      }
    } catch (err) {
      console.error('Analyze service evaluation AI error:', err);
      showToast('Gagal menghubungi layanan analisis AI.', 'error');
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSaveEvaluation = (printPdf: boolean) => {
    if (!selectedService && !initialEvaluation) {
      showToast('Pilih layanan yang akan dinilai terlebih dahulu.', 'warning');
      setStep('A');
      return;
    }
    if (jenisMasalah === 'Lainnya' && !alasanMasalahLainnya.trim()) {
      showToast('Wajib isi 1 kalimat alasan saat memilih Jenis Masalah "Lainnya".', 'warning');
      setStep('A');
      return;
    }
    if (!tindakLanjutApa.trim()) {
      showToast('Isi rencana tindak lanjut ("Apa tindak lanjutnya") sebelum menyimpan.', 'warning');
      setStep('B');
      return;
    }

    const sDate = selectedService?.date || initialEvaluation?.tanggal || todayIso;
    const nowIso = new Date().toISOString();
    const realisasiCount =
      selectedService?.students?.length || initialEvaluation?.realisasi || 1;

    const finalDoc: ProgramEvaluation = {
      ...(initialEvaluation || {}),
      id:
        initialEvaluation?.id ||
        `eval-srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      serviceId: selectedService?.id || initialEvaluation?.serviceId || '',
      bidang,
      namaProgram:
        selectedService?.problem ||
        initialEvaluation?.namaProgram ||
        `${teknikDipakai} — ${jenisMasalah}`,
      kelas: serviceClassLabel,
      target: initialEvaluation?.target ?? realisasiCount,
      realisasi: realisasiCount,
      kondisiAwal: `Baseline Retrospektif (Dari Ingatan): Keparahan ${keparahan}/5, Frekuensi ${frekuensi}/5, Motivasi Awal ${motivasiAwal}/5 (Indeks Awal: ${baselineObj.skorKondisiAwal}/5)`,
      kondisiSetelah:
        hasilSingkat.trim() ||
        `Rata-rata ${isKlasikalMode ? '4 Skor Klasikal' : '6 Skor'}: ${scores6.rataRata}/5 (${scores6.kategori}) setelah teknik ${teknikDipakai}.`,
      hasil:
        hasilSingkat.trim() ||
        aiAnalysis?.interpretasiKontekstual ||
        `Skor ${isKlasikalMode ? '4 indikator klasikal' : '6 indikator'} ${scores6.totalSkor}/${isKlasikalMode ? '20' : '30'} (rata-rata ${scores6.rataRata}/5 — ${scores6.kategori}).`,
      kendala: kendala.trim(),
      tindakLanjut: tindakLanjutApa.trim(),
      tanggalTindakLanjut: tanggalTindakLanjut || defaultPlanDate,
      penanggungJawabTindakLanjut: penanggungJawab.trim() || activeCounselor.name || 'Guru BK',
      statusTindakLanjut: initialEvaluation ? statusTindakLanjut : 'Belum Dikerjakan',
      nilai: Math.max(1, Math.min(5, Math.round(scores6.rataRata))),
      feedbackSiswaNilai: initialEvaluation?.feedbackSiswaNilai ?? 0,
      feedbackSiswaKomentar: initialEvaluation?.feedbackSiswaKomentar || '',
      feedbackWaliNama: initialEvaluation?.feedbackWaliNama || '',
      feedbackWaliKomentar: initialEvaluation?.feedbackWaliKomentar || '',
      buktiFoto: initialEvaluation?.buktiFoto || [],
      tanggal: sDate,
      createdBy: initialEvaluation?.createdBy || activeCounselor.name || 'Guru BK',
      evaluationScope: 'layanan',
      jenisMasalah,
      alasanMasalahLainnya: jenisMasalah === 'Lainnya' ? alasanMasalahLainnya.trim() : '',
      teknikDipakai,
      tujuanLayanan,
      baseline: baselineObj,
      baselineDariIngatan: true,
      scores6,
      isKlasikalEvaluation: isKlasikalMode,
      layananKeBerapa,
      aiAnalysis: aiAnalysis || initialEvaluation?.aiAnalysis,
      jenisLayanan: selectedService?.serviceType || teknikDipakai,
      guruBk: selectedService?.counselorName || activeCounselor.name || 'Guru BK',
      semester: getSemesterFromDate(sDate),
      tahunAjaran: getTahunAjaranFromDate(sDate),
      schoolId: initialEvaluation?.schoolId || getActiveSchoolId(),
      schoolName: initialEvaluation?.schoolName || schoolConfig.schoolName || 'SMP N 2 Susukan',
      counselorId: initialEvaluation?.counselorId || activeCounselor.id,
      createdAt: initialEvaluation?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSave(finalDoc, printPdf);
  };

  return (
    <div className="fixed inset-0 z-[72] bg-[#0b1c30]/60 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl border border-[#bcc9c6]/50 shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header + 2-Step Indicator */}
        <div className="px-4 sm:px-6 pt-4 pb-3.5 border-b border-[#bcc9c6]/40 bg-[#f8faf9]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00685f] bg-[#e6f4f1] px-2.5 py-0.5 rounded-md">
                  Evaluasi Layanan (Sumber Data Utama)
                </span>
                {selectedService && (
                  <span className="text-[10px] font-extrabold text-[#0b1c30] bg-slate-100 px-2.5 py-0.5 rounded-md">
                    Layanan ke-{layananKeBerapa} untuk {studentDisplayLabel}
                  </span>
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#0b1c30] tracking-tight mt-1">
                {step === 'A'
                  ? 'Langkah A — Konteks & Baseline Retrospektif'
                  : isKlasikalMode
                    ? 'Langkah B — 4 Skor Klasikal, Tindak Lanjut & Otak Konselor AI'
                    : 'Langkah B — 6 Skor, Tindak Lanjut & Otak Konselor AI'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[#3d4947] hover:bg-gray-200/70 transition-colors cursor-pointer"
              title="Tutup Form Evaluasi"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStep('A')}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-2 cursor-pointer transition-all ${
                step === 'A'
                  ? 'bg-[#00685f] text-white border-[#00685f]'
                  : 'bg-[#e6f4f1] text-[#00685f] border-[#00685f]/30'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white text-[#00685f] flex items-center justify-center text-[11px] font-black shrink-0">
                A
              </span>
              <span className="truncate">Konteks & Baseline Retrospektif</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selectedService && !initialEvaluation) {
                  showToast('Pilih layanan terlebih dahulu di Langkah A.', 'warning');
                  return;
                }
                setStep('B');
              }}
              className={`px-3 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-2 cursor-pointer transition-all ${
                step === 'B'
                  ? 'bg-[#00685f] text-white border-[#00685f]'
                  : 'bg-white text-[#3d4947] border-[#bcc9c6]/50 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  step === 'B' ? 'bg-white text-[#00685f]' : 'bg-gray-100 text-[#3d4947]'
                }`}
              >
                B
              </span>
              <span className="truncate">
                {isKlasikalMode
                  ? '4 Skor Klasikal + Tindak Lanjut + AI Konselor'
                  : '6 Skor + Tindak Lanjut + AI Konselor'}
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-white">
          {step === 'A' && (
            <div className="space-y-5">
              {/* Service Selector if not preset */}
              {!presetService && !initialEvaluation && (
                <div className="p-4 rounded-2xl border border-[#bcc9c6]/50 bg-[#f8faf9] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                      Pilih Layanan yang Akan Dinilai
                    </h3>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        placeholder="Cari siswa atau topik..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-gray-100 border border-[#bcc9c6]/40 rounded-xl bg-white">
                    {filteredServices.length === 0 ? (
                      <p className="p-4 text-xs text-center text-[#3d4947]">
                        Belum ada layanan tercatat untuk dievaluasi.
                      </p>
                    ) : (
                      filteredServices.slice(0, 25).map((srv) => {
                        const active = srv.id === selectedServiceId;
                        const names = (srv.students || []).map((s) => `${s.name} (${s.class})`).join(', ');
                        return (
                          <button
                            key={srv.id}
                            type="button"
                            onClick={() => handleSelectServiceInLangkahA(srv)}
                            className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                              active ? 'bg-[#e6f4f1]' : 'hover:bg-[#f8faf9]'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-extrabold text-[#0b1c30] truncate">
                                {names || 'Siswa'} &middot; {srv.problem || srv.serviceType}
                              </p>
                              <p className="text-[11px] text-[#3d4947] tabular-nums">
                                {srv.serviceType} &middot; {formatTanggalIndonesia(srv.date)}
                              </p>
                            </div>
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                active ? 'bg-[#00685f] text-white' : 'border border-gray-300'
                              }`}
                            >
                              {active && <Check className="w-3 h-3" />}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Selected Service Summary Strip */}
              {selectedService && (
                <div className="p-3.5 rounded-2xl bg-[#e6f4f1]/60 border border-[#00685f]/25 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase text-[#00685f] block">
                      Layanan yang Dinilai ({formatTanggalIndonesia(selectedService.date)})
                    </span>
                    <p className="font-extrabold text-[#0b1c30] truncate">
                      {studentDisplayLabel} (Kelas {serviceClassLabel}) &mdash;{' '}
                      {selectedService.problem || selectedService.serviceType}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-white border border-[#00685f]/30 text-[#00685f] font-extrabold text-[11px] shrink-0">
                    Sesi ke-{layananKeBerapa}
                  </span>
                </div>
              )}

              {/* Klasikal Notice */}
              {isKlasikalMode && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="font-bold text-amber-950">
                    Ini layanan klasikal, interpretasi untuk dinamika kelas, bukan 1 siswa. Indikator keterbukaan & perubahan perilaku individual dinonaktifkan otomatis di Langkah B.
                  </p>
                </div>
              )}

              {/* Konteks: Jenis Masalah, Bidang Otomatis, Teknik, Tujuan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-[#0b1c30] mb-1.5">
                    1. Jenis Masalah
                  </label>
                  <select
                    value={jenisMasalah}
                    onChange={(e) => handleJenisMasalahChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  >
                    {EVALUATION_JENIS_MASALAH.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {jenisMasalah === 'Lainnya' && (
                    <div className="mt-2">
                      <label className="block text-[11px] font-extrabold text-amber-900 mb-1">
                        Alasan Memilih "Lainnya" (Wajib 1 kalimat):
                      </label>
                      <input
                        type="text"
                        value={alasanMasalahLainnya}
                        onChange={(e) => setAlasanMasalahLainnya(e.target.value)}
                        placeholder="Tuliskan 1 kalimat alasan spesifik masalah ini..."
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 text-xs font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#0b1c30] mb-1.5">
                    2. Bidang BK (Otomatis dari Masalah, Bisa Diubah)
                  </label>
                  <select
                    value={bidang}
                    onChange={(e) => {
                      setBidangManuallyChanged(true);
                      setBidang(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  >
                    {STANDARD_EVALUATION_BIDANG.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#0b1c30] mb-1.5">
                    3. Teknik yang Dipakai
                  </label>
                  <select
                    value={teknikDipakai}
                    onChange={(e) => setTeknikDipakai(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  >
                    {EVALUATION_TEKNIK_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[#0b1c30] mb-1.5">
                    4. Tujuan Layanan
                  </label>
                  <select
                    value={tujuanLayanan}
                    onChange={(e) => setTujuanLayanan(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm font-semibold text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  >
                    {EVALUATION_TUJUAN_OPTIONS.map((tj) => (
                      <option key={tj} value={tj}>
                        {tj}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Baseline Retrospektif */}
              <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/45 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                      5. Baseline Retrospektif (Ingat Kondisi SEBELUM Layanan)
                    </h3>
                    <p className="text-[11px] text-[#3d4947]">
                      Nilai kondisi awal sebelum sesi dilakukan untuk pembanding cek follow-up 14 hari nanti.
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                    baselineDariIngatan: true &middot; Indeks Awal: {baselineObj.skorKondisiAwal}/5
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Keparahan Masalah (1–5)',
                      sub: '1 = Ringan · 5 = Sangat Parah',
                      val: keparahan,
                      setVal: setKeparahan,
                    },
                    {
                      label: 'Frekuensi Kejadian (1–5)',
                      sub: '1 = Jarang · 5 = Sangat Sering',
                      val: frekuensi,
                      setVal: setFrekuensi,
                    },
                    {
                      label: 'Motivasi Awal Siswa (1–5)',
                      sub: '1 = Pasif · 5 = Sangat Kooperatif',
                      val: motivasiAwal,
                      setVal: setMotivasiAwal,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="p-3 rounded-xl bg-white border border-[#bcc9c6]/50 space-y-2"
                    >
                      <div>
                        <p className="text-xs font-extrabold text-[#0b1c30]">{item.label}</p>
                        <p className="text-[10px] text-[#3d4947]">{item.sub}</p>
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => item.setVal(n)}
                            className={`py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition-colors tabular-nums ${
                              item.val === n
                                ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                                : 'bg-[#f8faf9] text-[#0b1c30] border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'B' && (
            <div className="space-y-5">
              {/* Skor Evaluasi (4 Indikator Klasikal atau 6 Indikator Standar) */}
              <div className="space-y-3">
                {isKlasikalMode && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs font-extrabold text-amber-950 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      Ini layanan klasikal, interpretasi untuk dinamika kelas, bukan 1 siswa. Indikator Keterbukaan Individual & Perubahan Perilaku Individual tidak dinilai.
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#0b1c30]">
                      {isKlasikalMode
                        ? '4 Indikator Penilaian Bimbingan Klasikal (Skala 1 – 5)'
                        : '6 Indikator Penilaian Layanan (Skala 1 – 5)'}
                    </h3>
                    <p className="text-xs text-[#3d4947]">
                      Klik angka 1 (Kurang) sampai 5 (Sangat Baik) untuk setiap indikator.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="px-3 py-1 rounded-xl bg-[#e6f4f1] text-[#00685f] text-xs font-extrabold">
                      Total: {scores6.totalSkor} / {isKlasikalMode ? 20 : 30}
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-[#0b1c30] text-white text-xs font-extrabold">
                      Rata-rata: {scores6.rataRata.toFixed(2)} ({scores6.kategori})
                    </span>
                  </div>
                </div>

                <div className={`grid grid-cols-1 ${isKlasikalMode ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-3`}>
                  {(isKlasikalMode ? EVALUATION_4_KLASIKAL_SCORES_META : EVALUATION_6_SCORES_META).map((meta) => {
                    const currentVal = scoresDraft[meta.key];
                    return (
                      <div
                        key={meta.key}
                        className="p-3 rounded-xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-2"
                      >
                        <div>
                          <p className="text-xs font-extrabold text-[#0b1c30]">{meta.label}</p>
                          <p className="text-[10px] text-[#3d4947]">{meta.hint}</p>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setScoresDraft((prev) => ({ ...prev, [meta.key]: n }))
                              }
                              className={`py-1.5 rounded-lg text-xs font-extrabold border cursor-pointer transition-all tabular-nums ${
                                currentVal === n
                                  ? 'bg-[#00685f] text-white border-[#00685f] shadow-2xs'
                                  : 'bg-white text-[#0b1c30] border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rencana Tindak Lanjut (Status otomatis Belum Dikerjakan saat baru dibuat) */}
              <div className="p-4 rounded-2xl bg-[#f8faf9] border border-[#bcc9c6]/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                    Rencana Tindak Lanjut <span className="text-rose-600">*</span>
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                    Status Awal: {initialEvaluation ? statusTindakLanjut : 'Belum Dikerjakan'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Apa Tindak Lanjutnya?
                    </label>
                    <input
                      type="text"
                      value={tindakLanjutApa}
                      onChange={(e) => setTindakLanjutApa(e.target.value)}
                      placeholder="Contoh: Observasi kehadiran pagi & koordinasi wali kelas"
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Tanggal Rencana
                    </label>
                    <input
                      type="date"
                      value={tanggalTindakLanjut}
                      onChange={(e) => setTanggalTindakLanjut(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                      Penanggung Jawab
                    </label>
                    <input
                      type="text"
                      value={penanggungJawab}
                      onChange={(e) => setPenanggungJawab(e.target.value)}
                      placeholder="Guru BK / Wali Kelas"
                      className="w-full px-3 py-2 rounded-xl border border-[#bcc9c6]/60 bg-white text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                    />
                  </div>
                </div>

                {initialEvaluation && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-bold text-[#3d4947]">Status:</span>
                    {EVALUATION_FOLLOWUP_STATUS_OPTIONS.map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusTindakLanjut(st)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          statusTindakLanjut === st
                            ? 'bg-[#0b1c30] text-white border-[#0b1c30]'
                            : 'bg-white text-[#3d4947] border-gray-200'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hasil Singkat & Kendala (Opsional 1 kalimat) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                    Hasil Singkat (Opsional, 1 kalimat)
                  </label>
                  <input
                    type="text"
                    value={hasilSingkat}
                    onChange={(e) => setHasilSingkat(e.target.value)}
                    placeholder="Contoh: Siswa mengakui penyebab terlambat & sepakat bangun lebih awal."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0b1c30] mb-1">
                    Kendala Singkat (Opsional, 1 kalimat)
                  </label>
                  <input
                    type="text"
                    value={kendala}
                    onChange={(e) => setKendala(e.target.value)}
                    placeholder="Contoh: Orang tua belum dapat dihubungi saat sesi berlangsung."
                    className="w-full px-3.5 py-2 rounded-xl border border-[#bcc9c6]/60 text-xs sm:text-sm text-[#0b1c30] focus:outline-none focus:border-[#00685f]"
                  />
                </div>
              </div>

              {/* AI sebagai Otak Konselor Profesional */}
              <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/45 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-[#0b1c30]">
                        AI Otak Konselor Profesional (Analisis Kontekstual)
                      </h4>
                      <p className="text-[11px] text-[#3d4947]">
                        Menganalisis Masalah ({jenisMasalah}), Teknik ({teknikDipakai}), Tujuan ({tujuanLayanan}), Baseline, Sesi ke-{layananKeBerapa}, & Catatan Sesi.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzingAi}
                    onClick={handleAnalyzeWithAi}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60 shrink-0 self-start sm:self-center"
                  >
                    {isAnalyzingAi ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isAnalyzingAi ? 'Menganalisis...' : 'Analisis Konselor AI'}</span>
                  </button>
                </div>

                {aiAnalysis && (
                  <div className="space-y-2.5 pt-2 border-t border-purple-200/70 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-purple-100">
                      <span className="text-[10px] font-extrabold uppercase text-purple-700 block">
                        Interpretasi Kontekstual
                      </span>
                      <p className="text-[#0b1c30] mt-0.5 leading-relaxed">
                        {aiAnalysis.interpretasiKontekstual}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="bg-white p-3 rounded-xl border border-emerald-200">
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                          Kekuatan Spesifik
                        </span>
                        <p className="text-[#0b1c30] mt-0.5 leading-relaxed">
                          {aiAnalysis.kekuatanSpesifik}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-amber-200">
                        <span className="text-[10px] font-extrabold uppercase text-amber-800 block">
                          Area Perbaikan Spesifik
                        </span>
                        <p className="text-[#0b1c30] mt-0.5 leading-relaxed">
                          {aiAnalysis.areaPerbaikanSpesifik}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase text-purple-700 block">
                          Rekomendasi Tindak Lanjut Spesifik (Apa · Kapan · Siapa · Teknik)
                        </span>
                        <p className="text-[#0b1c30] mt-0.5 leading-relaxed font-medium">
                          {aiAnalysis.rekomendasiTindakLanjut.ringkasan}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTindakLanjutApa(aiAnalysis.rekomendasiTindakLanjut.apa);
                          if (aiAnalysis.rekomendasiTindakLanjut.siapa) {
                            setPenanggungJawab(aiAnalysis.rekomendasiTindakLanjut.siapa);
                          }
                          showToast('Rekomendasi AI disalin ke Rencana Tindak Lanjut.', 'success');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        Terapkan Rekomendasi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#f8faf9] border-t border-[#bcc9c6]/40 flex items-center justify-between gap-2 flex-wrap">
          <div>
            {step === 'B' ? (
              <button
                type="button"
                onClick={() => setStep('A')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bcc9c6]/70 bg-white hover:bg-gray-50 text-xs font-bold text-[#0b1c30] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Langkah A</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#bcc9c6]/70 bg-white hover:bg-gray-50 text-xs font-bold text-[#3d4947] cursor-pointer"
              >
                Tutup
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step === 'A' ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedService && !initialEvaluation) {
                    showToast('Pilih salah satu layanan yang akan dinilai.', 'warning');
                    return;
                  }
                  setStep('B');
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold cursor-pointer"
              >
                <span>Lanjut ke Langkah B (6 Skor)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveEvaluation(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#00685f] hover:bg-[#005049] text-white text-xs sm:text-sm font-bold cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Evaluasi Layanan</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEvaluation(true)}
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
