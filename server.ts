import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const logGeminiQuotaFallback = (featureName: string, error: any) => {
  const errStr = String(error?.message || error || '');
  const isQuota = error?.status === 429 || error?.code === 429 || errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Quota');
  const isUnavailable = error?.status === 503 || error?.code === 503 || errStr.includes('503') || errStr.includes('UNAVAILABLE') || errStr.includes('high demand');

  if (isQuota) {
    console.warn(`[Gemini API] Free tier quota limit reached (429) for ${featureName}. Serving intelligent fallback response.`);
  } else if (isUnavailable) {
    console.warn(`[Gemini API] Upstream model high demand (503) for ${featureName}. Serving intelligent fallback response.`);
  } else {
    console.warn(`[Gemini API] Error in ${featureName}, using fallback:`, error?.message || error);
  }
};

// 1. Endpoint: Generate RPL / Modul Ajar BK
app.post('/api/gemini/generate-rpl', async (req, res) => {
  try {
    const { topic, bidang, fase, aspek, alokasi, metode } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      // High-quality structured fallback RPL if no API key
      return res.json({
        success: true,
        source: 'fallback',
        data: {
          title: topic || 'Pengembangan Potensi Diri & Regulasi Diri',
          fase: fase || 'Fase D (SMP)',
          bidang: bidang || 'Pribadi',
          aspekCode: aspek || 'SKKPD-3',
          aspekName: 'Kematangan Emosi & Intelektual',
          alokasiWaktu: alokasi || '2 x 45 Menit',
          profilPancasila: ['Mandiri', 'Bernalar Kritis', 'Gotong Royong'],
          metode: metode || 'Experiential Learning & Diskusi Kelompok',
          media: ['Slide Interaktif', 'Lembar Kerja Refleksi (LKPD)', 'Video Studi Kasus'],
          tujuanPengenalan: `Peserta didik mampu memahami konsep dasar dan relevansi ${topic || 'pengembangan diri'} dalam kehidupan sekolah.`,
          tujuanAkomodasi: `Peserta didik meyakini pentingnya penerapan sikap positif dan regulasi emosi terkait ${topic || 'pengembangan diri'}.`,
          tujuanTindakan: `Peserta didik mampu menyusun rencana aksi nyata dan mempraktikkan keterampilan ${topic || 'pengembangan diri'} secara terukur.`,
          langkahPendahuluan: [
            'Guru BK membuka sesi dengan salam, doa bersama, dan pembinaan suasana hangat.',
            'Apersepsi singkat dan pengantar tujuan layanan bimbingan klasikal.',
            'Penjelasan langkah-langkah kegiatan dan kesepakatan komitmen kelas.'
          ],
          langkahInti: [
            `Tahap Pengalaman (Experience): Peserta didik mengamati tayangan simulasi/kasus tentang ${topic || 'topik layanan'}.`,
            'Tahap Refleksi (Reflective Observation): Peserta didik mendiskusikan perasaan dan pembelajaran dari kasus tersebut.',
            'Tahap Konseptualisasi (Abstract Conceptualization): Guru BK memfasilitasi pemahaman teori dan strategi praktis.',
            'Tahap Aplikasi (Active Experimentation): Peserta didik mengisi LKPD komitmen tindakan nyata secara mandiri/berpasangan.'
          ],
          langkahPenutup: [
            'Peserta didik bersama Guru BK merumuskan kesimpulan utama layanan.',
            'Guru BK memberikan penguatan, apresiasi, dan do’a penutup.'
          ],
          evaluasiProses: [
            'Keterlibatan aktif dan antusiasme peserta didik selama diskusi.',
            'Dinamika kerjasama dan sikap saling menghargai pendapat.'
          ],
          evaluasiHasil: [
            'Instrumen pemahaman diri (Understanding) pasca layanan.',
            'Rencana aksi nyata (Action Plan) yang dituangkan dalam LKPD.'
          ],
          materiBimbingan: {
            ringkasanMateri: `Materi layanan bimbingan mengenai ${topic || 'pengembangan diri'} bertujuan membekali peserta didik dengan pemahaman mendalam, kesadaran emosional, dan keterampilan praktis.`,
            poinMateri: [
              `Pengertian dan esensi utama ${topic || 'pengembangan diri'} dalam Kurikulum Merdeka.`,
              'Faktor-faktor internal dan eksternal yang mempengaruhi perkembangan emosi/sosial peserta didik.',
              'Langkah konkret membangun kebiasaan positif dan komitmen tindakan nyata di sekolah.'
            ],
            studiKasus: `Seorang siswa menghadapi tantangan terkait ${topic || 'topik ini'} saat berinteraksi dengan teman sekelas, kemudian belajar menerapkan strategi penyesuaian diri yang bijak.`,
            tipsPraktis: [
              'Lakukan refleksi diri harian selama 5 menit.',
              'Gunakan komunikasi asertif saat menyampaikan gagasan.',
              'Konsultasikan ke Guru BK jika menemukan kendala belajar atau emosional.'
            ]
          },
          lkpd: {
            judulLkpd: `Lembar Kerja Peserta Didik (LKPD): ${topic || 'Pengembangan Diri'}`,
            instruksi: 'Bacalah petunjuk dengan seksama, diskusikan bersama teman atau isi secara mandiri, dan tuangkan rencana aksi nyatamu!',
            pertanyaanRefleksi: [
              `Apa hal paling penting yang kamu pelajari dari materi ${topic || 'layanan ini'}?`,
              'Bagaimana pengalaman pribadimu yang berkaitan dengan topik bimbingan hari ini?',
              'Sebutkan 2 tantangan utama yang sering kamu hadapi dan cara mengatasinya!'
            ],
            lembarAksiNyata: 'KOMITMEN SAYA: Mulai hari ini saya akan menerapkan sikap positif dan disiplin dalam kehidupan sehari-hari.',
            rubrikPenilaian: 'Penilaian mencakup pemahaman materi (40%), keaktifan refleksi (30%), dan kejelasan rencana aksi (30%).'
          },
          pptOutline: {
            slideJudul: topic || 'Pengembangan Potensi Diri',
            slides: [
              {
                slideNo: 1,
                title: 'Pengantar & Tujuan Layanan',
                bulletPoints: ['Mengapa topik ini penting untuk kita', 'Tujuan layanan bimbingan klasikal hari ini'],
                speakerNotes: 'Sapa siswa dengan hangat dan mulailah dengan ice breaking singkat.'
              },
              {
                slideNo: 2,
                title: 'Konsep Utama & Pemahaman Diri',
                bulletPoints: ['Poin-poin penting materi', 'Contoh penerapannya dalam kehidupan sekolah'],
                speakerNotes: 'Gunakan bahasa yang santai dan interaktif saat memaparkan materi.'
              },
              {
                slideNo: 3,
                title: 'Refleksi Kelompok & Pengisian LKPD',
                bulletPoints: ['Instruksi kerja kelompok', 'Pengisian lembar refleksi mandiri'],
                speakerNotes: 'Bimbing siswa saat mengisi LKPD.'
              }
            ],
            notebookLmPrompt: `Buatkan naskah panduan dan audio podcast edukasi interaktif 2 pembicara yang membahas topik "${topic || 'Pengembangan Diri'}" untuk peserta didik.`
          }
        }
      });
    }

    const prompt = `Anda adalah Asisten Pakar Bimbingan Konseling (BK) Kurikulum Merdeka Indonesia. 
Buatkan Paket Lengkap Modul Ajar / RPL BK (Rencana Pelaksanaan Layanan) yang SANGAT LENGKAP, SANGAT PRAKTIS, DAN SIAP DIGUNAKAN GURU.
Paket ini WAJIB mencakup 4 bagian utama:
1. RPL Utama (Identitas, Aspek SKKPD, Tujuan Pengenalan/Akomodasi/Tindakan, Langkah Pendahuluan/Inti/Penutup, Evaluasi).
2. Lampiran 1 - Materi Bimbingan / Layanan (Ringkasan materi lengkap, 3 gagasan utama, 1 studi kasus nyata, 3 tips praktis).
3. Lampiran 2 - LKPD / Lembar Kerja Peserta Didik (Judul LKPD, Instruksi, 3-4 Pertanyaan Refleksi Mendalam, Lembar Aksi Nyata/Komitmen Siswa, Rubrik Penilaian).
4. Lampiran 3 - Outline Presentation Slide (PPT) & NotebookLM Prompt (Judul Slide, 4-5 slide outline lengkap dengan bullet points & speaker notes, serta 1 prompt teks lengkap untuk diimpor ke NotebookLM agar menghasilkan podcast/audio overview).

Detail Parameter Request:
- Topik Layanan: "${topic}"
- Bidang Layanan: "${bidang || 'Pribadi'}"
- Fase: "${fase || 'Fase D (SMP)'}"
- Kode/Aspek SKKPD: "${aspek || 'SKKPD-3'}"
- Alokasi Waktu: "${alokasi || '2 x 45 Menit'}"
- Metode: "${metode || 'Experiential Learning'}"

Berikan output persis dalam format JSON dengan struktur:
{
  "title": string,
  "fase": string,
  "bidang": string,
  "aspekCode": string,
  "aspekName": string,
  "alokasiWaktu": string,
  "profilPancasila": string[],
  "metode": string,
  "media": string[],
  "tujuanPengenalan": string,
  "tujuanAkomodasi": string,
  "tujuanTindakan": string,
  "langkahPendahuluan": string[],
  "langkahInti": string[],
  "langkahPenutup": string[],
  "evaluasiProses": string[],
  "evaluasiHasil": string[],
  "materiBimbingan": {
    "ringkasanMateri": string,
    "poinMateri": string[],
    "studiKasus": string,
    "tipsPraktis": string[]
  },
  "lkpd": {
    "judulLkpd": string,
    "instruksi": string,
    "pertanyaanRefleksi": string[],
    "lembarAksiNyata": string,
    "rubrikPenilaian": string
  },
  "pptOutline": {
    "slideJudul": string,
    "slides": [
      {
        "slideNo": number,
        "title": string,
        "bulletPoints": string[],
        "speakerNotes": string
      }
    ],
    "notebookLmPrompt": string
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            fase: { type: Type.STRING },
            bidang: { type: Type.STRING },
            aspekCode: { type: Type.STRING },
            aspekName: { type: Type.STRING },
            alokasiWaktu: { type: Type.STRING },
            profilPancasila: { type: Type.ARRAY, items: { type: Type.STRING } },
            metode: { type: Type.STRING },
            media: { type: Type.ARRAY, items: { type: Type.STRING } },
            tujuanPengenalan: { type: Type.STRING },
            tujuanAkomodasi: { type: Type.STRING },
            tujuanTindakan: { type: Type.STRING },
            langkahPendahuluan: { type: Type.ARRAY, items: { type: Type.STRING } },
            langkahInti: { type: Type.ARRAY, items: { type: Type.STRING } },
            langkahPenutup: { type: Type.ARRAY, items: { type: Type.STRING } },
            evaluasiProses: { type: Type.ARRAY, items: { type: Type.STRING } },
            evaluasiHasil: { type: Type.ARRAY, items: { type: Type.STRING } },
            materiBimbingan: {
              type: Type.OBJECT,
              properties: {
                ringkasanMateri: { type: Type.STRING },
                poinMateri: { type: Type.ARRAY, items: { type: Type.STRING } },
                studiKasus: { type: Type.STRING },
                tipsPraktis: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['ringkasanMateri', 'poinMateri', 'studiKasus', 'tipsPraktis']
            },
            lkpd: {
              type: Type.OBJECT,
              properties: {
                judulLkpd: { type: Type.STRING },
                instruksi: { type: Type.STRING },
                pertanyaanRefleksi: { type: Type.ARRAY, items: { type: Type.STRING } },
                lembarAksiNyata: { type: Type.STRING },
                rubrikPenilaian: { type: Type.STRING },
              },
              required: ['judulLkpd', 'instruksi', 'pertanyaanRefleksi', 'lembarAksiNyata', 'rubrikPenilaian']
            },
            pptOutline: {
              type: Type.OBJECT,
              properties: {
                slideJudul: { type: Type.STRING },
                slides: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      slideNo: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      bulletPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                      speakerNotes: { type: Type.STRING }
                    },
                    required: ['slideNo', 'title', 'bulletPoints', 'speakerNotes']
                  }
                },
                notebookLmPrompt: { type: Type.STRING }
              },
              required: ['slideJudul', 'slides', 'notebookLmPrompt']
            }
          },
          required: [
            'title', 'fase', 'bidang', 'aspekCode', 'aspekName', 'alokasiWaktu',
            'profilPancasila', 'metode', 'media', 'tujuanPengenalan', 'tujuanAkomodasi',
            'tujuanTindakan', 'langkahPendahuluan', 'langkahInti', 'langkahPenutup',
            'evaluasiProses', 'evaluasiHasil', 'materiBimbingan', 'lkpd', 'pptOutline'
          ],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini', data: parsedData });
  } catch (error: any) {
    logGeminiQuotaFallback('generate-rpl', error);
    const { topic, bidang, fase, aspek, alokasi, metode } = req.body || {};
    return res.json({
      success: true,
      source: 'fallback',
      data: {
        title: topic || 'Pengembangan Potensi Diri & Regulasi Diri',
        fase: fase || 'Fase D (SMP)',
        bidang: bidang || 'Pribadi',
        aspekCode: aspek || 'SKKPD-3',
        aspekName: 'Kematangan Emosi & Intelektual',
        alokasiWaktu: alokasi || '2 x 45 Menit',
        profilPancasila: ['Mandiri', 'Bernalar Kritis', 'Gotong Royong'],
        metode: metode || 'Experiential Learning & Diskusi Kelompok',
        media: ['Slide Interaktif', 'Lembar Kerja Refleksi (LKPD)', 'Video Studi Kasus'],
        tujuanPengenalan: `Peserta didik mampu memahami konsep dasar dan relevansi ${topic || 'pengembangan diri'} dalam kehidupan sekolah.`,
        tujuanAkomodasi: `Peserta didik meyakini pentingnya penerapan sikap positif dan regulasi emosi terkait ${topic || 'pengembangan diri'}.`,
        tujuanTindakan: `Peserta didik mampu menyusun rencana aksi nyata dan mempraktikkan keterampilan ${topic || 'pengembangan diri'} secara terukur.`,
        langkahPendahuluan: [
          'Guru BK membuka sesi dengan salam, doa bersama, dan pembinaan suasana hangat.',
          'Apersepsi singkat dan pengantar tujuan layanan bimbingan klasikal.',
          'Penjelasan langkah-langkah kegiatan dan kesepakatan komitmen kelas.'
        ],
        langkahInti: [
          `Tahap Pengalaman (Experience): Peserta didik mengamati tayangan simulasi/kasus tentang ${topic || 'topik layanan'}.`,
          'Tahap Refleksi (Reflective Observation): Peserta didik mendiskusikan perasaan dan pembelajaran dari kasus tersebut.',
          'Tahap Konseptualisasi (Abstract Conceptualization): Guru BK memfasilitasi pemahaman teori dan strategi praktis.',
          'Tahap Aplikasi (Active Experimentation): Peserta didik mengisi LKPD komitmen tindakan nyata secara mandiri/berpasangan.'
        ],
        langkahPenutup: [
          'Peserta didik bersama Guru BK merumuskan kesimpulan utama layanan.',
          'Guru BK memberikan penguatan, apresiasi, dan do’a penutup.'
        ],
        evaluasiProses: [
          'Keterlibatan aktif dan antusiasme peserta didik selama diskusi.',
          'Dinamika kerjasama dan sikap saling menghargai pendapat.'
        ],
        evaluasiHasil: [
          'Instrumen pemahaman diri (Understanding) pasca layanan.',
          'Rencana aksi nyata (Action Plan) yang dituangkan dalam LKPD.'
        ],
        materiBimbingan: {
          ringkasanMateri: `Materi layanan bimbingan mengenai ${topic || 'pengembangan diri'} bertujuan membekali peserta didik dengan pemahaman mendalam, kesadaran emosional, dan keterampilan praktis.`,
          poinMateri: [
            `Pengertian dan esensi utama ${topic || 'pengembangan diri'} dalam Kurikulum Merdeka.`,
            'Faktor-faktor internal dan eksternal yang mempengaruhi perkembangan emosi/sosial peserta didik.',
            'Langkah konkret membangun kebiasaan positif dan komitmen tindakan nyata di sekolah.'
          ],
          studiKasus: `Seorang siswa menghadapi tantangan terkait ${topic || 'topik ini'} saat berinteraksi dengan teman sekelas, kemudian belajar menerapkan strategi penyesuaian diri yang bijak.`,
          tipsPraktis: [
            'Lakukan refleksi diri harian selama 5 menit.',
            'Gunakan komunikasi asertif saat menyampaikan gagasan.',
            'Konsultasikan ke Guru BK jika menemukan kendala belajar atau emosional.'
          ]
        },
        lkpd: {
          judulLkpd: `Lembar Kerja Peserta Didik (LKPD): ${topic || 'Pengembangan Diri'}`,
          instruksi: 'Bacalah petunjuk dengan seksama, diskusikan bersama teman atau isi secara mandiri, dan tuangkan rencana aksi nyatamu!',
          pertanyaanRefleksi: [
            `Apa hal paling penting yang kamu pelajari dari materi ${topic || 'layanan ini'}?`,
            'Bagaimana pengalaman pribadimu yang berkaitan dengan topik bimbingan hari ini?',
            'Sebutkan 2 tantangan utama yang sering kamu hadapi dan cara mengatasinya!'
          ],
          lembarAksiNyata: 'KOMITMEN SAYA: Mulai hari ini saya akan menerapkan sikap positif dan disiplin dalam kehidupan sehari-hari.',
          rubrikPenilaian: 'Penilaian mencakup pemahaman materi (40%), keaktifan refleksi (30%), dan kejelasan rencana aksi (30%).'
        },
        pptOutline: {
          slideJudul: topic || 'Pengembangan Potensi Diri',
          slides: [
            {
              slideNo: 1,
              title: 'Pengantar & Tujuan Layanan',
              bulletPoints: ['Mengapa topik ini penting untuk kita', 'Tujuan layanan bimbingan klasikal hari ini'],
              speakerNotes: 'Sapa siswa dengan hangat dan mulailah dengan ice breaking singkat.'
            },
            {
              slideNo: 2,
              title: 'Konsep Utama & Pemahaman Diri',
              bulletPoints: ['Poin-poin penting materi', 'Contoh penerapannya dalam kehidupan sekolah'],
              speakerNotes: 'Gunakan bahasa yang santai dan interaktif saat memaparkan materi.'
            },
            {
              slideNo: 3,
              title: 'Refleksi Kelompok & Pengisian LKPD',
              bulletPoints: ['Instruksi kerja kelompok', 'Pengisian lembar refleksi mandiri'],
              speakerNotes: 'Bimbing siswa saat mengisi LKPD.'
            }
          ],
          notebookLmPrompt: `Buatkan naskah panduan dan audio podcast edukasi interaktif 2 pembicara yang membahas topik "${topic || 'Pengembangan Diri'}" untuk peserta didik.`
        }
      }
    });
  }
});

// 4. Endpoint: Diagnose VAK Learning Style
app.post('/api/gemini/diagnose-vak', async (req, res) => {
  try {
    const { visualScore, auditoryScore, kinestheticScore, studentName } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      const dominant = visualScore >= auditoryScore && visualScore >= kinestheticScore ? 'Visual' : auditoryScore >= kinestheticScore ? 'Auditori' : 'Kinestetik';
      return res.json({
        success: true,
        source: 'fallback',
        data: {
          dominantStyle: dominant,
          characteristics: [
            dominant === 'Visual' ? 'Sangat peka terhadap warna, gambar, diagram, dan peta konsep.' : dominant === 'Auditori' ? 'Sangat responsif terhadap penjelasan lisan, diskusi, dan rekaman audio.' : 'Lebih cepat memahami melalui praktik langsung, gerakan fisik, dan eksperimen.'
          ],
          learningStrategies: [
            dominant === 'Visual' ? 'Gunakan mind map, catatan berwarna (color-coded), dan infografis ringkas.' : dominant === 'Auditori' ? 'Gunakan diskusi kelompok, bacaan bersuara, dan rekaman ringkasan materi.' : 'Gunakan simulasi, roleplay, belajar sambil bergerak, dan perbanyak latih tanding.'
          ],
          teacherTips: `Dalam pembelajaran berdiferensiasi, sediakan produk tugas berupa ${dominant === 'Visual' ? 'poster/infografis visual' : dominant === 'Auditori' ? 'podcast/presentasi lisan' : 'proyek peragaan fisik/simulasi'}.`
        }
      });
    }

    const prompt = `Analisis profil gaya belajar VAK siswa ${studentName || 'Siswa'}:
Visual: ${visualScore}%, Auditori: ${auditoryScore}%, Kinestetik: ${kinestheticScore}%
Berikan tips diagnosa BK dalam JSON:
{
  "dominantStyle": string,
  "characteristics": string[],
  "learningStrategies": string[],
  "teacherTips": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            dominantStyle: { type: Type.STRING },
            characteristics: { type: Type.ARRAY, items: { type: Type.STRING } },
            learningStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
            teacherTips: { type: Type.STRING },
          },
          required: ['dominantStyle', 'characteristics', 'learningStrategies', 'teacherTips'],
        },
      },
    });

    return res.json({ success: true, source: 'gemini', data: JSON.parse(response.text || '{}') });
  } catch (error: any) {
    logGeminiQuotaFallback('diagnose-vak', error);
    const { visualScore = 40, auditoryScore = 30, kinestheticScore = 30 } = req.body || {};
    const dominant = visualScore >= auditoryScore && visualScore >= kinestheticScore ? 'Visual' : auditoryScore >= kinestheticScore ? 'Auditori' : 'Kinestetik';
    return res.json({
      success: true,
      source: 'fallback',
      data: {
        dominantStyle: dominant,
        characteristics: [
          dominant === 'Visual' ? 'Sangat peka terhadap warna, gambar, diagram, dan peta konsep.' : dominant === 'Auditori' ? 'Sangat responsif terhadap penjelasan lisan, diskusi, dan rekaman audio.' : 'Lebih cepat memahami melalui praktik langsung, gerakan fisik, dan eksperimen.'
        ],
        learningStrategies: [
          dominant === 'Visual' ? 'Gunakan mind map, catatan berwarna (color-coded), dan infografis ringkas.' : dominant === 'Auditori' ? 'Gunakan diskusi kelompok, bacaan bersuara, dan rekaman ringkasan materi.' : 'Gunakan simulasi, roleplay, belajar sambil bergerak, dan perbanyak latih tanding.'
        ],
        teacherTips: `Dalam pembelajaran berdiferensiasi, sediakan produk tugas berupa ${dominant === 'Visual' ? 'poster/infografis visual' : dominant === 'Auditori' ? 'podcast/presentasi lisan' : 'proyek peragaan fisik/simulasi'}.`
      }
    });
  }
});

// 2. Endpoint: Analyze AKPD Data & Counselor Insight
app.post('/api/gemini/analyze-akpd', async (req, res) => {
  try {
    const { className, stats, topItems } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: 'fallback',
        analysis: {
          summary: `Hasil AKPD Kelas ${className || 'Target'} menunjukkan prioritas kebutuhan tertinggi terletak pada Bidang ${
            stats?.avgPribadi > stats?.avgBelajar ? 'Pribadi & Sosial' : 'Belajar & Karir'
          }. Siswa membutuhkan pendampingan intrapersonal dan regulasi diri.`,
          rootCauses: [
            'Pengaruh tekanan pertemanan sebaya (peer pressure) dan dinamika media sosial.',
            'Belum optimalnya strategi manajemen waktu belajar dan pengaturan gadget.',
            'Kecemasan menghadapi beban asesmen dan transisi pemetaan cita-cita.'
          ],
          recommendations: [
            'Laksanakan Bimbingan Klasikal bertema Manajemen Emosi dan Waktu.',
            'Buka pendaftaran Konseling Kelompok untuk kelompok siswa dengan profil indikator serupa.',
            'Kolaborasi dengan wali kelas untuk pemantauan pembiasaan positif mingguan.'
          ],
          actionPlan: [
            'Minggu 1: Bimbingan Klasikal - Regulasi Diri & Stop Prokrastinasi.',
            'Minggu 2: Konseling Kelompok Sebaya - Penguatan Kepercayaan Diri.',
            'Minggu 3: Evaluasi berkala & Layanan Konseling Individu terpilih.'
          ]
        }
      });
    }

    const prompt = `Anda adalah konselor senior Bimbingan Konseling.
Analisis data AKPD (Angket Kebutuhan Peserta Didik) untuk Kelas ${className}:
Persentase Kebutuhan:
- Pribadi: ${stats?.avgPribadi}%
- Sosial: ${stats?.avgSosial}%
- Belajar: ${stats?.avgBelajar}%
- Karir: ${stats?.avgKarir}%

5 Masalah Prioritas Utama:
${JSON.stringify(topItems, null, 2)}

Buatkan analisis komprehensif konselor BK dalam JSON:
{
  "summary": string,
  "rootCauses": string[],
  "recommendations": string[],
  "actionPlan": string[]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            rootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['summary', 'rootCauses', 'recommendations', 'actionPlan'],
        },
      },
    });

    return res.json({ success: true, source: 'gemini', analysis: JSON.parse(response.text || '{}') });
  } catch (error: any) {
    logGeminiQuotaFallback('analyze-akpd', error);
    const { className, stats } = req.body || {};
    return res.json({
      success: true,
      source: 'fallback',
      analysis: {
        summary: `Hasil AKPD Kelas ${className || 'Target'} menunjukkan prioritas kebutuhan tertinggi terletak pada Bidang ${
          (stats?.avgPribadi || 0) > (stats?.avgBelajar || 0) ? 'Pribadi & Sosial' : 'Belajar & Karir'
        }. Siswa membutuhkan pendampingan intrapersonal dan regulasi diri.`,
        rootCauses: [
          'Pengaruh tekanan pertemanan sebaya (peer pressure) dan dinamika media sosial.',
          'Belum optimalnya strategi manajemen waktu belajar dan pengaturan gadget.',
          'Kecemasan menghadapi beban asesmen dan transisi pemetaan cita-cita.'
        ],
        recommendations: [
          'Laksanakan Bimbingan Klasikal bertema Manajemen Emosi dan Waktu.',
          'Buka pendaftaran Konseling Kelompok untuk kelompok siswa dengan profil indikator serupa.',
          'Kolaborasi dengan wali kelas untuk pemantauan pembiasaan positif mingguan.'
        ],
        actionPlan: [
          'Minggu 1: Bimbingan Klasikal - Regulasi Diri & Stop Prokrastinasi.',
          'Minggu 2: Konseling Kelompok Sebaya - Penguatan Kepercayaan Diri.',
          'Minggu 3: Evaluasi berkala & Layanan Konseling Individu terpilih.'
        ]
      }
    });
  }
});

// 3. Endpoint: Generate Konseling & Guidance Script
app.post('/api/gemini/generate-script', async (req, res) => {
  try {
    const { serviceType, studentProblem, studentName } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: 'fallback',
        script: {
          opening: `Selamat pagi/siang ${studentName || 'Ananda'}. Terima kasih sudah bersedia hadir mengobrol santai bersama Bapak/Ibu Guru BK hari ini. Bagaimana kabarmu hari ini?`,
          coreExploration: `Bapak/Ibu BK mengamati atau menerima catatan mengenai ${studentProblem || 'kondisi Ananda'}. Bisakah Ananda ceritakan apa yang sebenarnya kamu rasakan saat situasi tersebut terjadi?`,
          empathyPhrases: [
            'Bapak/Ibu sangat memahami bahwa situasi tersebut tidak mudah bagi Ananda.',
            'Terima kasih sudah jujur dan terbuka mengekspresikan perasaanmu.'
          ],
          solutionCoaching: `Menurut Ananda, langkah atau kebiasaan kecil apa yang bisa kamu coba mulai besok untuk memperbaiki kondisi ini?`,
          closingCommitment: `Bagus sekali! Mari kita sepakati komitmen ini, dan Bapak/Ibu BK akan selalu siap mendukungmu. Sampai bertemu minggu depan untuk melihat kemajuanmu ya!`
        }
      });
    }

    const prompt = `Anda adalah Konselor BK Profesional berpengalaman. 
Buatkan draf panduan skrip dialog empatik untuk Guru BK saat melaksanakan layanan:
- Jenis Layanan: "${serviceType || 'Konseling Individu'}"
- Nama Siswa: "${studentName || 'Siswa'}"
- Permasalahan / Gambaran Kasus: "${studentProblem}"

Format JSON:
{
  "opening": string,
  "coreExploration": string,
  "empathyPhrases": string[],
  "solutionCoaching": string,
  "closingCommitment": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            opening: { type: Type.STRING },
            coreExploration: { type: Type.STRING },
            empathyPhrases: { type: Type.ARRAY, items: { type: Type.STRING } },
            solutionCoaching: { type: Type.STRING },
            closingCommitment: { type: Type.STRING },
          },
          required: ['opening', 'coreExploration', 'empathyPhrases', 'solutionCoaching', 'closingCommitment'],
        },
      },
    });

    return res.json({ success: true, source: 'gemini', script: JSON.parse(response.text || '{}') });
  } catch (error: any) {
    logGeminiQuotaFallback('generate-counseling-script', error);
    const { studentProblem, studentName } = req.body || {};
    return res.json({
      success: true,
      source: 'fallback',
      script: {
        opening: `Selamat pagi/siang ${studentName || 'Ananda'}. Terima kasih sudah bersedia hadir mengobrol santai bersama Bapak/Ibu Guru BK hari ini. Bagaimana kabarmu hari ini?`,
        coreExploration: `Bapak/Ibu BK mengamati atau menerima catatan mengenai ${studentProblem || 'kondisi Ananda'}. Bisakah Ananda ceritakan apa yang sebenarnya kamu rasakan saat situasi tersebut terjadi?`,
        empathyPhrases: [
          'Bapak/Ibu sangat memahami bahwa situasi tersebut tidak mudah bagi Ananda.',
          'Terima kasih sudah jujur dan terbuka mengekspresikan perasaanmu.'
        ],
        solutionCoaching: `Menurut Ananda, langkah atau kebiasaan kecil apa yang bisa kamu coba mulai besok untuk memperbaiki kondisi ini?`,
        closingCommitment: `Bagus sekali! Mari kita sepakati komitmen ini, dan Bapak/Ibu BK akan selalu siap mendukungmu. Sampai bertemu minggu depan untuk melihat kemajuanmu ya!`
      }
    });
  }
});

// 5. Endpoint: Diagnose Student Behavioral Trend & Psychological Analysis
app.post('/api/gemini/diagnose-behavior', async (req, res) => {
  try {
    const { studentName, studentClass, netPoints, alpaCount, violations, services, achievements } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        success: true,
        source: 'fallback',
        data: {
          primaryProblemTrend: alpaCount > 3 ? 'Indisiplin Kehadiran & Prokrastinasi Akademik' : netPoints >= 50 ? 'Eskalasi Pelanggaran Tata Tertib & Kontrol Diri' : 'Variasi Perilaku Adaptif Remaja',
          psychologicalAnalysis: `Siswa ${studentName || 'Siswa'} (${studentClass || 'Kelas'}) menunjukkan kecenderungan pola perilaku yang memerlukan pendampingan empatik. ${alpaCount > 0 ? `Terdapat riwayat ketidakhadiran tanpa keterangan sebanyak ${alpaCount} kali yang mengindikasikan kemungkinan hambatan motivasi internal atau kendala lingkungan sosial/keluarga.` : ''} ${netPoints > 0 ? `Akumulasi bobot pembinaan mencapai ${netPoints} bobot.` : ''}`,
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
      });
    }

    const prompt = `Anda adalah Pakar Psikologi Anak & Konselor Senior Bimbingan Konseling (BK) Sekolah.
Analisis data riwayat siswa berikut:
- Nama Siswa: ${studentName || 'Siswa'} (${studentClass || '-'})
- Akumulasi Bobot Pelanggaran (Net): ${netPoints || 0}
- Total Alpa / Tanpa Keterangan: ${alpaCount || 0}x
- Riwayat Pelanggaran: ${JSON.stringify(violations || [], null, 2)}
- Sesi Konseling Terdaftar: ${JSON.stringify(services || [], null, 2)}
- Riwayat Apresiasi/Prestasi: ${JSON.stringify(achievements || [], null, 2)}

Buatkan analisis psikologis perilaku siswa dan draf rekomendasi tindak lanjut BK secara ilmiah, empatik, dan praktis dalam format JSON berikut:
{
  "primaryProblemTrend": string,
  "psychologicalAnalysis": string,
  "riskLevel": "Rendah" | "Sedang" | "Tinggi" | "Kritis",
  "rootCauses": string[],
  "followUpRecommendations": string[],
  "suggestedInterventionType": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryProblemTrend: { type: Type.STRING },
            psychologicalAnalysis: { type: Type.STRING },
            riskLevel: { type: Type.STRING },
            rootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            followUpRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedInterventionType: { type: Type.STRING },
          },
          required: [
            'primaryProblemTrend', 'psychologicalAnalysis', 'riskLevel',
            'rootCauses', 'followUpRecommendations', 'suggestedInterventionType'
          ],
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini', data: parsedData });
  } catch (error: any) {
    logGeminiQuotaFallback('diagnose-student-behavior', error);
    const { studentName, studentClass, netPoints = 0, alpaCount = 0 } = req.body || {};
    return res.json({
      success: true,
      source: 'fallback',
      data: {
        primaryProblemTrend: alpaCount > 3 ? 'Indisiplin Kehadiran & Prokrastinasi Akademik' : netPoints >= 50 ? 'Eskalasi Pelanggaran Tata Tertib & Kontrol Diri' : 'Variasi Perilaku Adaptif Remaja',
        psychologicalAnalysis: `Siswa ${studentName || 'Siswa'} (${studentClass || 'Kelas'}) menunjukkan kecenderungan pola perilaku yang memerlukan pendampingan empatik. ${alpaCount > 0 ? `Terdapat riwayat ketidakhadiran tanpa keterangan sebanyak ${alpaCount} kali yang mengindikasikan kemungkinan hambatan motivasi internal.` : ''} ${netPoints > 0 ? `Akumulasi bobot pembinaan mencapai ${netPoints} bobot.` : ''}`,
        riskLevel: netPoints >= 50 || alpaCount >= 5 ? 'Kritis' : netPoints >= 25 || alpaCount >= 3 ? 'Tinggi' : netPoints >= 10 ? 'Sedang' : 'Rendah',
        rootCauses: [
          'Kurangnya regulasi diri dan manajemen waktu belajar harian.',
          'Dinamika hubungan teman sebaya yang memengaruhi prioritas kehadiran.',
          'Kebutuhan akan penguatan emosional dan komunikasi terbuka di lingkungan sekolah.'
        ],
        followUpRecommendations: [
          'Lakukan Sesi Konseling Individual dengan pendekatan Restoratif (Restorative Justice).',
          'Jadwalkan Ruang Dialog bersama Orang Tua/Wali dan Wali Kelas untuk kesepakatan komitmen bersama.',
          'Libatkan siswa dalam program pembinaan karakter bertahap.'
        ],
        suggestedInterventionType: netPoints >= 50 ? 'Konseling Individual + Kontrak Perilaku + Pemanggilan Orang Tua' : 'Bimbingan Konseling Individual & Pendampingan Persuasif Wali Kelas'
      }
    });
  }
});

// 6. Endpoint: AI Assistant for BK Discipline Forms
app.post('/api/gemini/generate-discipline-form-ai', async (req, res) => {
  try {
    const { formType, studentName, studentClass, alpaCount, violationCount, netPoints, violationsSummary } = req.body;
    const ai = getGeminiClient();

    const stName = studentName || 'Siswa';
    const stClass = studentClass || '-';
    const probContext = `Siswa ${stName} (${stClass}) memiliki catatan: ${alpaCount || 0}x Alpa/Tanpa Keterangan, ${violationCount || 0} kasus pelanggaran, akumulasi ${netPoints || 0} bobot pembinaan. Detail: ${violationsSummary || 'Pembinaan karakter dan disiplin sekolah.'}`;

    if (!ai) {
      // Smart Fallback AI Response Generator
      let fallbackData: any = {};

      if (formType === 'perjanjian') {
        fallbackData = {
          violationSummary: `Siswa ${stName} (${stClass}) ${alpaCount > 0 ? `tercatat ${alpaCount}x tidak hadir tanpa keterangan (Alpa)` : ''} ${netPoints > 0 ? `serta akumulasi ${netPoints} bobot pelanggaran kedisiplinan.` : 'memerlukan pembinaan disiplin positif.'}`,
          agreementPoints: [
            `Hadir di sekolah tepat waktu paling lambat pukul 06.45 WIB setiap hari belajar.`,
            `Menyerahkan surat izin resmi/dokter yang ditandatangani orang tua jika berhalangan hadir.`,
            `Mematuhi seluruh tata tertib sekolah, berpakaian seragam rapi, dan bersikap sopan santun.`,
            `Aktif mengikuti sesi pembinaan dan bimbingan konseling secara berkala.`
          ],
          consequences: `Menerima sanksi skorsing sementara dan pemanggilan orang tua/wali apabila mengulangi pelanggaran serupa.`
        };
      } else if (formType === 'kontrak') {
        fallbackData = {
          targetBehavior: `Meningkatkan persentase kehadiran 100% dan mematuhi seluruh tata tertib kelas & sekolah secara konsisten.`,
          agreedPositiveBehaviors: [
            `Datang ke sekolah sebelum bel masuk berbunyi (06.45 WIB).`,
            `Mengumpulkan seluruh tugas mata pelajaran tepat waktu.`,
            `Menjaga ketertiban kelas dan tidak melakukan pelanggaran disiplin sekolah.`
          ],
          rewards: `Sertifikat Apresiasi Karakter Disiplin & Pengurangan/Pemulihan -10 Bobot Pembinaan Perilaku.`,
          sanctions: `Tugas restitusi kebersihan area sekolah selama 30 menit setelah jam pulang.`
        };
      } else if (formType === 'jurnal-pembinaan') {
        fallbackData = {
          problemDescription: `Siswa menunjukkan kecenderungan indisiplin pada ${alpaCount > 0 ? 'kehadiran sekolah' : 'tata tertib belajar'}. Perlu penguatan kesadaran diri dan restitusi.`,
          counselingApproach: `Pendekatan Restorative Counseling & Solution-Focused Brief Therapy (SFBT) untuk memicu tanggung jawab internal.`,
          restitutionAgreement: `Siswa menyadari kekurangannya dan berkomitmen memperbaiki kehadiran serta membuat jurnal harian mandiri.`,
          evaluationPlan: `Pemantauan berkala setiap akhir pekan bersama Guru BK dan Wali Kelas selama 2 minggu.`
        };
      } else if (formType === 'komitmen-rtl') {
        fallbackData = {
          personalCommitment: `Saya ${stName} berjanji secara sadar untuk merubah kebiasaan buruk dan menjadi pribadi yang lebih disiplin dan bertanggung jawab.`,
          actionSteps: [
            `Tidur lebih awal sebelum pukul 22.00 WIB untuk menghindari keterlambatan/bangun kesiangan.`,
            `Menyiapkan seragam dan perlengkapan sekolah pada malam hari.`,
            `Meminta tanda tangan wali kelas pada kartu kontrol harian setiap selesai jam pelajaran.`
          ],
          successIndicators: `Kehadiran 100% tepat waktu selama 14 hari berturut-turut tanpa pelanggaran baru.`,
          supportNeeded: `Pendampingan pengingat dari Orang Tua di rumah dan Bimbingan motivasi mingguan dari Guru BK.`
        };
      }

      return res.json({ success: true, source: 'fallback', data: fallbackData });
    }

    let prompt = '';
    let responseSchemaProps: any = {};

    if (formType === 'perjanjian') {
      prompt = `Buatkan draf isi Surat Perjanjian Siswa BK untuk: ${probContext}. Output JSON: { "violationSummary": string, "agreementPoints": string[], "consequences": string }`;
      responseSchemaProps = {
        violationSummary: { type: Type.STRING },
        agreementPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
        consequences: { type: Type.STRING }
      };
    } else if (formType === 'kontrak') {
      prompt = `Buatkan draf Kontrak Perilaku Positif Siswa BK untuk: ${probContext}. Output JSON: { "targetBehavior": string, "agreedPositiveBehaviors": string[], "rewards": string, "sanctions": string }`;
      responseSchemaProps = {
        targetBehavior: { type: Type.STRING },
        agreedPositiveBehaviors: { type: Type.ARRAY, items: { type: Type.STRING } },
        rewards: { type: Type.STRING },
        sanctions: { type: Type.STRING }
      };
    } else if (formType === 'jurnal-pembinaan') {
      prompt = `Buatkan draf Jurnal Pembinaan & Restitusi BK untuk: ${probContext}. Output JSON: { "problemDescription": string, "counselingApproach": string, "restitutionAgreement": string, "evaluationPlan": string }`;
      responseSchemaProps = {
        problemDescription: { type: Type.STRING },
        counselingApproach: { type: Type.STRING },
        restitutionAgreement: { type: Type.STRING },
        evaluationPlan: { type: Type.STRING }
      };
    } else {
      prompt = `Buatkan draf Lembar Komitmen & Rencana Tindak Lanjut (RTL) Siswa BK untuk: ${probContext}. Output JSON: { "personalCommitment": string, "actionSteps": string[], "successIndicators": string, "supportNeeded": string }`;
      responseSchemaProps = {
        personalCommitment: { type: Type.STRING },
        actionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
        successIndicators: { type: Type.STRING },
        supportNeeded: { type: Type.STRING }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: responseSchemaProps,
        },
      },
    });

    const parsedData = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini', data: parsedData });
  } catch (error: any) {
    logGeminiQuotaFallback('generate-discipline-form', error);
    const { formType, studentName = 'Siswa', studentClass = '-', alpaCount = 0, netPoints = 0 } = req.body || {};
    let fallbackData: any = {};
    if (formType === 'perjanjian') {
      fallbackData = {
        violationSummary: `Siswa ${studentName} (${studentClass}) ${alpaCount > 0 ? `tercatat ${alpaCount}x tidak hadir tanpa keterangan (Alpa)` : ''} ${netPoints > 0 ? `serta akumulasi ${netPoints} bobot pelanggaran.` : 'memerlukan pembinaan disiplin positif.'}`,
        agreementPoints: [
          'Hadir di sekolah tepat waktu paling lambat pukul 06.45 WIB setiap hari belajar.',
          'Menyerahkan surat izin resmi/dokter yang ditandatangani orang tua jika berhalangan hadir.',
          'Mematuhi seluruh tata tertib sekolah, berpakaian seragam rapi, dan bersikap sopan santun.',
          'Aktif mengikuti sesi pembinaan dan bimbingan konseling secara berkala.'
        ],
        consequences: 'Menerima sanksi skorsing sementara dan pemanggilan orang tua/wali apabila mengulangi pelanggaran serupa.'
      };
    } else if (formType === 'kontrak') {
      fallbackData = {
        targetBehavior: 'Meningkatkan persentase kehadiran 100% dan mematuhi seluruh tata tertib kelas & sekolah secara konsisten.',
        agreedPositiveBehaviors: [
          'Datang ke sekolah sebelum bel masuk berbunyi (06.45 WIB).',
          'Mengumpulkan seluruh tugas mata pelajaran tepat waktu.',
          'Menjaga ketertiban kelas dan tidak melakukan pelanggaran disiplin sekolah.'
        ],
        rewards: 'Sertifikat Apresiasi Karakter Disiplin & Pengurangan/Pemulihan -10 Bobot Pembinaan Perilaku.',
        sanctions: 'Tugas restitusi kebersihan area sekolah selama 30 menit setelah jam pulang.'
      };
    } else {
      fallbackData = {
        personalCommitment: `Saya ${studentName} berjanji secara sadar untuk merubah kebiasaan buruk dan menjadi pribadi yang lebih disiplin dan bertanggung jawab.`,
        actionSteps: [
          'Tidur lebih awal sebelum pukul 22.00 WIB untuk menghindari keterlambatan/bangun kesiangan.',
          'Menyiapkan seragam dan perlengkapan sekolah pada malam hari.',
          'Meminta tanda tangan wali kelas pada kartu kontrol harian setiap selesai jam pelajaran.'
        ],
        successIndicators: 'Kehadiran 100% tepat waktu selama 14 hari berturut-turut tanpa pelanggaran baru.',
        supportNeeded: 'Pendampingan pengingat dari Orang Tua di rumah dan Bimbingan motivasi mingguan dari Guru BK.'
      };
    }
    return res.json({ success: true, source: 'fallback', data: fallbackData });
  }
});

// 7. Endpoint: AI Recommendation & Analysis for Counseling, Daily Journal & Journal Narration
app.post('/api/gemini/recommend', async (req, res) => {
  try {
    const { type, problem, date, activities, title, activityType, target } = req.body;
    const ai = getGeminiClient();

    // 1. Handling Type: "journal_narration" (Generate rich journal description for Mapel / BK / Wali Kelas)
    if (type === 'journal_narration') {
      const actType = activityType || 'Kegiatan Mengajar Mata Pelajaran';
      const actTitle = title || 'Pembelajaran & Pendampingan Siswa';
      const actTarget = target || 'Peserta Didik';

      if (!ai) {
        let narrative = '';
        if (actType.includes('Mengajar') || actType.includes('Mata Pelajaran')) {
          narrative = `Pelaksanaan Kegiatan Belajar Mengajar (KBM) dengan fokus materi "${actTitle}" untuk ${actTarget}. Guru memulai dengan apersepsi topik "${actTitle}", memfasilitasi eksplorasi konsep melalui diskusi interaktif dan latihan mandiri/kelompok, serta menutup sesi dengan refleksi dan evaluasi pemahaman siswa. Peserta didik mengikuti pembelajaran dengan tertib, antusias, dan kondusif.`;
        } else if (actType.includes('Klasikal')) {
          narrative = `Pelaksanaan layanan bimbingan klasikal bertema "${actTitle}" sasaran ${actTarget}. Guru BK memfasilitasi pemahaman topik "${actTitle}", memandu dinamika diskusi dan lembar refleksi diri, serta membimbing siswa merumuskan komitmen tindakan positif. Peserta didik menunjukkan keterbukaan, antusiasme, dan partisipasi aktif.`;
        } else if (actType.includes('Orang Tua') || actType.includes('Konsultasi')) {
          narrative = `Pelaksanaan konsultasi tatap muka bersama ${actTarget} terkait pembahasan "${actTitle}". Guru mengomunikasikan capaian positif siswa, mendiskusikan tantangan yang dihadapi, serta menyepakati langkah sinergi pemantauan berkelanjutan antara pihak sekolah dan orang tua di rumah.`;
        } else if (actType.includes('Koordinasi') || actType.includes('Rapat')) {
          narrative = `Pelaksanaan rapat koordinasi profesional mengenai "${actTitle}" bersama ${actTarget}. Menghasilkan kesepakatan langkah strategis, pembagian peran kerja yang jelas, serta rencana tindak lanjut terukur untuk mendukung kemajuan siswa dan sekolah.`;
        } else if (actType.includes('Administrasi')) {
          narrative = `Kegiatan administrasi dan pengelolaan perangkat profesi: "${actTitle}". Meliputi penyusunan modul layanan/RPL, pengolahan instrumen asesmen kebutuhan siswa, serta pengarsipan rekam jejak bimbingan secara sistematis dan akuntabel.`;
        } else {
          narrative = `Pelaksanaan agenda kerja pendidik bertema "${actTitle}" sasaran ${actTarget}. Rangkaian kegiatan terlaksana secara tertib, lancar, dan terdokumentasi sesuai rencana kerja harian.`;
        }
        return res.json({ success: true, source: 'fallback', narration: narrative });
      }

      const prompt = `Anda adalah Asisten Pakar Pendidik Profesional (Guru Mata Pelajaran, Guru BK, dan Wali Kelas) Kurikulum Merdeka Indonesia.
Tugas Anda: Buatkan 1 PARAGRAF LENGKAP narasi deskripsi jurnal harian pendidik yang SANGAT SPESIFIK, AKURAT, FORMAL, dan BERKUALITAS TINGGI sesuai topik/tema berikut:

DATA KEGIATAN:
- Jenis Kegiatan: "${actType}"
- Judul / Topik / Materi Pembelajaran: "${actTitle}"
- Sasaran / Target: "${actTarget}"

ATURAN WAJIB & MUTLAK:
1. Narasi HARUS BENAR-BENAR BERFOKUS PADA TOPIK: "${actTitle}". Jangan membuat cerita yang menyimpang atau tidak sesuai dengan materi/topik "${actTitle}".
2. Alur narasi mencakup 3 tahapan yang terintegrasi dalam 1 paragraf mengalir:
   - Apersepsi/pembuka terkait materi "${actTitle}".
   - Aktivitas inti (misal: eksperimen, diskusi kelompok, pemecahan masalah, penayangan media, atau eksplorasi bimbingan khusus tentang "${actTitle}").
   - Penutup, refleksi, evaluasi capaian pemahaman sasaran (${actTarget}), dan suasana kelas.
3. DILARANG KERAS memunculkan topik kasus pelanggaran atau siswa terlambat KECUALI jika judul kegiatan secara eksplisit memuat kata tersebut.
4. Gunakan bahasa Indonesia baku, profesional, bernilai administratif resmi kedinasan sekolah.

Output WAJIB berupa JSON:
{
  "narration": "isi 1 paragraf narasi kegiatan lengkap dan presisi..."
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              narration: { type: Type.STRING }
            },
            required: ['narration']
          }
        }
      });
      const parsed = JSON.parse(response.text || '{}');
      const finalNarration = typeof parsed.narration === 'string' ? parsed.narration : String(parsed.narration || '');
      return res.json({ success: true, source: 'gemini', narration: finalNarration });
    }

    // 2. Handling Type: "daily_journal" (Analyze whole day for Guru BK and/or Guru Mapel)
    if (type === 'daily_journal') {
      const actList = Array.isArray(activities) ? activities : [];
      const summaryText = actList.map(a => `- [${a.type}] ${a.title} (Target: ${a.target})`).join('\n');

      if (!ai) {
        const isMapelHeavy = actList.some(a => (a.type || '').toLowerCase().includes('mengajar') || (a.title || '').toLowerCase().includes('mapel') || (a.title || '').toLowerCase().includes('kbm') || (a.title || '').toLowerCase().includes('pembelajaran'));

        const fallbackRecommendation = {
          summary: `Analisis aktivitas tanggal ${date || 'hari ini'} (${actList.length} agenda): Seluruh kegiatan ${isMapelHeavy ? 'pembelajaran dan pendampingan' : 'layanan bimbingan dan konseling'} terlaksana tertib.`,
          highlights: [
            isMapelHeavy ? 'KBM dan interaksi kelas berjalan dinamis serta interaktif.' : 'Pelaksanaan layanan konseling berjalan komunikatif dan empatik.',
            'Dokumentasi dan evaluasi peserta didik tercatat rapi.'
          ],
          suggestions: [
            'Lanjutkan pemantauan terukur dan koordinasi berkala dengan wali kelas.',
            'Berikan umpan balik apresiatif langsung kepada siswa untuk menjaga motivasi positif.'
          ],
          teacherWellbeing: 'Dedikasi luar biasa hari ini! Luangkan waktu sejenak untuk ngopi/teh hangat dan istirahat agar energi tetap prima. ☕✨'
        };

        return res.json({ success: true, source: 'fallback', recommendation: fallbackRecommendation });
      }

      const prompt = `Anda adalah Rekan AI BK & Pakar Supervisi Pendidik yang santai, bersahabat, ramah, dan TO-THE-POINT.
Analisis seluruh kegiatan harian guru (${actList.length} aktivitas) pada tanggal ${date}:

Daftar Kegiatan:
${summaryText || 'Tidak ada catatan detail'}

INSTRUKSI:
1. Gaya bahasa: Santai, segar, apresiatif, namun tetap profesional dan solutif.
2. RINGKAS, TO-THE-POINT, dan FOKUS PADA LANGKAH PRAKTIS (bullet points).
3. Struktur:
   - summary: 1-2 kalimat ringkas merangkum inti kegiatan hari ini.
   - highlights: 2-3 butir poin kunci capaian utama hari ini.
   - suggestions: 2-3 langkah praktis dan konkret tindak lanjut berikutnya.
   - teacherWellbeing: 1 kalimat motivasi apresiatif pereda stres untuk Guru BK (kopi, istirahat, senyum).

Output JSON:
{
  "summary": string,
  "highlights": string[],
  "suggestions": string[],
  "teacherWellbeing": string
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              teacherWellbeing: { type: Type.STRING }
            },
            required: ['summary', 'highlights', 'suggestions', 'teacherWellbeing']
          }
        }
      });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, source: 'gemini', recommendation: parsed });
    }

    // 3. Handling Type: "session" (Counseling & Teaching session recommendations)
    const prob = problem || 'Pembinaan karakter, peningkatan keaktifan belajar, dan motivasi siswa.';
    if (!ai) {
      return res.json({
        success: true,
        source: 'fallback',
        recommendation: {
          summary: `Analisis konteks "${prob}": Pendekatan solutif berbasis penguatan karakter dan pendampingan personal.`,
          rootCauses: ['Kebutuhan eksplorasi minat & penyesuaian gaya belajar', 'Dinamika regulasi diri dan lingkungan sosial'],
          recommendations: [
            `Lakukan eksplorasi empati terkait "${prob}" tanpa menghakimi.`,
            'Ajak siswa mengidentifikasi pemicu utama dan alternatif solusi yang realistis.',
            'Susun target perilaku mingguan terukur yang disepakati bersama.'
          ],
          actionPlan: [
            'Sesi tatap muka berkala 15-20 menit dengan fokus solusi konkret',
            'Kolaborasi terarah bersama wali kelas dan pemantauan orang tua'
          ]
        }
      });
    }

    const prompt = `Anda adalah Pakar Bimbingan Konseling & Psikologi Pendidikan Kurikulum Merdeka Indonesia.
Kasus/Permintaan Layanan Siswa: "${prob}".

INSTRUKSI KETAT:
- SANGAT RELEVAN & SPESIFIK terhadap permasalahan "${prob}". Jangan memberikan saran umum yang tidak nyambung dengan "${prob}".
- SANGAT RINGKAS, TO-THE-POINT, dan BERFOKUS PADA LANGKAH-LANGKAH PRAKTIS KONSELING.
- Berikan panduan aksi yang langsung bisa diterapkan oleh Guru BK dalam sesi konseling.

Output JSON:
{
  "summary": string,
  "rootCauses": string[],
  "recommendations": string[],
  "actionPlan": string[]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            rootCauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['summary', 'rootCauses', 'recommendations', 'actionPlan']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini', recommendation: parsed });

  } catch (error: any) {
    logGeminiQuotaFallback('counseling-recommend', error);
    const { type, activityType, title, target, date, activities, problem } = req.body || {};
    if (type === 'journal_narration') {
      const actType = activityType || 'Kegiatan Mengajar Mata Pelajaran';
      const actTitle = title || 'Pembelajaran & Pendampingan Siswa';
      const actTarget = target || 'Peserta Didik';
      return res.json({
        success: true,
        source: 'fallback',
        narration: `Pelaksanaan kegiatan profesional pendidik (${actType}) berfokus pada topik "${actTitle}" untuk ${actTarget}. Guru memfasilitasi pemahaman materi secara interaktif, mendampingi proses refleksi/latihan, serta melakukan evaluasi pemahaman siswa. Suasana kegiatan berlangsung tertib dan kondusif.`
      });
    }
    if (type === 'daily_journal') {
      const actList = Array.isArray(activities) ? activities : [];
      return res.json({
        success: true,
        source: 'fallback',
        recommendation: {
          summary: `Analisis aktivitas harian tanggal ${date || 'hari ini'}: Tercatat ${actList.length} agenda kegiatan yang terlaksana secara teratur.`,
          highlights: ['Pelaksanaan agenda kerja harian berjalan sesuai rencana.', 'Dokumentasi kegiatan telah tersimpan secara rapi.'],
          suggestions: ['Pertahankan ritme kerja dan koordinasi dengan kawan sejawat.'],
          teacherWellbeing: 'Apresiasi tinggi atas dedikasi Anda hari ini. Selamat beristirahat agar besok kembali segar!'
        }
      });
    }
    return res.json({
      success: true,
      source: 'fallback',
      recommendation: {
        summary: `Rekomendasi pendampingan untuk "${problem || 'kondisi siswa'}": Perlu kombinasi bimbingan personal dan tindak lanjut terukur.`,
        rootCauses: ['Faktor motivasi internal dan dinamika belajar di kelas/sekolah.'],
        recommendations: ['Lakukan pendekatan empatik dan konsultasi berkala dengan wali kelas.'],
        actionPlan: ['Sesi konseling individual dan evaluasi perkembangan bertahap.']
      }
    });
  }
});

// 8. Endpoint: Rekan AI BK Daily Assistant & Chat (Personal Companion & Step-by-Step Workflow Guide)
app.post('/api/gemini/daily-assistant', async (req, res) => {
  try {
    const { action, payload } = req.body;
    const ai = getGeminiClient();

    if (action === 'briefing' || action === 'analyze-day') {
      const {
        counselorName,
        timeGreeting = 'Selamat Pagi',
        todayDayName = 'Hari Ini',
      } = payload || {};
      
      const firstName = counselorName ? counselorName.split(' ')[0] : 'Rekan BK';

      // Warm & cheerful personal assistant companion generator
      const generateCheerUpFallback = () => {
        const greetings = [
          `☕ **${timeGreeting}, ${firstName}!**\n"Guru BK itu sabarnya seluas samudra, tapi tetep butuh asupan kopi hangat biar mood tetap 100%!" 😄 Senyum dulu yuk, tarik napas dalam-dalam, dan nikmati hari ini dengan penuh kehangatan! ✨`,
          `🌟 **Semangat Pagi, ${firstName}!**\n"Di balik siswa yang ceria, ada Guru BK hebat yang selalu setia mendengarkan." Tetap rileks, santai sejenak, dan mari tebarkan energi positif ke seluruh sekolah hari ini! 💖`,
          `✨ **Halo Sahabat BK, ${firstName}!**\n"Ingat: kita nggak perlu menyelesaikan semua masalah dunia dalam satu jam." Yang penting hati tenang, senyum mengembang, dan selalu ada secangkir teh/kopi di meja! ☕💪`,
          `🎯 **Selamat Beraktivitas, ${firstName}!**\n"Pahlawan tanpa tanda jasa itu nyata, salah satunya Guru BK yang tahan dengerin 1001 curhatan unik!" Apapun yang terjadi hari ini, hadapi dengan tenang dan senyuman terbaikmu ya! 😊`
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
      };

      if (!ai) {
        return res.json({
          success: true,
          source: 'fallback',
          message: generateCheerUpFallback()
        });
      }

      const prompt = `Anda adalah "Si Becik 🦉", asisten pribadi dan sahabat virtual Guru BK yang hangat, santai, humoris, mencairkan suasana, dan menjadi penyemangat kerja (mood booster).
Nama Guru BK: ${counselorName} (Panggilan akrab: ${firstName}).
Waktu: ${timeGreeting} (${todayDayName}).

PETUNJUK PENTING:
- JANGAN menuliskan rincian detail agenda harian, daftar tugas, data absensi kelas, atau catatan pelanggaran (karena semua detail teknis sudah ada di kartu dashboard).
- FOKUS 100% pada peran asisten pribadi yang mencairkan suasana: berikan sapaan akrab, 1 celetukan humor/refleksi santai khas dunia bimbingan konseling/sekolah, dan kata-kata motivasi atau afirmasi positif yang menyegarkan pikiran.
- Panjang teks: Cukup 2-3 kalimat pendek yang hangat, renyah dibaca, dan bikin tersenyum.
- Gunakan emoji secukupnya (☕, ✨, 😊, 💖, 💪).`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      return res.json({
        success: true,
        source: 'gemini',
        message: response.text || generateCheerUpFallback()
      });
    }

    if (action === 'workflow-guide') {
      const { topic, situation, counselorName } = payload || {};
      const firstName = counselorName ? counselorName.split(' ')[0] : 'Guru BK';

      if (!ai) {
        return res.json({
          success: true,
          source: 'fallback',
          data: {
            title: topic || 'Alur Penanganan Kasus & Pendampingan Siswa',
            summary: `Panduan taktis langkah demi langkah untuk ${firstName} dalam menangani situasi: "${situation || topic}".`,
            steps: [
              {
                stepNo: 1,
                title: 'Penerimaan & Stabilisasi Awal (Ciptakan Rasa Aman)',
                action: 'Sapa siswa dengan tenang tanpa menghakimi. Berikan waktu untuk menenangkan emosi dan dengarkan sudut pandangnya secara objektif.',
                tips: 'Gunakan teknik Segitiga Restitusi: Stabilkan identitas terlebih dahulu ("Semua orang pernah melakukan kesalahan").',
                targetTab: 'tambah-layanan',
                targetTabLabel: 'Buka Modul Konseling BK'
              },
              {
                stepNo: 2,
                title: 'Eksplorasi Akar Masalah & Keyakinan Kelas',
                action: 'Ajak siswa merefleksikan nilai-nilai atau keyakinan kelas yang belum terpenuhi dan apa motivasi di balik perilakunya.',
                tips: 'Hindari pertanyaan "Kenapa kamu melakukan ini?", gantikan dengan "Apa yang sedang kamu butuhkan saat itu?".',
                targetTab: 'data-siswa',
                targetTabLabel: 'Cek Profil Siswa'
              },
              {
                stepNo: 3,
                title: 'Perumusan Solusi & Komitmen Perbaikan Mandiri',
                action: 'Bimbing siswa merumuskan sendiri rencana aksi perbaikan (restitusi) dan catat kesepakatan solusi secara tertulis.',
                tips: 'Biarkan solusi datang dari siswa agar rasa tanggung jawab dan kepemilikan komitmen lebih tinggi.',
                targetTab: 'tambah-layanan',
                targetTabLabel: 'Catat Hasil Sesi BK'
              },
              {
                stepNo: 4,
                title: 'Pencatatan Dokumentasi & Tindak Lanjut Kolaboratif',
                action: 'Dokumentasikan sesi di aplikasi BK. Koordinasikan dengan Wali Kelas dan Orang Tua jika memerlukan pendampingan berkelanjutan.',
                tips: 'Pantau perkembangan perilaku siswa dalam 3-7 hari ke depan dengan sapaan suportif di sekolah.',
                targetTab: 'panggilan-ortu',
                targetTabLabel: 'Koordinasi / Panggilan Ortu'
              }
            ],
            proTips: [
              'Jaga kerahasiaan proses konseling untuk membangun rasa percaya siswa.',
              'Fokus pada perbaikan perilaku di masa depan, bukan hukuman masa lalu.'
            ]
          }
        });
      }

      const prompt = `Anda adalah "Si Becik 🦉", Asisten Pribadi Pakar Bimbingan Konseling (BK) Kurikulum Merdeka Indonesia.
Tugas Anda: Memberikan panduan LANGKAH DEMI LANGKAH (Step-by-Step Workflow) yang SANGAT JELAS, PRAKTIS, TAKTIS, DAN SISTEMATIS untuk Guru BK: ${counselorName} (${firstName}).

Situasi/Kebutuhan: "${situation || topic}".

Buatkan panduan alur penanganan BK yang tepat (misal: Konseling, Restitusi, Mediasi, Home Visit, Panggilan Ortu, Penanganan Bolos/Terlambat, dsb).
Format output JSON WAJIB:
{
  "title": string,
  "summary": string,
  "steps": [
    {
      "stepNo": number,
      "title": string,
      "action": string,
      "tips": string,
      "targetTab": string, // Salah satu dari: 'tambah-layanan' | 'pelanggaran' | 'home-visit' | 'panggilan-ortu' | 'absensi' | 'jurnal-harian' | 'data-siswa'
      "targetTabLabel": string
    }
  ],
  "proTips": string[]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              summary: { type: Type.STRING },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNo: { type: Type.INTEGER },
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    tips: { type: Type.STRING },
                    targetTab: { type: Type.STRING },
                    targetTabLabel: { type: Type.STRING }
                  },
                  required: ['stepNo', 'title', 'action', 'tips', 'targetTab', 'targetTabLabel']
                }
              },
              proTips: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['title', 'summary', 'steps', 'proTips']
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, source: 'gemini', data: parsed });
    }

    if (action === 'chat') {
      const { userQuery, counselorName } = payload || {};
      const firstName = counselorName ? counselorName.split(' ')[0] : 'Kawan BK';

      if (!ai) {
        return res.json({
          success: true,
          source: 'fallback',
          message: `Siap ${firstName}! ☕ Berikut langkah praktis yang bisa kamu lakukan:\n\n1️⃣ **Langkah 1**: Tarik napas sejenak dan dengarkan situasi dengan pikiran tenang tanpa tergesa-gesa.\n2️⃣ **Langkah 2**: Ajak siswa/pihak terkait berdialog santai dalam suasana yang aman dan empatik.\n3️⃣ **Langkah 3**: Rumuskan solusi konkret bersama dan catat komitmen tindak lanjutnya di aplikasi BK.\n\nSemangat terus, kamu pasti bisa menanganinya dengan hebat! ✨`
        });
      }

      const prompt = `Anda adalah "Si Becik 🦉", asisten pribadi cerdas, ramah, dan solutif bagi Guru BK: ${counselorName} (panggilan akrab: ${firstName}).
Peran Anda:
1. Membantu Guru BK dengan panduan langkah demi langkah (step-by-step) yang terstruktur dan praktis saat ditanya alur kerja, penanganan kasus siswa, konseling, restitusi, home visit, ataupun administrasi BK.
2. Tetap ramah, hangat, menyemangati, dan mencairkan suasana.
3. Berikan jawaban yang terstruktur dengan format poin/penomoran (1️⃣, 2️⃣, 3️⃣) agar Guru BK langsung tahu langkah konkret apa yang harus dilakukan selanjutnya.

Pertanyaan / Permintaan Guru BK: "${userQuery}"
Respon: Berikan panduan yang jelas, to-the-point, sistematis, dan suportif.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt
      });

      return res.json({
        success: true,
        source: 'gemini',
        message: response.text || `Siap ${firstName}! Pokoknya tetap santai, tersenyum, dan jaga mood baik hari ini! ☕✨`
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (error: any) {
    logGeminiQuotaFallback('daily-assistant', error);
    const { action, payload } = req.body || {};
    const { counselorName, timeGreeting = 'Selamat Pagi' } = payload || {};
    const firstName = counselorName ? counselorName.split(' ')[0] : 'Rekan BK';
    
    if (action === 'chat') {
      return res.json({
        success: true,
        source: 'fallback',
        message: `Halo ${firstName}! ☕ Tetap semangat dan rileks ya. Apapun tantangannya, kamu adalah sosok hebat bagi siswa-siswamu! ✨`
      });
    }
    return res.json({
      success: true,
      source: 'fallback',
      message: `☕ **${timeGreeting}, ${firstName}!**\n"Senyuman Guru BK di pagi hari adalah obat terbaik bagi suasana sekolah." Tarik napas dalam-dalam, nikmati kopi hangatmu, dan mari buat hari ini luar biasa! ✨`
    });
  }
});

// 9. Endpoint: Google Apps Script (GAS) Proxy to bypass browser CORS / fetch restrictions
app.post('/api/gas/proxy', async (req, res) => {
  try {
    const { targetUrl, method = 'POST', payload, queryParams } = req.body;

    if (!targetUrl || typeof targetUrl !== 'string') {
      return res.status(400).json({ status: 'error', message: 'Target URL Google Apps Script tidak valid.' });
    }

    let finalUrl = targetUrl;
    if (queryParams && typeof queryParams === 'object') {
      const urlObj = new URL(targetUrl);
      Object.keys(queryParams).forEach((key) => {
        urlObj.searchParams.set(key, queryParams[key]);
      });
      finalUrl = urlObj.toString();
    }

    const options: RequestInit = {
      method,
      redirect: 'follow', // Automatically follow GAS 302 redirects
    };

    if (method === 'POST') {
      options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    }

    const response = await fetch(finalUrl, options);
    const text = await response.text();

    if (text.trim().startsWith('<')) {
      return res.json({
        status: 'error',
        message: 'Google Apps Script mengembalikan halaman HTML (Izin/Login Google). Pastikan Web App dideploy dengan opsi "Who has access: Anyone".'
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { status: response.ok ? 'success' : 'error', message: text, raw: true };
    }

    return res.json(data);
  } catch (error: any) {
    console.warn('Proxy GAS Error:', error.message);
    return res.status(200).json({
      status: 'error',
      message: `Gagal terhubung ke Google Apps Script via Proxy: ${error.message}`
    });
  }
});

// Start Express + Vite Middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BK Gridasus System] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
