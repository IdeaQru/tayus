const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import AIS Service
const { AISTelnetClient } = require('./ais-services');

const app = express();
const port = 3333;

// Inisialisasi AIS Client
const aisClient = new AISTelnetClient('165.154.228.42', 5000); // Ganti dengan host AIS server Anda

// Middleware untuk logging request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Konfigurasi CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware untuk parsing body request
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(bodyParser.json());

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

// ===== AIS CLIENT EVENT HANDLERS =====

// Event listeners untuk AIS client
aisClient.on('connected', () => {
  console.log('✅ AIS Telnet client connected successfully');
});

aisClient.on('disconnected', () => {
  console.log('❌ AIS Telnet client disconnected');
});

aisClient.on('error', (error) => {
  console.error('🔥 AIS Telnet client error:', error);
});

aisClient.on('shipUpdate', (shipData) => {
  console.log(`🚢 Ship data updated for MMSI: ${shipData.MMSI} (${shipData.decoderSource})`);
});

aisClient.on('aidUpdate', (aidData) => {
  console.log(`🚨 Aid-to-Navigation data updated for MMSI: ${aidData.MMSI} (${aidData.decoderSource})`);
});

// Start AIS connection
console.log('🔄 Starting AIS connection...');
aisClient.connect();

// ===== WEATHER API ENDPOINTS =====

// API endpoint untuk menerima data cuaca dari ESP32
app.post('/api/weather', (req, res) => {
  console.log('POST request received at /api/weather');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body:', req.body);
  
  // Cek apakah body kosong
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('Empty request body received');
    return res.status(400).json({ 
      error: 'Empty request body',
      timestamp: new Date().toISOString()
    });
  }
  
  const data = req.body;
  
  // Generate timestamp saat menerima data
  const timestamp = new Date().toISOString();

  // Validasi data (tanpa timestamp dari client)
  if (!data.kecepatan_detik && data.kecepatan_detik !== 0 || 
      !data.kecepatan_jam && data.kecepatan_jam !== 0 || 
      !data.arah_angin || 
      !data.curah_hujan && data.curah_hujan !== 0) {
    console.log('Incomplete data received:', data);
    return res.status(400).json({ 
      error: 'Data tidak lengkap',
      required: ['kecepatan_detik', 'kecepatan_jam', 'arah_angin', 'curah_hujan'],
      received: Object.keys(data),
      timestamp: timestamp
    });
  }

  // Format CSV dengan timestamp yang di-generate server
  const csvLine = `${timestamp},${data.kecepatan_detik},${data.kecepatan_jam},${data.arah_angin},${data.curah_hujan}\n`;

  // Pastikan folder data ada
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
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
      return res.status(500).json({ 
        error: 'Gagal menyimpan data',
        details: err.message,
        timestamp: timestamp
      });
    }
    console.log('Weather data saved successfully');
    res.json({ 
      status: 'success', 
      message: 'Data diterima dan disimpan', 
      timestamp: timestamp,
      data: data
    });
  });
});

// API endpoint untuk mengambil data cuaca terbaru
app.get('/api/weather', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'data_cuaca.csv');
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading weather data:', err);
      return res.status(500).json({ 
        error: 'Gagal membaca data',
        details: err.message,
        timestamp: new Date().toISOString()
      });
    }

    if (!data.trim()) {
      return res.status(404).json({ 
        error: 'Data belum tersedia',
        timestamp: new Date().toISOString()
      });
    }

    const lines = data
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({ 
        error: 'Format data tidak valid',
        timestamp: new Date().toISOString()
      });
    }

    const lastLine = lines[lines.length - 1];
    const fields = lastLine.split(',');

    if (fields.length < 5) {
      return res.status(400).json({ 
        error: 'Jumlah kolom tidak sesuai',
        expected: 5,
        received: fields.length,
        timestamp: new Date().toISOString()
      });
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

// API endpoint untuk mengambil historical weather data
app.get('/api/weather/history', (req, res) => {
  const filePath = path.join(__dirname, 'data', 'data_cuaca.csv');
  const limit = parseInt(req.query.limit) || 100;
  const page = parseInt(req.query.page) || 1;
  
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ 
        error: 'Gagal membaca data',
        timestamp: new Date().toISOString()
      });
    }

    if (!data.trim()) {
      return res.status(404).json({ 
        error: 'Data belum tersedia',
        timestamp: new Date().toISOString()
      });
    }

    const lines = data
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '');

    if (lines.length < 2) {
      return res.status(400).json({ 
        error: 'Format data tidak valid',
        timestamp: new Date().toISOString()
      });
    }

    // Remove header and reverse for latest first
    const dataLines = lines.slice(1).reverse();
    const total = dataLines.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const weatherHistory = dataLines.slice(startIndex, endIndex).map(line => {
      const fields = line.split(',');
      return {
        timestamp: fields[0],
        kecepatan_detik: parseFloat(fields[1]).toFixed(2),
        kecepatan_jam: parseFloat(fields[2]).toFixed(2),
        arah_angin: fields[3],
        curah_hujan: parseFloat(fields[4]).toFixed(2)
      };
    });

    res.json({
      data: weatherHistory,
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit),
      limit: limit
    });
  });
});

// ===== SHIPS API ENDPOINTS =====

// GET /api/ships - Mengambil semua data ships dengan pagination
app.get('/api/ships', (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '100');
    
    const result = aisClient.getAllShips(page, limit);
    
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ships data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ships/:mmsi - Mengambil data ship berdasarkan MMSI
app.get('/api/ships/:mmsi', (req, res) => {
  try {
    const mmsi = req.params.mmsi;
    const shipData = aisClient.getShipByMMSI(mmsi);
    
    if (!shipData) {
      return res.status(404).json({ 
        error: 'Ship not found',
        mmsi: mmsi,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(shipData);
  } catch (error) {
    console.error('Error fetching ship data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/ships/area - Mengambil ships berdasarkan area
app.post('/api/ships/area', (req, res) => {
  try {
    const bounds = req.body.bounds;
    
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return res.status(400).json({ 
        error: 'Invalid bounds format',
        required: 'bounds: { north, south, east, west }',
        timestamp: new Date().toISOString()
      });
    }
    
    const ships = aisClient.getShipsByArea(bounds);
    
    res.json({
      data: ships,
      total: ships.length,
      bounds: bounds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching ships by area:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== AIDS-TO-NAVIGATION API ENDPOINTS =====

// GET /api/aids - Mengambil semua data Aid-to-Navigation dengan pagination
app.get('/api/aids', (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '100');
    
    const result = aisClient.getAllAids(page, limit);
    
    res.json({
      ...result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching aids data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/aids/:mmsi - Mengambil data aid berdasarkan MMSI
app.get('/api/aids/:mmsi', (req, res) => {
  try {
    const mmsi = req.params.mmsi;
    const aidData = aisClient.getAidByMMSI(mmsi);
    
    if (!aidData) {
      return res.status(404).json({ 
        error: 'Aid not found',
        mmsi: mmsi,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json(aidData);
  } catch (error) {
    console.error('Error fetching aid data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/aids/type/:aidType - Mengambil aids berdasarkan tipe
app.get('/api/aids/type/:aidType', (req, res) => {
  try {
    const aidType = req.params.aidType;
    const aids = aisClient.getAidsByType(aidType);
    
    res.json({
      data: aids,
      total: aids.length,
      aidType: parseInt(aidType),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching aids by type:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/aids/area - Mengambil aids berdasarkan area
app.post('/api/aids/area', (req, res) => {
  try {
    const bounds = req.body.bounds;
    
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return res.status(400).json({ 
        error: 'Invalid bounds format',
        required: 'bounds: { north, south, east, west }',
        timestamp: new Date().toISOString()
      });
    }
    
    const aids = aisClient.getAidsByArea(bounds);
    
    res.json({
      data: aids,
      total: aids.length,
      bounds: bounds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching aids by area:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== STATISTICS & STATUS API ENDPOINTS =====

// GET /api/ais/statistics - Mengambil statistik AIS
app.get('/api/ais/statistics', (req, res) => {
  try {
    const stats = aisClient.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching AIS statistics:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /api/ais/status - Mengambil status koneksi AIS
app.get('/api/ais/status', (req, res) => {
  res.json({
    connected: aisClient.isConnected,
    totalShips: aisClient.shipsData.size,
    totalAids: aisClient.aidsData.size,
    host: aisClient.host,
    port: aisClient.port,
    timestamp: new Date().toISOString()
  });
});

// ===== COMBINED API ENDPOINTS =====

// GET /api/all - Mengambil semua data (ships + aids)
app.get('/api/all', (req, res) => {
  try {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '100');
    
    const ships = aisClient.getAllShips(1, 1000); // Get all ships
    const aids = aisClient.getAllAids(1, 1000); // Get all aids
    
    const allData = [...ships.data, ...aids.data];
    const total = allData.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    res.json({
      data: allData.slice(startIndex, endIndex),
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit),
      breakdown: {
        ships: ships.total,
        aids: aids.total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching all data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST /api/all/area - Mengambil semua data berdasarkan area
app.post('/api/all/area', (req, res) => {
  try {
    const bounds = req.body.bounds;
    
    if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
      return res.status(400).json({ 
        error: 'Invalid bounds format',
        required: 'bounds: { north, south, east, west }',
        timestamp: new Date().toISOString()
      });
    }
    
    const ships = aisClient.getShipsByArea(bounds);
    const aids = aisClient.getAidsByArea(bounds);
    
    res.json({
      data: [...ships, ...aids],
      total: ships.length + aids.length,
      bounds: bounds,
      breakdown: {
        ships: ships.length,
        aids: aids.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching all data by area:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===== HEALTH CHECK ENDPOINT =====

// GET /api/health - Health check endpoint
app.get('/api/health', (req, res) => {
  const weatherFilePath = path.join(__dirname, 'data', 'data_cuaca.csv');
  const weatherFileExists = fs.existsSync(weatherFilePath);
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      weather: {
        status: weatherFileExists ? 'active' : 'inactive',
        dataFile: weatherFileExists
      },
      ais: {
        status: aisClient.isConnected ? 'connected' : 'disconnected',
        totalShips: aisClient.shipsData.size,
        totalAids: aisClient.aidsData.size
      }
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.version
  });
});

// Route untuk halaman utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== ERROR HANDLING =====

// Tangani request yang tidak cocok dengan route manapun
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: 'Route not found',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });
});

// Tangani error
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Server error', 
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// ===== SERVER STARTUP =====

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di http://0.0.0.0:${port}`);
  console.log(`📊 Weather API: http://0.0.0.0:${port}/api/weather`);
  console.log(`🚢 Ships API: http://0.0.0.0:${port}/api/ships`);
  console.log(`🚨 Aids API: http://0.0.0.0:${port}/api/aids`);
  console.log(`💚 Health Check: http://0.0.0.0:${port}/api/health`);
});

// ===== GRACEFUL SHUTDOWN =====

process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down gracefully...');
  aisClient.disconnect();
  console.log('✅ AIS client disconnected');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Shutting down gracefully...');
  aisClient.disconnect();
  console.log('✅ AIS client disconnected');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  aisClient.disconnect();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  aisClient.disconnect();
  process.exit(1);
});
