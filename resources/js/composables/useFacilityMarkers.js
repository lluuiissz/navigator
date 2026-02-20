import { ref } from 'vue'
import L from 'leaflet'


export function useFacilityMarkers() {
  const facilityMarkers = ref([])
  const polygonLayers = ref([])

// Marker type icons mapping
  const markerTypeIcons = {
    'academic': '🎓',
    'library': '📚',
    'laboratory': '🔬',
    'office': '💼',
    'cafeteria': '🍽️',
    'sports': '🏃',
    'dormitory': '🛏️',
    'parking': '🚗',
    'medical': '⚕️',
    'building': '🏛️',
    'classroom': '✏️',
    'administration': '📋',
    'auditorium': '🎭',
    'gymnasium': '🏀',
    'theater': '🎬',
    'studio': '🎨',
    'workshop': '🔧',
    'conference': '👥',
    'entrance': '🚪',
    'exit': '🚶',
    'restroom': '🚻',
    'garden': '🌳',
    'plaza': '🏞️',
    'fountain': '⛲',
    'statue': '🗿',
    'gate': '🚧',
    'security': '🔒',
    'it': '💻',
    'maintenance': '🛠️',
    'storage': '📦',
    'default': '📌'
  }

  // Add facility marker to map
  const addFacilityMarker = (location, map) => {
    if (!map || !map.addLayer) {
      console.warn('Cannot add marker: map not ready')
      return
    }

    try {
      const marker = L.marker([location.lat, location.lng], {
        title: location.name,
        icon: L.divIcon({
          className: 'facility-marker',
          html: `
            <div style="
              background: white;
              border: 1px solid #3B82F6;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              font-size: 16px;
            ">
              ${location.icon}
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(map)

      facilityMarkers.value.push(marker)
      return marker
    } catch (error) {
      console.error('Error adding facility marker:', error)
      return null
    }
  }

  // Cleanup function to remove all markers and polygons
  const cleanup = (map) => {
    if (!map) return

    // Remove facility markers
    facilityMarkers.value.forEach(marker => {
      if (map.hasLayer && map.hasLayer(marker)) {
        try {
          map.removeLayer(marker)
        } catch (error) {
          console.warn('Error removing facility marker:', error)
        }
      }
    })
    facilityMarkers.value = []

    // Remove polygons
    polygonLayers.value.forEach(layer => {
      if (map.hasLayer && map.hasLayer(layer)) {
        try {
          map.removeLayer(layer)
        } catch (error) {
          console.warn('Error removing polygon layer:', error)
        }
      }
    })
    polygonLayers.value = []
  }

  // Display polygons on map
  const displayPolygons = (polygons, map) => {
    if (!map || !polygons || !Array.isArray(polygons)) {
      console.warn('Cannot display polygons: map or data not ready')
      return
    }

    // Clear existing polygon layers
    polygonLayers.value.forEach(layer => {
      if (map && map.hasLayer && map.hasLayer(layer)) {
        try {
          map.removeLayer(layer)
        } catch (error) {
          console.warn('Error removing polygon layer:', error)
        }
      }
    })
    polygonLayers.value = []

    polygons.forEach(polygon => {
      if (!polygon.coordinates || !Array.isArray(polygon.coordinates)) {
        console.warn('Invalid polygon coordinates:', polygon)
        return
      }

      try {
        // Convert coordinates to Leaflet format [[lat, lng], [lat, lng], ...]
        const latlngs = polygon.coordinates.map(coord => [coord.lat, coord.lng])

        const polygonLayer = L.polygon(latlngs, {
          color: polygon.color || '#3B82F6',
          fillColor: polygon.fill_color || '#3B82F6',
          fillOpacity: polygon.fill_opacity || 0.3,
          weight: 3,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        })

        // Add tooltip that shows on hover
        if (polygon.name) {
          polygonLayer.bindTooltip(polygon.name, {
            permanent: false,
            direction: 'center',
            className: 'polygon-tooltip',
            opacity: 0.9
          })
        }

        // Add hover effects
        polygonLayer.on('mouseover', function(e) {
          const layer = e.target
          layer.setStyle({
            fillOpacity: 0.5,
            weight: 4
          })
        })

        polygonLayer.on('mouseout', function(e) {
          const layer = e.target
          layer.setStyle({
            fillOpacity: polygon.fill_opacity || 0.3,
            weight: 3
          })
        })

        // Only add to map if map still exists
        if (map && map.addLayer) {
          polygonLayer.addTo(map)
          polygonLayers.value.push(polygonLayer)
        }
      } catch (error) {
        console.error('Error creating polygon:', polygon, error)
      }
    })

    // console.log(`Displayed ${polygonLayers.value.length} polygons on map`)
  }

  return {
    facilityMarkers,
    polygonLayers,
    markerTypeIcons,
    addFacilityMarker,
    displayPolygons,
    cleanup
  }
}
