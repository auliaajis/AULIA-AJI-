# Design Guidelines & System Instructions for AI Studio

Set aturan desain, skema warna, tipografi, dan komponen ini dapat disalin ke dalam proyek baru atau berkas `AGENTS.md` di proyek AI Studio lainnya agar AI dapat secara otomatis menerapkan tema visual yang persis sama.

---

## 🎨 1. Skema Warna (Color Palette)

Aplikasi ini menggunakan skema warna **Clean Teal Slate & Warm Off-White** dengan kontras tinggi yang profesional dan ramah mata:

*   **Primary Accent (Teal Utama):** `#00685f` (Hover: `#005049`, Light BG: `#e6f4f1` / `emerald-50`)
*   **Deep Heading & Dark Slate (Teks Header / Utama):** `#0b1c30`
*   **Secondary / Body Text (Teks Sekunder):** `#3d4947`
*   **Border & Divider Light:** `#bcc9c6` (opacity 30%–50%)
*   **Canvas / Main Background:** `#f8faf9` atau `#f3f6f5`
*   **Accent Highlight (Dokumentasi & Notulen):** Purple Accent (`purple-600`, `purple-50`, `purple-100`)
*   **Alert & Caution:** Amber (`amber-600`, `amber-50`), Red (`red-600`, `red-50`), Emerald (`emerald-600`, `emerald-50`)

---

## 🔤 2. Tipografi & Font Pairing

*   **Primary Font:** **Plus Jakarta Sans** (Weights: `400`, `500`, `600`, `700`, `800`)
*   **Google Fonts Import:**
    ```css
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
      background-color: #f8faf9;
      color: #0b1c30;
    }
    ```

---

## 📐 3. Layout & Komponen Visual

*   **Border Radius:** Konsisten memakai `rounded-xl` (12px) untuk tombol & input, dan `rounded-2xl` (16px) untuk card & kontainer utama.
*   **Bayangan (Shadows):** Murni bayangan sangat tipis / halus (`shadow-2xs`, `shadow-xs`, `shadow-sm`) untuk menjaga tampilan tetap bersih (clean).
*   **Tombol Navigasi / Tab:** Tab berupa tombol segmented pill di dalam kontainer `bg-gray-100 p-1.5 rounded-2xl`. Tab aktif menggunakan warna dasar `#00685f` dengan teks putih.
*   **Layar Sentuh Tanda Tangan (Touch Signature Pad):** Menggunakan elemen `<canvas>` interaktif bergaris batas putus-putus (*dashed border*) dengan instruksi transparan yang hilang saat disentuh/ditarik.

---

## 📋 4. Template Prompt untuk Proyek Baru di AI Studio

Saat membuka proyek baru di AI Studio, Anda cukup menempelkan instruksi berikut di kolom percakapan:

> **"Buat aplikasi [Nama Aplikasi] dengan tema desain Clean Teal & Slate:**
> - **Font:** Plus Jakarta Sans
> - **Warna Utama:** `#00685f` (Primary Teal) & `#0b1c30` (Dark Slate Heading)
> - **Latar Belakang Canvas:** Soft Off-White `#f8faf9`
> - **Sudut Elemen:** Rounded-xl (12px) & Rounded-2xl (16px)
> - **Gaya Visual:** Bersih, profesional, bebas AI-slop, dengan batas tipis `#bcc9c6` dan bayangan lembut."**
