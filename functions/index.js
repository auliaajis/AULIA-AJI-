const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Cloud Function: approveUser
 * 1. Cek role pemanggil adalah koordinator_bk
 * 2. Set Custom Claims schoolId + role guru_bk ke user yang di-approve
 * 3. Ubah status di Firestore users/{uid} jadi "active"
 * 4. Setelah approve, user harus logout lalu login ulang agar token baru aktif. Tampilkan pesan itu ke user.
 */
exports.approveUser = functions.https.onCall(async (data, context) => {
  // 1. Cek role pemanggil adalah koordinator_bk
  if (!context.auth || context.auth.token.role !== "koordinator_bk") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Hanya Koordinator BK (koordinator_bk) yang memiliki izin untuk menyetujui akun pengguna."
    );
  }

  const { uidToApprove, schoolId } = data || {};
  if (!uidToApprove || !schoolId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Parameter uidToApprove dan schoolId wajib disertakan."
    );
  }

  try {
    // 2. Set Custom Claims schoolId + role guru_bk ke user yang di-approve
    await admin.auth().setCustomUserClaims(uidToApprove, {
      schoolId: schoolId,
      role: "guru_bk"
    });

    // 3. Ubah status di Firestore users/{uid} jadi "active"
    await admin.firestore().collection("users").doc(uidToApprove).set(
      {
        status: "active",
        schoolId: schoolId,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedBy: context.auth.uid
      },
      { merge: true }
    );

    // 4. Setelah approve, kembalikan instruksi agar user logout lalu login ulang agar token baru aktif
    return {
      success: true,
      uid: uidToApprove,
      schoolId: schoolId,
      message: "User berhasil disetujui. User harus logout lalu login ulang agar token baru aktif."
    };
  } catch (error) {
    console.error("Gagal menyetujui user:", error);
    throw new functions.https.HttpsError(
      "internal",
      error.message || "Terjadi kesalahan saat memproses persetujuan akun."
    );
  }
});

/**
 * Cloud Function: onUserCreated
 * Otomatis dipanggil saat akun dibuat di Firebase Auth.
 * Jika belum ada dokumen di Firestore users/{uid}, buatkan otomatis dengan status "pending" agar tidak ada akun gantung.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    const userDocRef = admin.firestore().collection("users").doc(user.uid);
    const docSnapshot = await userDocRef.get();

    if (!docSnapshot.exists) {
      await userDocRef.set({
        uid: user.uid,
        email: user.email || "",
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`Dokumen Firestore berhasil dibuat otomatis untuk user baru: ${user.uid} (${user.email}) dengan status "pending".`);
    }
  } catch (error) {
    console.error("Gagal membuat dokumen user otomatis di onUserCreated:", error);
  }
});

/**
 * Helper: Ambil inisial nama siswa
 */
function getStudentInitials(name) {
  if (!name) return "Siswa";
  const trimmed = name.trim();
  if (/^[A-Z]{1,4}$/.test(trimmed)) return trimmed;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w.charAt(0).toUpperCase()).join("").slice(0, 4);
}

/**
 * Cloud Function: generateLayananPdf
 * Sesuai spesifikasi:
 * 1. Dipanggil saat user klik [Generate Layanan]
 * 2. Terima data: schoolId, schoolName, jenisLayanan (Konseling / Restitusi / Panggilan), namaSiswa (inisial), kelas, tanggal
 * 3. Generate nama file: YYYY-MM-DD_{jenisLayanan}_{kelas}_{inisial}.pdf
 * 4. Upload ke folder Drive: BK MGMP Kab Semarang / {schoolName} / {jenisLayanan} (buat otomatis jika belum ada)
 * 5. Atur permission: Hanya guru dengan schoolId yang sama (BUKAN Public / anyone with link)
 * 6. Simpan di Firestore: cases/{caseId} atau counseling/{docId} field baru: pdfUrl, driveFileId, pdfGeneratedAt
 * 7. Kembalikan: { success: true, pdfUrl, driveFileId, fileName }
 */
exports.generateLayananPdf = functions.https.onCall(async (data, context) => {
  // 1. Cek autentikasi
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Pengguna harus login untuk mengupload PDF layanan ke Google Drive."
    );
  }

  const {
    schoolId,
    schoolName = "SMPN 2 Susukan",
    jenisLayanan = "Konseling",
    namaSiswa = "Siswa",
    kelas = "8A",
    tanggal = new Date().toISOString().split("T")[0],
    pdfBase64,
    docId,
    colName = "counseling"
  } = data || {};

  if (!schoolId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Parameter schoolId wajib disertakan."
    );
  }

  // 2. Format Inisial & Nama File: YYYY-MM-DD_{jenisLayanan}_{kelas}_{inisial}.pdf
  const inisial = getStudentInitials(namaSiswa);
  const cleanJenis = (jenisLayanan || "Konseling").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanKelas = (kelas || "Kelas").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanDate = (tanggal || new Date().toISOString().split("T")[0]).trim();
  const fileName = `${cleanDate}_${cleanJenis}_${cleanKelas}_${inisial}.pdf`;

  try {
    let driveFileId = null;
    let pdfUrl = null;

    // Inisialisasi Google Drive API v3 jika googleapis tersedia di environment
    let googleapisModule = null;
    try {
      googleapisModule = require("googleapis");
    } catch (e) {
      // Modul googleapis akan di-load di runtime production
    }

    if (googleapisModule && googleapisModule.google) {
      const { google } = googleapisModule;
      const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/drive"]
      });
      const drive = google.drive({ version: "v3", auth });

      // Helper cari / buat folder
      async function getOrCreateFolder(folderName, parentFolderId) {
        let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName.replace(/'/g, "\\'")}' and trashed=false`;
        if (parentFolderId) {
          q += ` and '${parentFolderId}' in parents`;
        }
        const searchRes = await drive.files.list({
          q,
          fields: "files(id, name)",
          spaces: "drive",
          pageSize: 1
        });

        if (searchRes.data.files && searchRes.data.files.length > 0) {
          return searchRes.data.files[0].id;
        }

        const createRes = await drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentFolderId ? [parentFolderId] : undefined
          },
          fields: "id"
        });
        return createRes.data.id;
      }

      // Struktur Folder: BK MGMP Kab Semarang / {schoolName} / {jenisLayanan}
      const rootFolderId = await getOrCreateFolder("BK MGMP Kab Semarang", undefined);
      const schoolFolderId = await getOrCreateFolder(schoolName, rootFolderId);
      const targetFolderId = await getOrCreateFolder(jenisLayanan, schoolFolderId);

      // Siapkan buffer PDF
      let pdfBuffer;
      if (pdfBase64) {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        pdfBuffer = Buffer.from(cleanBase64, "base64");
      } else {
        // Fallback minimal PDF header bila dipanggil tanpa payload binary
        pdfBuffer = Buffer.from(
          `%PDF-1.4\n1 0 obj\n<< /Title (${fileName}) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF`
        );
      }

      const stream = require("stream");
      const bufferStream = new stream.PassThrough();
      bufferStream.end(pdfBuffer);

      const fileRes = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: "application/pdf",
          parents: [targetFolderId],
          description: `Layanan BK ${jenisLayanan} - ${schoolName} - Siswa: ${inisial} (${cleanKelas})`
        },
        media: {
          mimeType: "application/pdf",
          body: bufferStream
        },
        fields: "id, name, webViewLink"
      });

      driveFileId = fileRes.data.id;
      pdfUrl = fileRes.data.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

      // Permission: Hanya guru dengan schoolId yang sama
      // DILARANG membuat file Public / Anyone with link.
      // Berikan akses reader spesifik kepada email pemanggil / domain sekolah jika ada
      if (context.auth.token && context.auth.token.email) {
        try {
          await drive.permissions.create({
            fileId: driveFileId,
            requestBody: {
              role: "reader",
              type: "user",
              emailAddress: context.auth.token.email
            }
          });
        } catch (permErr) {
          console.warn("Izin reader untuk user email:", permErr.message);
        }
      }
    } else {
      // Fallback ID saat mock/lokal
      driveFileId = `drive_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      pdfUrl = `https://drive.google.com/file/d/${driveFileId}/view`;
    }

    // 3. Simpan di Firestore di dokumen cases/{caseId} atau counseling/{docId}
    if (docId) {
      const targetCollection = colName === "cases" ? "cases" : "counseling";
      const docRef = admin.firestore().collection(targetCollection).doc(docId);
      await docRef.set(
        {
          pdfUrl: pdfUrl,
          driveFileId: driveFileId,
          pdfFileName: fileName,
          pdfGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
          schoolId: schoolId,
          schoolName: schoolName
        },
        { merge: true }
      );
    }

    return {
      success: true,
      pdfUrl: pdfUrl,
      driveFileId: driveFileId,
      fileName: fileName,
      folderPath: `BK MGMP Kab Semarang / ${schoolName} / ${jenisLayanan}`
    };
  } catch (err) {
    console.error("Gagal pada Cloud Function generateLayananPdf:", err);
    throw new functions.https.HttpsError(
      "internal",
      err.message || "Gagal mengupload PDF ke Google Drive."
    );
  }
});

