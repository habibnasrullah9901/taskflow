# TASKFLOW – Sistem Informasi Pengumpulan Tugas dan Manajemen Materi Kuliah

## Prasyarat
1. Install **Node.js LTS** (https://nodejs.org) dan **MySQL 8** (atau XAMPP/Laragon). Install VS Code.
2. Buka folder `taskflow` di VS Code.

## Langkah menjalankan
1. **Database** – buka MySQL (terminal/phpMyAdmin) lalu impor:
   `mysql -u root -p < database/taskflow.sql`
2. **Backend** (terminal 1):
   ```
   cd backend
   npm install
   ```
   Edit `backend/.env` (sudah disalin dari `.env.example`): isi `DB_PASSWORD` dan ganti `JWT_SECRET` dengan teks acak panjang. Lalu:
   ```
   npm run seed     # membuat akun demo (cukup sekali)
   npm run dev
   ```
3. **Frontend** (terminal 2):
   ```
   cd frontend
   npm install
   npm run dev
   ```
4. Buka **http://localhost:5173**

## Akun demo
| Role | Email | Password |
|---|---|---|
| Admin | admin@taskflow.id | admin123 |
| Dosen | dosen@taskflow.id | dosen123 |
| Mahasiswa | mahasiswa@taskflow.id | mhs123 |

## Catatan keamanan & asumsi
- Password di-hash bcrypt; token JWT di cookie httpOnly + SameSite strict; pengecekan Origin untuk CSRF; query MySQL berparameter; rate limiting login & API.
- File upload divalidasi ekstensi, ukuran, dan magic bytes; disimpan dengan nama acak di `backend/uploads` (tidak dipublikasikan) dan hanya bisa diunduh lewat endpoint yang mengecek hak akses.
- Reset password mode demo: tautan dicetak di terminal backend (belum ada pengiriman email).
- Akun baru mahasiswa belum punya kelas/mata kuliah; hubungkan via data di database (menu admin belum dibuat di versi ini).
