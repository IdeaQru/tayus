// Array untuk menyimpan data historis sensor
let weatherDataLog = [];

// Fungsi untuk mengambil dan tampilkan data dari sensor
function updateWeatherData() {
    fetch('/api/weather')
      .then(response => {
        if (!response.ok) throw new Error('Gagal mengambil data');
        return response.json();
      })
      .then(data => {
        // Update nilai di DOM
        document.getElementById('kecepatan-detik').textContent = data.kecepatan_detik;
        document.getElementById('kecepatan-jam').textContent = data.kecepatan_jam;
        document.getElementById('arah-angin').textContent = data.arah_angin;
        document.getElementById('curah-hujan').textContent = data.curah_hujan;
        
        // Format timestamp
        const date = new Date(data.timestamp);
        document.getElementById('timestamp').textContent = 
          `${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID')}`;
        
        // Simpan data sensor ke log secara otomatis
        saveWeatherDataToLog(data);
      })
      .catch(error => {
        console.error('Error:', error);
        // Jangan tampilkan alert setiap error, cukup log
        console.log('Gagal memperbarui data cuaca:', error.message);
      });
}

// Fungsi untuk menyimpan data sensor ke log
function saveWeatherDataToLog(sensorData) {
    const currentTime = new Date();
    const logEntry = {
        id: Date.now(), // Unique ID untuk setiap record
        timestamp: currentTime.toISOString(),
        tanggal: currentTime.toLocaleDateString('id-ID'),
        waktu: currentTime.toLocaleTimeString('id-ID'),
        kecepatanDetik: sensorData.kecepatan_detik,
        kecepatanJam: sensorData.kecepatan_jam,
        arahAngin: sensorData.arah_angin,
        curahHujan: sensorData.curah_hujan,
        timestampSensor: sensorData.timestamp
    };
    
    // Tambahkan ke log
    weatherDataLog.push(logEntry);
    
    // Update counter di UI
    document.getElementById('log-count').textContent = weatherDataLog.length;
    
    // Bersihkan data lama (simpan hanya 24 jam terakhir)
    cleanOldDataLog();
    
    // Simpan ke localStorage untuk persistence
    saveToLocalStorage();
}

// Fungsi untuk membersihkan data lama (lebih dari 24 jam)
function cleanOldDataLog() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    weatherDataLog = weatherDataLog.filter(entry => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= twentyFourHoursAgo;
    });
}

// Fungsi untuk menyimpan ke localStorage
function saveToLocalStorage() {
    try {
      
        localStorage.setItem('weatherDataLog', JSON.stringify(weatherDataLog));
    } catch (error) {
        console.error('Gagal menyimpan ke localStorage:', error);
    }
}

// Fungsi untuk memuat dari localStorage
function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem('weatherDataLog');
        if (saved) {
            weatherDataLog = JSON.parse(saved);
            document.getElementById('log-count').textContent = weatherDataLog.length;
        }
    } catch (error) {
        console.error('Gagal memuat dari localStorage:', error);
    }
}

// Fungsi untuk download CSV
function downloadCSV() {
    if (weatherDataLog.length === 0) {
        alert('Tidak ada data untuk didownload. Tunggu hingga data sensor tersedia.');
        return;
    }
    
    // Header CSV
    const csvHeader = 'ID,Tanggal,Waktu,Timestamp,Kecepatan per Detik (m/s),Kecepatan per Jam (km/h),Arah Angin (derajat),Curah Hujan (mm),Timestamp Sensor\n';
    
    // Convert data ke format CSV
    const csvContent = weatherDataLog.map(entry => {
        return `${entry.id},${entry.tanggal},${entry.waktu},${entry.timestamp},${entry.kecepatanDetik},${entry.kecepatanJam},${entry.arahAngin},${entry.curahHujan},${entry.timestampSensor}`;
    }).join('\n');
    
    // Gabungkan header dan content
    const fullCSV = csvHeader + csvContent;
    
    // Buat blob dan download
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `log_cuaca_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Tampilkan notifikasi sukses
        showNotification('Data berhasil didownload!', 'success');
    }
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff'};
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 3000);
}

// Fungsi untuk membuka peta
function openMaps() {
    window.open('maps.html', '_blank');
}

// Fungsi untuk menghapus semua log (fitur tambahan)
function clearAllLogs() {
    if (confirm('Apakah Anda yakin ingin menghapus semua log data?')) {
        weatherDataLog = [];
        document.getElementById('log-count').textContent = '0';
        localStorage.removeItem('weatherDataLog');
        showNotification('Semua log data telah dihapus!', 'info');
    }
}

// Inisialisasi aplikasi
function initializeApp() {
    // Muat data dari localStorage
    loadFromLocalStorage();
    
    // Jalankan update pertama kali
    updateWeatherData();
    
    // Set interval untuk update data sensor (setiap 30 detik)
    setInterval(updateWeatherData, 2000);
    
    // Set interval untuk membersihkan data lama (setiap 1 jam)
    setInterval(cleanOldDataLog, 200000);
}

// Jalankan saat halaman dimuat
document.addEventListener('DOMContentLoaded', initializeApp);
