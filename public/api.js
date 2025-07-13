// api.js - Pastikan method ini ada di class AISDataAPI

// api.js - Menangani SSE API dan data processing

// Konfigurasi API SSE
const API_CONFIG = {
  baseUrl: 'http://165.154.228.42:3045/api/v2/realtime',
  timeout: 30000,
  retryAttempts: 3,
  reconnectDelay: 5000, // Delay untuk reconnect SSE
  maxReconnectAttempts: 10
};

// ATON Types (sama seperti sebelumnya)
const ATON_TYPES = {
  // Cardinal Marks
  1: { name: 'North Cardinal', category: 'Cardinal Mark', color: '#000000', symbol: '▲' },
  2: { name: 'East Cardinal', category: 'Cardinal Mark', color: '#000000', symbol: '▶' },
  3: { name: 'South Cardinal', category: 'Cardinal Mark', color: '#000000', symbol: '▼' },
  4: { name: 'West Cardinal', category: 'Cardinal Mark', color: '#000000', symbol: '◀' },
  
  // Lateral Marks
  5: { name: 'Port Hand', category: 'Lateral Mark', color: '#FF0000', symbol: '●' },
  6: { name: 'Starboard Hand', category: 'Lateral Mark', color: '#00FF00', symbol: '●' },
  7: { name: 'Preferred Channel Port', category: 'Lateral Mark', color: '#FF0000', symbol: '◐' },
  8: { name: 'Preferred Channel Starboard', category: 'Lateral Mark', color: '#00FF00', symbol: '◑' },
  
  // Isolated Danger
  9: { name: 'Isolated Danger', category: 'Isolated Danger', color: '#FF0000', symbol: '⚫' },
  
  // Safe Water
  10: { name: 'Safe Water', category: 'Safe Water', color: '#FFFFFF', symbol: '⚪' },
  
  // Special Marks
  11: { name: 'Special Mark', category: 'Special Mark', color: '#FFFF00', symbol: '◆' },
  
  // Light Vessels/LANBY
  12: { name: 'Light Vessel', category: 'Light Vessel', color: '#FF6600', symbol: '⛵' },
  13: { name: 'LANBY', category: 'Large Automatic Navigation Buoy', color: '#FF6600', symbol: '🚢' },
  
  // Racon
  14: { name: 'Racon', category: 'Radar Transponder', color: '#9900CC', symbol: '📡' },
  
  // Fixed Structures
  15: { name: 'Fixed Structure', category: 'Fixed Structure', color: '#666666', symbol: '🏗️' },
  16: { name: 'Floating Structure', category: 'Floating Structure', color: '#0066CC', symbol: '🏭' },
  
  // Emergency Wreck Marking
  17: { name: 'Emergency Wreck', category: 'Emergency Wreck Marking', color: '#FF0000', symbol: '⚠️' },
  
  // Offshore Installations
  18: { name: 'Offshore Platform', category: 'Offshore Installation', color: '#333333', symbol: '🛢️' },
  19: { name: 'Drilling Rig', category: 'Offshore Installation', color: '#333333', symbol: '⚙️' },
  
  // Virtual ATON
  20: { name: 'Virtual ATON', category: 'Virtual Aid', color: '#00CCFF', symbol: '💫' },
  
  // Default
  0: { name: 'Unknown ATON', category: 'Unknown', color: '#999999', symbol: '❓' }
};
class AISDataAPI {
  constructor() {
    this.connectionStatus = 'disconnected';
    this.lastFetchTime = null;
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.vessels = new Map();
    this.buoys = new Map();
    this.dataCallback = null;
    this.statusCallback = null;
  }

  // Set callback functions
  setDataCallback(callback) {
    this.dataCallback = callback;
  }

  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  // METHOD INI HARUS ADA - testSSEConnection
  async testSSEConnection() {
    return new Promise((resolve) => {
      console.log('🔄 Testing SSE connection to:', API_CONFIG.baseUrl);
      
      const testEventSource = new EventSource(API_CONFIG.baseUrl);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          testEventSource.close();
          console.error('❌ SSE Connection Test Timeout');
          this.connectionStatus = 'error';
          resolve(false);
        }
      }, 10000);
      
      testEventSource.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testEventSource.close();
          console.log('✅ SSE Connection Test Success');
          this.connectionStatus = 'connected';
          resolve(true);
        }
      };
      
      testEventSource.onerror = (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          testEventSource.close();
          console.error('❌ SSE Connection Test Failed:', error);
          this.connectionStatus = 'error';
          resolve(false);
        }
      };
    });
  }

  // Start SSE connection
  startSSEConnection() {
    try {
      console.log('🚀 Starting SSE connection...');
      this.connectionStatus = 'connecting';
      this.updateStatus('connecting');
      
      if (this.eventSource) {
        this.eventSource.close();
      }
      
      this.eventSource = new EventSource(API_CONFIG.baseUrl);
      
      this.eventSource.onopen = (event) => {
        console.log('✅ SSE Connection opened');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.lastFetchTime = new Date();
        this.updateStatus('connected');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          console.log('📨 Received SSE data');
          this.handleSSEData(event.data);
        } catch (error) {
          console.error('❌ Error processing SSE message:', error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        console.error('❌ SSE Error:', error);
        this.connectionStatus = 'error';
        this.updateStatus('error');
        
        if (this.reconnectAttempts < API_CONFIG.maxReconnectAttempts) {
          this.scheduleReconnect();
        } else {
          console.error('❌ Max reconnect attempts reached');
          this.updateStatus('failed');
        }
      };
      
    } catch (error) {
      console.error('❌ Error starting SSE connection:', error);
      this.connectionStatus = 'error';
      this.updateStatus('error');
    }
  }

  // Stop SSE connection
  stopSSEConnection() {
    if (this.eventSource) {
      console.log('🛑 Stopping SSE connection');
      this.eventSource.close();
      this.eventSource = null;
      this.connectionStatus = 'disconnected';
      this.updateStatus('disconnected');
    }
  }

  // Handle incoming SSE data
  handleSSEData(rawData) {
    try {
      let data;
      try {
        data = JSON.parse(rawData);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        return;
      }
      
      console.log('📊 Processing SSE data');
      
      let aisRecords = [];
      
      if (Array.isArray(data)) {
        aisRecords = data;
      } else if (data.data && Array.isArray(data.data)) {
        aisRecords = data.data;
      } else if (data.vessels && Array.isArray(data.vessels)) {
        aisRecords = data.vessels;
      } else if (typeof data === 'object' && data.mmsi) {
        aisRecords = [data];
      } else {
        for (const key in data) {
          if (Array.isArray(data[key])) {
            aisRecords = data[key];
            break;
          }
        }
      }
      
      if (aisRecords.length === 0) {
        console.log('⚠️ No AIS records found in data');
        return;
      }
      
      console.log(`📈 Processing ${aisRecords.length} AIS records`);
      
      let vesselsUpdated = 0;
      let buoysUpdated = 0;
      
      aisRecords.forEach((item, index) => {
        try {
          if (!item || !item.mmsi || !this.hasValidPosition(item)) {
            return;
          }
          
          const processedItem = this.processAISRecord(item);
          
          if (processedItem.isVessel) {
            this.vessels.set(processedItem.mmsi, processedItem);
            vesselsUpdated++;
          } else {
            this.buoys.set(processedItem.mmsi, processedItem);
            buoysUpdated++;
          }
          
        } catch (itemError) {
          console.error(`❌ Error processing item ${index}:`, itemError);
        }
      });
      
      console.log(`✅ Updated: ${vesselsUpdated} vessels, ${buoysUpdated} buoys`);
      this.triggerDataUpdate();
      
    } catch (error) {
      console.error('❌ Error handling SSE data:', error);
    }
  }

  // Process single AIS record
  processAISRecord(item) {
    const processedItem = {
      mmsi: item.mmsi,
      timestamp: item.timestamp || item.created_at || item.Timestamp || new Date().toISOString(),
      position: this.extractPosition(item),
      movement: this.extractMovement(item),
      static: this.extractStaticData(item),
      dataAgeMinutes: this.calculateDataAge(item.timestamp || item.created_at || item.Timestamp),
      messageType: parseInt(item.msgtype || item.aistype || item.message_type || 0),
      objectType: item.objectType || 'vessel',
      rawData: item,
      lastUpdate: new Date()
    };
    
    if (processedItem.objectType === "BUOY" || processedItem.aisType === 21) {
      const atonData = this.classifyATON(item);
      return {
        ...processedItem,
        objectType: 'aton',
        isVessel: false,
        atonType: atonData.type,
        atonName: atonData.name,
        atonCategory: atonData.category,
        atonColor: atonData.color,
        atonSymbol: atonData.symbol,
        atonDetails: this.extractATONDetails(item)
      };
    } else {
      return {
        ...processedItem,
        objectType: 'vessel',
        isVessel: true
      };
    }
  }

  // Schedule reconnect
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = API_CONFIG.reconnectDelay * this.reconnectAttempts;
    
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}`);
      this.startSSEConnection();
    }, delay);
  }

  // Get current data
  getCurrentData() {
    return {
      vessels: Array.from(this.vessels.values()),
      buoys: Array.from(this.buoys.values()),
      totalFetched: this.vessels.size + this.buoys.size,
      lastUpdate: this.lastFetchTime
    };
  }

  // Trigger data update callback
  triggerDataUpdate() {
    if (this.dataCallback) {
      const data = this.getCurrentData();
      this.dataCallback(data);
    }
  }

  // Update status callback
  updateStatus(status) {
    this.connectionStatus = status;
    if (this.statusCallback) {
      this.statusCallback(status);
    }
  }

  // Clean old data
  cleanOldData() {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    
    let removedVessels = 0;
    let removedBuoys = 0;
    
    for (const [mmsi, vessel] of this.vessels.entries()) {
      if (vessel.lastUpdate < thirtyMinutesAgo) {
        this.vessels.delete(mmsi);
        removedVessels++;
      }
    }
    
    for (const [mmsi, buoy] of this.buoys.entries()) {
      if (buoy.lastUpdate < thirtyMinutesAgo) {
        this.buoys.delete(mmsi);
        removedBuoys++;
      }
    }
    
    if (removedVessels > 0 || removedBuoys > 0) {
      console.log(`🧹 Cleaned old data: ${removedVessels} vessels, ${removedBuoys} buoys`);
      this.triggerDataUpdate();
    }
  }

  // Start periodic data cleaning
  startDataCleaning() {
    setInterval(() => {
      this.cleanOldData();
    }, 5 * 60 * 1000);
  }

  // Helper methods
  hasValidPosition(item) {
    if (item.position && item.position.latitude && item.position.longitude) return true;
    if (item.loc && item.loc.coordinates && item.loc.coordinates.length >= 2) return true;
    if (item.coordinates && item.coordinates.coordinates && item.coordinates.coordinates.length >= 2) return true;
    if (item.latitude && item.longitude) return true;
    if (item.lat && item.lng) return true;
    return false;
  }

  extractPosition(item) {
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

  extractMovement(item) {
    return {
      sog: parseFloat(item.sog || item.SpeedOverGround || item.speed || 0),
      cog: parseFloat(item.cog || item.CourseOverGround || item.course || 0),
      heading: parseFloat(item.hdg || item.Heading || item.heading || 0),
      rot: parseFloat(item.rot || item.RateOfTurn || 0),
      navStatus: parseInt(item.navstat || item.NavigationStatus || item.nav_status || 0)
    };
  }

  extractStaticData(item) {
    return {
      NAME: item.ShipName || item.NAME || item.name || item.ShipName || 'Unknown',
      TYPE: parseInt(item.ShipType || item.TYPE || item.type || item.vessel_type || 0),
      TYPENAME: item.vesseltypeDesk || item.TYPENAME || item.type_name || 'Unknown Type',
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

  calculateDataAge(timestamp) {
    if (!timestamp) return 0;
    const now = new Date();
    const dataTime = new Date(timestamp);
    const diffMs = now - dataTime;
    return Math.floor(diffMs / 60000);
  }

  classifyATON(atonData) {
    const atonType = parseInt(
      atonData.aid_type || 
      atonData.aton_type || 
      atonData.type_of_aid || 
      atonData.navaid_type || 
      0
    );
    
    const classification = ATON_TYPES[atonType] || ATON_TYPES[0];
    
    return {
      type: atonType,
      name: classification.name,
      category: classification.category,
      color: classification.color,
      symbol: classification.symbol
    };
  }

  extractATONDetails(atonData) {
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

  // Get connection status
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Get last fetch time
  getLastFetchTime() {
    return this.lastFetchTime;
  }

  // Legacy methods untuk compatibility
  async fetchAllData() {
    return this.getCurrentData();
  }
}

// Export instance - PASTIKAN INI ADA
window.aisDataAPI = new AISDataAPI();
