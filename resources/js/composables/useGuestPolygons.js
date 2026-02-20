import { ref } from 'vue'
import L from 'leaflet'
import axios from 'axios'
import { useToast } from 'vue-toastification'

export function useGuestPolygons(map) {
  const toast = useToast()

  const polygons = ref([])
  const polygonInstances = ref([])

  // Fetch polygons from backend
  const fetchPolygons = async () => {
    try {
      const response = await axios.get('/facilities/polygons', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      polygons.value = response.data

      if (map.value) {
        // Clear existing polygons
        polygonInstances.value.forEach(p => {
          if (p && p.polygon) {
            try {
              p.polygon.off()
              if (p.polygon.remove) {
                p.polygon.remove()
              }
            } catch (err) {
              console.warn('Error removing polygon:', err)
            }
          }
        })
        polygonInstances.value = []

        // Add new polygons
        polygons.value.forEach(polygon => {
          displayPolygon(polygon)
        })

        console.log(`📐 Loaded ${polygons.value.length} facility polygons`)
      }
    } catch (error) {
      console.error('Error fetching polygons:', error)
      toast.error('Failed to load facility areas')
    }
  }

  // Display polygon on map
  const displayPolygon = (polygonData) => {
    if (!polygonData.coordinates || polygonData.coordinates.length === 0) return
    if (!map.value) return

    const existingPolygon = polygonInstances.value.find(p => p.id === polygonData.id)
    if (existingPolygon) {
      console.log('Polygon already exists, skipping duplicate:', polygonData.id)
      return
    }

    try {
      const coordinates = polygonData.coordinates.map(point => [point.lat, point.lng])

      const polygon = L.polygon(coordinates, {
        color: polygonData.color || '#3B82F6',
        fillColor: polygonData.fill_color || '#3B82F6',
        fillOpacity: polygonData.fill_opacity || 0.2,
        weight: 2,
        polygonId: polygonData.id
      }).addTo(map.value)

      // Simple tooltip showing facility name
      polygon.bindTooltip(polygonData.name, {
        permanent: false,
        direction: 'center',
        className: 'polygon-tooltip-guest'
      })

      // Simple popup with facility info
      const popupContent = `
        <div style="min-width:160px;padding:8px;">
          <div style="font-weight:700;margin-bottom:6px;color:#1f2937;">${polygonData.name}</div>
          ${polygonData.description ? `<div style="font-size:12px;color:#4B5563;margin-bottom:4px">${polygonData.description}</div>` : ''}
          <div style="font-size:11px;color:#6B7280">Type: ${polygonData.type || 'Building'}</div>
        </div>
      `
      polygon.bindPopup(popupContent)

      polygonInstances.value.push({
        id: polygonData.id,
        polygon,
        data: polygonData
      })
    } catch (error) {
      console.error('Error displaying polygon:', error, polygonData)
    }
  }

  // Cleanup polygons
  const cleanupPolygons = () => {
    polygonInstances.value.forEach(p => {
      if (p && p.polygon) {
        try {
          p.polygon.off()
          if (p.polygon.remove) {
            p.polygon.remove()
          }
        } catch (error) {
          console.warn('Error removing polygon:', error)
        }
      }
    })
    polygonInstances.value = []
  }

  return {
    polygons,
    polygonInstances,
    fetchPolygons,
    cleanupPolygons
  }
}
