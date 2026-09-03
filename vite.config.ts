import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {viteSingleFile} from 'vite-plugin-singlefile';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Secure server-side initialization of Gemini API Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  } catch (err) {
    console.error('Error initializing Gemini client:', err);
    return null;
  }
};

export default defineConfig(() => {
  const isSingleFile = process.env.BUILD_SINGLE === 'true';
  const plugins: any[] = [
    react(), 
    tailwindcss(), 
  ];

  if (isSingleFile) {
    plugins.push(viteSingleFile());
  }

  plugins.push({
    name: 'serve-compiled-html',
    configureServer(server) {
      // Secure server-side Gemini API endpoint for smart counseling recommendations
      server.middlewares.use('/api/gemini/recommend', (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const { type, problem, serviceType, targetType, studentName, date, activities } = payload;

            const aiClient = getGeminiClient();
            if (!aiClient) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ 
                success: false, 
                fallback: true,
                message: 'GEMINI_API_KEY belum dikonfigurasi di Settings > Secrets. Menjalankan asisten BK dalam mode offline.' 
              }));
              return;
            }

            let prompt = '';
            let systemInstruction = '';

            if (type === 'session') {
              systemInstruction = 'Anda adalah konselor Bimbingan Konseling (BK) ahli yang praktis, empatik, to-the-point, dan efisien. Berikan rekomendasi bimbingan yang ringkas, padat, dan berfokus pada langkah-langkah praktis (bullet points) tanpa penjelasan yang bertele-tele atau terlalu panjang.';
              prompt = `Berikan rekomendasi bimbingan konseling yang ringkas, to-the-point, dan berfokus pada langkah-langkah praktis untuk kasus siswa berikut:
- Permasalahan: "${problem}"
- Jenis Layanan: "${serviceType}"
- Tipe Target: "${targetType}"
${studentName ? `- Nama Siswa: "${studentName}"` : ''}

Harap berikan tanggapan terstruktur, padat, dan langsung ke inti (bullet points):
1. **Pendekatan Konseling**: Pendekatan terbaik (CBT/SFBT/REBT/Client-Centered) dalam 1-2 kalimat ringkas.
2. **Langkah Praktis Sesi**: 3-4 butir langkah konkret langsung terapkan saat konseling tatap muka.
3. **Rencana Tindak Lanjut**: 2-3 butir pemantauan terukur dan kolaborasi praktis.
4. **Contoh Kalimat Empati**: 2-3 kalimat verbal suportif singkat siap pakai.`;
            } else if (type === 'daily_journal') {
              systemInstruction = 'Anda adalah Rekan AI BK senior yang santai, jenaka, dan penuh humor ringan namun tetap profesional dan solutif. Tugas Anda adalah meringkas aktivitas jurnal harian dengan gaya bahasa yang santai, segar, dan menghibur agar Guru BK merasa lebih rileks saat membaca ringkasan harian, namun tetap to-the-point, ringkas, dan terfokus pada langkah-langkah praktis (bullet points) tanpa bertele-tele.';
              prompt = `Berikut adalah ringkasan seluruh aktivitas bimbingan konseling dan pencatatan sekolah pada tanggal ${date || 'hari ini'}:

${JSON.stringify(activities, null, 2)}

Harap berikan ringkasan harian yang santai, bernada humoris ringan, sangat ringkas, to-the-point, dan berfokus pada bullet points praktis:
1. ☕ **Sorotan & Celetukan Santai Hari Ini**: 1-2 kalimat jenaka pembuka tentang dinamika kegiatan hari ini agar Guru BK rileks.
2. 📌 **Poin Kunci Aktivitas**: 2-3 butir poin ringkas mengenai hasil utama pelaksanaan layanan / KBM hari ini.
3. 💡 **Langkah Praktis & Tindak Lanjut**: 2-3 langkah aksi konkret dan praktis untuk Guru BK selanjutnya.
4. 🌟 **Pesan Relaksasi & Apresiasi**: 1 kalimat motivasi humoris pereda stres (misal kopi, istirahat cukup, senyum) untuk menjaga well-being Guru BK.`;
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Invalid request type' }));
              return;
            }

            const response = await aiClient.models.generateContent({
              model: "gemini-3.5-flash",
              contents: prompt,
              config: {
                systemInstruction,
                temperature: 0.7,
              }
            });

            const textOutput = response.text || 'Gagal menghasilkan rekomendasi bimbingan.';

            res.writeHead(200, { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
              success: true, 
              recommendation: textOutput 
            }));

          } catch (err: any) {
            console.error('Error handling Gemini API request:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Internal Server Error: ' + err.message }));
          }
        });
      });

      server.middlewares.use('/api/get-compiled-html', (req, res) => {
        try {
          const filePath = fs.existsSync(path.resolve(__dirname, 'dist/single.html'))
            ? path.resolve(__dirname, 'dist/single.html')
            : path.resolve(__dirname, 'dist-single/index.html');
          
          if (fs.existsSync(filePath)) {
            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': 'attachment; filename="Index.html"',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(fs.readFileSync(filePath));
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File single-file html not found. Please build the project first.');
          }
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error serving compiled HTML: ' + err.message);
        }
      });
    }
  });

  return {
    plugins,
    build: {
      outDir: isSingleFile ? 'dist-single' : 'dist',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
