export interface BehavioralDiagnosisResult {
  primaryProblemTrend: string;
  psychologicalAnalysis: string;
  riskLevel: 'Rendah' | 'Sedang' | 'Tinggi' | 'Kritis';
  rootCauses: string[];
  followUpRecommendations: string[];
  suggestedInterventionType: string;
}

export async function fetchBehavioralDiagnosis(payload: {
  studentName: string;
  studentClass: string;
  netPoints: number;
  alpaCount: number;
  violations?: any[];
  services?: any[];
  achievements?: any[];
}): Promise<{ success: boolean; source?: string; data: BehavioralDiagnosisResult }> {
  try {
    const res = await fetch('/api/gemini/diagnose-behavior', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Gagal memanggil endpoint Gemini, menggunakan analisis lokal:', err);
    
    // Client-side fallback if server offline
    const alpaCount = payload.alpaCount || 0;
    const netPoints = payload.netPoints || 0;
    return {
      success: true,
      source: 'client_fallback',
      data: {
        primaryProblemTrend: alpaCount > 3 ? 'Indisiplin Kehadiran & Prokrastinasi Akademik' : netPoints >= 50 ? 'Eskalasi Pelanggaran Tata Tertib & Kontrol Diri' : 'Variasi Perilaku Adaptif Remaja',
        psychologicalAnalysis: `Siswa ${payload.studentName} (${payload.studentClass}) menunjukkan kecenderungan pola perilaku yang memerlukan pendampingan empatik. ${alpaCount > 0 ? `Terdapat riwayat ketidakhadiran tanpa keterangan sebanyak ${alpaCount} kali yang mengindikasikan kemungkinan hambatan motivasi internal atau kendala lingkungan sosial/keluarga.` : ''} ${netPoints > 0 ? `Akumulasi bobot pembinaan mencapai ${netPoints} bobot.` : ''}`,
        riskLevel: netPoints >= 50 || alpaCount >= 5 ? 'Kritis' : netPoints >= 25 || alpaCount >= 3 ? 'Tinggi' : netPoints >= 10 ? 'Sedang' : 'Rendah',
        rootCauses: [
          'Kurangnya regulasi diri dan manajemen waktu belajar harian.',
          'Dinamika hubungan teman sebaya yang memengaruhi prioritas kehadiran.',
          'Kebutuhan akan penguatan emosional dan komunikasi terbuka di lingkungan rumah/sekolah.'
        ],
        followUpRecommendations: [
          'Lakukan Sesi Konseling Individual dengan pendekatan Restoratif (Restorative Justice).',
          'Jadwalkan Ruang Dialog bersama Orang Tua/Wali dan Wali Kelas untuk kesepakatan komitmen bersama.',
          'Libatkan siswa dalam program pembinaan karakter bertahap dan pemantauan Jurnal Karakter.'
        ],
        suggestedInterventionType: netPoints >= 50 ? 'Konseling Individual + Kontrak Perilaku + Pemanggilan Orang Tua' : 'Bimbingan Konseling Individual & Pendampingan Persuasif Wali Kelas'
      }
    };
  }
}
