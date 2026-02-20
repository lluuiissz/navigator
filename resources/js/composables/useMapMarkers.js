import { ref } from 'vue'
import L from 'leaflet'
import axios from 'axios'
import { useToast } from 'vue-toastification'

export function useMapMarkers(map, isAdmin) {
  const toast = useToast()

  const locations = ref([])
  const markerInstances = ref([])
  const draggingMarkerInstance = ref(null)

  const markerTypes = [
    'Administration',
    'Academic',
    'Student Services',
    'Services',
    'Facility',
    'Other'
  ]

  // Fetch markers from backend
  const fetchMarkers = async () => {
    try {
      const response = await axios.get('/markers', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      locations.value = response.data.map(marker => ({
        id: marker.id,
        name: marker.label,
        lng: parseFloat(marker.longitude),
        lat: parseFloat(marker.latitude),
        department: marker.type
      }))

      if (map.value) {
        // Clear existing markers
        markerInstances.value.forEach(m => {
          if (m && m.remove) m.remove()
        })
        markerInstances.value = []

        // Add new markers
        locations.value.forEach(location => {
          addMarkerToMap(location)
        })
      }
    } catch (error) {
      // console.error('Error fetching markers:', error)
      // Silently ignore fetch errors for markers
      toast.error('Failed to load markers')
    }
  }

  // Add marker to map
  const addMarkerToMap = (location) => {
    const marker = L.marker([location.lat, location.lng], {
      draggable: false,
      icon: L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      })
    })
      .addTo(map.value)
      .bindPopup(`
        <div class="p-2">
          <h3 class="font-bold text-sm">${location.name}</h3>
          <p class="text-xs text-gray-600">${location.department}</p>
          ${isAdmin ? `
            <div class="flex gap-2 mt-2">
              <button onclick="window.editMarker(${location.id})" class="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                Edit
              </button>
              <button onclick="window.deleteMarker(${location.id})" class="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                Delete
              </button>
            </div>
          ` : ''}
        </div>
      `)

    marker._markerData = location
    markerInstances.value.push(marker)

    if (!isAdmin) {
      marker.on('click', () => {
        window.dispatchEvent(new CustomEvent('markerClicked', { detail: location }))
      })
    }
  }

  // Enable marker dragging for editing
  const enableMarkerDragging = (markerId, onDragEnd) => {
    const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
    if (!markerObj) {
    //   toast.error('Marker not found')
      console.error('Marker not found')
      return
    }

    const originalLatLng = markerObj.getLatLng()
    markerObj.dragging.enable()
    markerObj.setOpacity(0.8)
    draggingMarkerInstance.value = markerObj

    markerObj.on('dragstart', () => {
      markerObj.setOpacity(0.6)
    })

    markerObj.on('dragend', (e) => {
      const newLatLng = e.target.getLatLng()
      markerObj.setOpacity(1)
      markerObj.dragging.disable()

      const marker = locations.value.find(m => m.id === markerId)
      if (marker && onDragEnd) {
        onDragEnd({
          id: markerId,
          oldCoords: {
            lat: parseFloat(originalLatLng.lat.toFixed(6)),
            lng: parseFloat(originalLatLng.lng.toFixed(6))
          },
          newCoords: {
            lat: parseFloat(newLatLng.lat.toFixed(6)),
            lng: parseFloat(newLatLng.lng.toFixed(6))
          },
          label: marker.name,
          type: marker.department
        })
      }
    })
  }

  return {
    locations,
    markerInstances,
    markerTypes,
    draggingMarkerInstance,
    fetchMarkers,
    addMarkerToMap,
    enableMarkerDragging
  }
}
