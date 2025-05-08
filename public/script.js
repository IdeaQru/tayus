// Fungsi untuk mengambil dan tampilkan data
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
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Gagal memperbarui data cuaca');
      });
  }
  
  // Jalankan update otomatis setiap 5 detik
  setInterval(updateWeatherData, 1000);
  updateWeatherData(); // Update pertama kali
  