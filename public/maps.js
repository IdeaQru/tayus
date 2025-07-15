// maps.js - Core map functionality dengan MarkerManager integration

// ===== GLOBAL VARIABLES =====
let map, vesselsLayer, buoysLayer, tracksLayer, weatherLayer;
let allProcessedData = new Map();
let connectionStatus = 'disconnected';
let refreshInterval = null;
let weatherData = null;

// ===== API CONFIGURATION =====
const API_CONFIG = {
  baseURL: 'http://localhost:3333/api',
  endpoints: {
    ships: '/ships',
    aids: '/aids',
    weather: '/weather',
    weatherHistory: '/weather/history',
    aisStatus: '/ais/status',
    aisStatistics: '/ais/statistics',
    allData: '/all',
    health: '/health'
  },
  refreshInterval: 30000, // 30 seconds
  timeout: 10000 // 10 seconds
};

// ===== MARKER ASSETS CONFIGURATION =====
const MARKER_ASSETS = {
  basePath: './assets/marker/',
  vessel: 'ships.png',
  aton: {
    // Cardinal Marks
    1: 'north-cardinal.png',     // North Cardinal
    2: 'east-cardinal.png',      // East Cardinal  
    3: 'south-cardinal.png',     // South Cardinal
    4: 'west-cardinal.png',      // West Cardinal
    21: 'north-cardinal.png',    // North Cardinal with Topmark
    22: 'east-cardinal.png',     // East Cardinal with Topmark
    23: 'south-cardinal.png',    // South Cardinal with Topmark
    24: 'west-cardinal.png',     // West Cardinal with Topmark
    
    // Lateral Marks
    5: 'portland.png',           // Port Hand
    7: 'portland.png',           // Preferred Channel Port
    25: 'portland.png',          // Port Lateral with Topmark
    6: 'starboard-hand.png',     // Starboard Hand
    8: 'starboard-hand.png',     // Preferred Channel Starboard
    26: 'starboard-hand.png',    // Starboard Lateral with Topmark
    
    // Safe Water Marks
    10: 'safe-water.png',        // Safe Water
    28: 'safe-water.png',        // Safe Water with Topmark
    
    // Special Marks
    9: 'special-mark.png',       // Isolated Danger
    11: 'special-mark.png',      // Special Mark
    12: 'special-mark.png',      // Light Vessel
    13: 'special-mark.png',      // LANBY
    14: 'special-mark.png',      // Racon
    15: 'special-mark.png',      // Fixed Structure
    16: 'special-mark.png',      // Floating Structure
    17: 'special-mark.png',      // Emergency Wreck
    18: 'special-mark.png',      // Offshore Platform
    19: 'special-mark.png',      // Drilling Rig
    27: 'special-mark.png',      // Isolated Danger with Topmark
    29: 'special-mark.png',      // Special Purpose with Topmark
    30: 'special-mark.png',      // Wreck Marking
    31: 'special-mark.png',      // Obstruction Marking
    
    // Virtual ATON
    20: 'virtual_buoy.png',      // Virtual ATON
    
    // Default/Unknown
    0: 'special-mark.png'        // Unknown ATON
  }
};

// ===== API CLIENT CLASS =====
class AISAPIClient {
  constructor(config) {
    this.config = config;
    this.abortController = null;
  }

  async makeRequest(endpoint, options = {}) {
    try {
      if (this.abortController) {
        this.abortController.abort();
      }
      
      this.abortController = new AbortController();
      
      const url = `${this.config.baseURL}${endpoint}`;
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: this.abortController.signal,
        timeout: this.config.timeout,
        ...options
      };

      console.log(`🌐 Making API request to: ${url}`);
      
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ API response received from ${endpoint}`);
      
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🔄 Request aborted');
        return null;
      }
      
      console.error(`❌ API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async getAllData(page = 1, limit = 100) {
    return await this.makeRequest(`${this.config.endpoints.allData}?page=${page}&limit=${limit}`);
  }

  async getShips(page = 1, limit = 100) {
    return await this.makeRequest(`${this.config.endpoints.ships}?page=${page}&limit=${limit}`);
  }

  async getAids(page = 1, limit = 100) {
    return await this.makeRequest(`${this.config.endpoints.aids}?page=${page}&limit=${limit}`);
  }

  async getShipsByArea(bounds) {
    return await this.makeRequest(this.config.endpoints.ships + '/area', {
      method: 'POST',
      body: JSON.stringify({ bounds })
    });
  }

  async getAidsByArea(bounds) {
    return await this.makeRequest(this.config.endpoints.aids + '/area', {
      method: 'POST',
      body: JSON.stringify({ bounds })
    });
  }

  async getAllDataByArea(bounds) {
    return await this.makeRequest(this.config.endpoints.allData + '/area', {
      method: 'POST',
      body: JSON.stringify({ bounds })
    });
  }

  async getWeatherData() {
    return await this.makeRequest(this.config.endpoints.weather);
  }

  async getWeatherHistory(page = 1, limit = 50) {
    return await this.makeRequest(`${this.config.endpoints.weatherHistory}?page=${page}&limit=${limit}`);
  }

  async getAISStatus() {
    return await this.makeRequest(this.config.endpoints.aisStatus);
  }

  async getAISStatistics() {
    return await this.makeRequest(this.config.endpoints.aisStatistics);
  }

  async getHealthStatus() {
    return await this.makeRequest(this.config.endpoints.health);
  }
}

// ===== INITIALIZE API CLIENT =====
const apiClient = new AISAPIClient(API_CONFIG);

// ===== MAP INITIALIZATION =====
async function initMap() {
  try {
    console.log('🗺️ Initializing map with AIS Server API...');
    
    // Setup map
    map = L.map('map').setView([-6.1754, 106.8272], 6);

    // Base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CartoDB'
    });

    osmLayer.addTo(map);

    // Layer groups
    vesselsLayer = L.layerGroup().addTo(map);
    buoysLayer = L.layerGroup().addTo(map);
    tracksLayer = L.layerGroup();
    weatherLayer = L.layerGroup();

    // Layer control
    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "Satellite": satelliteLayer,
      "Dark": darkLayer
    };

    const overlayMaps = {
      "Vessels": vesselsLayer,
      "Aids to Navigation": buoysLayer,
      "Tracks": tracksLayer,
      "Weather": weatherLayer
    };

    L.control.layers(baseMaps, overlayMaps).addTo(map);
    
    // Test API connection
    console.log('🔄 Testing API connection...');
    const healthStatus = await testAPIConnection();
    
    if (healthStatus) {
      console.log('✅ API connection successful, starting data fetch...');
      updateConnectionStatus('connected');
      
      // Initial data fetch
      await fetchAllData();
      
      // Start auto-refresh
      startAutoRefresh();
      
      // Fetch weather data
      await fetchWeatherData();
      
    } else {
      console.log('❌ API connection failed');
      updateConnectionStatus('error');
    }
    
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    updateConnectionStatus('error');
  }
}

// ===== API CONNECTION TEST =====
async function testAPIConnection() {
  try {
    updateConnectionStatus('connecting');
    
    const healthStatus = await apiClient.getHealthStatus();
    
    if (healthStatus && healthStatus.status === 'healthy') {
      console.log('✅ API Health Check passed:', healthStatus);
      return true;
    } else {
      console.log('❌ API Health Check failed:', healthStatus);
      return false;
    }
    
  } catch (error) {
    console.error('❌ API connection test failed:', error);
    return false;
  }
}

// ===== DATA FETCHING =====
async function fetchAllData() {
  try {
    console.log('📄 Fetching all AIS data...');
    updateConnectionStatus('connecting');
    
    let currentPage = 1;
    let hasMorePages = true;
    let totalFetched = 0;
    
    // Clear existing data
    allProcessedData.clear();
    MarkerManager.clearAllMarkers();
    
    while (hasMorePages && currentPage <= 10) {
      try {
        console.log(`📄 Fetching page ${currentPage}...`);
        
        const pageData = await apiClient.getAllData(currentPage, 100);
        
        if (pageData && pageData.data && pageData.data.length > 0) {
          processPageData(pageData.data);
          totalFetched += pageData.data.length;
          
          // Check if there are more pages
          if (pageData.totalPages && currentPage < pageData.totalPages) {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
          } else {
            hasMorePages = false;
          }
        } else {
          hasMorePages = false;
        }
        
      } catch (pageError) {
        console.error(`❌ Error fetching page ${currentPage}:`, pageError);
        hasMorePages = false;
      }
    }
    
    console.log(`✅ Total fetched: ${totalFetched} records`);
    updateMapWithAllData();
    updateConnectionStatus('connected');
    
    // Update last update time
    updateLastUpdateTime();
    
    // Fetch statistics
    await fetchAISStatistics();
    
  } catch (error) {
    console.error('❌ Error fetching all data:', error);
    updateConnectionStatus('error');
  }
}

// ===== PROCESS PAGE DATA =====
function processPageData(pageData) {
  if (!Array.isArray(pageData)) return;
  
  pageData.forEach(item => {
    if (!item || !item.MMSI) return;
    
    const processedItem = processAISItem(item);
    if (processedItem) {
      allProcessedData.set(processedItem.mmsi, processedItem);
    }
  });
}

// ===== PROCESS AIS ITEM =====
function processAISItem(item) {
  try {
    if (!hasValidPosition(item)) {
      return null;
    }
    
    const processedItem = {
      mmsi: item.MMSI,
      timestamp: item.Timestamp || new Date().toISOString(),
      position: extractPosition(item),
      movement: extractMovement(item),
      static: extractStaticData(item),
      dataAgeMinutes: calculateDataAge(item.Timestamp),
      messageType: parseInt(item.MessageType || 0),
      rawData: item,
      lastUpdate: new Date()
    };
    
    // Classify based on Message Type
    if (processedItem.messageType === 21) {
      // Message Type 21 = Aid to Navigation Report
      const atonData = classifyATON(item);
      return {
        ...processedItem,
        objectType: 'aton',
        isVessel: false,
        atonType: atonData.type,
        atonName: atonData.name,
        atonCategory: atonData.category,
        markerImage: item.MarkerImage || MARKER_ASSETS.aton[atonData.type] || MARKER_ASSETS.aton[0],
        atonDetails: extractATONDetails(item)
      };
    } else {
      // All non-ATON are vessels
      return {
        ...processedItem,
        objectType: 'vessel',
        isVessel: true,
        markerImage: item.MarkerImage || MARKER_ASSETS.vessel
      };
    }
    
  } catch (error) {
    console.error(`❌ Error processing AIS item:`, error);
    return null;
  }
}

// ===== UPDATE MAP WITH ALL DATA =====
function updateMapWithAllData() {
  try {
    console.log(`🗺️ Updating map with ${allProcessedData.size} total records`);
    
    // Clear existing layers using MarkerManager
    MarkerManager.clearAllMarkers();
    
    let vesselCount = 0;
    let buoyCount = 0;
    let validCoordinates = 0;
    let invalidCoordinates = 0;
    
    allProcessedData.forEach((item, mmsi) => {
      try {
        if (!item.position || !item.position.latitude || !item.position.longitude) {
          invalidCoordinates++;
          return;
        }
        
        const lat = parseFloat(item.position.latitude);
        const lng = parseFloat(item.position.longitude);
        
        if (!isValidCoordinate(lat, lng)) {
          invalidCoordinates++;
          return;
        }
        
        validCoordinates++;
        
        if (item.isVessel) {
          vesselCount++;
          MarkerManager.addVesselMarker(item, lat, lng);
        } else {
          buoyCount++;
          MarkerManager.addATONMarker(item, lat, lng);
        }
        
      } catch (error) {
        console.error(`❌ Error processing item ${mmsi}:`, error);
        invalidCoordinates++;
      }
    });
    
    updateCounters(vesselCount, buoyCount);
    
    console.log(`📊 Map update complete:`, {
      vessels: vesselCount,
      buoys: buoyCount,
      validCoordinates,
      invalidCoordinates,
      totalProcessed: allProcessedData.size
    });
    
    // Auto-zoom to data
    setTimeout(() => {
      // autoZoomToData();
    }, 500);
    
    // Cleanup old markers
    MarkerManager.cleanupOldMarkers();
    
  } catch (error) {
    console.error('❌ Error updating map:', error);
  }
}

// ===== WEATHER DATA FUNCTIONS =====
async function fetchWeatherData() {
  try {
    console.log('🌤️ Fetching weather data...');
    
    const weather = await apiClient.getWeatherData();
    
    if (weather) {
      weatherData = weather;
      updateWeatherDisplay(weather);
      console.log('✅ Weather data updated:', weather);
    }
    
  } catch (error) {
    console.error('❌ Error fetching weather data:', error);
  }
}

function updateWeatherDisplay(weather) {
  try {
    const weatherContainer = document.getElementById('weather-info');
    if (!weatherContainer) return;
    
    weatherContainer.innerHTML = `
      <div class="weather-data">
        <div class="weather-item">
          <span class="weather-label">
            <i class="fas fa-wind"></i> Wind Speed:
          </span>
          <span class="weather-value">${weather.kecepatan_jam} km/h</span>
        </div>
        <div class="weather-item">
          <span class="weather-label">
            <i class="fas fa-compass"></i> Wind Direction:
          </span>
          <span class="weather-value">${weather.arah_angin}</span>
        </div>
        <div class="weather-item">
          <span class="weather-label">
            <i class="fas fa-cloud-rain"></i> Rainfall:
          </span>
          <span class="weather-value">${weather.curah_hujan} mm</span>
        </div>
        <div class="weather-timestamp">
          <i class="fas fa-clock"></i> Updated: ${new Date(weather.timestamp).toLocaleString()}
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Error updating weather display:', error);
  }
}

// ===== AIS STATISTICS =====
async function fetchAISStatistics() {
  try {
    const stats = await apiClient.getAISStatistics();
    
    if (stats) {
      updateStatisticsDisplay(stats);
      console.log('📊 AIS Statistics updated:', stats);
    }
    
  } catch (error) {
    console.error('❌ Error fetching AIS statistics:', error);
  }
}

function updateStatisticsDisplay(stats) {
  try {
    const statsContainer = document.getElementById('ais-statistics');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
      <div class="stats-data">
        <div class="stats-item">
          <span class="stats-label">
            <i class="fas fa-ship"></i> Total Ships:
          </span>
          <span class="stats-value">${stats.totalShips}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">
            <i class="fas fa-anchor"></i> Total Aids:
          </span>
          <span class="stats-value">${stats.totalAids}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">
            <i class="fas fa-broadcast-tower"></i> Message Types:
          </span>
          <span class="stats-value">${Object.keys(stats.messageTypes || {}).length}</span>
        </div>
        <div class="stats-item">
          <span class="stats-label">
            <i class="fas fa-database"></i> Decoder Sources:
          </span>
          <span class="stats-value">${Object.keys(stats.decoderSources || {}).length}</span>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error('❌ Error updating statistics display:', error);
  }
}

// ===== AUTO REFRESH =====
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  refreshInterval = setInterval(async () => {
    console.log('🔄 Auto-refreshing data...');
    await fetchAllData();
    await fetchWeatherData();
  }, API_CONFIG.refreshInterval);
  
  console.log(`🔄 Auto-refresh started (${API_CONFIG.refreshInterval / 1000}s interval)`);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('⏹️ Auto-refresh stopped');
  }
}

// ===== HELPER FUNCTIONS =====
function isValidCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function hasValidPosition(item) {
  if (item.coordinates && item.coordinates.coordinates && item.coordinates.coordinates.length >= 2) return true;
  if (item.position && item.position.latitude && item.position.longitude) return true;
  if (item.latitude && item.longitude) return true;
  if (item.lat && item.lng) return true;
  return false;
}

function extractPosition(item) {
  if (item.coordinates && item.coordinates.coordinates && item.coordinates.coordinates.length >= 2) {
    return {
      latitude: parseFloat(item.coordinates.coordinates[1]),
      longitude: parseFloat(item.coordinates.coordinates[0])
    };
  }
  
  if (item.position && item.position.latitude && item.position.longitude) {
    return {
      latitude: parseFloat(item.position.latitude),
      longitude: parseFloat(item.position.longitude)
    };
  }
  
  if (item.latitude && item.longitude) {
    return {
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude)
    };
  }
  
  return { latitude: 0, longitude: 0 };
}

function extractMovement(item) {
  return {
    sog: parseFloat(item.SpeedOverGround || item.sog || 0),
    cog: parseFloat(item.CourseOverGround || item.cog || 0),
    heading: parseFloat(item.Heading || item.heading || 0),
    rot: parseFloat(item.RateOfTurn || item.rot || 0),
    navStatus: parseInt(item.NavigationStatus || item.navStatus || 0)
  };
}

function extractStaticData(item) {
  return {
    NAME: item.ShipName || item.NAME || item.name || 'Unknown Vessel',
    TYPE: parseInt(item.ShipType || item.TYPE || 0),
    TYPENAME: item.vesseltypeDesk || item.TYPENAME || 'Unknown Type',
    MMSI: item.MMSI || item.mmsi,
    IMO: item.IMO_Number || item.IMO,
    CALLSIGN: item.CallSign || item.callsign,
    FLAG: item.Flag || item.FLAG,
    LENGTH: item.Length || item.LOA,
    WIDTH: item.Width || item.BEAM,
    DRAUGHT: item.Draught || item.DRAUGHT
  };
}

function calculateDataAge(timestamp) {
  if (!timestamp) return 0;
  const now = new Date();
  const dataTime = new Date(timestamp);
  const diffMs = now - dataTime;
  return Math.floor(diffMs / 60000);
}

function classifyATON(atonData) {
  const atonType = parseInt(atonData.AidType || atonData.aidType || 0);
  
  const atonNames = {
    1: 'North Cardinal', 2: 'East Cardinal', 3: 'South Cardinal', 4: 'West Cardinal',
    5: 'Port Hand', 6: 'Starboard Hand', 7: 'Preferred Channel Port', 8: 'Preferred Channel Starboard',
    9: 'Isolated Danger', 10: 'Safe Water', 11: 'Special Mark', 12: 'Light Vessel',
    13: 'LANBY', 14: 'Racon', 15: 'Fixed Structure', 16: 'Floating Structure',
    17: 'Emergency Wreck', 18: 'Offshore Platform', 19: 'Drilling Rig', 20: 'Virtual ATON',
    21: 'North Cardinal with Topmark', 22: 'East Cardinal with Topmark', 23: 'South Cardinal with Topmark', 24: 'West Cardinal with Topmark',
    25: 'Port Lateral with Topmark', 26: 'Starboard Lateral with Topmark', 27: 'Isolated Danger with Topmark', 28: 'Safe Water with Topmark',
    29: 'Special Purpose with Topmark', 30: 'Wreck Marking', 31: 'Obstruction Marking', 0: 'Unknown ATON'
  };
  
  const atonCategories = {
    1: 'Cardinal Mark', 2: 'Cardinal Mark', 3: 'Cardinal Mark', 4: 'Cardinal Mark',
    5: 'Lateral Mark', 6: 'Lateral Mark', 7: 'Lateral Mark', 8: 'Lateral Mark',
    9: 'Isolated Danger', 10: 'Safe Water', 11: 'Special Mark', 12: 'Light Vessel',
    13: 'Large Automatic Navigation Buoy', 14: 'Radar Transponder', 15: 'Fixed Structure', 16: 'Floating Structure',
    17: 'Emergency Wreck Marking', 18: 'Offshore Installation', 19: 'Offshore Installation', 20: 'Virtual Aid',
    21: 'Cardinal Mark', 22: 'Cardinal Mark', 23: 'Cardinal Mark', 24: 'Cardinal Mark',
    25: 'Lateral Mark', 26: 'Lateral Mark', 27: 'Isolated Danger', 28: 'Safe Water',
    29: 'Special Mark', 30: 'Wreck Mark', 31: 'Obstruction Mark', 0: 'Unknown'
  };
  
  return {
    type: atonType,
    name: atonNames[atonType] || atonNames[0],
    category: atonCategories[atonType] || atonCategories[0]
  };
}

function extractATONDetails(atonData) {
  return {
    name: atonData.AidName || atonData.name || 'Unknown ATON',
    offPosition: atonData.OffPosition || false,
    virtualAid: atonData.VirtualAid || false,
    assignedMode: atonData.AssignedMode || false,
    length: atonData.Length || 0,
    width: atonData.Width || 0
  };
}

function autoZoomToData() {
  try {
    const bounds = L.latLngBounds();
    let hasValidBounds = false;
    
    // Check all markers in vessels layer
    vesselsLayer.eachLayer(function(marker) {
      const latLng = marker.getLatLng();
      if (latLng) {
        bounds.extend(latLng);
        hasValidBounds = true;
      }
    });
    
    // Check all markers in buoys layer
    buoysLayer.eachLayer(function(marker) {
      const latLng = marker.getLatLng();
      if (latLng) {
        bounds.extend(latLng);
        hasValidBounds = true;
      }
    });
    
    if (hasValidBounds) {
      console.log('🗺️ Auto-zooming to marker bounds');
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 12
      });
    } else {
      console.log('🗺️ No markers found, zooming to Indonesia');
      map.setView([-6.2, 106.8], 8);
    }
    
  } catch (error) {
    console.error('❌ Error auto-zooming:', error);
    map.setView([-6.2, 106.8], 8);
  }
}

// ===== UI CONTROL FUNCTIONS =====
function updateCounters(vesselCount, buoyCount) {
  try {
    const vesselCountEl = document.getElementById('vessel-count');
    const buoyCountEl = document.getElementById('buoy-count');
    
    if (vesselCountEl) vesselCountEl.textContent = vesselCount;
    if (buoyCountEl) buoyCountEl.textContent = buoyCount;
  } catch (error) {
    console.error('❌ Error updating counters:', error);
  }
}

function updateConnectionStatus(status) {
  try {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (!statusDot || !statusText) return;
    
    connectionStatus = status;
    
    switch(status) {
      case 'connected':
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Live AIS Data';
        break;
      case 'connecting':
        statusDot.className = 'status-dot connecting';
        statusText.textContent = 'Connecting...';
        break;
      case 'error':
        statusDot.className = 'status-dot error';
        statusText.textContent = 'Connection Error';
        break;
      default:
        statusDot.className = 'status-dot';
        statusText.textContent = 'Disconnected';
    }
  } catch (error) {
    console.error('❌ Error updating connection status:', error);
  }
}

function updateLastUpdateTime() {
  try {
    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = new Date().toLocaleTimeString();
    }
  } catch (error) {
    console.error('❌ Error updating last update time:', error);
  }
}

function toggleFilter(type) {
  try {
    const btn = document.getElementById(type + '-btn');
    if (!btn) return;
    
    if (type === 'vessels') {
      if (map.hasLayer(vesselsLayer)) {
        map.removeLayer(vesselsLayer);
        btn.classList.remove('active');
      } else {
        map.addLayer(vesselsLayer);
        btn.classList.add('active');
      }
    } else if (type === 'buoys') {
      if (map.hasLayer(buoysLayer)) {
        map.removeLayer(buoysLayer);
        btn.classList.remove('active');
      } else {
        map.addLayer(buoysLayer);
        btn.classList.add('active');
      }
    } else if (type === 'tracks') {
      if (map.hasLayer(tracksLayer)) {
        map.removeLayer(tracksLayer);
        btn.classList.remove('active');
      } else {
        map.addLayer(tracksLayer);
        btn.classList.add('active');
      }
    } else if (type === 'weather') {
      if (map.hasLayer(weatherLayer)) {
        map.removeLayer(weatherLayer);
        btn.classList.remove('active');
      } else {
        map.addLayer(weatherLayer);
        btn.classList.add('active');
      }
    }
  } catch (error) {
    console.error('❌ Error toggling filter:', error);
  }
}

async function refreshData() {
  const refreshBtn = document.querySelector('.refresh-btn i, .action-btn i');
  
  try {
    if (refreshBtn) refreshBtn.style.animation = 'spin 1s linear infinite';
    
    console.log('🔄 Manual refresh triggered...');
    updateConnectionStatus('connecting');
    
    // Clear existing data
    allProcessedData.clear();
    
    // Fetch fresh data
    await fetchAllData();
    await fetchWeatherData();
    
    console.log('✅ Manual refresh completed');
    
    // Show success toast
    showToast('Data refreshed successfully', 'success');
    
  } catch (error) {
    console.error('❌ Refresh failed:', error);
    updateConnectionStatus('error');
    showToast('Refresh failed: ' + error.message, 'error');
  }
  
  setTimeout(() => {
    if (refreshBtn) refreshBtn.style.animation = '';
  }, 2000);
}

// ===== DETAIL FUNCTIONS =====
function showVesselDetails(vessel) {
  try {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    if (!infoPanel || !infoContent) return;
    
    // Show panel
    infoPanel.classList.add('active');
    
    // Create detailed content
    const detailContent = MarkerManager.createVesselPopup(vessel);
    infoContent.innerHTML = detailContent;
    
    console.log('🚢 Showing vessel details:', vessel);
  } catch (error) {
    console.error('❌ Error showing vessel details:', error);
  }
}

function showATONDetails(aton) {
  try {
    const infoPanel = document.getElementById('info-panel');
    const infoContent = document.getElementById('info-content');
    
    if (!infoPanel || !infoContent) return;
    
    // Show panel
    infoPanel.classList.add('active');
    
    // Create detailed content
    const detailContent = MarkerManager.createATONPopup(aton);
    infoContent.innerHTML = detailContent;
    
    console.log('🚨 Showing ATON details:', aton);
  } catch (error) {
    console.error('❌ Error showing ATON details:', error);
  }
}

// ===== AREA SEARCH =====
async function searchByArea() {
  try {
    const bounds = map.getBounds();
    const boundsObj = {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    };
    
    console.log('🔍 Searching by area:', boundsObj);
    updateConnectionStatus('connecting');
    
    const areaData = await apiClient.getAllDataByArea(boundsObj);
    
    if (areaData && areaData.data) {
      // Clear current data
      allProcessedData.clear();
      MarkerManager.clearAllMarkers();
      
      // Process area data
      processPageData(areaData.data);
      
      // Update map
      updateMapWithAllData();
      
      updateConnectionStatus('connected');
      showToast(`Area search completed: ${areaData.data.length} items found`, 'success');
      
      console.log(`✅ Area search completed: ${areaData.data.length} items found`);
    } else {
      showToast('No data found in current area', 'warning');
    }
    
  } catch (error) {
    console.error('❌ Area search failed:', error);
    updateConnectionStatus('error');
    showToast('Area search failed: ' + error.message, 'error');
  }
}

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info') {
  try {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    toast.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  } catch (error) {
    console.error('❌ Error showing toast:', error);
  }
}

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey || e.metaKey) {
    switch(e.key) {
      case 'r':
        e.preventDefault();
        refreshData();
        break;
      case 'f':
        e.preventDefault();
        if (typeof toggleFullscreen === 'function') {
          toggleFullscreen();
        }
        break;
      case 'l':
        e.preventDefault();
        if (typeof openLegend === 'function') {
          openLegend();
        }
        break;
      case 's':
        e.preventDefault();
        searchByArea();
        break;
    }
  }
});

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', initMap);

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
  if (apiClient.abortController) {
    apiClient.abortController.abort();
  }
});

// ===== EXPORT FOR DEBUGGING =====
window.debugAIS = {
  getAllData: () => allProcessedData,
  getDataCount: () => allProcessedData.size,
  refreshMap: () => updateMapWithAllData(),
  fetchData: () => fetchAllData(),
  getAssetConfig: () => MARKER_ASSETS,
  getAPIClient: () => apiClient,
  getConnectionStatus: () => connectionStatus,
  testConnection: () => testAPIConnection(),
  searchArea: () => searchByArea(),
  getWeatherData: () => weatherData,
  getMarkerCounts: () => MarkerManager.getMarkerCounts(),
  highlightMarker: (mmsi, isVessel) => MarkerManager.highlightMarker(mmsi, isVessel),
  clearMarkers: () => MarkerManager.clearAllMarkers()
};

// ===== GLOBAL FUNCTIONS FOR HTML =====
window.toggleFilter = toggleFilter;
window.refreshData = refreshData;
window.searchByArea = searchByArea;
window.showVesselDetails = showVesselDetails;
window.showATONDetails = showATONDetails;
window.showToast = showToast;
