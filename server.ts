import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health check endpoint for Cloud Run container probes
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Control plane dev server status endpoint
app.get(['/__aistudio_internal_control_plane/dev/status', '/__aistudio_internal_control_plane/*'], (_req, res) => {
  res.status(200).json({
    status: 'ok',
    devServer: true,
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Initialize Gemini Client
const GEMINI_TEXT_MODEL = 'gemini-3.8-flash';

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
      model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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
        model: GEMINI_TEXT_MODEL,
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
        model: GEMINI_TEXT_MODEL,
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
      model: GEMINI_TEXT_MODEL,
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

// 7b. Endpoint: Rekomendasi Tindak Lanjut Berdasarkan Sesi Konseling Sebelumnya (AI Follow-up Suggester)
app.post('/api/gemini/suggest-follow-up', async (req, res) => {
  try {
    const { studentName, studentClass, previousSession, currentTopic } = req.body;
    const ai = getGeminiClient();

    const prevDate = previousSession?.date || 'Sebelumnya';
    const prevType = previousSession?.serviceType || 'Konseling Individual';
    const prevTopic = previousSession?.problem || previousSession?.topic || 'Bimbingan umum';
    const prevNotes = previousSession?.description || previousSession?.notes || '-';
    const prevOutput = previousSession?.output || '-';
    const curTopic = currentTopic || prevTopic;

    if (!ai) {
      const cleanPrevTopic = prevTopic.toLowerCase();
      let technique = 'Solution-Focused Brief Therapy (SFBT)';
      let actions = [
        `Evaluasi progres komitmen siswa terkait "${prevTopic}" sejak sesi tanggal ${prevDate}.`,
        'Lakukan observasi perkembangan perilaku dan motivasi belajar di kelas bersama wali kelas.',
        'Jadwalkan sesi check-in 10-15 menit minggu depan untuk mengukur kestabilan perubahan positif.'
      ];
      if (cleanPrevTopic.includes('bolos') || cleanPrevTopic.includes('absen') || cleanPrevTopic.includes('terlambat')) {
        technique = 'Behavioral Contract & Glasser Reality Therapy';
        actions = [
          'Review kartu komitmen absensi harian yang telah disepakati pada sesi sebelumnya.',
          'Apresiasi konsistensi kehadiran dan identifikasi kendala pagi hari yang masih dialami.',
          'Koordinasikan laporan presensi mingguan dengan guru piket dan orang tua.'
        ];
      } else if (cleanPrevTopic.includes('emosi') || cleanPrevTopic.includes('marah') || cleanPrevTopic.includes('teman') || cleanPrevTopic.includes('bully')) {
        technique = 'Restitusi Perilaku & Assertive Training';
        actions = [
          'Evaluasi penerapan teknik kontrol emosi (Deep Breathing / Jeda Respon) saat menghadapi pemicu di kelas.',
          'Periksa apakah ada gesekan interpersonal baru dengan teman sebaya.',
          'Bimbing siswa merefleksikan suasana pertemanan yang lebih kondusif dan damai.'
        ];
      }

      return res.json({
        success: true,
        source: 'fallback',
        data: {
          summaryContext: `Siswa ${studentName || 'Ananda'} sebelumnya telah menjalani sesi ${prevType} mengenai "${prevTopic}" pada ${prevDate}. Fokus saat ini adalah kesinambungan tindak lanjut dan evaluasi komitmen perbaikan.`,
          counselingTechnique: technique,
          recommendedActions: actions,
          monitoringChecklist: [
            'Pemantauan konsistensi perilaku harian',
            'Komunikasi berkala dengan wali kelas',
            'Kesiapan siswa meminta bantuan jika masalah berulang'
          ],
          reviewQuestions: [
            `"Bagaimana perasaan dan pengalamanmu sejak sesi terakhir kita tanggal ${prevDate}?"`,
            `"Dari kesepakatan kita mengenai ${prevTopic}, hal apa yang sudah berhasil kamu jalankan dengan baik?"`,
            '"Apa tantangan terberat yang masih kamu hadapi, dan bagaimana kita menyelesaikannya bersama?"'
          ],
          suggestedFollowUpText: `1. Memantau konsistensi perkembangan ${studentName || 'siswa'} pasca-sesi ${prevDate} (${prevTopic}).\n2. Melakukan evaluasi penerapan ${technique} dalam aktivitas belajar dan interaksi kelas.\n3. Berkoordinasi dengan wali kelas ${studentClass || ''} untuk feedback mingguan serta menjadwalkan sesi evaluasi berkala 1-2 minggu mendatang.`
        }
      });
    }

    const prompt = `Anda adalah Konselor Ahli Bimbingan & Konseling Kurikulum Merdeka (Standar BSKAP Kemendikbudristek & Disiplin Positif).
Tugas Anda: Berikan REKOMENDASI TINDAK LANJUT (FOLLOW-UP ACTIONS) yang tajam, edukatif, dan praktis berdasarkan rekam jejak sesi konseling sebelumnya untuk siswa:

DATA SISWA:
- Nama Siswa: ${studentName || 'Peserta Didik'}
- Kelas: ${studentClass || '-'}

DATA SESI SEBELUMNYA:
- Tanggal Sesi: ${prevDate}
- Jenis Layanan: ${prevType}
- Topik / Masalah Sesi Sebelumnya: "${prevTopic}"
- Deskripsi Proses / Catatan Konselor: "${prevNotes}"
- Hasil / Capaian Sesi Sebelumnya: "${prevOutput}"
- Topik / Fokus Sesi Saat Ini: "${curTopic}"

PANDUAN PENYUSUNAN TINDAK LANJUT:
1. Hubungkan secara logis antara hasil sesi sebelumnya dengan langkah konkrit berikutnya (tidak mengulang dari nol, melainkan follow-up progresif).
2. Tentukan teknik konseling yang relevan (misal: SFBT, Glasser Reality Therapy, Segitiga Restitusi, Motivational Interviewing, atau Kontrak Perilaku).
3. Berikan 3-4 langkah aksi tindak lanjut yang spesifik untuk guru BK, wali kelas, atau siswa.
4. Berikan pertanyaan pembuka sesi (review questions) untuk mengecek komitmen anak.
5. Sediakan narasi teks siap pakai untuk kolom "Rencana Tindak Lanjut" di buku konseling.

Output WAJIB berupa JSON dengan struktur persis:
{
  "summaryContext": string (1-2 kalimat ringkasan kesinambungan kasus),
  "counselingTechnique": string (nama teknik/pendekatan konseling),
  "recommendedActions": string[] (3-4 langkah aksi tindak lanjut konkrit),
  "monitoringChecklist": string[] (2-3 poin cek pemantauan),
  "reviewQuestions": string[] (2-3 pertanyaan reflektif untuk siswa),
  "suggestedFollowUpText": string (narasi rencana tindak lanjut siap pakai yang rapi bernomor)
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summaryContext: { type: Type.STRING },
            counselingTechnique: { type: Type.STRING },
            recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            monitoringChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
            reviewQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedFollowUpText: { type: Type.STRING }
          },
          required: ['summaryContext', 'counselingTechnique', 'recommendedActions', 'monitoringChecklist', 'reviewQuestions', 'suggestedFollowUpText']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, source: 'gemini', data: parsed });

  } catch (error: any) {
    logGeminiQuotaFallback('suggest-follow-up', error);
    const { studentName, studentClass, previousSession } = req.body || {};
    const prevDate = previousSession?.date || 'sebelumnya';
    const prevTopic = previousSession?.problem || previousSession?.topic || 'konseling';
    return res.json({
      success: true,
      source: 'fallback',
      data: {
        summaryContext: `Tindak lanjut sesi berkelanjutan untuk ${studentName || 'siswa'} pasca-sesi ${prevDate}.`,
        counselingTechnique: 'Solution-Focused Brief Therapy & Disiplin Positif',
        recommendedActions: [
          `Evaluasi komitmen perbaikan terkait ${prevTopic}.`,
          'Koordinasi pemantauan harian dengan wali kelas.',
          'Jadwalkan sesi evaluasi 1 minggu mendatang.'
        ],
        monitoringChecklist: ['Kehadiran di kelas', 'Partisipasi belajar'],
        reviewQuestions: ['"Bagaimana perkembanganmu sejak sesi terakhir?"'],
        suggestedFollowUpText: `1. Memantau progres ${studentName || 'siswa'} terkait ${prevTopic}.\n2. Kolaborasi dengan wali kelas ${studentClass || ''}.\n3. Evaluasi berkala kemandirian perilaku.`
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

      // Warm, relatable, witty, diverse & authentic companion messages for Indonesian school counselors (TIDAK GARING & VARIATIF)
      const generateCheerUpFallback = (selectedCategory?: string) => {
        const pool = [
          // Tone 1: Santai & Kopi (Relaksasi, Anti-Burnout & Self-Care)
          {
            tag: 'Santai & Kopi',
            text: `☕ **${timeGreeting}, ${firstName}!**\n"Guru BK itu bukan pesulap yang wajib bereskan semua masalah dunia dalam semalam." Tarik napas panjang, seruput kopi hangatmu, dan ingat: kehadiranmu yang tulus sudah jadi anugerah besar bagi sekolah ini! 🌿✨`
          },
          {
            tag: 'Santai & Kopi',
            text: `☕ **Halo ${firstName}, santai sejenak yuk!**\nDi antara hiruk-pikuk bel sekolah dan catatan layanan menumpuk, jangan lupa jaga energimu sendiri. Ambil jeda 5 menit, nikmati semilir angin pagi, dan hadapi hari dengan senyum rileks. You've got this! ☕🌸`
          },
          {
            tag: 'Santai & Kopi',
            text: `🌿 **${timeGreeting}, ${firstName}!**\n"Kunci ruang konseling yang nyaman berawal dari hati konselor yang tenang." Lepaskan beban kemarin, fokus pada langkah kecil hari ini. Secangkir teh hangat siap menemanimu! 🍵✨`
          },
          {
            tag: 'Santai & Kopi',
            text: `🌸 **Kawan BK tersayang, ${firstName}!**\nKamu tidak harus sempurna untuk menjadi tempat bersandar yang baik bagi siswa. Cukup hadir dengan senyuman tulus dan telinga yang mendengarkan tanpa menghakimi. Rileks dan nikmati harimu! ☕💖`
          },
          {
            tag: 'Santai & Kopi',
            text: `🍃 **Jeda bernapas sejenak, ${firstName}!**\nSebelum bel masuk berbunyi kencang: pejamkan mata sejenak, buang napas perlahan. Ingat, cangkir yang kosong tak bisa menuangkan air—isi hatimu dulu dengan ketenangan sebelum membimbing anak-anak hari ini! 🫖✨`
          },
          {
            tag: 'Santai & Kopi',
            text: `🍵 **${timeGreeting}, ${firstName}!**\n"Meja kerja boleh penuh berkas RPL, tapi kepala harus tetap adem." Ambil camilan favoritmu, regangkan bahu yang kaku, dan nikmati petualangan hari ini dengan tempo yang santai! 🍩🌿`
          },

          // Tone 2: Afirmasi Hebat (Empowerment & Kebanggaan Profesi)
          {
            tag: 'Afirmasi Hebat',
            text: `🌟 **Semangat ${timeGreeting}, ${firstName}!**\n"Mungkin siswa tidak selalu hafal setiap butir nasihat kita, tapi mereka takkan pernah lupa rasa hangat saat diterima seutuhnya di ruang BK." Hari ini kamu sedang menumbuhkan pohon harapan baru! 💖🌱`
          },
          {
            tag: 'Afirmasi Hebat',
            text: `🛡️ **Kawan Hebat BK, ${firstName}!**\nTidak semua pahlawan berpenampilan mencolok; sebagian duduk sabar di kursi konseling dengan hati seluas samudra dan telinga yang mendengarkan. Banggalah pada dedikasimu, kamu sedang menyelamatkan masa depan anak bangsa! 💪✨`
          },
          {
            tag: 'Afirmasi Hebat',
            text: `✨ **Pagi yang cerah untuk ${firstName}!**\nSatu percakapan penuh empati darimu hari ini bisa jadi titik balik penyelamat seorang anak dari keputusasaan. Teruslah menjadi pelita hangat di sekolah tercinta! 🎯🌟`
          },
          {
            tag: 'Afirmasi Hebat',
            text: `💎 **Salam hormat untuk ${firstName}!**\nMembimbing jiwa-jiwa muda bukanlah pekerjaan mudah, tapi kamu melakukannya dengan penuh cinta setiap hari. Semesta mencatat setiap kebaikan tulus yang kamu taburkan di sanubari mereka! 🚀💖`
          },
          {
            tag: 'Afirmasi Hebat',
            text: `🔥 **Luar biasa dedikasimu, ${firstName}!**\nDi saat orang lain hanya melihat nilai angka rapor atau label kenakalan, kamulah yang melihat potensi tersembunyi di balik mata anak-anak itu. Kamu pahlawan tanpa tanda jasa yang sesungguhnya! 🌟🏆`
          },
          {
            tag: 'Afirmasi Hebat',
            text: `🌱 **Kekuatan hening ${firstName}!**\n"Pohon jati yang kokoh tumbuh dari bibit kecil yang dirawat tekun bertahun-tahun." Setiap kata penyemangat yang kamu bisikkan di ruang konseling akan mekar indah di masa depan mereka! 🌳🤍`
          },

          // Tone 3: Refleksi Empati & Restitusi (Mindset Positif)
          {
            tag: 'Refleksi Empati',
            text: `🌱 **${timeGreeting}, ${firstName}!**\n"Dalam kacamata restitusi, kekeliruan perilaku siswa bukanlah vonis akhir, melainkan pintu gerbang untuk mengajarkan tanggung jawab moral." Tetap sabar dan percaya pada benih kebaikan mereka! 🧭🤍`
          },
          {
            tag: 'Refleksi Empati',
            text: `💡 **Semangat membimbing, ${firstName}!**\n"Siswa yang paling butuh penerimaan sering kali menunjukkannya dengan perilaku yang paling membingungkan." Tatap matanya dengan teduh, dan biarkan kehangatanmu meluluhkan pertahanan mereka. 🤝✨`
          },
          {
            tag: 'Refleksi Empati',
            text: `🌈 **Refleksi berharga untuk ${firstName}!**\nKarakter mulia siswa tidak terbentuk dalam semalam, melainkan dari rajutan konsisten doa, kesabaran, dan teladan yang kamu hadirkan di ruang BK. Teruslah melangkah dengan bangga! 🌟🌱`
          },
          {
            tag: 'Refleksi Empati',
            text: `🧭 **${timeGreeting}, ${firstName}!**\nSetiap anak berhak mendapatkan kesempatan kedua, ketiga, bahkan kesepuluh untuk berbenah. Ruang BK adalah rumah kedua tempat mereka belajar bangkit dari kesalahan tanpa rasa takut dihakimi! 🏡✨`
          },
          {
            tag: 'Refleksi Empati',
            text: `🕊️ **Catatan empati ${firstName}:**\n"Saat seorang siswa marah atau membangkang, ingatlah: itu sering kali jeritan tak terucap dari hati yang terluka." Terima emosinya, bimbing perilakunya, dan sayangi prosesnya. Kamu lentera terbaik mereka! 🕯️🤍`
          },
          {
            tag: 'Refleksi Empati',
            text: `🌿 **Pelukan pemulihan untuk ${firstName}!**\nKetika restitusi berhasil membuat seorang siswa tersenyum lega dan berani memperbaiki kesalahannya sendiri, di situlah mukjizat pendidikan karakter terjadi. Nikmati setiap detik proses indahnya! 🤝🌈`
          },

          // Tone 4: Humor Ruang BK (Segar, Lucu & Tidak Garing)
          {
            tag: 'Humor Ruang BK',
            text: `😄 **${timeGreeting}, ${firstName}!**\nSiap-siap mendengar 1001 alasan siswa terlambat dari "rantai sepeda lepas di jalan kenangan" sampai "kucing tetangga mogok makan". Pasang senyum andalan Guru BK: "Aku tahu kamu ngeles, tapi aku tetap sayang kok!" 😂☕`
          },
          {
            tag: 'Humor Ruang BK',
            text: `🍰 **Tips Bugar Guru BK hari ini, ${firstName}:**\n1. Jangan bawa drama ruang konseling sampai ke mimpi tidur.\n2. Banyak minum air putih.\n3. Amankan stok gorengan dan cemilan di laci meja dari serbuan bapak/ibu guru sebelah! 😆 Semangat melayani!`
          },
          {
            tag: 'Humor Ruang BK',
            text: `☕ **Mood Booster ${timeGreeting}, ${firstName}!**\nMenjadi Guru BK itu paket komplit: kadang jadi detektif kelas, kadang diplomat PBB penengah konflik antar geng, kadang motivator ala TED Talk. Jangan lupa isi baterai energimu dulu dengan sarapan enak ya! 🥐✨`
          },
          {
            tag: 'Humor Ruang BK',
            text: `🎉 **${timeGreeting}, ${firstName}!**\n"Kalau hari ini dinamika sekolah terasa nano-nano (manis, asam, asin campur aduk), ingat: itu tandanya hidupmu berasa film petualangan seru!" Hadapi dengan tawa renyah dan hati riang gembira ya! 🚀😄`
          },
          {
            tag: 'Humor Ruang BK',
            text: `🕶️ **Intel Melapor untuk ${firstName}!**\n"Info A1 hari ini: murid yang paling sering bolos ke kantin ternyata cuma kangen gorengan bakwan Bu Siti." Ajak ngobrol santai dulu sambil ngunyah, baru masuk sesi bimbingan dari hati ke hati! 🍟😂`
          },
          {
            tag: 'Humor Ruang BK',
            text: `📱 **Status WA Guru BK hari ini, ${firstName}:**\n"Menghadapi drama percintaan monyet anak SMP/SMA yang lebih rumit daripada drama Korea." Tarik napas, pasang muka bijak, dan jangan sampai ikut baper ya! 🙈🍿`
          },

          // Tone 5: Trik Taktis Konselor (Tips Praktis, De-eskalasi & Diplomasi)
          {
            tag: 'Trik Taktis',
            text: `🎯 **Tips Taktis Hari Ini untuk ${firstName}!**\nKalau ada siswa masuk ruang BK dengan wajah cemberut atau defensif: jangan langsung tanya "Kenapa kamu melanggar?". Tawarkan segelas air dingin dulu dan tanyakan: "Sudah sarapan belum tadi pagi?". Kehangatan memecah kebekuan lebih cepat dari aturan tertulis! 💧🤍`
          },
          {
            tag: 'Trik Taktis',
            text: `🧠 **Micro-Mindfulness Konselor, ${firstName}:**\nSebelum memanggil orang tua siswa yang sedang emosional atau denial: lakukan teknik pernapasan 4-7-8 (tarik 4 detik, tahan 7 detik, hembus 8 detik). Nada suara yang tenang akan otomatis menurunkan tensi lawan bicara! 🧘‍♂️✨`
          },
          {
            tag: 'Trik Taktis',
            text: `🤝 **Kunci Segitiga Restitusi, ${firstName}:**\nSaat menanyakan keyakinan kelas, gunakan kalimat terbuka: "Menurutmu, apa yang bisa kita perbaiki bersama agar kamu dan teman-teman merasa aman kembali?". Biarkan solusi meluncur dari mulut anak sendiri! 🗝️📘`
          },
          {
            tag: 'Trik Taktis',
            text: `🛡️ **Diplomasi Ortu Anti-Drama, ${firstName}:**\nSaat konferensi kasus dengan orang tua: selalu buka dengan 2 apresiasi tulus tentang kebaikan sang anak sebelum membahas catatan perilakunya. Orang tua akan merasa didukung, bukan diserang! 🌟👨‍👩‍👧`
          },

          // Tone 6: Mood Booster Harian (Ceria, Optimis & Berenergi)
          {
            tag: 'Mood Booster',
            text: `☀️ **Selamat menyambut hari yang cerah, ${firstName}!**\nBuka jendela ruang BK lebar-lebar, biarkan sinar mentari menyapa. Hari ini adalah kanvas bersih tempatmu menorehkan jejak kebaikan baru bagi anak-anak bangsa. Semangat membara! 🔥🌸`
          },
          {
            tag: 'Mood Booster',
            text: `🎈 **Suntikan Semangat untuk ${firstName}!**\nSenyum manismu adalah penenang nomor satu bagi siswa yang sedang cemas di sekolah. Sebarkan aura positifmu hari ini dan lihat bagaimana lingkungan sekitar ikut bersemi! 🌻✨`
          },
          {
            tag: 'Mood Booster',
            text: `🚀 **Siap meluncur, ${firstName}!**\nTidak ada masalah yang tak bisa diselesaikan selama hati kita lapang dan pikiran kita jernih. Bersiaplah menjadi versi terbaik dirimu hari ini, doa baik menyertaimu selalu! 🌈💖`
          },
          {
            tag: 'Mood Booster',
            text: `🍀 **Keberuntungan hari ini untuk ${firstName}!**\nSemoga setiap sesi layanan hari ini berjalan lancar, penuh tawa, dan berujung kesepakatan damai yang melegakan. Jadilah lentera yang tak pernah padam! 🌟🌿`
          }
        ];

        let filtered = pool;
        if (selectedCategory && selectedCategory !== 'Semua') {
          filtered = pool.filter(p => p.tag.toLowerCase().includes(selectedCategory.toLowerCase()));
          if (filtered.length === 0) filtered = pool;
        }

        const pick = filtered[Math.floor(Math.random() * filtered.length)];
        return pick.text;
      };

      if (!ai) {
        return res.json({
          success: true,
          source: 'fallback',
          message: generateCheerUpFallback(payload?.category)
        });
      }

      const prompt = `Anda adalah "Si Becik 🦉", asisten cerdas, sahabat karib virtual, dan mood-booster bagi Guru BK: ${counselorName} (panggilan akrab: ${firstName}).
Waktu saat ini: ${timeGreeting} (${todayDayName}).
Permintaan kategori/suasana hati: ${payload?.category || 'Semua / Acak segar'}.

INSTRUKSI KHUSUS "TIDAK GARING & SANGAT VARIATIF":
1. FOKUS 100% pada peran sahabat karib sejati yang menyemangati hati dan mental Guru BK di sekolah Indonesia.
2. JANGAN PERNAH membuat teks kaku, klise basi formal (hindari kalimat basi seperti "jangan menyerah Anda pasti bisa!"), atau template motivasi robotik.
3. Gunakan gaya bahasa Indonesia yang luwes, akrab, renyah dibaca, cerdas, sedikit humor santai khas ruang BK (relatable dengan dinamika murid SMP/SMA, orang tua murid, drama pertemanan, segitiga restitusi, atau ngopi/rehat santai konselor), serta penuh empati mendalam.
4. Panjang respons: 2 sampai 4 kalimat yang sangat berkesan, segar, dan bikin tersenyum hangat.
5. Awali dengan sapaan hangat yang pas (${timeGreeting}, ${firstName}!).
6. Sisipkan emoji yang ekspresif (☕, 🌿, ✨, 💖, 😄, 💡, 🛡️, 🍩).`;

      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt
      });

      return res.json({
        success: true,
        source: 'gemini',
        message: response.text || generateCheerUpFallback(payload?.category)
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
        model: GEMINI_TEXT_MODEL,
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
      const { userQuery, counselorName, mode, topic, studentClass, duration } = payload || {};
      const firstName = counselorName ? counselorName.split(' ')[0] : 'Kawan BK';

      // Fallback generator adhering strictly to user rules
      const generateMetaAiFallback = () => {
        if (mode === 'rapikan-laporan') {
          return `Berikut draf laporan layanan BK yang telah dirapikan secara formal:

**Pelaksanaan:**
Layanan konseling dilaksanakan di Ruang Bimbingan dan Konseling bersama konseli (Siswa A). Konselor membangun hubungan baik (*rapport*), mendengarkan secara aktif tanpa menghakimi, serta mengidentifikasi faktor pemicu situasi yang dihadapi siswa dalam suasana yang kondusif dan terjaga kerahasiaannya.

**Hasil:**
Konseli (Siswa A) menunjukkan keterbukaan dalam menyampaikan kendala yang dialami, menyadari konsekuensi dari perilaku sebelumnya terhadap proses belajarnya, serta menunjukkan motivasi internal untuk melakukan perbaikan diri.

**Kesepakatan & Tindak Lanjut:**
1. Konseli menyepakati komitmen pengelolaan waktu dan pembiasaan disiplin baru.
2. Konselor akan memantau kehadiran dan perkembangan perilaku konseli selama 1 (satu) minggu ke depan.
3. Konseling lanjutan akan dijadwalkan kembali apabila diperlukan evaluasi mendalam.`;
        }

        if (mode === 'buatkan-rpl') {
          const rplTopic = topic || userQuery || 'Pencegahan Perundungan & Disiplin Positif';
          const rplClass = studentClass || 'Kelas 7 / 8 / 9';
          const rplTime = duration || '1 x 40 Menit';

          return `Berikut Rencana Pelaksanaan Layanan (RPL) Bimbingan Klasikal resmi:

**Topik Layanan:** ${rplTopic}
**Sasaran Kelas:** ${rplClass}
**Alokasi Waktu:** ${rplTime}

**Tujuan Layanan:**
- *Tujuan Umum:* Peserta didik mampu memahami pentingnya ${rplTopic.toLowerCase()} serta membangun relasi sosial yang sehat dan bertanggung jawab di lingkungan sekolah.
- *Tujuan Khusus:*
  1. Peserta didik dapat mengidentifikasi bentuk-bentuk perilaku yang mendukung iklim belajar kondusif.
  2. Peserta didik dapat menganalisis dampak positif dari penerapan nilai-nilai disiplin diri.
  3. Peserta didik dapat merumuskan komitmen bersama untuk menciptakan lingkungan kelas yang aman dan harmonis.

**Materi Layanan:**
1. Pengertian dan urgensi ${rplTopic}.
2. Faktor-faktor pendukung terciptanya kenyamanan belajar dan pertemanan sehat.
3. Strategi penyelesaian konflik secara asertif dan saling menghargai.

**Metode Layanan:**
Ceramah interaktif, diskusi kelompok terbimbing (*small group discussion*), dan refleksi diri.

**Media Layanan:**
Slide presentasi (PPT), video edukasi inspiratif, serta lembar kerja peserta didik (LKPD reflektif).

**Langkah Kegiatan:**
1. *Pendahuluan (8 Menit):*
   - Guru BK membuka sesi dengan salam, doa bersama, dan pembinaan suasana hangat (*ice breaking*).
   - Menyampaikan topik, tujuan layanan, serta kontrak belajar yang disepakati bersama.
2. *Kegiatan Inti (25 Menit):*
   - Guru BK menayangkan materi/studi kasus kontekstual seputar ${rplTopic}.
   - Siswa berdiskusi dalam kelompok kecil untuk merumuskan pandangan dan solusi alternatif.
   - Perwakilan kelompok mempresentasikan hasil refleksi dan ditanggapi dengan penguatan oleh Guru BK.
3. *Penutup (7 Menit):*
   - Guru BK dan peserta didik bersama-sama menyimpulkan inti pembelajaran hari ini.
   - Guru BK memberikan lembar refleksi singkat serta kata-kata penguatan motivasi.

**Evaluasi Layanan:**
- *Laiseg (Penilaian Segera):* Mengamati antusiasme, keaktifan berpendapat, dan suasana emosi siswa selama sesi klasikal berlangsung.
- *Laijapen (Penilaian Jangka Pendek):* Mengamati perubahan sikap siswa dalam 1–2 minggu setelah layanan, terutama interaksi sosial antarteman di kelas.
- *Laijapang (Penilaian Jangka Panjang):* Mengamati ketahanan komitmen perilaku positif siswa sepanjang semester dan nihilnya laporan insiden sejenis.`;
        }

        if (mode === 'tanya-teknik') {
          return `Berikut analisis bimbingan konseling untuk situasi tersebut:

**Penyebab:**
Perilaku siswa umumnya dipicu oleh kombinasi faktor internal (kesulitan mengelola regulasi emosi, kebutuhan perhatian yang belum terpenuhi, atau kelelahan adaptasi) dan faktor eksternal (tekanan pertemanan sebaya, pola komunikasi di rumah, atau kebiasaan begadang akibat gawai).

**Teknik yang Cocok:**
Pendekatan *Solution-Focused Brief Counseling* (SFBC) yang dipadukan dengan teknik *Segitiga Restitusi* (Menstabilkan Identitas, Validasi Tindakan yang Salah, dan Menanyakan Keyakinan). Pendekatan ini efektif karena berfokus pada kekuatan siswa dan solusi perbaikan di masa depan, bukan menghukum kesalahan masa lalu.

**Langkah Minggu Ini:**
1. Lakukan konseling individual singkat (15–20 menit) dalam suasana hangat tanpa menghakimi.
2. Ajak siswa menyusun kontrak perilaku sederhana (*behavioral contract*) selama 7 hari.
3. Berkoordinasi dengan wali kelas untuk memantau perubahan afektif siswa di kelas tanpa membuat siswa merasa diawasi secara berlebihan.

**Kapan Home Visit / Rapat Kasus:**
Lakukan **Kunjungan Rumah (Home Visit)** jika siswa tidak hadir 3 hari berturut-turut tanpa kabar atau orang tua tidak merespons surat panggilan. Lakukan **Rapat Kasus (Konferensi Kasus)** jika persoalan melibatkan pelanggaran berat, perundungan lintas kelas, atau kebuntuan yang memerlukan koordinasi resmi kepala sekolah dan tim PPKSP.

Mau saya buatkan draf laporannya?`;
        }

        return `Halo ${firstName}! Saya Si Becik, asisten cerdas Guru BK berbasis Meta AI. 

Saya siap membantu menyusun Rencana Pelaksanaan Layanan (RPL), merapikan draf laporan konseling formal, atau mendiskusikan teknik intervensi BK yang tepat bagi siswa Anda. Silakan pilih mode di atas atau ceritakan situasi yang sedang Anda hadapi (gunakan sebutan Siswa A). ✨`;
      };

      if (!ai) {
        return res.json({
          success: true,
          source: 'meta-ai-fallback',
          message: generateMetaAiFallback()
        });
      }

      const metaSystemPrompt = `Anda adalah "Si Becik 🦉", Asisten Cerdas Resmi Guru BK Indonesia yang didukung oleh teknologi Meta AI (Powered by Meta AI).
Identitas Pengguna: ${counselorName} (Panggilan akrab: ${firstName}).

=== PEDOMAN ETIKA & ATURAN KERAS (WAJIB DIPATUHI TANPA PENGECUALIAN) ===
1. PRIVASI & KERAHASIAAN SISWA:
   - DILARANG KERAS meminta, mencatat, atau menyimpan nama asli siswa, nomor induk (NIS/NISN), nama orang tua, alamat pribadi, ataupun foto siswa.
   - JIKA pengguna mengetik nama orang/siswa asli atau terdeteksi nama pribadi: Anda WAJIB langsung menjawab diawali dengan kalimat teguran ramah berikut:
     "Jangan pakai nama asli ya, pakai Siswa A saja."
     Kemudian lanjutkan memberikan jawaban dengan selalu mengganti nama tersebut menjadi "Siswa A" atau "Siswa B".

2. BATASAN PROFESI & MEDIS:
   - Anda HANYA membantu Guru BK dalam koridor pedagogik, bimbingan pribadi, sosial, belajar, dan karir.
   - DILARANG KERAS membuat diagnosis medis atau psikiatris (misalnya mendiagnosis gangguan mental klinis, ADHD klinis, skizofrenia, depresi mayor medis, atau meresepkan terapi obat).
   - Jika kasus melibatkan gejala klinis berat/gangguan kejiwaan/menyakiti diri, gunakan istilah pedagogik dan sarankan Alih Tangan Kasus (Referral) ke psikolog klinis / psikiater / faskes.

3. BAHASA & TONE:
   - Gunakan bahasa Indonesia formal BK yang baku, terstruktur, santun, empatik, dan solutif.

=== FORMAT OUTPUT SESUAI 3 MODE KHUSUS ===
Jika Mode = 'rapikan-laporan':
Ubah tulisan acak pengguna menjadi laporan konseling formal dengan 3 bagian wajib bertanda bold:
**Pelaksanaan:** (Uraian pelaksanaan, tanggal/waktu, sasaran Siswa A, proses konseling)
**Hasil:** (Temuan inti masalah, dinamika respons konseli, pemahaman baru)
**Kesepakatan & Tindak Lanjut:** (Komitmen solusi konseli, jadwal evaluasi berkala)

Jika Mode = 'buatkan-rpl':
Susun RPL Bimbingan Klasikal resmi Kurikulum Merdeka lengkap dengan bagian:
**Topik Layanan:** ...
**Sasaran Kelas:** ...
**Alokasi Waktu:** ...
**Tujuan Layanan:** (Tujuan Umum & Tujuan Khusus)
**Materi Layanan:** (Poin ringkasan materi)
**Metode Layanan:** (Ceramah, Diskusi, dsb)
**Media Layanan:** (PPT, Video, LKPD)
**Langkah Kegiatan:**
- *Pendahuluan:* ...
- *Kegiatan Inti:* ...
- *Penutup:* ...
**Evaluasi Layanan:**
- *Laiseg (Penilaian Segera):* ...
- *Laijapen (Penilaian Jangka Pendek):* ...
- *Laijapang (Penilaian Jangka Panjang):* ...

Jika Mode = 'tanya-teknik':
Jawab dengan 4 bagian terstruktur:
**Penyebab:** (Analisis faktor internal & eksternal siswa)
**Teknik yang Cocok:** (Rekomendasi teknik konseling BK yang tepat, misal SFBC, Restitusi, Kontrak Perilaku)
**Langkah Minggu Ini:** (Aksi praktis konkret Guru BK dalam 7 hari ke depan)
**Kapan Home Visit / Rapat Kasus:** (Kriteria jelas kapan perlu kunjungan rumah atau konferensi kasus)
WAJIB AKHIRI DENGAN KALIMAT PERSIS:
"Mau saya buatkan draf laporannya?"`;

      const prompt = `${metaSystemPrompt}

Mode Aktif: ${mode || 'tanya-teknik'}
Topik Tambahan: ${topic || '-'}
Kelas: ${studentClass || '-'}
Alokasi Waktu: ${duration || '-'}
Pesan / Catatan Guru BK:
"${userQuery}"`;

      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt
      });

      return res.json({
        success: true,
        source: 'meta-ai',
        message: response.text || generateMetaAiFallback()
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
    // Resolve dist path robustly across different container runtime environments
    let distPath = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(distPath) && fs.existsSync(path.resolve(__dirname, '..', 'dist'))) {
      distPath = path.resolve(__dirname, '..', 'dist');
    } else if (!fs.existsSync(distPath) && fs.existsSync(__dirname)) {
      distPath = path.resolve(__dirname);
    }

    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!DOCTYPE html><html><head><title>SIKAP-BK</title></head><body><h3>SIKAP-BK Service Initializing...</h3></body></html>');
      }
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIKAP-BK System] Server successfully running on http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown handling for Cloud Run containers
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Gracefully closing server...`);
    server.close(() => {
      console.log('Server closed successfully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer();
