# Panduan Deploy Gratis ke Firebase Hosting (Tanpa Billing / Tanpa Kartu)

Proyek ini sudah dikonfigurasi untuk **Firebase Hosting** (`firebase.json` + `.firebaserc`) pada project Firebase **`gen-lang-client-0064829073`** dengan paket gratis **Spark Plan**.

> **PENTING:** Selalu gunakan flag `--only hosting`!  
> Jangan jalankan `firebase deploy` tanpa `--only hosting`, karena folder `functions/` akan meminta upgrade ke Blaze Plan (Billing). Dengan `--only hosting`, aplikasi **100% gratis tanpa kartu kredit**.

---

## Langkah-Langkah Deploy (Sekali Setup, Selanjutnya 1 Perintah)

### 1. Unduh Proyek & Siapkan Terminal
1. Di AI Studio, klik ikon **Download ZIP** proyek (atau clone dari GitHub jika sudah dihubungkan), lalu ekstrak ke folder di laptop/PC Anda.
2. Pastikan **Node.js** (versi 18 atau 20+) sudah terpasang di laptop Anda (cek di Terminal/CMD dengan `node -v`).
3. Buka Terminal / Command Prompt di dalam folder proyek hasil ekstrak tersebut.

### 2. Install Dependency & Login Firebase (Cukup Sekali)
Jalankan perintah berikut secara berurutan:

```bash
npm install
npx firebase-tools login
```
Browser akan terbuka—masuk menggunakan akun Google yang menjadi pemilik/editor project Firebase `gen-lang-client-0064829073`.

### 3. Build & Publish ke Firebase Hosting (Gratis)
Jalankan 1 perintah ini:

```bash
npm run deploy:hosting
```
*(Perintah ini otomatis menjalankan `vite build` lalu `npx firebase-tools deploy --only hosting`)*

Jika berhasil, akan muncul alamat website resmi aplikasi Anda:
- `https://gen-lang-client-0064829073.web.app`
- `https://gen-lang-client-0064829073.firebaseapp.com`

---

## Catatan Penting Setelah Online
1. **Jika Login Google / Google Drive Sync dipakai:**  
   Buka **Firebase Console** → **Authentication** → **Settings** → **Authorized domains**, pastikan `gen-lang-client-0064829073.web.app` dan `gen-lang-client-0064829073.firebaseapp.com` sudah terdaftar.
2. **Fitur yang berjalan di Firebase Hosting:**  
   - **Berfungsi penuh:** Beranda, Data Siswa, Absensi, Pelanggaran, Layanan BK, Home Visit, Surat Panggilan, Cetak PDF, Audit Identitas Sekolah, Sampah/Soft Delete, dan sinkronisasi **Firestore Realtime**.
   - **Asisten AI Si Becik & Generator RPL:** Tetap berjalan menggunakan mode fallback lokal apabila server Express `/api/gemini/*` tidak dihosting.
3. **Update versi berikutnya:**  
   Setiap kali ada pembaruan kode, cukup unduh ulang atau edit lalu jalankan kembali `npm run deploy:hosting`.
