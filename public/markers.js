// markers.js - Marker Management System dengan Bearing Rotation

class MarkerManager {
  
  // ===== CLEAR METHODS =====
  static clearAllMarkers() {
    try {
      if (typeof vesselsLayer !== 'undefined') vesselsLayer.clearLayers();
      if (typeof buoysLayer !== 'undefined') buoysLayer.clearLayers();
      console.log('🧹 All markers cleared');
    } catch (error) {
      console.error('❌ Error clearing markers:', error);
    }
  }

  // ===== VESSEL MARKER METHODS =====
  static addVesselMarker(vessel, lat, lng) {
    try {
      console.log(`🚢 Adding vessel marker: ${vessel.mmsi || vessel.MMSI} at ${lat}, ${lng}`);
      
      // Ambil nilai heading atau COG untuk rotasi
      const heading = vessel.movement?.heading || vessel.Heading || 0;
      const cog = vessel.movement?.cog || vessel.CourseOverGround || 0;
      const sog = vessel.movement?.sog || vessel.SpeedOverGround || 0;
      
      // Prioritas: gunakan heading jika tersedia dan valid, jika tidak gunakan COG
      const rotation = (heading > 0 && heading <= 360) ? heading : cog;
      
      // Tentukan status navigasi untuk styling
      const navStatus = vessel.movement?.navStatus || vessel.NavigationStatus || 0;
      const statusClass = this.getNavigationStatusClass(navStatus);
      
      // Tentukan kelas kecepatan untuk color coding
      const speedClass = this.getSpeedClass(sog);
      
      // Buat icon dengan asset lokal
      const iconUrl = MARKER_ASSETS.basePath + MARKER_ASSETS.vessel;
      
      // Buat custom icon dengan rotasi CSS dan bearing indicator
      const vesselIcon = L.divIcon({
        html: `
          <div class="vessel-marker-container ${statusClass}" style="transform: rotate(${rotation}deg);">
            <img src="${iconUrl}" class="vessel-icon-img" alt="Vessel ${vessel.mmsi || vessel.MMSI}" />
            <div class="bearing-indicator"></div>
          </div>
          <div class="vessel-info">
            <span class="vessel-name">${vessel.static?.NAME || vessel.ShipName || 'Unknown'}</span>
            <span class="vessel-speed ${speedClass}">${sog.toFixed(1)} kts</span>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -15],
        className: 'vessel-marker-icon'
      });
      
      const marker = L.marker([lat, lng], {
        icon: vesselIcon,
        mmsi: vessel.mmsi || vessel.MMSI,
        vesselData: vessel,
        rotation: rotation,
        lastUpdate: new Date()
      }).addTo(vesselsLayer);
      
      // Bind popup
      const popupContent = this.createVesselPopup(vessel);
      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'custom-popup vessel-popup'
      });
      
      // Event handlers
      this.addVesselEventHandlers(marker, vessel);
      
      console.log(`✅ Vessel marker added: ${vessel.mmsi || vessel.MMSI} with rotation: ${rotation}°`);
      return marker;
      
    } catch (error) {
      console.error(`❌ Error adding vessel marker for ${vessel.mmsi || vessel.MMSI}:`, error);
      return null;
    }
  }

  static addVesselEventHandlers(marker, vessel) {
    // Click handler
    marker.on('click', function(e) {
      showVesselDetails(vessel);
      L.DomEvent.stopPropagation(e);
    });
    
    // Hover events
    marker.on('mouseover', function(e) {
      this.getElement().classList.add('marker-hover');
    });
    
    marker.on('mouseout', function(e) {
      this.getElement().classList.remove('marker-hover');
    });
  }

  // ===== ATON MARKER METHODS =====
  static addATONMarker(aton, lat, lng) {
    try {
      console.log(`⚓ Adding ATON marker: ${aton.mmsi || aton.MMSI} at ${lat}, ${lng} (Type: ${aton.atonType || aton.AidType})`);
      
      // Dapatkan asset berdasarkan tipe ATON
      const atonType = aton.atonType || aton.AidType || 0;
      const assetFile = MARKER_ASSETS.aton[atonType] || MARKER_ASSETS.aton[0];
      const iconUrl = MARKER_ASSETS.basePath + assetFile;
      
      console.log(`📁 Using asset: ${assetFile} for ATON type ${atonType}`);
      
      // Buat custom icon untuk ATON
      const atonIcon = L.divIcon({
        html: `
          <div class="aton-marker-container">
            <img src="${iconUrl}" class="aton-icon-img" alt="ATON ${aton.mmsi || aton.MMSI}" />
          </div>
          <div class="aton-info">
            <span class="aton-name">${ aton.atonDetails.AidName || 'Unknown ATON'}</span>
            <span class="aton-type">${this.getATONTypeName(atonType)}</span>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
        className: 'aton-marker-icon'
      });
      
      const marker = L.marker([lat, lng], {
        icon: atonIcon,
        mmsi: aton.mmsi || aton.MMSI,
        atonData: aton,
        atonType: atonType,
        lastUpdate: new Date()
      }).addTo(buoysLayer);
      
      // Bind popup
      const popupContent = this.createATONPopup(aton);
      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'custom-popup aton-popup'
      });
      
      // Event handlers
      this.addATONEventHandlers(marker, aton);
      
      console.log(`✅ ATON marker added: ${aton.mmsi || aton.MMSI} using ${assetFile}`);
      return marker;
      
    } catch (error) {
      console.error(`❌ Error adding ATON marker for ${aton.mmsi || aton.MMSI}:`, error);
      return null;
    }
  }

  static addATONEventHandlers(marker, aton) {
    // Click handler
    marker.on('click', function(e) {
      showATONDetails(aton);
      L.DomEvent.stopPropagation(e);
    });
    
    // Hover events
    marker.on('mouseover', function(e) {
      this.getElement().classList.add('marker-hover');
    });
    
    marker.on('mouseout', function(e) {
      this.getElement().classList.remove('marker-hover');
    });
  }

  // ===== UPDATE METHODS =====
  static updateVesselPosition(mmsi, lat, lng, heading) {
    try {
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          // Update posisi
          marker.setLatLng([lat, lng]);
          
          // Update rotasi jika ada heading baru
          if (heading !== undefined && Math.abs(heading - marker.options.rotation) > 5) {
            const iconElement = marker.getElement();
            if (iconElement) {
              const container = iconElement.querySelector('.vessel-marker-container');
              if (container) {
                container.style.transform = `rotate(${heading}deg)`;
                marker.options.rotation = heading;
              }
            }
          }
          
          marker.options.lastUpdate = new Date();
          console.log(`🔄 Updated vessel ${mmsi} position to ${lat}, ${lng}, rotation: ${heading}°`);
        }
      });
    } catch (error) {
      console.error(`❌ Error updating vessel position for ${mmsi}:`, error);
    }
  }

  static updateVesselData(vessel) {
    try {
      const mmsi = vessel.mmsi || vessel.MMSI;
      let markerFound = false;
      
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          markerFound = true;
          
          // Update stored data
          marker.options.vesselData = vessel;
          
          // Update position
          const lat = parseFloat(vessel.position?.latitude || vessel.coordinates?.coordinates[1]);
          const lng = parseFloat(vessel.position?.longitude || vessel.coordinates?.coordinates[0]);
          
          if (lat && lng) {
            marker.setLatLng([lat, lng]);
          }
          
          // Update rotation
          const heading = vessel.movement?.heading || vessel.Heading || 0;
          const cog = vessel.movement?.cog || vessel.CourseOverGround || 0;
          const newRotation = (heading > 0 && heading <= 360) ? heading : cog;
          
          if (Math.abs(newRotation - marker.options.rotation) > 5) {
            const iconElement = marker.getElement();
            if (iconElement) {
              const container = iconElement.querySelector('.vessel-marker-container');
              if (container) {
                container.style.transform = `rotate(${newRotation}deg)`;
                marker.options.rotation = newRotation;
              }
            }
          }
          
          // Update popup content
          const newPopupContent = MarkerManager.createVesselPopup(vessel);
          marker.setPopupContent(newPopupContent);
          
          marker.options.lastUpdate = new Date();
          console.log(`🔄 Updated vessel data for ${mmsi}`);
        }
      });
      
      return markerFound;
    } catch (error) {
      console.error(`❌ Error updating vessel data for ${vessel.mmsi || vessel.MMSI}:`, error);
      return false;
    }
  }

  // ===== UTILITY METHODS =====
  static removeMarkerByMMSI(mmsi, isVessel = true) {
    try {
      const layer = isVessel ? vesselsLayer : buoysLayer;
      let removed = false;
      
      layer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          layer.removeLayer(marker);
          removed = true;
          console.log(`🗑️ Removed ${isVessel ? 'vessel' : 'ATON'} marker: ${mmsi}`);
        }
      });
      
      return removed;
    } catch (error) {
      console.error(`❌ Error removing marker for ${mmsi}:`, error);
      return false;
    }
  }

  static getMarkerCounts() {
    try {
      return {
        vessels: vesselsLayer ? vesselsLayer.getLayers().length : 0,
        buoys: buoysLayer ? buoysLayer.getLayers().length : 0,
        total: (vesselsLayer ? vesselsLayer.getLayers().length : 0) + 
               (buoysLayer ? buoysLayer.getLayers().length : 0)
      };
    } catch (error) {
      console.error('❌ Error getting marker counts:', error);
      return { vessels: 0, buoys: 0, total: 0 };
    }
  }

  static highlightMarker(mmsi, isVessel = true) {
    try {
      const layer = isVessel ? vesselsLayer : buoysLayer;
      let highlighted = false;
      
      layer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          const iconElement = marker.getElement();
          if (iconElement) {
            iconElement.classList.add('marker-highlight');
            
            setTimeout(() => {
              iconElement.classList.remove('marker-highlight');
            }, 3000);
          }
          
          marker.openPopup();
          highlighted = true;
          console.log(`✨ Highlighted marker: ${mmsi}`);
        }
      });
      
      return highlighted;
    } catch (error) {
      console.error(`❌ Error highlighting marker for ${mmsi}:`, error);
      return false;
    }
  }

  // ===== POPUP CREATION METHODS =====
  static createVesselPopup(vessel) {
    const mmsi = vessel.mmsi || vessel.MMSI;
    const name = vessel.static?.NAME || vessel.ShipName || 'Unknown Vessel';
    const type = vessel.static?.TYPENAME || vessel.vesseltypeDesk || 'Unknown Type';
    const sog = vessel.movement?.sog || vessel.SpeedOverGround || 0;
    const cog = vessel.movement?.cog || vessel.CourseOverGround || 0;
    const heading = vessel.movement?.heading || vessel.Heading || 0;
    const navStatus = vessel.movement?.navStatus || vessel.NavigationStatus || 0;
    const lat = vessel.position?.latitude || vessel.coordinates?.coordinates[1] || 0;
    const lng = vessel.position?.longitude || vessel.coordinates?.coordinates[0] || 0;
    const age = vessel.dataAgeMinutes || 0;
    const ageColor = age < 5 ? 'green' : age < 15 ? 'orange' : 'red';
    const bearing = (heading > 0 && heading <= 360) ? heading : cog;
    
    return `
      <div class="vessel-popup-content">
        <div class="popup-header">
          <h4>${name}</h4>
          <span class="vessel-type-badge">${type}</span>
        </div>
        
        <div class="popup-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">MMSI:</span>
              <span class="value">${mmsi}</span>
            </div>
            <div class="info-item">
              <span class="label">Speed:</span>
              <span class="value">${sog.toFixed(1)} kts</span>
            </div>
            <div class="info-item">
              <span class="label">Course:</span>
              <span class="value">${cog.toFixed(0)}°</span>
            </div>
            <div class="info-item">
              <span class="label">Heading:</span>
              <span class="value">${heading.toFixed(0)}°</span>
            </div>
            <div class="info-item">
              <span class="label">Nav Status:</span>
              <span class="value">${this.getNavigationStatusText(navStatus)}</span>
            </div>
            <div class="info-item">
              <span class="label">Position:</span>
              <span class="value">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            </div>
            <div class="info-item">
              <span class="label">Data Age:</span>
              <span class="value" style="color: ${ageColor}">${age} min</span>
            </div>
            <div class="info-item">
              <span class="label">Bearing Used:</span>
              <span class="value">${bearing.toFixed(0)}° ${(heading > 0 && heading <= 360) ? '(HDG)' : '(COG)'}</span>
            </div>
          </div>
          
          <div class="bearing-compass">
            <div class="compass-ring">
              <div class="compass-needle" style="transform: rotate(${bearing}deg);"></div>
              <div class="compass-labels">
                <span class="north">N</span>
                <span class="east">E</span>
                <span class="south">S</span>
                <span class="west">W</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static createATONPopup(aton) {
    const mmsi = aton.mmsi || aton.MMSI;
    const name = aton.atonDetails.name || aton.ShipName || aton.atonName ;
    console.log(`Creating ATON popup for name: ${name}`);
    const type = aton.atonType || aton.AidType || 0;
    const category = aton.atonCategory || this.getATONTypeName(type);
    const lat = aton.position?.latitude || aton.coordinates?.coordinates[1] || 0;
    const lng = aton.position?.longitude || aton.coordinates?.coordinates[0] || 0;
    const age = aton.dataAgeMinutes || 0;
    const ageColor = age < 5 ? 'green' : age < 15 ? 'orange' : 'red';
    const offPosition = aton.atonDetails?.offPosition || aton.OffPosition || false;
    const virtualAid = aton.atonDetails?.virtualAid || aton.VirtualAid || false;
    
    return `
      <div class="aton-popup-content">
        <div class="popup-header">
          <h4>${name}</h4>
          <span class="aton-type-badge">${category}</span>
        </div>
        
        <div class="popup-body">
          <div class="info-grid">
            <div class="info-item">
              <span class="label">MMSI:</span>
              <span class="value">${mmsi}</span>
            </div>
            <div class="info-item">
              <span class="label">Type:</span>
              <span class="value">${type}</span>
            </div>
            <div class="info-item">
              <span class="label">Category:</span>
              <span class="value">${category}</span>
            </div>
            <div class="info-item">
              <span class="label">Position:</span>
              <span class="value">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>
            </div>
            <div class="info-item">
              <span class="label">Data Age:</span>
              <span class="value" style="color: ${ageColor}">${age} min</span>
            </div>
            <div class="info-item">
              <span class="label">Off Position:</span>
              <span class="value ${offPosition ? 'warning' : 'normal'}">${offPosition ? 'Yes' : 'No'}</span>
            </div>
            <div class="info-item">
              <span class="label">Virtual Aid:</span>
              <span class="value ${virtualAid ? 'info' : 'normal'}">${virtualAid ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== HELPER METHODS =====
  static getNavigationStatusClass(navStatus) {
    const statusMap = {
      0: 'underway',
      1: 'anchored',
      2: 'not-under-command',
      3: 'restricted',
      4: 'constrained',
      5: 'moored',
      6: 'aground',
      7: 'fishing',
      8: 'sailing',
      15: 'undefined'
    };
    return statusMap[navStatus] || 'undefined';
  }

  static getNavigationStatusText(navStatus) {
    const statusMap = {
      0: 'Under way using engine',
      1: 'At anchor',
      2: 'Not under command',
      3: 'Restricted manoeuvrability',
      4: 'Constrained by her draught',
      5: 'Moored',
      6: 'Aground',
      7: 'Engaged in fishing',
      8: 'Under way sailing',
      15: 'Not defined'
    };
    return statusMap[navStatus] || 'Unknown';
  }

  static getSpeedClass(sog) {
    if (sog < 1) return 'vessel-speed-slow';
    if (sog < 10) return 'vessel-speed-medium';
    return 'vessel-speed-fast';
  }

  static getATONTypeName(type) {
    const typeMap = {
      1: 'North Cardinal', 2: 'East Cardinal', 3: 'South Cardinal', 4: 'West Cardinal',
      5: 'Port Hand', 6: 'Starboard Hand', 7: 'Preferred Channel Port', 8: 'Preferred Channel Starboard',
      9: 'Isolated Danger', 10: 'Safe Water', 11: 'Special Mark', 12: 'Light Vessel',
      13: 'LANBY', 14: 'Racon', 15: 'Fixed Structure', 16: 'Floating Structure',
      17: 'Emergency Wreck', 18: 'Offshore Platform', 19: 'Drilling Rig', 20: 'Virtual ATON',
      21: 'North Cardinal with Topmark', 22: 'East Cardinal with Topmark', 23: 'South Cardinal with Topmark', 24: 'West Cardinal with Topmark',
      25: 'Port Lateral with Topmark', 26: 'Starboard Lateral with Topmark', 27: 'Isolated Danger with Topmark', 28: 'Safe Water with Topmark',
      29: 'Special Purpose with Topmark', 30: 'Wreck Marking', 31: 'Obstruction Marking', 0: 'Unknown ATON'
    };
    return typeMap[type] || typeMap[0];
  }

  // ===== CLEANUP METHODS =====
  static cleanupOldMarkers(maxAgeMinutes = 10) {
    try {
      const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
      let removedCount = 0;
      
      // Clean vessels
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.lastUpdate && marker.options.lastUpdate < cutoffTime) {
          vesselsLayer.removeLayer(marker);
          removedCount++;
        }
      });
      
      // Clean ATONs
      buoysLayer.eachLayer(function(marker) {
        if (marker.options.lastUpdate && marker.options.lastUpdate < cutoffTime) {
          buoysLayer.removeLayer(marker);
          removedCount++;
        }
      });
      
      if (removedCount > 0) {
        console.log(`🧹 Cleaned up ${removedCount} old markers`);
      }
      
      return removedCount;
    } catch (error) {
      console.error('❌ Error cleaning up old markers:', error);
      return 0;
    }
  }
}

// ===== CSS STYLES =====
const markerStyle = document.createElement('style');
markerStyle.textContent = `
  /* ===== VESSEL MARKER STYLES ===== */
  .vessel-marker-container {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    transition: transform 0.3s ease;
    position: relative;
  }
  
  .vessel-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
  }
  
  .bearing-indicator {
    position: absolute;
    top: -1px;
    left: 50%;
    width: 2px;
    height: 4px;
    background: #06b6d4;
    transform: translateX(-50%);
    border-radius: 0 0 1px 1px;
  }
  
  .vessel-info {
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(5px);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    font-size: 9px;
    color: #ffffff;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1000;
  }
  
  .vessel-marker-icon:hover .vessel-info {
    opacity: 1;
  }
  
  .vessel-name {
    display: block;
    font-weight: 600;
    color: #06b6d4;
    margin-bottom: 1px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .vessel-speed {
    display: block;
    font-size: 8px;
    color: #10b981;
  }
  
  .vessel-speed-slow { color: #64748b; }
  .vessel-speed-medium { color: #f59e0b; }
  .vessel-speed-fast { color: #ef4444; }
  
  /* ===== ATON MARKER STYLES ===== */
  .aton-marker-container {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  
  .aton-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
  }
  
  .aton-info {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(5px);
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    font-size: 9px;
    color: #ffffff;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 1000;
  }
  
  .aton-marker-icon:hover .aton-info {
    opacity: 1;
  }
  
  .aton-name {
    display: block;
    font-weight: 600;
    color: #f59e0b;
    margin-bottom: 1px;
    max-width: 80px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .aton-type {
    display: block;
    font-size: 8px;
    color: #10b981;
  }
  
  /* ===== HOVER EFFECTS ===== */
  .vessel-marker-icon, .aton-marker-icon {
    cursor: pointer;
  }
  
  .vessel-marker-icon.marker-hover .vessel-icon-img,
  .aton-marker-icon.marker-hover .aton-icon-img {
    filter: drop-shadow(0 2px 4px rgba(6, 182, 212, 0.5)) brightness(1.1);
  }
  
  .vessel-marker-icon:hover .vessel-marker-container {
    transform: scale(1.2);
  }
  
  .aton-marker-icon:hover .aton-marker-container {
    transform: scale(1.2);
  }
  
  /* ===== STATUS ANIMATIONS ===== */
  .vessel-marker-container.anchored {
    animation: pulse-blue 2s infinite;
  }
  
  .vessel-marker-container.not-under-command {
    animation: pulse-red 1s infinite;
  }
  
  .vessel-marker-container.fishing {
    animation: pulse-green 2s infinite;
  }
  
  @keyframes pulse-blue {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
  }
  
  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
  }
  
  @keyframes pulse-green {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
  }
  
  /* ===== HIGHLIGHT ANIMATION ===== */
  .marker-highlight {
    animation: pulse-highlight 2s infinite;
  }
  
  @keyframes pulse-highlight {
    0% { 
      filter: drop-shadow(0 0 5px #ffff00);
    }
    50% { 
      filter: drop-shadow(0 0 15px #ffff00) drop-shadow(0 0 25px #ffff00);
    }
    100% { 
      filter: drop-shadow(0 0 5px #ffff00);
    }
  }
  
  /* ===== POPUP STYLES ===== */
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.15);
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(59, 130, 246, 0.2);
  }
  
  .custom-popup .leaflet-popup-content {
    margin: 0;
    padding: 0;
    color: #ffffff;
  }
  
  .custom-popup .leaflet-popup-tip {
    background: rgba(15, 23, 42, 0.95);
  }
  
  .vessel-popup-content, .aton-popup-content {
    min-width: 300px;
  }
  
  .popup-header {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 12px 12px 0 0;
  }
  
  .popup-header h4 {
    margin: 0;
    color: #ffffff;
    font-size: 1.1rem;
    font-weight: 600;
  }
  
  .vessel-type-badge, .aton-type-badge {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }
  
  .popup-body {
    padding: 1rem 1.5rem;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .info-item .label {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 500;
  }
  
  .info-item .value {
    font-size: 0.875rem;
    color: #ffffff;
    font-weight: 600;
  }
  
  .info-item .value.warning {
    color: #f59e0b;
  }
  
  .info-item .value.info {
    color: #06b6d4;
  }
  
  .info-item .value.normal {
    color: #10b981;
  }
  
  /* ===== BEARING COMPASS ===== */
  .bearing-compass {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
  }
  
  .compass-ring {
    width: 60px;
    height: 60px;
    border: 2px solid #06b6d4;
    border-radius: 50%;
    position: relative;
    background: radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%);
  }
  
  .compass-needle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 2px;
    height: 20px;
    background: linear-gradient(to top, #ef4444 0%, #06b6d4 100%);
    transform-origin: bottom center;
    transform: translate(-50%, -100%);
    transition: transform 0.3s ease;
  }
  
  .compass-needle::before {
    content: '';
    position: absolute;
    top: -3px;
    left: -2px;
    width: 6px;
    height: 6px;
    background: #06b6d4;
    border-radius: 50%;
  }
  
  .compass-labels {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
  
  .compass-labels span {
    position: absolute;
    font-size: 0.75rem;
    font-weight: 600;
    color: #06b6d4;
  }
  
  .compass-labels .north {
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .compass-labels .east {
    right: -2px;
    top: 50%;
    transform: translateY(-50%);
  }
  
  .compass-labels .south {
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
  }
  
  .compass-labels .west {
    left: -2px;
    top: 50%;
    transform: translateY(-50%);
  }
`;
document.head.appendChild(markerStyle);

// Export MarkerManager untuk global access
window.MarkerManager = MarkerManager;

// Export markerStyle untuk global access
window.markerStyle = markerStyle;