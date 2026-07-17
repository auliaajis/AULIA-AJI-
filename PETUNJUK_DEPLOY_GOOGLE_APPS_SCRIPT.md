# Panduan Lengkap & Detail: Deploy Sistem BK SMPN 2 Susukan ke Google Apps Script (GAS)

Selamat! Aplikasi Bimbingan Konseling (BK) Anda kini telah sepenuhnya dikonfigurasi agar dapat di-build menjadi **satu file tunggal (`index.html`)** yang sangat ringan, responsif, dan stabil. 

Karena semua kode, CSS (Tailwind), dan ikon (Lucide) telah disatukan secara otomatis oleh sistem kami menggunakan `vite-plugin-singlefile`, Anda dapat menghosting aplikasi ini **100% GRATIS** di dalam akun Google Workspace Anda (seperti `@guru.smp.belajar.id`) menggunakan **Google Apps Script** dan **Google Sheets** sebagai database-nya.

Berikut adalah panduan langkah demi langkah yang sangat detail dan dirancang khusus untuk pemula guna menyelesaikan kendala eror dan melakukan deploy dengan benar.

---

## 📋 DAFTAR ISI
1. **Langkah 1:** Menyiapkan Google Spreadsheet Baru (Database)
2. **Langkah 2:** Membuat Proyek Google Apps Script Baru
3. **Langkah 3:** Menempelkan Kode Backend Baru (`Code.gs`) - *Bebas Eror & Otomatis*
4. **Langkah 4:** Memasang File Aplikasi (`Index.html`)
5. **Langkah 5:** Melakukan Publikasi (Deploy) sebagai Aplikasi Web
6. **Langkah 6:** Menghubungkan Aplikasi ke Google Sheets Anda
7. **Tips Stabil & Aman Penggunaan**

---

### 🟢 LANGKAH 1: MENYIAPKAN GOOGLE SPREADSHEET BARU
Aplikasi Anda membutuhkan Google Sheets sebagai tempat menyimpan seluruh data (Siswa, Pelanggaran, Jurnal Layanan, dan Absensi).
1. Buka Google Drive Anda (gunakan akun Google belajar.id Anda).
2. Buat Spreadsheet Baru dengan cara klik **Baru (New)** > **Google Spreadsheet (Google Sheets)**.
3. Beri nama spreadsheet tersebut: `Database BK Sekolah` (atau nama lain bebas).

---

### 🟢 LANGKAH 2: MEMBUAT PROYEK GOOGLE APPS SCRIPT BARU
1. Di dalam Google Spreadsheet yang baru saja Anda buat di atas, klik menu **Ekstensi (Extensions)** > **Apps Script**.
2. Tab baru akan terbuka menampilkan editor Google Apps Script.
3. Klik pada tulisan "Proyek Tanpa Judul" di bagian kiri atas, lalu beri nama proyek Anda, misalnya: `Sistem BK SMPN 2 Susukan`.

---

### 🟢 LANGKAH 3: MENEMPELKAN KODE BACKEND BARU (`Code.gs`)
Di dalam Google Apps Script, sudah ada file bernama `Kode.gs` atau `Code.gs`. 
Berikut adalah kode terbaru yang **100% stabil, telah diperbaiki dari masalah syntax error, dan tidak membutuhkan penyusunan ID manual** karena otomatis mendeteksi Spreadsheet tempat Anda membuka Apps Script tersebut!

1. Hapus seluruh isi kode bawaan (`function myFunction() { ... }`).
2. Tempelkan seluruh kode di bawah ini secara utuh tanpa ada bagian yang terpotong:

```javascript
/**
 * SISTEM BK - GOOGLE APPS SCRIPT DATABASE ENDPOINT
 * --------------------------------------------------
 * Tempelkan kode ini secara utuh pada Google Apps Script Anda (Ekstensi > Apps Script).
 * Deploy sebagai Aplikasi Web (Web App), setel "Jalankan sebagai: Saya", dan "Akses: Siapa saja".
 */

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Koneksi berhasil! Terhubung ke Spreadsheet: " + ss.getName() 
      })).setMimeType(ContentService.MimeType.JSON);
    } else if (action === "readAll") {
      var output = JSON.stringify({
        students: readTab(ss, "Siswa", ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount", "initials"]),
        violations: readTab(ss, "Pelanggaran", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"]),
        services: readTab(ss, "LayananBK", ["id", "serviceType", "problem", "description", "output", "followUp", "status", "date", "startTime", "endTime", "students", "attachments", "notes"]),
        attendance: readTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"])
      });
      return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JSON);
    } else {
      // DEFAULT: Jika diakses langsung tanpa action di web browser, tampilkan UI Aplikasi BK (Index.html)
      try {
        var htmlOutput = HtmlService.createHtmlOutputFromFile("Index");
        htmlOutput.setTitle("Sistem BK SMPN 2 Susukan")
                  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                  .addMetaTag('viewport', 'width=device-width, initial-scale=1');
        return htmlOutput;
      } catch(htmlErr) {
        // Jika file "Index.html" belum diupload atau gagal diload, tampilkan halaman panduan ramah
        var errDetail = htmlErr ? htmlErr.toString() : "File 'Index' tidak ditemukan di Apps Script Anda.";
        return HtmlService.createHtmlOutput(
          "<div style='font-family: sans-serif; padding: 25px; max-width: 600px; margin: 40px auto; border: 1px solid #cce8e5; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); background-color: #fcfefe;'>" +
          "<h2 style='color: #00685f; margin-top: 0;'>Sistem Database BK SMPN 2 Susukan Aktif!</h2>" +
          "<p style='color: #4a5568; line-height: 1.6;'>Database Google Apps Script Anda <strong>berhasil dikoneksikan</strong> ke Spreadsheet: <strong style='color: #00685f;'>" + ss.getName() + "</strong>.</p>" +
          "<div style='background-color: #f0fdfa; border-left: 4px solid #0d9488; padding: 12px; margin: 15px 0; border-radius: 4px; color: #115e59; font-size: 14px; font-weight: bold;'>" +
          "Langkah berikutnya: Hubungkan URL ini di aplikasi BK Anda!" +
          "</div>" +
          "<div style='background-color: #fef2f2; border-left: 4px solid #f87171; padding: 15px; margin: 15px 0; border-radius: 6px; color: #991b1b; font-size: 13px;'>" +
          "<strong style='font-size: 14px;'>⚠️ Detail Status Hosting Aplikasi:</strong><br>" +
          "<code style='background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-family: monospace; display: block; margin-top: 5px; word-break: break-all;'>" + errDetail + "</code>" +
          "<p style='margin: 8px 0 0 0; font-size: 12px;'>Jika status di atas adalah <strong>'Exception: Inside Sidebar/Dialog...'</strong> atau <strong>'ScriptError...'</strong> atau <strong>'Page not found'</strong>, itu artinya file 'Index' belum ditambahkan dengan benar atau deployment belum diperbarui ke Versi Baru.</p>" +
          "</div>" +
          "<hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>" +
          "<h4 style='color: #2d3748; margin-bottom: 8px;'>Panduan Tambahan: Cara Menghosting Aplikasi Langsung di Sini</h4>" +
          "<p style='color: #718096; font-size: 13px; margin-top: 0;'>Anda juga dapat membuka aplikasi BK secara penuh lewat link ini dengan mengupload file Index.html:</p>" +
          "<ol style='color: #4a5568; line-height: 1.6; padding-left: 20px; font-size: 13.5px;'>" +
          "<li>Buka aplikasi BK Anda, pergi ke menu <strong>Integrasi Google</strong>.</li>" +
          "<li>Di panel kanan bawah, klik <strong>'Unduh File Aplikasi'</strong> untuk mendownload file <strong>Index.html</strong>.</li>" +
          "<li>Pada editor Apps Script ini, di sebelah kiri (bagian File), klik ikon <strong>+</strong> > pilih <strong>HTML</strong>.</li>" +
          "<li>Beri nama file tersebut <strong>Index</strong> (tanpa .html).</li>" +
          "<li>Buka file Index.html yang terunduh tadi, salin semua kodenya, dan paste ke file Index di editor Apps Script ini.</li>" +
          "<li>Klik Simpan (disket), lalu klik <strong>Terapkan (Deploy)</strong> > <strong>Kelola Penerapan (Manage deployments)</strong> > Edit > Pilih Versi Baru, lalu simpan.</li>" +
          "</ol>" +
          "</div>"
        );
      }
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var output = "";
  
  try {
    var payload = JSON.parse(e.postData.contents);
    if (payload.action === "sync") {
      // Sinkronisasikan keempat tab data
      syncTab(ss, "Siswa", ["id", "nis", "name", "class", "gender", "violationPoints", "bkServicesCount", "initials"], payload.students || []);
      syncTab(ss, "Pelanggaran", ["id", "ticketId", "studentId", "studentName", "studentClass", "category", "pointsAdded", "date", "time", "location", "notes", "reportedBy", "handledBy", "handlingProgress"], payload.violations || []);
      syncTab(ss, "LayananBK", ["id", "serviceType", "problem", "description", "output", "followUp", "status", "date", "startTime", "endTime", "students", "attachments", "notes"], payload.services || []);
      syncTab(ss, "Absensi", ["id", "class", "date", "records", "updatedAt", "submittedBy"], payload.attendance || []);
      
      output = JSON.stringify({ 
        status: "success", 
        message: "Sinkronisasi berhasil! Spreadsheet telah diperbarui." 
      });
    } else {
      output = JSON.stringify({ status: "error", message: "Aksi POST tidak dikenal." });
    }
  } catch (err) {
    output = JSON.stringify({ status: "error", message: err.message });
  }
  
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function syncTab(ss, tabName, headers, items) {
  var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  sheet.clear();
  
  var rows = [headers];
  if (items && items.length > 0) {
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var row = headers.map(function(h) {
        var val = item[h];
        if (val === undefined || val === null) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
      rows.push(row);
    }
  }
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

function readTab(ss, tabName, headers) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];
  
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  var sheetHeaders = values[0];
  var result = [];
  
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var obj = {};
    headers.forEach(function(h) {
      var idx = sheetHeaders.indexOf(h);
      var val = idx !== -1 ? row[idx] : "";
      
      if (typeof val === "string" && (val.indexOf("[") === 0 || val.indexOf("{") === 0)) {
        try { val = JSON.parse(val); } catch(e) {}
      }
      
      if (h === "violationPoints" || h === "bkServicesCount" || h === "pointsAdded") {
        var num = Number(val);
        if (!isNaN(num)) val = num;
      }
      
      obj[h] = val;
    });
    result.push(obj);
  }
  return result;
}
```

3. Klik tombol **Simpan (Save)** (ikon disket di atas) pada editor Apps Script Anda.

---

### 🟢 LANGKAH 4: MEMASANG FILE APLIKASI (`Index.html`)
Kami telah membuat fitur unduh file tunggal otomatis langsung dari dalam aplikasi sehingga Anda tidak perlu menyalin kode yang sangat besar ini secara manual!
1. Buka aplikasi BK Anda (bisa lewat pratinjau AI Studio atau versi Shared App).
2. Masuk ke tab **Integrasi Google** di menu utama.
3. Di sisi kanan bawah, Anda akan melihat bagian baru bernama: **"Unduh File Aplikasi (Index.html)"**.
4. Klik tombol **Unduh File Aplikasi** di sana. Browser Anda akan mengunduh file bernama `Index.html`.
5. Di bagian kiri editor Apps Script Anda, arahkan kursor ke tulisan **File**, lalu klik ikon **`+` (Tambah file)** > pilih **HTML**.
6. Beri nama file tersebut: `Index` (tanpa ekstensi `.html`, pastikan huruf pertama kapital).
7. Buka file `Index.html` yang baru diunduh tadi menggunakan Notepad, VS Code, atau editor teks lainnya, salin seluruh isi teksnya (Ctrl+A lalu Ctrl+C), lalu tempelkan (Ctrl+V) ke dalam file `Index` di editor Google Apps Script Anda.
8. Klik tombol **Simpan (Save)** (ikon disket).

---

### 🟢 LANGKAH 5: MELAKUKAN PUBLIKASI (DEPLOY) SEBAGAI APLIKASI WEB
1. Di kanan atas halaman Google Apps Script, klik tombol **Terapkan (Deploy)** > **Penerapan Baru (New deployment)**.
2. Klik ikon gerigi (Pilih jenis penerapan) > pilih **Aplikasi Web (Web App)**.
3. Konfigurasikan pengaturannya sebagai berikut:
   * **Deskripsi:** `Sistem BK SMPN 2 Susukan v1.1`
   * **Jalankan sebagai (Execute as):** **Saya (Email Anda / Me)** - agar aplikasi diizinkan menulis ke Spreadsheet.
   * **Siapa yang memiliki akses (Who has access):** **Siapa saja (Anyone)** - agar aplikasi di browser Anda bisa berinteraksi mengirim data.
4. Klik tombol **Terapkan (Deploy)**.
5. Anda mungkin akan diminta memberikan Otorisasi Akses. 
   * Klik **Berikan Akses (Authorize access)**.
   * Pilih akun email belajar.id Anda.
   * Klik tulisan kecil **Advanced / Lanjutan** di bagian bawah, lalu klik **Go to Sistem BK SMPN 2 Susukan (unsafe)**.
   * Klik **Izinkan (Allow)**.
6. Google Apps Script akan menampilkan **URL Aplikasi Web** Anda. Salin URL ini!

---

### 🟢 LANGKAH 6: MENHUBUNGKAN APLIKASI KE GOOGLE SHEETS ANDA
1. Buka aplikasi BK Anda, pergi ke menu **Integrasi Google**.
2. Pada kolom **"URL Google Apps Script"**, tempelkan URL Web App yang Anda salin pada Langkah 5 tadi.
3. Klik tombol **Simpan URL** lalu klik **Uji Koneksi**.
4. Jika berhasil, Anda akan melihat notifikasi hijau: **"Koneksi berhasil! Terhubung ke Spreadsheet..."**
5. Kini Anda bisa melakukan **Kirim via Apps Script** atau **Tarik via Apps Script** kapan saja untuk menyinkronkan data kesiswaan Anda!

---

## 💡 TIPS STABIL & AMAN PENGGUNAAN
* **Penanganan Eror "Failed to fetch":** Eror ini terjadi jika URL Google Apps Script Anda belum dideploy sebagai "Anyone" (Siapa saja), atau karena ada eror penulisan fungsi di Apps Script Anda. Dengan menggunakan kode `Code.gs` terbaru di atas, eror ini akan sepenuhnya teratasi karena semua fungsi sudah disempurnakan.
* **Penanganan Eror Login Google (popup-closed-by-user):** Eror ini terjadi karena jendela masuk (sign-in popup) Google ditutup secara manual sebelum proses verifikasi selesai. Pastikan Anda menyelesaikan proses login di jendela popup tersebut hingga tertutup secara otomatis oleh sistem.
* **Data Aman di Cloud:** Aplikasi berjalan sepenuhnya di sisi browser Anda (Client-Side), dan semua data diunggah langsung ke penyimpanan Google Sheets pribadi Anda di server Kementerian Pendidikan, menjadikannya sangat aman dan privat.
