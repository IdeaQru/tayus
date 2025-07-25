<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Tutorial.md - AIS Maritime System Setup

## Prerequisites

Pastikan Anda telah menginstall:

- **Node.js** (versi 16 atau lebih baru)
- **npm** (biasanya sudah terinstall dengan Node.js)
- **Git** (untuk clone repository)


## 1. Setup Project

### Clone atau Download Project

```bash
# Jika menggunakan Git
git clone <repository-url>
cd ais-maritime-system

# Atau extract file project ke folder
```


### Struktur Project

```
ais-maritime-system/
├── server.js              # Server utama
├── aisService.js          # AIS service untuk decode data
├── package.json           # Dependencies configuration
├── public/
│   ├── maps.html         # Halaman peta utama
│   ├── legend.html       # Halaman legend
│   ├── maps.js           # JavaScript untuk peta
│   ├── markers.js        # Marker management
│   ├── maps-style.css    # Styling untuk peta
│   ├── legend.css        # Styling untuk legend
│   └── assets/
│       └── marker/       # Icon markers
├── data/                 # Folder untuk data CSV (auto-created)
└── README.md
```


## 2. Install Dependencies

### Install Package Dependencies

```bash
npm install
```


### Dependencies yang Diinstall

Package yang akan diinstall secara otomatis:

- **express**: Web framework untuk Node.js
- **cors**: Cross-Origin Resource Sharing
- **body-parser**: Parse request body
- **ggencoder**: AIS message decoder


### Jika Ada Error saat Install

```bash
# Clear npm cache
npm cache clean --force

# Install ulang
npm install

# Atau install satu per satu
npm install express cors body-parser ggencoder
```


## 3. Konfigurasi Server

### Update Konfigurasi API (Opsional)

Edit file `maps.js` untuk mengubah URL API jika diperlukan:

```javascript
const API_CONFIG = {
  baseURL: 'http://localhost:3333/api',  // Ubah sesuai kebutuhan
  // ...
};
```


### Konfigurasi AIS Server

Edit file `server.js` untuk mengubah host AIS server:

```javascript
const aisClient = new AISTelnetClient('localhost', 4001); // Ganti dengan host AIS Anda
```


## 4. Running Application

### Start Server

```bash
node server.js
```


### Alternative Running Methods

```bash
# Menggunakan nodemon untuk development (jika terinstall)
npm install -g nodemon
nodemon server.js

# Atau menggunakan npm script (jika sudah dikonfigurasi)
npm start
```


### Expected Output

Jika berhasil, Anda akan melihat output seperti:

```
🚀 Server berjalan di http://0.0.0.0:3333
📊 Weather API: http://0.0.0.0:3333/api/weather
🚢 Ships API: http://0.0.0.0:3333/api/ships
🚨 Aids API: http://0.0.0.0:3333/api/aids
💚 Health Check: http://0.0.0.0:3333/api/health
🔄 Testing AIS connection...
✅ AIS Telnet client connected successfully
```


## 5. Akses Aplikasi

### Web Interface

- **Peta AIS**: http://localhost:3333/maps.html
- **Legend**: http://localhost:3333/legend.html
- **Home**: http://localhost:3333/


### API Endpoints

- **Health Check**: http://localhost:3333/api/health
- **Ships Data**: http://localhost:3333/api/ships
- **Aids Data**: http://localhost:3333/api/aids
- **Weather Data**: http://localhost:3333/api/weather
- **AIS Status**: http://localhost:3333/api/ais/status


## 6. Testing API

### Test dengan Browser

Buka browser dan akses:

```
http://localhost:3333/api/health
```


### Test dengan curl

```bash
# Health check
curl http://localhost:3333/api/health

# Ships data
curl http://localhost:3333/api/ships

# Weather data
curl http://localhost:3333/api/weather
```


## 7. Troubleshooting

### Port Already in Use

```bash
# Cari process yang menggunakan port 3333
lsof -i :3333

# Kill process
kill -9 <PID>

# Atau ubah port di server.js
const port = 3334; // Ganti port
```


### AIS Connection Error

```bash
# Pastikan AIS server berjalan di host:port yang benar
# Edit konfigurasi di server.js:
const aisClient = new AISTelnetClient('your-ais-host', 4001);
```


### Missing Dependencies

```bash
# Install missing dependencies
npm install --save express cors body-parser ggencoder

# Atau install development dependencies
npm install --save-dev nodemon
```


### File Permission Error

```bash
# Berikan permission untuk folder data
chmod 755 data/
chmod 644 data/*.csv
```


## 8. Development Mode

### Auto-restart Server

```bash
# Install nodemon globally
npm install -g nodemon

# Run dengan auto-restart
nodemon server.js
```


### Debug Mode

```bash
# Run dengan debug output
DEBUG=* node server.js

# Atau set environment variable
NODE_ENV=development node server.js
```


## 9. Production Deployment

### Install PM2 (Process Manager)

```bash
npm install -g pm2

# Start dengan PM2
pm2 start server.js --name "ais-server"

# Monitor
pm2 monit

# Auto-start on boot
pm2 startup
pm2 save
```


### Environment Variables

```bash
# Set production environment
export NODE_ENV=production
export PORT=3333

# Run server
node server.js
```


## 10. Maintenance

### Update Dependencies

```bash
# Check outdated packages
npm outdated

# Update packages
npm update

# Update specific package
npm install package-name@latest
```


### Backup Data

```bash
# Backup CSV data
cp -r data/ backup/data-$(date +%Y%m%d)/
```


### Log Management

```bash
# View logs dengan PM2
pm2 logs ais-server

# Rotate logs
pm2 install pm2-logrotate
```


## 11. Common Commands

### Quick Start

```bash
# Complete setup dan start
npm install && node server.js
```


### Stop Server

```bash
# Ctrl+C untuk stop server
# Atau jika menggunakan PM2:
pm2 stop ais-server
```


### Restart Server

```bash
# Jika menggunakan PM2
pm2 restart ais-server

# Atau manual
# Stop dengan Ctrl+C, kemudian:
node server.js
```


## 📝 Notes

- Server akan berjalan di port **3333** secara default
- Data weather akan disimpan di folder `data/data_cuaca.csv`
- AIS data disimpan di memory (tidak persistent)
- Pastikan folder `assets/marker/` berisi semua icon yang diperlukan
- Untuk production, gunakan process manager seperti PM2
- Monitor log untuk troubleshooting masalah koneksi AIS


## 🔧 Support

Jika mengalami masalah:

1. Periksa log console untuk error messages
2. Pastikan semua dependencies terinstall
3. Verifikasi konfigurasi host dan port
4. Test API endpoints secara manual
5. Periksa firewall dan network connectivity

**Selamat menggunakan AIS Maritime System!** 🚢⚓

