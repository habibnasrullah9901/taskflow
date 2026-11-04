# Deploy TASKFLOW ke VPS (Docker)
1. Siapkan VPS Ubuntu (1 GB RAM cukup) dan sebuah domain yang A-record-nya mengarah ke IP VPS.
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Upload folder `taskflow` ke VPS (mis. `scp -r taskflow user@IP:~/`), lalu `cd taskflow`.
4. `cp .env.production.example .env` dan isi DOMAIN, DB_PASSWORD, JWT_SECRET (`nano .env`).
5. `docker compose up -d --build`  (database + tabel dibuat otomatis, HTTPS otomatis dari Caddy)
6. Buat akun demo (sekali saja): `docker compose exec app node seed.js`
7. Buka `https://DOMAINANDA`. Ganti password akun demo setelah login!
Update versi baru: `docker compose up -d --build`. Backup: volume `dbdata` (database) dan `uploads` (file).
