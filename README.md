# NiagaAngkut — Operasional Broker Transportasi Curah

Aplikasi web pribadi untuk pencatatan ritase, kontrol dokumen SJ, manajemen vendor, penagihan ke Pusat, cetak nota vendor (A4 Landscape), dan perhitungan claim susut otomatis dengan toleransi **0,3% per ritase/nopol**.

Semua data tersimpan otomatis secara lokal di browser (`localStorage`), dilengkapi tombol **Backup Data (JSON)** dan **Restore Data**.

## Cara Deploy Otomatis ke GitHub Pages

1. Buat repository baru di GitHub (misalnya `niagaangkut`).
2. Unggah (atau `git push`) seluruh isi folder project ini ke branch `main` (atau `master`).
3. Di repository GitHub Anda, buka **Settings** → **Pages**.
4. Pada bagian **Build and deployment** → **Source**, pilih **GitHub Actions**.
5. Tunggu ~1 menit sampai proses workflow **Deploy NiagaAngkut ke GitHub Pages** selesai (centang hijau).
6. Link aplikasi Anda (`https://<username>.github.io/<nama-repo>/`) siap langsung dibuka di HP maupun laptop.

## Aplikasi PC Windows (.exe) & APK Android Otomatis

Setiap kali kode di-push ke branch `main` (atau dijalankan manual dari tab **Actions**):

1. **PC / Laptop Windows**: Workflow **Build Aplikasi PC Windows (NiagaAngkut)** otomatis membuat 2 file siap pakai di tab **Releases** (`NiagaAngkut PC Windows (.exe)`) dan **Artifacts** (`NiagaAngkut-PC-Windows`):
   - `NiagaAngkut-Setup.exe` — Installer Windows standar (otomatis membuat shortcut Desktop & Start Menu).
   - `NiagaAngkut-Portable.exe` — Versi portabel (langsung klik buka tanpa instalasi).
2. **HP Android**: Workflow **Build File APK Android (NiagaAngkut)** otomatis membuat `NiagaAngkut.apk`.

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Build produksi web:

```bash
npm run build
```

