export type DisciplineFormType = 'perjanjian' | 'kontrak' | 'jurnal-pembinaan' | 'komitmen-rtl';

export interface DisciplineFormAiPayload {
  formType: DisciplineFormType;
  studentName: string;
  studentClass: string;
  alpaCount: number;
  violationCount: number;
  netPoints: number;
  violationsSummary?: string;
}

export interface DisciplineFormAiResult {
  // For 'perjanjian'
  violationSummary?: string;
  agreementPoints?: string[];
  consequences?: string;

  // For 'kontrak'
  targetBehavior?: string;
  agreedPositiveBehaviors?: string[];
  rewards?: string;
  sanctions?: string;

  // For 'jurnal-pembinaan'
  problemDescription?: string;
  counselingApproach?: string;
  restitutionAgreement?: string;
  evaluationPlan?: string;

  // For 'komitmen-rtl'
  personalCommitment?: string;
  actionSteps?: string[];
  successIndicators?: string;
  supportNeeded?: string;
}

export async function fetchDisciplineFormAi(
  payload: DisciplineFormAiPayload
): Promise<{ success: boolean; source?: string; data: DisciplineFormAiResult }> {
  try {
    const res = await fetch('/api/gemini/generate-discipline-form-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Fallback ke Generator AI Lokal untuk Form Pembinaan BK:', err);

    const stName = payload.studentName || 'Siswa';
    const stClass = payload.studentClass || '-';
    const alpa = payload.alpaCount || 0;
    const pts = payload.netPoints || 0;

    let fallback: DisciplineFormAiResult = {};

    if (payload.formType === 'perjanjian') {
      fallback = {
        violationSummary: `Siswa ${stName} (${stClass}) ${alpa > 0 ? `terdata Alpa/Tanpa Keterangan sebanyak ${alpa}x` : ''} ${pts > 0 ? `serta mengumpulkan ${pts} bobot poin pelanggaran.` : 'memerlukan pembinaan komitmen kedisiplinan.'}`,
        agreementPoints: [
          `Tiba di sekolah tepat waktu paling lambat pukul 06.45 WIB setiap hari belajar.`,
          `Membawa surat keterangan resmi dari orang tua atau dokter jika berhalangan hadir.`,
          `Mengenakan seragam lengkap sesuai ketentuan dan mematuhi tata tertib sekolah.`,
          `Bersikap sopan santun kepada guru, staf, dan menghormati sesama teman.`
        ],
        consequences: `Menerima sanksi pembinaan terstruktur, skorsing sementara, dan pemanggilan orang tua apabila terulang.`
      };
    } else if (payload.formType === 'kontrak') {
      fallback = {
        targetBehavior: `Mencapai persentase kehadiran 100% tepat waktu dan aktif mengumpulkan tugas sekolah secara konsisten.`,
        agreedPositiveBehaviors: [
          `Hadir di kelas sebelum bel masuk berbunyi (06.45 WIB).`,
          `Mengisi dan meminta verifikasi Jurnal Presensi Karakter setiap hari.`,
          `Mengikuti seluruh sesi pembelajaran tanpa membolos.`
        ],
        rewards: `Piagam Penghargaan Karakter Disiplin & Pemulihan -10 Poin Pelanggaran.`,
        sanctions: `Tugas piket kebersihan area lingkungan sekolah setelah jam pulang.`
      };
    } else if (payload.formType === 'jurnal-pembinaan') {
      fallback = {
        problemDescription: `Siswa mengalami hambatan motivasi kehadiran (${alpa}x Alpa) dan kendala regulasi diri.`,
        counselingApproach: `Konseling Restoratif & Solution-Focused Brief Therapy (SFBT) untuk menumbuhkan rasa tanggung jawab.`,
        restitutionAgreement: `Siswa menyadari dampak perilakunya dan berkomitmen hadir tepat waktu serta melengkapi catatan tugas.`,
        evaluationPlan: `Evaluasi mingguan selama 14 hari melalui pemantauan kartu kontrol presensi.`
      };
    } else {
      fallback = {
        personalCommitment: `Saya ${stName} berjanji dengan sungguh-sungguh untuk merubah kebiasaan buruk dan menjadi siswa yang disiplin.`,
        actionSteps: [
          `Mengatur alarm dan tidur malam paling lambat pukul 21.30 WIB.`,
          `Menyiapkan seragam dan tas sekolah pada malam hari sebelum tidur.`,
          `Melaporkan kehadiran kepada Wali Kelas setiap pagi saat tiba di sekolah.`
        ],
        successIndicators: `Kehadiran 100% tepat waktu tanpa Alpa dan keterlambatan selama 2 minggu berturut-turut.`,
        supportNeeded: `Dukungan pengawasan positif dari Orang Tua di rumah dan Bimbingan motivasi dari Guru BK.`
      };
    }

    return { success: true, source: 'fallback', data: fallback };
  }
}
