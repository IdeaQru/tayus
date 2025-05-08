const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

// Konfigurasi CORS
app.use(cors());

// Menyajikan file statis dari folder public
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint untuk mengambil data cuaca terbaru
app.get('/api/weather', (req, res) => {
    fs.readFile('data/data_cuaca.csv', 'utf8', (err, data) => {
      if (err) {
        return res.status(500).json({ error: 'Gagal membaca data' });
      }
  
      // 1. Handle file kosong
      if (!data.trim()) {
        return res.status(404).json({ error: 'Data belum tersedia' });
      }
  
      // 2. Bersihkan line kosong
      const lines = data
        .trim() // Hapus spasi di awal/akhir
        .split('\n')
        .filter(line => line.trim() !== ''); // Filter line kosong
  
      // 3. Validasi format data
      if (lines.length < 2) { // Minimal header + 1 data
        return res.status(400).json({ error: 'Format data tidak valid' });
      }
  
      const lastLine = lines[lines.length - 1]; // Ambil line terakhir
      const fields = lastLine.split(',');
  
      // 4. Validasi jumlah kolom
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

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
