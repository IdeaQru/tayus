const net = require('net');
const EventEmitter = require('events');
const { AisDecode } = require('ggencoder');

// Konfigurasi Marker Assets
const MARKER_ASSETS = {
  basePath: './assets/marker/',
  vessel: 'ships.png',
  aton: {
    1: 'north-cardinal.png',     // North Cardinal
    2: 'east-cardinal.png',      // East Cardinal
    3: 'south-cardinal.png',     // South Cardinal
    4: 'west-cardinal.png',      // West Cardinal
    5: 'portland.png',           // Port Hand
    6: 'starboard-hand.png',     // Starboard Hand
    7: 'portland.png',           // Preferred Channel Port
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
    20: 'virtual_buoy.png',      // Virtual ATON
    21: 'north-cardinal.png',    // North Cardinal with Topmark
    22: 'east-cardinal.png',     // East Cardinal with Topmark
    23: 'south-cardinal.png',    // South Cardinal with Topmark
    24: 'west-cardinal.png',     // West Cardinal with Topmark
    25: 'portland.png',          // Port Lateral with Topmark
    26: 'starboard-hand.png',    // Starboard Lateral with Topmark
    27: 'special-mark.png',      // Isolated Danger with Topmark
    28: 'safe-water.png',        // Safe Water with Topmark
    29: 'special-mark.png',      // Special Purpose with Topmark
    30: 'special-mark.png',      // Wreck Marking
    31: 'special-mark.png',      // Obstruction Marking
    0: 'special-mark.png'        // Unknown ATON
  }
};

// Navigation Status Descriptions
const NAV_STATUS = {
  0: { description: 'Under way using engine' },
  1: { description: 'At anchor' },
  2: { description: 'Not under command' },
  3: { description: 'Restricted manoeuvrability' },
  4: { description: 'Constrained by her draught' },
  5: { description: 'Moored' },
  6: { description: 'Aground' },
  7: { description: 'Engaged in fishing' },
  8: { description: 'Under way sailing' },
  9: { description: 'Reserved for future amendment' },
  10: { description: 'Reserved for future amendment' },
  11: { description: 'Power-driven vessel towing astern' },
  12: { description: 'Power-driven vessel pushing ahead' },
  13: { description: 'Reserved for future use' },
  14: { description: 'AIS-SART is active' },
  15: { description: 'Not defined' }
};

// Message Type Descriptions
const MSG_TYPE = {
  1: { description: 'Position Report Class A' },
  2: { description: 'Position Report Class A (Assigned schedule)' },
  3: { description: 'Position Report Class A (Response to interrogation)' },
  4: { description: 'Base Station Report' },
  5: { description: 'Static and Voyage Related Data' },
  18: { description: 'Standard Class B CS Position Report' },
  19: { description: 'Extended Class B CS Position Report' },
  21: { description: 'Aid-to-Navigation Report' },
  24: { description: 'Static Data Report' }
};

// Vessel Type Descriptions
const VESSEL_TYPE = {
  0: { description: 'Not available' },
  30: { description: 'Fishing' },
  31: { description: 'Towing' },
  32: { description: 'Towing: length exceeds 200m or breadth exceeds 25m' },
  33: { description: 'Dredging or underwater ops' },
  34: { description: 'Diving ops' },
  35: { description: 'Military ops' },
  36: { description: 'Sailing' },
  37: { description: 'Pleasure Craft' },
  40: { description: 'High speed craft (HSC)' },
  50: { description: 'Pilot Vessel' },
  51: { description: 'Search and Rescue vessel' },
  52: { description: 'Tug' },
  53: { description: 'Port Tender' },
  54: { description: 'Anti-pollution equipment' },
  55: { description: 'Law Enforcement' },
  58: { description: 'Medical Transport' },
  60: { description: 'Passenger' },
  70: { description: 'Cargo' },
  80: { description: 'Tanker' },
  90: { description: 'Other Type' },
  999: { description: 'SAR Aircraft' }
};

// AIS Telnet Client dengan ggencoder saja
class AISTelnetClient extends EventEmitter {
  constructor(host = 'localhost', port = 4001) {
    super();
    this.host = host;
    this.port = port;
    this.client = null;
    this.reconnectInterval = 5000;
    this.isConnected = false;
    this.shipsData = new Map();
    this.aidsData = new Map();
  }
  
  connect() {
    console.log(`Connecting to AIS server at ${this.host}:${this.port}`);
    
    this.client = new net.Socket();
    
    this.client.connect(this.port, this.host, () => {
      console.log('Connected to AIS Telnet server');
      this.isConnected = true;
      this.emit('connected');
    });
    
    this.client.on('data', (data) => {
      const messages = data.toString().split('\n');
      messages.forEach(message => {
        if (message.trim()) {
          this.processAISMessage(message.trim());
        }
      });
    });
    
    this.client.on('close', () => {
      console.log('Connection to AIS server closed');
      this.isConnected = false;
      this.emit('disconnected');
      this.scheduleReconnect();
    });
    
    this.client.on('error', (err) => {
      console.error('AIS Telnet connection error:', err);
      this.isConnected = false;
      this.emit('error', err);
      this.scheduleReconnect();
    });
  }
  
  scheduleReconnect() {
    setTimeout(() => {
      if (!this.isConnected) {
        console.log('Attempting to reconnect to AIS server...');
        this.connect();
      }
    }, this.reconnectInterval);
  }
  
  processAISMessage(message) {
    try {
      // Menggunakan ggencoder saja
      const ggencoderResult = new AisDecode(message);
      
      if (ggencoderResult.valid) {
        this.processDecodedMessage(ggencoderResult, 'ggencoder');
      } else {
        console.log('Invalid AIS message:', message);
      }
    } catch (error) {
      console.error('Error processing AIS message:', error);
    }
  }
  
  processDecodedMessage(decodedData, source = 'ggencoder') {
    let mmsi, shipData;
    
    mmsi = decodedData.mmsi;
    shipData = this.formatGgencoderData(decodedData);
    
    if (mmsi && shipData) {
      const existingData = this.shipsData.get(mmsi) || {};
      
      const updatedData = {
        ...existingData,
        ...shipData,
        MMSI: mmsi,
        lastUpdate: new Date(),
        decoderSource: source
      };
      
      // Pisahkan data berdasarkan message type
      if (shipData.MessageType === 21) {
        // Aid-to-Navigation data
        this.aidsData.set(mmsi, updatedData);
        this.emit('aidUpdate', updatedData);
      } else {
        // Ship data
        this.shipsData.set(mmsi, updatedData);
        this.emit('shipUpdate', updatedData);
      }
      
      this.cleanupOldData();
    }
  }
  
  formatGgencoderData(decoded) {
    const data = {
      Timestamp: new Date().toISOString(),
      RawAIS: decoded.nmea || decoded.raw,
      Channel: decoded.channel,
      MessageType: decoded.aistype || decoded.msgtype,
      Class: decoded.class || 'A'
    };
    
    // Handle different message types
    switch (decoded.aistype || decoded.msgtype) {
      case 1:
      case 2:
      case 3:
        // Position Report
        data.coordinates = {
          type: 'Point',
          coordinates: [decoded.lon, decoded.lat]
        };
        data.SpeedOverGround = decoded.sog || 0;
        data.CourseOverGround = decoded.cog || 0;
        data.Heading = decoded.hdg || 0;
        data.NavigationStatus = decoded.navstatus?.toString() || "15";
        data.navstatDesk = NAV_STATUS[decoded.navstatus]?.description || "undefined";
        data.msgDynamicDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        data.MarkerImage = MARKER_ASSETS.vessel;
        break;
        
      case 4:
        // Base Station Report
        data.coordinates = {
          type: 'Point',
          coordinates: [decoded.lon, decoded.lat]
        };
        data.Timestamp = decoded.timestamp || data.Timestamp;
        data.msgDynamicDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        break;
        
      case 5:
        // Static and Voyage Related Data
        data.ShipName = decoded.shipname || "Unknown Ship";
        data.ShipType = decoded.shiptype || decoded.cargo || 0;
        data.CallSign = decoded.callsign;
        data.Length = (decoded.dimA || 0) + (decoded.dimB || 0) || decoded.length;
        data.Width = (decoded.dimC || 0) + (decoded.dimD || 0) || decoded.width;
        data.Draught = decoded.draught;
        data.Destination = decoded.destination;
        data.IMO_Number = decoded.imo;
        data.vesseltypeDesk = VESSEL_TYPE[decoded.shiptype]?.description || "Unknown";
        data.msgStaticDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        break;
        
      case 18:
        // Class B Position Report
        data.coordinates = {
          type: 'Point',
          coordinates: [decoded.lon, decoded.lat]
        };
        data.SpeedOverGround = decoded.sog || 0;
        data.CourseOverGround = decoded.cog || 0;
        data.Heading = decoded.hdg || 0;
        data.Class = 'B';
        data.msgDynamicDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        data.MarkerImage = MARKER_ASSETS.vessel;
        break;
        
      case 21:
        // Aid-to-Navigation Report - MESSAGE TYPE 21 (UTAMA)
        data.coordinates = {
          type: 'Point',
          coordinates: [decoded.lon, decoded.lat]
        };
        data.AidType = decoded.aid_type || decoded.aidtype || 0;
        data.AidName = decoded.name || "Unknown Aid";
        data.Length = (decoded.dimA || 0) + (decoded.dimB || 0) || decoded.length;
        data.Width = (decoded.dimC || 0) + (decoded.dimD || 0) || decoded.width;
        data.TypeOfEPFD = decoded.epfd || 0;
        data.OffPosition = decoded.off_position || false;
        data.VirtualAid = decoded.virtual_aid || false;
        data.AssignedMode = decoded.assigned || false;
        data.MarkerImage = MARKER_ASSETS.aton[data.AidType] || MARKER_ASSETS.aton[0];
        data.msgDynamicDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        console.log('=== MESSAGE TYPE 21 (Aid-to-Navigation) PROCESSED ===');
        console.log('Aid Data:', data);
        break;
        
      case 24:
        // Static Data Report
        if (decoded.part === 0) {
          data.ShipName = decoded.shipname || "Unknown Ship";
        } else if (decoded.part === 1) {
          data.ShipType = decoded.shiptype || decoded.cargo || 0;
          data.CallSign = decoded.callsign;
          data.Length = (decoded.dimA || 0) + (decoded.dimB || 0) || decoded.length;
          data.Width = (decoded.dimC || 0) + (decoded.dimD || 0) || decoded.width;
          data.vesseltypeDesk = VESSEL_TYPE[decoded.shiptype]?.description || "Unknown";
        }
        data.msgStaticDesk = MSG_TYPE[decoded.aistype || decoded.msgtype]?.description || undefined;
        break;
        
      default:
        console.log(`Unhandled message type: ${decoded.aistype || decoded.msgtype}`);
    }
    
    return data;
  }
  
  cleanupOldData() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Cleanup ships data
    for (const [mmsi, shipData] of this.shipsData.entries()) {
      if (shipData.lastUpdate < tenMinutesAgo) {
        this.shipsData.delete(mmsi);
      }
    }
    
    // Cleanup aids data
    for (const [mmsi, aidData] of this.aidsData.entries()) {
      if (aidData.lastUpdate < tenMinutesAgo) {
        this.aidsData.delete(mmsi);
      }
    }
  }
  
  // Ships API Methods
  getAllShips(page = 1, limit = 100) {
    const ships = Array.from(this.shipsData.values());
    const total = ships.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      data: ships.slice(startIndex, endIndex),
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  getShipByMMSI(mmsi) {
    return this.shipsData.get(parseInt(mmsi)) || null;
  }
  
  getShipsByArea(bounds) {
    const ships = Array.from(this.shipsData.values());
    return ships.filter(ship => {
      if (!ship.coordinates || !ship.coordinates.coordinates) return false;
      
      const [lon, lat] = ship.coordinates.coordinates;
      return lon >= bounds.west && lon <= bounds.east && 
             lat >= bounds.south && lat <= bounds.north;
    });
  }
  
  // Aids API Methods
  getAllAids(page = 1, limit = 100) {
    const aids = Array.from(this.aidsData.values());
    const total = aids.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
      data: aids.slice(startIndex, endIndex),
      total: total,
      page: page,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  getAidByMMSI(mmsi) {
    return this.aidsData.get(parseInt(mmsi)) || null;
  }
  
  getAidsByType(aidType) {
    const aids = Array.from(this.aidsData.values());
    return aids.filter(aid => aid.AidType === parseInt(aidType));
  }
  
  getAidsByArea(bounds) {
    const aids = Array.from(this.aidsData.values());
    return aids.filter(aid => {
      if (!aid.coordinates || !aid.coordinates.coordinates) return false;
      
      const [lon, lat] = aid.coordinates.coordinates;
      return lon >= bounds.west && lon <= bounds.east && 
             lat >= bounds.south && lat <= bounds.north;
    });
  }
  
  // Statistics Methods
  getStatistics() {
    const ships = Array.from(this.shipsData.values());
    const aids = Array.from(this.aidsData.values());
    const messageTypes = {};
    const decoderSources = {};
    const vesselTypes = {};
    const aidTypes = {};
    
    [...ships, ...aids].forEach(item => {
      messageTypes[item.MessageType] = (messageTypes[item.MessageType] || 0) + 1;
      decoderSources[item.decoderSource] = (decoderSources[item.decoderSource] || 0) + 1;
      
      if (item.ShipType) {
        vesselTypes[item.ShipType] = (vesselTypes[item.ShipType] || 0) + 1;
      }
      
      if (item.AidType !== undefined) {
        aidTypes[item.AidType] = (aidTypes[item.AidType] || 0) + 1;
      }
    });
    
    return {
      totalShips: ships.length,
      totalAids: aids.length,
      messageTypes,
      decoderSources,
      vesselTypes,
      aidTypes,
      lastUpdate: new Date().toISOString()
    };
  }
  
  disconnect() {
    if (this.client) {
      this.client.destroy();
      this.isConnected = false;
    }
  }
}

module.exports = { AISTelnetClient, MARKER_ASSETS, NAV_STATUS, MSG_TYPE, VESSEL_TYPE };
