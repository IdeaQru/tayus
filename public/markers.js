// markers.js - Versi Diperbaiki

class MarkerManager {
  
  // Clear semua markers
  static clearAllMarkers() {
    try {
      vesselsLayer.clearLayers();
      buoysLayer.clearLayers();
      console.log('🧹 All markers cleared');
    } catch (error) {
      console.error('❌ Error clearing markers:', error);
    }
  }

  // Tambah marker vessel dengan rotasi yang benar
  static addVesselMarker(vessel, lat, lng) {
    try {
      console.log(`🚢 Adding vessel marker: ${vessel.mmsi} at ${lat}, ${lng}`);
      
      // Hitung rotasi berdasarkan heading atau COG
      const rotation = vessel.movement?.heading || vessel.movement?.cog || 0;
      
      // Buat icon dengan asset lokal
      const iconUrl = MARKER_ASSETS.basePath + MARKER_ASSETS.vessel;
      
      // Buat custom icon dengan rotasi CSS yang benar
      const vesselIcon = L.divIcon({
        html: `
          <div class="vessel-marker-container" style="transform: rotate(${rotation}deg);">
            <img src="${iconUrl}" class="vessel-icon-img" alt="Vessel ${vessel.mmsi}" />
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
        className: 'vessel-marker-icon'
      });
      
      const marker = L.marker([lat, lng], {
        icon: vesselIcon,
        mmsi: vessel.mmsi, // Store MMSI untuk reference
        vesselData: vessel, // Store data vessel untuk popup
        rotation: rotation // Store rotasi saat ini
      }).addTo(vesselsLayer);
      
      // Bind popup menggunakan PopupManager
      const popupContent = PopupManager.createVesselPopup(vessel);
      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'custom-popup'
      });
      
      // Click handler menggunakan PopupManager
      marker.on('click', function(e) {
        PopupManager.showVesselInfo(vessel);
        // Prevent event bubbling
        L.DomEvent.stopPropagation(e);
      });
      
      // Hover events untuk highlight
      marker.on('mouseover', function(e) {
        this.getElement().classList.add('marker-hover');
      });
      
      marker.on('mouseout', function(e) {
        this.getElement().classList.remove('marker-hover');
      });
      
      console.log(`✅ Vessel marker added: ${vessel.mmsi} with rotation: ${rotation}°`);
      
    } catch (error) {
      console.error(`❌ Error adding vessel marker for ${vessel.mmsi}:`, error);
    }
  }

  // Tambah marker ATON dengan popup yang benar
  static addATONMarker(aton, lat, lng) {
    try {
      console.log(`⚓ Adding ATON marker: ${aton.mmsi} at ${lat}, ${lng} (Type: ${aton.atonType})`);
      
      // Dapatkan asset berdasarkan tipe ATON
      const atonType = aton.atonType || 0;
      const assetFile = MARKER_ASSETS.aton[atonType] || MARKER_ASSETS.aton[0];
      const iconUrl = MARKER_ASSETS.basePath + assetFile;
      
      console.log(`📁 Using asset: ${assetFile} for ATON type ${atonType}`);
      
      // Buat custom icon untuk ATON
      const atonIcon = L.divIcon({
        html: `
          <div class="aton-marker-container">
            <img src="${iconUrl}" class="aton-icon-img" alt="ATON ${aton.mmsi}" />
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10],
        className: 'aton-marker-icon'
      });
      
      const marker = L.marker([lat, lng], {
        icon: atonIcon,
        mmsi: aton.mmsi, // Store MMSI untuk reference
        atonData: aton // Store data ATON untuk popup
      }).addTo(buoysLayer);
      
      // Bind popup menggunakan PopupManager
      const popupContent = PopupManager.createATONPopup(aton);
      marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'custom-popup aton-popup'
      });
      
      // Click handler menggunakan PopupManager
      marker.on('click', function(e) {
        PopupManager.showATONInfo(aton);
        // Prevent event bubbling
        L.DomEvent.stopPropagation(e);
      });
      
      // Hover events untuk highlight
      marker.on('mouseover', function(e) {
        this.getElement().classList.add('marker-hover');
      });
      
      marker.on('mouseout', function(e) {
        this.getElement().classList.remove('marker-hover');
      });
      
      console.log(`✅ ATON marker added: ${aton.mmsi} using ${assetFile}`);
      
    } catch (error) {
      console.error(`❌ Error adding ATON marker for ${aton.mmsi}:`, error);
    }
  }

  // Update marker position dan rotasi untuk real-time updates
  static updateVesselPosition(mmsi, lat, lng, heading) {
    try {
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          // Update posisi
          marker.setLatLng([lat, lng]);
          
          // Update rotasi jika ada heading baru
          if (heading !== undefined && heading !== marker.options.rotation) {
            const iconElement = marker.getElement();
            if (iconElement) {
              const container = iconElement.querySelector('.vessel-marker-container');
              if (container) {
                container.style.transform = `rotate(${heading}deg)`;
                marker.options.rotation = heading; // Update stored rotation
              }
            }
          }
          
          console.log(`🔄 Updated vessel ${mmsi} position to ${lat}, ${lng}, rotation: ${heading}°`);
        }
      });
    } catch (error) {
      console.error(`❌ Error updating vessel position for ${mmsi}:`, error);
    }
  }

  // Update data vessel yang sudah ada
  static updateVesselData(vessel) {
    try {
      vesselsLayer.eachLayer(function(marker) {
        if (marker.options.mmsi === vessel.mmsi) {
          // Update stored data
          marker.options.vesselData = vessel;
          
          // Update position
          const lat = parseFloat(vessel.position.latitude);
          const lng = parseFloat(vessel.position.longitude);
          marker.setLatLng([lat, lng]);
          
          // Update rotation
          const newRotation = vessel.movement?.heading || vessel.movement?.cog || 0;
          if (newRotation !== marker.options.rotation) {
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
          const newPopupContent = PopupManager.createVesselPopup(vessel);
          marker.setPopupContent(newPopupContent);
          
          console.log(`🔄 Updated vessel data for ${vessel.mmsi}`);
        }
      });
    } catch (error) {
      console.error(`❌ Error updating vessel data for ${vessel.mmsi}:`, error);
    }
  }

  // Remove marker berdasarkan MMSI
  static removeMarkerByMMSI(mmsi, isVessel = true) {
    try {
      const layer = isVessel ? vesselsLayer : buoysLayer;
      
      layer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          layer.removeLayer(marker);
          console.log(`🗑️ Removed ${isVessel ? 'vessel' : 'ATON'} marker: ${mmsi}`);
        }
      });
    } catch (error) {
      console.error(`❌ Error removing marker for ${mmsi}:`, error);
    }
  }

  // Get marker count
  static getMarkerCounts() {
    return {
      vessels: vesselsLayer.getLayers().length,
      buoys: buoysLayer.getLayers().length,
      total: vesselsLayer.getLayers().length + buoysLayer.getLayers().length
    };
  }

  // Highlight marker berdasarkan MMSI
  static highlightMarker(mmsi, isVessel = true) {
    try {
      const layer = isVessel ? vesselsLayer : buoysLayer;
      
      layer.eachLayer(function(marker) {
        if (marker.options.mmsi === mmsi) {
          // Add highlight effect
          const iconElement = marker.getElement();
          if (iconElement) {
            iconElement.classList.add('marker-highlight');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              iconElement.classList.remove('marker-highlight');
            }, 3000);
          }
          
          // Open popup
          marker.openPopup();
          
          console.log(`✨ Highlighted marker: ${mmsi}`);
        }
      });
    } catch (error) {
      console.error(`❌ Error highlighting marker for ${mmsi}:`, error);
    }
  }
}

// CSS untuk marker yang diperbaiki
const markerStyle = document.createElement('style');
markerStyle.textContent = `
  /* Container untuk vessel marker */
  .vessel-marker-container {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center center;
    transition: transform 0.3s ease;
  }
  
  .vessel-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));
  }
  
  /* Container untuk ATON marker */
  .aton-marker-container {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .aton-icon-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));
  }
  
  /* Hover effects yang tidak mengganggu posisi */
  .vessel-marker-icon, .aton-marker-icon {
    cursor: pointer;
  }
  
  .vessel-marker-icon.marker-hover .vessel-icon-img,
  .aton-marker-icon.marker-hover .aton-icon-img {
    filter: drop-shadow(2px 2px 8px rgba(0,123,255,0.6)) brightness(1.1);
  }
  
  /* Highlight animation */
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
  
  /* Custom popup styling */
  .custom-popup .leaflet-popup-content-wrapper {
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  }
  
  .custom-popup .leaflet-popup-content {
    margin: 0;
    padding: 0;
  }
  
  .aton-popup .leaflet-popup-content-wrapper {
    background: #f8f9fa;
  }
`;
document.head.appendChild(markerStyle);

// Export MarkerManager untuk global access
window.MarkerManager = MarkerManager;
