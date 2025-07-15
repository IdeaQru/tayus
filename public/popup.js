// popups.js - Semua fungsi terkait popup dan info panel
// Tambahkan di awal popups.js

// Prevent popup conflicts
document.addEventListener('DOMContentLoaded', function() {
  // Close info panel when clicking outside
  document.addEventListener('click', function(e) {
    const panel = document.getElementById('info-panel');
    if (panel && panel.style.display === 'block') {
      if (!panel.contains(e.target) && !e.target.closest('.leaflet-marker-icon')) {
        PopupManager.closeInfoPanel();
      }
    }
  });
});

// Update closeInfoPanel function


// Popup Manager Class
class PopupManager {

  // Buat popup untuk vessel
  static createVesselPopup(vessel) {
    const name = vessel.static?.NAME || 'Unknown Vessel';
    const mmsi = vessel.mmsi || 'N/A';
    const type = vessel.static?.TYPENAME || 'Unknown';
    const speed = (vessel.movement?.sog || 0).toFixed(1);
    const course = Math.round(vessel.movement?.cog || 0);
    const heading = Math.round(vessel.movement?.heading || 0);
    const callsign = vessel.static?.CALLSIGN || 'N/A';
    const age = vessel.dataAgeMinutes || 0;
    
    return `
      <div class="popup-header">
        <i class="fas fa-ship"></i> ${name}
      </div>
      <div class="popup-body">
        <div class="popup-data">
          <div class="popup-item">
            <span class="popup-label">MMSI</span>
            <span class="popup-value">${mmsi}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Type</span>
            <span class="popup-value">${type}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Speed</span>
            <span class="popup-value">${speed} kts</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Course</span>
            <span class="popup-value">${course}°</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Heading</span>
            <span class="popup-value">${heading}°</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Callsign</span>
            <span class="popup-value">${callsign}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Age</span>
            <span class="popup-value">${age} min</span>
          </div>
        </div>
        <div class="popup-actions">
          <button class="popup-btn" onclick="PopupManager.trackVessel('${mmsi}')">
            <i class="fas fa-crosshairs"></i> Track
          </button>
          <button class="popup-btn" onclick="PopupManager.showVesselHistory('${mmsi}')">
            <i class="fas fa-history"></i> History
          </button>
        </div>
      </div>
    `;
  }

  // Buat popup untuk ATON
  static createATONPopup(aton) {
    const name = aton.atonDetails?.name || aton.atonName || 'Unknown ATON';
    const mmsi = aton.mmsi || 'N/A';
    const category = aton.atonCategory || 'Unknown';
    const typeCode = aton.atonType || 0;
    const atonName = aton.atonDetails?.name || 'N/A';
    const dimensions = `${aton.atonDetails?.dimensions?.length || 0}x${aton.atonDetails?.dimensions?.width || 0}m`;
    const isVirtual = aton.atonDetails?.virtualAton ? 'Yes' : 'No';
    
    return `
      <div class="popup-header aton-popup-header">
        <i class="fas fa-anchor"></i> ${name}
      </div>
      <div class="popup-body">
        <div class="popup-data">
          <div class="popup-item">
            <span class="popup-label">MMSI</span>
            <span class="popup-value">${mmsi}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Category</span>
            <span class="popup-value">${category}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Type Code</span>
            <span class="popup-value">${typeCode}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Name</span>
            <span class="popup-value">${atonName}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Dimensions</span>
            <span class="popup-value">${dimensions}</span>
          </div>
          <div class="popup-item">
            <span class="popup-label">Virtual</span>
            <span class="popup-value">${isVirtual}</span>
          </div>
        </div>
        <div class="popup-actions">
          <button class="popup-btn" onclick="PopupManager.showATONDetails('${mmsi}')">
            <i class="fas fa-info-circle"></i> Details
          </button>
        </div>
      </div>
    `;
  }

  // Show vessel info di panel
  static showVesselInfo(vessel) {
    try {
      const panel = document.getElementById('info-panel');
      const content = document.getElementById('info-content');
      
      if (!panel || !content) return;
      
      const name = vessel.static?.NAME || 'Unknown';
      const mmsi = vessel.mmsi || 'N/A';
      const imo = vessel.static?.IMO || 'N/A';
      const callsign = vessel.static?.CALLSIGN || 'N/A';
      const type = vessel.static?.TYPENAME || 'Unknown';
      const speed = (vessel.movement?.sog || 0).toFixed(1);
      const course = Math.round(vessel.movement?.cog || 0);
      const heading = Math.round(vessel.movement?.heading || 0);
      const lat = vessel.position?.latitude?.toFixed(6) || 'N/A';
      const lng = vessel.position?.longitude?.toFixed(6) || 'N/A';
      const age = vessel.dataAgeMinutes || 0;
      const navStatus = PopupManager.getNavigationStatusText(vessel.movement?.navStatus || 0);
      const flag = vessel.static?.FLAG || 'N/A';
      const gt = vessel.static?.GT || 'N/A';
      const loa = vessel.static?.LOA || 'N/A';
      const beam = vessel.static?.BEAM || 'N/A';
      
      content.innerHTML = `
        <div class="vessel-details">
          <div class="detail-header">
            <h3><i class="fas fa-ship"></i> ${name}</h3>
            <span class="mmsi-badge">${mmsi}</span>
          </div>
          
          <div class="detail-section">
            <h4>Vessel Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">IMO</span>
                <span class="detail-value">${imo}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Callsign</span>
                <span class="detail-value">${callsign}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Type</span>
                <span class="detail-value">${type}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Flag</span>
                <span class="detail-value">${flag}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Gross Tonnage</span>
                <span class="detail-value">${gt}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Length</span>
                <span class="detail-value">${loa} m</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Beam</span>
                <span class="detail-value">${beam} m</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Navigation Data</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Speed</span>
                <span class="detail-value">${speed} knots</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Course</span>
                <span class="detail-value">${course}°</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Heading</span>
                <span class="detail-value">${heading}°</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="detail-value">${navStatus}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Position</h4>
            <div class="position-info">
              <div class="coordinates">
                <span class="coord-label">Latitude:</span>
                <span class="coord-value">${lat}</span>
              </div>
              <div class="coordinates">
                <span class="coord-label">Longitude:</span>
                <span class="coord-value">${lng}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Data Status</h4>
            <div class="status-info">
              <span class="status-label">Last Update:</span>
              <span class="status-value">${age} minutes ago</span>
            </div>
          </div>
          
          <div class="detail-actions">
            <button class="action-btn primary" onclick="PopupManager.trackVessel('${mmsi}')">
              <i class="fas fa-crosshairs"></i> Track Vessel
            </button>
            <button class="action-btn secondary" onclick="PopupManager.showVesselHistory('${mmsi}')">
              <i class="fas fa-history"></i> View History
            </button>
            <button class="action-btn secondary" onclick="PopupManager.exportVesselData('${mmsi}')">
              <i class="fas fa-download"></i> Export Data
            </button>
          </div>
        </div>
      `;
      
      panel.style.display = 'block';
      
    } catch (error) {
      console.error('❌ Error showing vessel info:', error);
    }
  }

  // Show ATON info di panel
  static showATONInfo(aton) {
    try {
      const panel = document.getElementById('info-panel');
      const content = document.getElementById('info-content');
      
      if (!panel || !content) return;
      
      const name = aton.atonDetails.name || 'Unknown ATON';
      const mmsi = aton.mmsi || 'N/A';
      const atonName = aton.atonName || 'Unknown';
      const category = aton.atonCategory || 'Unknown';
      const typeCode = aton.atonType || 0;
      const lat = aton.position?.latitude?.toFixed(6) || 'N/A';
      const lng = aton.position?.longitude?.toFixed(6) || 'N/A';
      const length = aton.atonDetails?.dimensions?.length || 0;
      const width = aton.atonDetails?.dimensions?.width || 0;
      const isVirtual = aton.atonDetails?.virtualAton ? 'Yes' : 'No';
      const offPosition = aton.atonDetails?.offPosition ? 'Yes' : 'No';
      const raimFlag = aton.atonDetails?.raimFlag ? 'Active' : 'Inactive';
      const age = aton.dataAgeMinutes || 0;
      const timestamp = aton.timestamp ? new Date(aton.timestamp).toLocaleString() : 'N/A';
      
      content.innerHTML = `
        <div class="aton-details">
          <div class="detail-header">
            <h3><i class="fas fa-anchor"></i> ${name}</h3>
            <span class="mmsi-badge aton-badge">${mmsi}</span>
          </div>
          
          <div class="detail-section">
            <h4>ATON Information</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Type</span>
                <span class="detail-value">${atonName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Category</span>
                <span class="detail-value">${category}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Type Code</span>
                <span class="detail-value">${typeCode}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Virtual ATON</span>
                <span class="detail-value">${isVirtual}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Off Position</span>
                <span class="detail-value">${offPosition}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">RAIM Flag</span>
                <span class="detail-value">${raimFlag}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Physical Characteristics</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Length</span>
                <span class="detail-value">${length} meters</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Width</span>
                <span class="detail-value">${width} meters</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Position</h4>
            <div class="position-info">
              <div class="coordinates">
                <span class="coord-label">Latitude:</span>
                <span class="coord-value">${lat}</span>
              </div>
              <div class="coordinates">
                <span class="coord-label">Longitude:</span>
                <span class="coord-value">${lng}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h4>Data Status</h4>
            <div class="status-info">
              <span class="status-label">Last Update:</span>
              <span class="status-value">${age} minutes ago</span>
            </div>
            <div class="status-info">
              <span class="status-label">Timestamp:</span>
              <span class="status-value">${timestamp}</span>
            </div>
          </div>
          
          <div class="detail-actions">
            <button class="action-btn primary" onclick="PopupManager.showATONDetails('${mmsi}')">
              <i class="fas fa-info-circle"></i> Full Details
            </button>
            <button class="action-btn secondary" onclick="PopupManager.exportATONData('${mmsi}')">
              <i class="fas fa-download"></i> Export Data
            </button>
          </div>
        </div>
      `;
      
      panel.style.display = 'block';
      
    } catch (error) {
      console.error('❌ Error showing ATON info:', error);
    }
  }

  // Close info panel
static closeInfoPanel() {
  try {
    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.style.display = 'none';
      // Clear any active highlights
      document.querySelectorAll('.marker-highlight').forEach(el => {
        el.classList.remove('marker-highlight');
      });
    }
  } catch (error) {
    console.error('❌ Error closing info panel:', error);
  }
}

  // Track vessel function
  static trackVessel(mmsi) {
    try {
      console.log(`🎯 Tracking vessel: ${mmsi}`);
      
      // Highlight marker
      MarkerManager.highlightMarker(mmsi, true);
      
      // Center map on vessel
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          map.setView(marker.getLatLng(), 12);
        }
      });
      
      // Show tracking notification
      PopupManager.showNotification(`Now tracking vessel ${mmsi}`, 'success');
      
    } catch (error) {
      console.error(`❌ Error tracking vessel ${mmsi}:`, error);
    }
  }

  // Show vessel history
  static showVesselHistory(mmsi) {
    try {
      console.log(`📊 Showing history for vessel: ${mmsi}`);
      PopupManager.showNotification(`History feature for vessel ${mmsi} - Coming soon!`, 'info');
    } catch (error) {
      console.error(`❌ Error showing vessel history for ${mmsi}:`, error);
    }
  }

  // Show ATON details
  static showATONDetails(mmsi) {
    try {
      console.log(`📋 Showing details for ATON: ${mmsi}`);
      PopupManager.showNotification(`Detailed ATON information for ${mmsi} - Coming soon!`, 'info');
    } catch (error) {
      console.error(`❌ Error showing ATON details for ${mmsi}:`, error);
    }
  }

  // Export vessel data
  static exportVesselData(mmsi) {
    try {
      console.log(`💾 Exporting data for vessel: ${mmsi}`);
      PopupManager.showNotification(`Export feature for vessel ${mmsi} - Coming soon!`, 'info');
    } catch (error) {
      console.error(`❌ Error exporting vessel data for ${mmsi}:`, error);
    }
  }

  // Export ATON data
  static exportATONData(mmsi) {
    try {
      console.log(`💾 Exporting data for ATON: ${mmsi}`);
      PopupManager.showNotification(`Export feature for ATON ${mmsi} - Coming soon!`, 'info');
    } catch (error) {
      console.error(`❌ Error exporting ATON data for ${mmsi}:`, error);
    }
  }

  // Show notification
  static showNotification(message, type = 'info') {
    try {
      // Create notification element if not exists
      let notification = document.getElementById('notification');
      if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
      }
      
      notification.className = `notification ${type} show`;
      notification.textContent = message;
      
      // Auto hide after 3 seconds
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  // Get navigation status text
  static getNavigationStatusText(status) {
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
      15: 'Undefined'
    };
    return statusMap[status] || 'Unknown';
  }
}

// CSS untuk popup styling
const popupStyle = document.createElement('style');
popupStyle.textContent = `
  .popup-header {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
    padding: 12px 15px;
    font-weight: bold;
    border-radius: 8px 8px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .aton-popup-header {
    background: linear-gradient(135deg, #28a745, #1e7e34);
  }
  
  .popup-body {
    padding: 15px;
    max-width: 300px;
  }
  
  .popup-data {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .popup-item {
    display: flex;
    flex-direction: column;
  }
  
  .popup-label {
    font-size: 10px;
    color: #666;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .popup-value {
    font-size: 13px;
    color: #333;
    margin-top: 2px;
  }
  
  .popup-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  
  .popup-btn {
    flex: 1;
    padding: 6px 8px;
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    transition: all 0.2s;
  }
  
  .popup-btn:hover {
    background: #e9ecef;
    border-color: #adb5bd;
  }
  
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #e9ecef;
  }
  
  .detail-header h3 {
    margin: 0;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .mmsi-badge {
    background: #007bff;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
  }
  
  .aton-badge {
    background: #28a745;
  }
  
  .detail-section {
    margin-bottom: 20px;
  }
  
  .detail-section h4 {
    color: #495057;
    font-size: 14px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e9ecef;
  }
  
  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  
  .detail-item {
    display: flex;
    flex-direction: column;
  }
  
  .detail-label {
    font-weight: bold;
    color: #666;
    font-size: 11px;
    text-transform: uppercase;
  }
  
  .detail-value {
    color: #333;
    font-size: 14px;
    margin-top: 2px;
  }
  
  .detail-full {
    grid-column: 1 / -1;
  }
  
  .legend {
    position: absolute;
    bottom: 20px;
    left: 20px;
    background: rgba(255, 255, 255, 0.95);
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    max-width: 200px;
  }
  
  .legend h4 {
    color: #495057;
    font-size: 14px;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e9ecef;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .legend-visual {
    width: 20px;
    height: 20px;
    border-radius: 4px;
  }
  
  .legend-label {
    font-size: 12px;
    color: #333;
  }`;