import { useState, useEffect } from 'react';
import { Sparkles, Brain, AlertTriangle, CheckCircle, Copy, Check, Mail, X, RefreshCw, ArrowRight } from 'lucide-react';
import { fetchBehavioralDiagnosis, BehavioralDiagnosisResult } from '../utils/geminiBehaviorService';

interface BehavioralDiagnosisModalProps {
  studentName: string;
  studentClass: string;
  studentNis?: string;
  netPoints: number;
  alpaCount: number;
  violations?: any[];
  services?: any[];
  achievements?: any[];
  onClose: () => void;
  onOpenEmailModal?: (draftData: any) => void;
}

export default function BehavioralDiagnosisModal({
  studentName,
  studentClass,
  studentNis,
  netPoints,
  alpaCount,
  violations = [],
  services = [],
  achievements = [],
  onClose,
  onOpenEmailModal
}: BehavioralDiagnosisModalProps) {
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [diagnosis, setDiagnosis] = useState<BehavioralDiagnosisResult | null>(null);

  const loadDiagnosis = async () => {
    setLoading(true);
    const res = await fetchBehavioralDiagnosis({
      studentName,
      studentClass,
      netPoints,
      alpaCount,
      violations,
      services,
      achievements
    });
    setDiagnosis(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadDiagnosis();
  }, [studentName, studentClass, netPoints, alpaCount]);

  const handleCopyText = () => {
    if (!diagnosis) return;
    const text = `[DIAGNOSA PERILAKU SISWA - AI GEMINI BK]
Nama Siswa: ${studentName} (${studentClass})
Level Risiko: ${diagnosis.riskLevel}
Tren Masalah Utama: ${diagnosis.primaryProblemTrend}

ANALISIS PSIKOLOGIS:
${diagnosis.psychologicalAnalysis}

AKAR MASALAH (ROOT CAUSES):
${diagnosis.rootCauses.map((rc, i) => `${i + 1}. ${rc}`).join('\n')}

REKOMENDASI TINDAK LANJUT BK:
${diagnosis.followUpRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

BENTUK INTERVENSI:
${diagnosis.suggestedInterventionType}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'Kritis':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Tinggi':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Sedang':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-[#0b1c30] to-[#00685f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <Brain className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-wide">Diagnosa Perilaku Siswa (Gemini AI)</h3>
                <span className="px-2 py-0.5 bg-teal-400/20 text-teal-200 text-[10px] font-bold rounded-full border border-teal-300/30">
                  BK AI Assistant
                </span>
              </div>
              <p className="text-xs text-teal-100/80 font-medium">
                Analisis Psikologis & Draf Rekomendasi Tindak Lanjut: {studentName} ({studentClass})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-[#0b1c30]">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#00685f] animate-spin mx-auto" />
              <p className="font-extrabold text-sm text-[#0b1c30]">Menganalisis Tren Perilaku & Catatan Pembinaan...</p>
              <p className="text-gray-500 text-xs">AI Gemini sedang memproses indikator kehadiran, bobot pelanggaran, dan pola konseling.</p>
            </div>
          ) : diagnosis ? (
            <>
              {/* Profile Bar */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Siswa Terdiagnosa</span>
                  <p className="font-extrabold text-sm text-[#0b1c30]">{studentName} ({studentClass})</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Status Bobot / Alpa</span>
                    <p className="font-bold text-xs text-[#0b1c30]">{netPoints} Bobot {alpaCount > 0 ? `| ${alpaCount}x Alpa` : ''}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${getRiskBadge(diagnosis.riskLevel)}`}>
                    Risiko: {diagnosis.riskLevel}
                  </span>
                </div>
              </div>

              {/* Main Problem Trend */}
              <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-200 space-y-1">
                <div className="flex items-center gap-1.5 text-[#00685f] font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Tren Masalah Utama Siswa</span>
                </div>
                <p className="font-extrabold text-sm text-[#0b1c30]">{diagnosis.primaryProblemTrend}</p>
              </div>

              {/* Psychological Analysis */}
              <div className="space-y-1.5">
                <h4 className="font-extrabold text-xs text-[#0b1c30] uppercase tracking-wide flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-[#00685f]" />
                  <span>Analisis Psikologis Latar Belakang</span>
                </h4>
                <p className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-gray-800 leading-relaxed font-medium">
                  {diagnosis.psychologicalAnalysis}
                </p>
              </div>

              {/* Root Causes */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-[#0b1c30] uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Akar Masalah (Root Causes)</span>
                </h4>
                <div className="space-y-1.5">
                  {diagnosis.rootCauses.map((cause, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60 text-amber-950 font-semibold">
                      <span className="bg-amber-200 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{cause}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-xs text-[#0b1c30] uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-[#00685f]" />
                  <span>Draf Rekomendasi Tindak Lanjut BK</span>
                </h4>
                <div className="space-y-1.5">
                  {diagnosis.followUpRecommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 bg-[#e6f4f1]/60 p-2.5 rounded-lg border border-[#00685f]/20 text-[#0b1c30] font-semibold">
                      <CheckCircle className="w-4 h-4 text-[#00685f] shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Intervention Type */}
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Rekomendasi Bentuk Intervensi</span>
                  <p className="font-extrabold text-xs text-[#00685f] mt-0.5">{diagnosis.suggestedInterventionType}</p>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={loadDiagnosis}
            disabled={loading}
            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Regenerasi AI</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              disabled={loading || !diagnosis}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Diagnosa'}</span>
            </button>

            {onOpenEmailModal && diagnosis && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEmailModal({
                    studentName,
                    studentClass,
                    netPoints,
                    alpaCount,
                    followUpPlan: diagnosis.followUpRecommendations.join('; '),
                    riskLevel: diagnosis.riskLevel,
                    diagnosisSummary: diagnosis.primaryProblemTrend
                  });
                }}
                className="px-4 py-2 bg-[#00685f] hover:bg-[#005049] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Buat Draf Email Notifikasi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
