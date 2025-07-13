// maps.js - Core map functionality dan orchestration

// Variabel global untuk peta
let map, vesselsLayer, buoysLayer, tracksLayer;
let aisData = [];
let allProcessedData = new Map();

// Konfigurasi asset marker lokal
const MARKER_ASSETS = {
  basePath: './assets/marker/',
  vessel: 'ships.png',
  aton: {
    1: 'north-cardinal.png',     // North Cardinal
    2: 'east-cardinal.png',      // East Cardinal
    3: 'south-cardinal.png',     // South Cardinal
    4: 'west-cardinal.png',      // West Cardinal
    5: 'porthand.png',           // Port Hand
    6: 'starboard-hand.png',     // Starboard Hand
    7: 'porthand.png',           // Preferred Channel Port
    8: 'starboard-hand.png',     // Preferred Channel Starboard
    9: 'special-mark.png',       // Isolated Danger
    10: 'safe-water.png',        // Safe Water
    11: 'special-mark.png',      // Special Mark
    12: 'special-mark.png',      // Light Vessel
    13: 'special-mark.png',      // LANBY
    14: 'special-mark.png',      // Racon
    15: 'special-mark.png',      // Fixed Structure
    16: 'special-mark.png',      // Floating Structure
    17: 'special-mark.png',      // Emergency Wreck
    18: 'special-mark.png',      // Offshore Platform
    19: 'special-mark.png',      // Drilling Rig
    20: 'special-mark.png',      // Virtual ATON
    21: 'north-cardinal.png',    // North Cardinal with Topmark
    22: 'east-cardinal.png',     // East Cardinal with Topmark
    23: 'south-cardinal.png',    // South Cardinal with Topmark
    24: 'west-cardinal.png',     // West Cardinal with Topmark
    25: 'porthand.png',          // Port Lateral with Topmark
    26: 'starboard-hand.png',    // Starboard Lateral with Topmark
    27: 'special-mark.png',      // Isolated Danger with Topmark
    28: 'safe-water.png',        // Safe Water with Topmark
    29: 'special-mark.png',      // Special Purpose with Topmark
    30: 'special-mark.png',      // Wreck Marking
    31: 'special-mark.png',      // Obstruction Marking
    0: 'special-mark.png'        // Unknown ATON
  }
};

// Inisialisasi peta
async function initMap() {
  try {
    console.log('🗺️ Initializing map with local assets...');
    
    // Setup peta
    map = L.map('map').setView([-6.1754, 106.8272], 6);

    // Base layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri'
    });

    osmLayer.addTo(map);

    // Layer groups
    vesselsLayer = L.layerGroup().addTo(map);
    buoysLayer = L.layerGroup().addTo(map);
    tracksLayer = L.layerGroup();

    // Layer control
    const baseMaps = {
      "OpenStreetMap": osmLayer,
      "Satellite": satelliteLayer
    };

    L.control.layers(baseMaps).addTo(map);
    
    // Setup SSE callbacks
    window.aisDataAPI.setDataCallback(handleIncomingData);
    window.aisDataAPI.setStatusCallback(updateConnectionStatus);
    
    // Test SSE connection dan start
    console.log('🔄 Testing SSE connection...');
    const connectionOk = await window.aisDataAPI.testSSEConnection();
    
    if (connectionOk) {
      console.log('✅ SSE connection test successful, starting real-time stream...');
      window.aisDataAPI.startSSEConnection();
      window.aisDataAPI.startDataCleaning();
      
      // Fetch initial data dari semua pagination
      await fetchAllPaginationData();
    } else {
      console.log('❌ SSE connection failed');
      updateConnectionStatus('error');
    }
    
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    updateConnectionStatus('error');
  }
}

// Fetch semua data dari pagination API
async function fetchAllPaginationData() {
  try {
    console.log('📄 Fetching all pagination data...');
    updateConnectionStatus('connecting');
    
    let currentPage = 1;
    let hasMorePages = true;
    let totalFetched = 0;
    
    while (hasMorePages && currentPage <= 10) {
      try {
        console.log(`📄 Fetching page ${currentPage}...`);
        
        const pageData = await fetchPageData(currentPage);
        
        if (pageData && pageData.data && pageData.data.length > 0) {
          processPageData(pageData.data);
          totalFetched += pageData.data.length;
          
          if (pageData.pagination && pageData.pagination.hasNext) {
            currentPage++;
            await new Promise(resolve => setTimeout(resolve, 500));
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
    
    console.log(`✅ Total fetched from pagination: ${totalFetched} records`);
    updateMapWithAllData();
    updateConnectionStatus('connected');
    
  } catch (error) {
    console.error('❌ Error fetching pagination data:', error);
    updateConnectionStatus('error');
  }
}

// Fetch data dari halaman tertentu
async function fetchPageData(page) {
  try {
    const url = new URL('http://165.154.228.42:3045/api/v2/realtime');
    url.searchParams.append('page', page);
    url.searchParams.append('limit', 500);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    console.error(`❌ Error fetching page ${page}:`, error);
    return null;
  }
}

// Process data dari halaman
function processPageData(pageData) {
  if (!Array.isArray(pageData)) return;
  
  pageData.forEach(item => {
    if (!item || !item.mmsi) return;
    
    const processedItem = processAISItem(item);
    if (processedItem) {
      allProcessedData.set(processedItem.mmsi, processedItem);
    }
  });
}

// Process single AIS item
function processAISItem(item) {
  try {
    if (!hasValidPosition(item)) {
      console.log(`⚠️ Invalid position for MMSI ${item.mmsi}`);
      return null;
    }
    
    const processedItem = {
      mmsi: item.mmsi,
      timestamp: item.timestamp || item.created_at || item.Timestamp || new Date().toISOString(),
      position: extractPosition(item),
      movement: extractMovement(item),
      static: extractStaticData(item),
      dataAgeMinutes: calculateDataAge(item.timestamp || item.created_at || item.Timestamp),
      messageType: parseInt(item.msgtype || item.aistype || item.message_type || 0),
      aisType: parseInt(item.aistype || item.msgtype || item.message_type || 0),
      rawData: item,
      lastUpdate: new Date()
    };
    
    // Klasifikasi berdasarkan AIS Message Type
    if (processedItem.messageType === 21 || processedItem.aisType === 21) {
      // Message Type 21 = Aid to Navigation Report
      const atonData = classifyATON(item);
      return {
        ...processedItem,
        objectType: 'aton',
        isVessel: false,
        atonType: atonData.type,
        atonName: atonData.name,
        atonCategory: atonData.category,
        atonColor: atonData.color,
        atonSymbol: atonData.symbol,
        atonDetails: extractATONDetails(item)
      };
    } else {
      // Semua yang bukan ATON adalah vessel
      return {
        ...processedItem,
        objectType: 'vessel',
        isVessel: true
      };
    }
    
  } catch (error) {
    console.error(`❌ Error processing AIS item:`, error, item);
    return null;
  }
}

// Handle incoming SSE data
function handleIncomingData(data) {
  try {
    console.log('📨 Handling incoming SSE data:', data);
    
    if (data.vessels && Array.isArray(data.vessels)) {
      data.vessels.forEach(vessel => {
        if (vessel.mmsi) {
          allProcessedData.set(vessel.mmsi, vessel);
        }
      });
    }
    
    if (data.buoys && Array.isArray(data.buoys)) {
      data.buoys.forEach(buoy => {
        if (buoy.mmsi) {
          allProcessedData.set(buoy.mmsi, buoy);
        }
      });
    }
    
    updateMapWithAllData();
    
  } catch (error) {
    console.error('❌ Error handling incoming data:', error);
  }
}

// Update map dengan semua data
function updateMapWithAllData() {
  try {
    console.log(`🗺️ Updating map with ${allProcessedData.size} total records`);
    
    // Clear existing layers menggunakan MarkerManager
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
          console.log(`❌ Invalid coordinate for ${mmsi}: ${lat}, ${lng}`);
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
    
    // Force layer visibility
    if (vesselCount > 0 && !map.hasLayer(vesselsLayer)) {
      map.addLayer(vesselsLayer);
      const vesselBtn = document.getElementById('vessels-btn');
      if (vesselBtn) vesselBtn.classList.add('active');
    }

    if (buoyCount > 0 && !map.hasLayer(buoysLayer)) {
      map.addLayer(buoysLayer);
      const buoyBtn = document.getElementById('buoys-btn');
      if (buoyBtn) buoyBtn.classList.add('active');
    }

    // Auto-zoom ke data setelah 500ms
    setTimeout(() => {
      autoZoomToData();
    }, 500);
    
  } catch (error) {
    console.error('❌ Error updating map:', error);
  }
}

// Auto-zoom ke data
function autoZoomToData() {
  try {
    const bounds = L.latLngBounds();
    let hasValidBounds = false;
    
    // Cek semua marker di vessels layer
    vesselsLayer.eachLayer(function(marker) {
      const latLng = marker.getLatLng();
      if (latLng) {
        bounds.extend(latLng);
        hasValidBounds = true;
      }
    });
    
    // Cek semua marker di buoys layer
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

// Helper functions
function isValidCoordinate(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function hasValidPosition(item) {
  if (item.position && item.position.latitude && item.position.longitude) return true;
  if (item.loc && item.loc.coordinates && item.loc.coordinates.length >= 2) return true;
  if (item.coordinates && item.coordinates.coordinates && item.coordinates.coordinates.length >= 2) return true;
  if (item.latitude && item.longitude) return true;
  if (item.lat && item.lng) return true;
  return false;
}

function extractPosition(item) {
  if (item.position && item.position.latitude && item.position.longitude) {
    return {
      latitude: parseFloat(item.position.latitude),
      longitude: parseFloat(item.position.longitude)
    };
  }
  
  if (item.loc && item.loc.coordinates && item.loc.coordinates.length >= 2) {
    return {
      latitude: parseFloat(item.loc.coordinates[1]),
      longitude: parseFloat(item.loc.coordinates[0])
    };
  }
  
  if (item.coordinates && item.coordinates.coordinates && item.coordinates.coordinates.length >= 2) {
    return {
      latitude: parseFloat(item.coordinates.coordinates[1]),
      longitude: parseFloat(item.coordinates.coordinates[0])
    };
  }
  
  if (item.latitude && item.longitude) {
    return {
      latitude: parseFloat(item.latitude),
      longitude: parseFloat(item.longitude)
    };
  }
  
  if (item.lat && item.lng) {
    return {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lng)
    };
  }
  
  return { latitude: 0, longitude: 0 };
}

function extractMovement(item) {
  return {
    sog: parseFloat(item.sog || item.SpeedOverGround || item.speed || 0),
    cog: parseFloat(item.cog || item.CourseOverGround || item.course || 0),
    heading: parseFloat(item.hdg || item.Heading || item.heading || 0),
    rot: parseFloat(item.rot || item.RateOfTurn || 0),
    navStatus: parseInt(item.navstat || item.NavigationStatus || item.nav_status || 0)
  };
}

function extractStaticData(item) {
  return {
    NAME: item.ShipName || item.NAME || item.name || item.vessel_name || '-',
    TYPE: parseInt(item.ShipType || item.TYPE || item.type || item.vessel_type || 0) || null,
    TYPENAME: item.vesseltypeDesk || item.TYPENAME || item.type_name || 'Unknown Vessel Type',
    MMSI: item.mmsi || item.MMSI,
    IMO: item.IMO || item.imo,
    CALLSIGN: item.callsign || item.call_sign,
    FLAG: item.FLAG || item.flag,
    GT: item.GT || item.gross_tonnage,
    DWT: item.DWT || item.deadweight,
    LOA: item.LOA || item.length,
    BEAM: item.BEAM || item.beam,
    DRAUGHT: item.DRAUGHT || item.draught
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
  const atonType = parseInt(
    atonData.aid_type || 
    atonData.aton_type || 
    atonData.type_of_aid || 
    atonData.navaid_type || 
    0
  );
  
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
    category: atonCategories[atonType] || atonCategories[0],
    color: '#FF0000',
    symbol: '●'
  };
}

function extractATONDetails(atonData) {
  return {
    name: atonData.name || atonData.aton_name || atonData.aid_name || 'Unknown ATON',
    dimensions: {
      length: parseInt(atonData.to_bow || 0) + parseInt(atonData.to_stern || 0),
      width: parseInt(atonData.to_port || 0) + parseInt(atonData.to_starboard || 0)
    },
    offPosition: atonData.off_position || false,
    virtualAton: atonData.virtual_aid || false,
    assignedMode: atonData.assigned_mode || false,
    raimFlag: atonData.raim || false,
    utcSecond: atonData.second || 60
  };
}

// Update counters
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

// Control functions
function updateConnectionStatus(status) {
  try {
    const statusDot = document.getElementById('connection-status');
    const statusText = document.getElementById('status-text');
    
    if (!statusDot || !statusText) return;
    
    switch(status) {
      case 'connected':
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Live AIS Data';
        break;
      case 'connecting':
        statusDot.className = 'status-dot';
        statusText.textContent = 'Loading...';
        break;
      case 'error':
        statusDot.className = 'status-dot';
        statusText.textContent = 'Connection Error';
        break;
    }
  } catch (error) {
    console.error('❌ Error updating connection status:', error);
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
    }
  } catch (error) {
    console.error('❌ Error toggling filter:', error);
  }
}

// Refresh data
async function refreshData() {
  const refreshBtn = document.querySelector('.refresh-btn i');
  
  try {
    if (refreshBtn) refreshBtn.style.animation = 'spin 1s linear infinite';
    
    console.log('🔄 Refreshing all data...');
    updateConnectionStatus('connecting');
    
    allProcessedData.clear();
    
    if (window.aisDataAPI) {
      window.aisDataAPI.stopSSEConnection();
      
      setTimeout(async () => {
        window.aisDataAPI.startSSEConnection();
        await fetchAllPaginationData();
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ Refresh failed:', error);
    updateConnectionStatus('error');
  }
  
  setTimeout(() => {
    if (refreshBtn) refreshBtn.style.animation = '';
  }, 2000);
}

// CSS untuk marker
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

// Initialize
document.addEventListener('DOMContentLoaded', initMap);

// Export untuk debugging
window.debugAIS = {
  getAllData: () => allProcessedData,
  getDataCount: () => allProcessedData.size,
  refreshMap: () => updateMapWithAllData(),
  fetchPagination: () => fetchAllPaginationData(),
  getAssetConfig: () => MARKER_ASSETS
};
