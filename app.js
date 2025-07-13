const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser'); // Tambahkan ini jika belum ada

const app = express();
const port = 3000;

// Middleware untuk logging request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Konfigurasi CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware untuk parsing body request
app.use(express.json({ limit: '10mb' })); // Tingkatkan limit jika perlu
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json()); // Tambahkan body-parser sebagai backup

// Middleware untuk debugging body request
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('Headers:', req.headers);
    console.log('Raw body:', req.body);
  }
  next();
});

// Menyajikan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint untuk menerima data cuaca dari ESP32
app.post('/api/weather', (req, res) => {
  console.log('POST request received at /api/weather');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body:', req.body);
  
  // Cek apakah body kosong
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('Empty request body received');
    return res.status(400).json({ error: 'Empty request body' });
  }
  
  const data = req.body;
  
  // Generate timestamp saat menerima data
  const timestamp = new Date().toISOString();

  // Validasi data (tanpa timestamp dari client)
  if (!data.kecepatan_detik || !data.kecepatan_jam || !data.arah_angin || !data.curah_hujan) {
    console.log('Incomplete data received:', data);
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }

  // Format CSV dengan timestamp yang di-generate server
  const csvLine = `${timestamp},${data.kecepatan_detik},${data.kecepatan_jam},${data.arah_angin},${data.curah_hujan}\n`;

  // Pastikan folder data ada
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  // Simpan ke file CSV
  const filePath = path.join(dataDir, 'data_cuaca.csv');

  // Jika file belum ada, buat header terlebih dahulu
  if (!fs.existsSync(filePath)) {
    const header = 'Timestamp,kecepatan_detik,kecepatan_jam,arah_angin,curah_hujan\n';
    fs.writeFileSync(filePath, header);
  }

  // Tambahkan data
  fs.appendFile(filePath, csvLine, (err) => {
    if (err) {
      console.error('Gagal menyimpan data:', err);
      return res.status(500).json({ error: 'Gagal menyimpan data' });
    }
    console.log('Data saved successfully');
    res.json({ status: 'success', message: 'Data diterima dan disimpan', timestamp: timestamp });
  });
});

// API endpoint untuk mengambil data cuaca terbaru
app.get('/api/weather', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'data_cuaca.csv');
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Gagal membaca data' });
    }

    if (!data.trim()) {
      return res.status(404).json({ error: 'Data belum tersedia' });
    }

    const lines = data
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({ error: 'Format data tidak valid' });
    }

    const lastLine = lines[lines.length - 1];
    const fields = lastLine.split(',');

    if (fields.length < 5) {
      return res.status(400).json({ error: 'Jumlah kolom tidak sesuai' });
    }

    const weatherData = {
      timestamp: fields[0],
      kecepatan_detik: parseFloat(fields[1]).toFixed(2),
      kecepatan_jam: parseFloat(fields[2]).toFixed(2),
      arah_angin: fields[3],
      curah_hujan: parseFloat(fields[4]).toFixed(2)
    };

    res.json(weatherData);
  });
});

// Route untuk halaman utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tangani request yang tidak cocok dengan route manapun
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: 'Route not found' });
});

// Tangani error
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Server error', message: err.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server berjalan di http://0.0.0.0:${port}`);
});
