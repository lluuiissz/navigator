<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon, PencilIcon } from '@heroicons/vue/24/outline'
import Modal from '../Modal.vue'
import TextInput from '../TextInput.vue'
import axios from 'axios'
import { useToast } from 'vue-toastification'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'

const toast = useToast()

// --- Props ---
const props = defineProps({
  isAdmin: {
    type: Boolean,
    default: false
  },
  markers: {
    type: Array,
    default: () => []
  }
})

// ========== REACTIVE VARIABLES ==========
const map = ref(null)
const routingControl = ref(null)
const selectedLocation = ref('')
const searchQuery = ref('')
const showSearchResults = ref(false)
const isSearching = ref(false)
const userLocation = ref(null)
const isSubmitting = ref(false)
const userMarker = ref(null)
const userHeading = ref(0)

// Marker related variables
const locations = ref([])
const filteredLocations = ref([])
const markerInstances = ref([])

// Route related variables
const savedRoutes = ref([])
const routePolylines = ref([])
const drawnRoute = ref(null)
const routePoints = ref([])
const temporaryMarkers = ref([]) // Add this for cleanup
const isDrawing = ref(false)
const drawRouteMode = ref(false)
const editRouteMode = ref(false)
const selectedRoute = ref(null)
const editMarkers = ref([])

// Modal state variables
const showMarkerModal = ref(false)
const markerModalMode = ref('add')
const markerFormData = ref({
  id: null,
  latitude: '',
  longitude: '',
  label: '',
  type: ''
})

const showRouteModal = ref(false)
const routeModalMode = ref('add')
const routeFormData = ref({
  id: null,
  start_lat: '',
  start_lng: '',
  end_lat: '',
  end_lng: '',
  estimated_time: '',
  path_data: []
})

const showDeleteConfirmModal = ref(false)
const deleteModalData = ref({
  type: '',
  id: null,
  name: '',
  description: ''
})

const showPointEditModal = ref(false)
const editedPointData = ref({
  index: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  routeId: null
})

const showMarkerDragModal = ref(false)
const markerDragData = ref({
  id: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  label: '',
  type: ''
})

// UI state variables
const clickAddModeEnabled = ref(false)
let draggingMarkerInstance = null

// ========== COMPUTED PROPERTIES ==========
const startingPointDisplay = computed(() => {
  if (routeFormData.value.start_lat && routeFormData.value.start_lng) {
    try {
      return `${parseFloat(routeFormData.value.start_lat).toFixed(6)}, ${parseFloat(routeFormData.value.start_lng).toFixed(6)}`
    } catch (error) {
      return 'Invalid coordinates'
    }
  }
  return 'Not set'
})

const endingPointDisplay = computed(() => {
  if (routeFormData.value.end_lat && routeFormData.value.end_lng) {
    try {
      return `${parseFloat(routeFormData.value.end_lat).toFixed(6)}, ${parseFloat(routeFormData.value.end_lng).toFixed(6)}`
    } catch (error) {
      return 'Invalid coordinates'
    }
  }
  return 'Not set'
})

// ========== CONSTANTS ==========
const markerTypes = [
  'Administration',
  'Academic',
  'Student Services',
  'Services',
  'Facility',
  'Other'
]

// ========== MARKER METHODS ==========

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
    console.error('Error fetching markers:', error)
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
        ${props.isAdmin ? `
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

  if (!props.isAdmin) {
    marker.on('click', () => {
      selectedLocation.value = location
      routeToLocation()
    })
  }
}

// Enable marker dragging for editing
const enableMarkerDragging = (markerId) => {
  const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
  if (!markerObj) {
    toast.error('Marker not found')
    return
  }

  const originalLatLng = markerObj.getLatLng()
  markerObj.dragging.enable()
  markerObj.setOpacity(0.8)
  draggingMarkerInstance = markerObj

  markerObj.on('dragstart', () => {
    markerObj.setOpacity(0.6)
  })

  markerObj.on('dragend', (e) => {
    const newLatLng = e.target.getLatLng()
    markerObj.setOpacity(1)
    markerObj.dragging.disable()

    const marker = locations.value.find(m => m.id === markerId)
    if (marker) {
      showMarkerDragModal.value = true
      markerDragData.value = {
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
      }
    }
  })
}

// Save marker function
const saveMarker = async () => {
  if (isSubmitting.value) return

  if (!markerFormData.value.label || !markerFormData.value.type) {
    toast.error('Please fill in all required fields')
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      latitude: parseFloat(markerFormData.value.latitude),
      longitude: parseFloat(markerFormData.value.longitude),
      label: markerFormData.value.label,
      type: markerFormData.value.type
    }

    let response
    if (markerModalMode.value === 'edit') {
      response = await axios.put(`/markers/${markerFormData.value.id}`, payload)
      toast.success('Marker updated successfully!')

      const index = locations.value.findIndex(m => m.id === markerFormData.value.id)
      if (index !== -1) {
        locations.value[index] = {
          id: markerFormData.value.id,
          name: markerFormData.value.label,
          lng: parseFloat(markerFormData.value.longitude),
          lat: parseFloat(markerFormData.value.latitude),
          department: markerFormData.value.type
        }
      }
    } else {
      response = await axios.post('/markers', payload)
      toast.success('Marker added successfully!')

      const newLoc = {
        id: response.data.id,
        name: markerFormData.value.label,
        lng: parseFloat(markerFormData.value.longitude),
        lat: parseFloat(markerFormData.value.latitude),
        department: markerFormData.value.type
      }
      locations.value.push(newLoc)
    }

    // Refresh markers on map
    await fetchMarkers()

    closeMarkerModal()
    if (clickAddModeEnabled.value) {
      clickAddModeEnabled.value = false
      map.value.getContainer().style.cursor = ''
    }
    draggingMarkerInstance = null

  } catch (error) {
    console.error('Error saving marker:', error)
    toast.error(error.response?.data?.message || 'Failed to save marker')
  } finally {
    isSubmitting.value = false
  }
}

// ========== ROUTE METHODS ==========

// Comprehensive route cleanup and refresh method
const refreshRoutes = async () => {
  try {
    // 1. Clear all existing route polylines
    routePolylines.value.forEach(route => {
      if (route.polyline && typeof route.polyline.remove === 'function') {
        try {
          route.polyline.remove()
        } catch (error) {
          console.warn('Error removing polyline:', error)
        }
      }
    })
    routePolylines.value = []

    // 2. Clear all edit markers
    editMarkers.value.forEach(marker => {
      if (marker && typeof marker.remove === 'function') {
        try {
          marker.remove()
        } catch (error) {
          console.warn('Error removing edit marker:', error)
        }
      }
    })
    editMarkers.value = []

    // 3. Clear temporary drawing elements
    if (drawnRoute.value && typeof drawnRoute.value.remove === 'function') {
      try {
        drawnRoute.value.remove()
        drawnRoute.value = null
      } catch (error) {
        console.warn('Error removing drawn route:', error)
      }
    }

    // 4. Clear temporary markers (circle markers from drawing)
    temporaryMarkers.value.forEach(marker => {
      if (marker && typeof marker.remove === 'function') {
        try {
          marker.remove()
        } catch (error) {
          console.warn('Error removing temporary marker:', error)
        }
      }
    })
    temporaryMarkers.value = []

    // 5. Reset route points
    routePoints.value = []

    // 6. Reset editing states
    if (editRouteMode.value) {
      if (selectedRoute.value && selectedRoute.value.polyline) {
        selectedRoute.value.polyline.off('click')
        selectedRoute.value.polyline.setStyle({ color: '#3B82F6', weight: 4 })
      }
      editRouteMode.value = false
      selectedRoute.value = null
    }

    // 7. Reset drawing states
    if (drawRouteMode.value) {
      drawRouteMode.value = false
      isDrawing.value = false
      if (map.value) {
        map.value.getContainer().style.cursor = ''
      }
    }

    // 8. Clear routing control
    if (routingControl.value) {
      try {
        map.value.removeControl(routingControl.value)
        routingControl.value = null
      } catch (error) {
        console.warn('Error removing routing control:', error)
      }
    }

    // 9. Reset form data
    routeFormData.value = {
      id: null,
      start_lat: '',
      start_lng: '',
      end_lat: '',
      end_lng: '',
      estimated_time: '',
      path_data: []
    }

    // 10. Clear modal states
    showRouteModal.value = false
    showPointEditModal.value = false
    routeModalMode.value = 'add'

    // 11. Reset edited point data
    editedPointData.value = {
      index: null,
      oldCoords: { lat: null, lng: null },
      newCoords: { lat: null, lng: null },
      routeId: null
    }

    console.log('Route cleanup completed successfully')

  } catch (error) {
    console.error('Error during route cleanup:', error)
    toast.error('Failed to refresh routes')
  }
}

const fetchRoutes = async () => {
  try {
    // Fetch new routes from backend first
    const response = await axios.get('/routes', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    const newRoutes = response.data

    // Create a quick lookup of current route IDs
    const currentRouteIds = new Set(newRoutes.map(route => route.id))

    // Step 1: Remove routes that are no longer in the data
    const routesToRemove = []
    routePolylines.value.forEach(routePoly => {
      if (!currentRouteIds.has(routePoly.id)) {
        routesToRemove.push(routePoly)
      }
    })

    // Remove outdated routes from map and array
    routesToRemove.forEach(routePoly => {
      if (routePoly.polyline && routePoly.polyline.remove) {
        routePoly.polyline.remove()
      }
      const index = routePolylines.value.indexOf(routePoly)
      if (index > -1) {
        routePolylines.value.splice(index, 1)
      }
    })

    // Step 2: Update existing routes and add new ones
    newRoutes.forEach(newRoute => {
      if (!newRoute.path_data || newRoute.path_data.length === 0) {
        console.warn('Route has no path data:', newRoute)
        return
      }

      // Check if this route already exists
      const existingRoute = routePolylines.value.find(r => r.id === newRoute.id)

      if (existingRoute) {
        // Update existing route - only if data has changed
        const existingPathData = Array.isArray(existingRoute.data.path_data)
          ? existingRoute.data.path_data
          : JSON.parse(existingRoute.data.path_data || '[]')

        const newPathData = Array.isArray(newRoute.path_data)
          ? newRoute.path_data
          : JSON.parse(newRoute.path_data || '[]')

        // Check if route data has actually changed
        const hasChanged = JSON.stringify(existingPathData) !== JSON.stringify(newPathData) ||
                          existingRoute.data.estimated_time !== newRoute.estimated_time

        if (hasChanged) {
          // Update the polyline
          const pathCoordinates = newPathData.map(point => [point.lat, point.lng])
          existingRoute.polyline.setLatLngs(pathCoordinates)

          // Update popup content
          const startPoint = `${parseFloat(newRoute.start_lat).toFixed(4)}, ${parseFloat(newRoute.start_lng).toFixed(4)}`
          const endPoint = `${parseFloat(newRoute.end_lat).toFixed(4)}, ${parseFloat(newRoute.end_lng).toFixed(4)}`

          existingRoute.polyline.setPopupContent(`
            <div class="p-3">
              <h3 class="font-bold text-sm mb-2">Route ${newRoute.id}</h3>
              <p class="text-xs text-gray-600 mb-1">Start: ${startPoint}</p>
              <p class="text-xs text-gray-600 mb-2">End: ${endPoint}</p>
              <p class="text-xs text-gray-600 mb-3">Est. Time: ${newRoute.estimated_time}</p>
              ${props.isAdmin ? `
                <div class="flex gap-2">
                  <button onclick="window.editRoute(${newRoute.id})" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                    Edit
                  </button>
                  <button onclick="window.deleteRoute(${newRoute.id})" class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
                    Delete
                  </button>
                </div>
              ` : ''}
            </div>
          `)

          // Update stored data
          existingRoute.data = newRoute
        }
      } else {
        // Add new route
        displayRoute(newRoute)
      }
    })

    // Update the savedRoutes array
    savedRoutes.value = newRoutes

    console.log(`🔄 Routes updated: +${newRoutes.length - (savedRoutes.value.length - routesToRemove.length)} new, -${routesToRemove.length} removed, ${savedRoutes.value.length - routesToRemove.length} existing`)

  } catch (error) {
    console.error('Error fetching routes:', error)
    toast.error('Failed to load routes')
  }
}

// Display a saved route on the map
const displayRoute = (route) => {
  if (!route.path_data || route.path_data.length === 0) {
    console.warn('Route has no path data:', route)
    return
  }

  // Check if route already exists to avoid duplicates
  const existingRoute = routePolylines.value.find(r => r.id === route.id)
  if (existingRoute) {
    console.log('Route already exists, skipping duplicate:', route.id)
    return
  }

  try {
    const pathCoordinates = route.path_data.map(point => [point.lat, point.lng])

    const polyline = L.polyline(pathCoordinates, {
      color: '#3B82F6',
      weight: 4,
      opacity: 0.7,
      routeId: route.id
    }).addTo(map.value)

    const startPoint = `${parseFloat(route.start_lat).toFixed(4)}, ${parseFloat(route.start_lng).toFixed(4)}`
    const endPoint = `${parseFloat(route.end_lat).toFixed(4)}, ${parseFloat(route.end_lng).toFixed(4)}`

    polyline.bindPopup(`
      <div class="p-3">
        <h3 class="font-bold text-sm mb-2">Route ${route.id}</h3>
        <p class="text-xs text-gray-600 mb-1">Start: ${startPoint}</p>
        <p class="text-xs text-gray-600 mb-2">End: ${endPoint}</p>
        <p class="text-xs text-gray-600 mb-3">Est. Time: ${route.estimated_time}</p>
        ${props.isAdmin ? `
          <div class="flex gap-2">
            <button onclick="window.editRoute(${route.id})" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
              Edit
            </button>
            <button onclick="window.deleteRoute(${route.id})" class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">
              Delete
            </button>
          </div>
        ` : ''}
      </div>
    `)

    routePolylines.value.push({ id: route.id, polyline, data: route })
  } catch (error) {
    console.error('Error displaying route:', error, route)
  }
}

// Route editing functionality
const enableRouteEditing = (routeObj) => {
  editRouteMode.value = true
  drawRouteMode.value = false
  clickAddModeEnabled.value = false

  // Clear any existing edit markers
  editMarkers.value.forEach(marker => marker.remove())
  editMarkers.value = []

  routeObj.polyline.setStyle({ color: '#EF4444', weight: 5 })

  routeFormData.value.path_data.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-route-marker',
        html: `<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${index + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map.value)

    const originalLatLng = L.latLng(point.lat, point.lng)

    marker.on('dragstart', () => {
      marker.setOpacity(0.7)
    })

    marker.on('drag', (e) => {
      const newLatLng = e.target.getLatLng()
      routeFormData.value.path_data[index] = {
        lat: newLatLng.lat,
        lng: newLatLng.lng
      }

      if (index === 0) {
        routeFormData.value.start_lat = newLatLng.lat
        routeFormData.value.start_lng = newLatLng.lng
      } else if (index === routeFormData.value.path_data.length - 1) {
        routeFormData.value.end_lat = newLatLng.lat
        routeFormData.value.end_lng = newLatLng.lng
      }

      updateEditPolyline()
    })

    marker.on('dragend', (e) => {
      marker.setOpacity(1)
      const newLatLng = e.target.getLatLng()

      if (index === 0) {
        toast.success(`Starting point updated to: ${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`)
      } else if (index === routeFormData.value.path_data.length - 1) {
        toast.success(`Ending point updated to: ${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}`)
      } else {
        toast.success(`Point ${index + 1} position updated`)
      }

      const distance = originalLatLng.distanceTo(newLatLng)
      if (distance > 50) {
        showPointEditModal.value = true
        editedPointData.value = {
          index: index,
          oldCoords: { lat: originalLatLng.lat, lng: originalLatLng.lng },
          newCoords: { lat: newLatLng.lat, lng: newLatLng.lng },
          routeId: routeFormData.value.id
        }
      }
    })

    marker.on('contextmenu', (e) => {
      e.originalEvent.preventDefault()
      if (routeFormData.value.path_data.length > 2) {
        routeFormData.value.path_data.splice(index, 1)
        marker.remove()
        editMarkers.value.splice(index, 1)

        if (routeFormData.value.path_data.length > 0) {
          routeFormData.value.start_lat = routeFormData.value.path_data[0].lat
          routeFormData.value.start_lng = routeFormData.value.path_data[0].lng
          routeFormData.value.end_lat = routeFormData.value.path_data[routeFormData.value.path_data.length - 1].lat
          routeFormData.value.end_lng = routeFormData.value.path_data[routeFormData.value.path_data.length - 1].lng
        }

        updateEditPolyline()
        updateMarkerNumbers()
        toast.info('Point removed - start/end points updated automatically')
      } else {
        toast.error('Route must have at least 2 points')
      }
    })

    editMarkers.value.push(marker)
  })

  // Add click handler to polyline for adding new points
  routeObj.polyline.on('click', (e) => {
    const clickLatLng = e.latlng

    let minDist = Infinity
    let insertIndex = 0

    for (let i = 0; i < routeFormData.value.path_data.length - 1; i++) {
      const p1 = L.latLng(routeFormData.value.path_data[i].lat, routeFormData.value.path_data[i].lng)
      const p2 = L.latLng(routeFormData.value.path_data[i + 1].lat, routeFormData.value.path_data[i + 1].lng)
      const dist = L.LineUtil.pointToSegmentDistance(
        map.value.latLngToLayerPoint(clickLatLng),
        map.value.latLngToLayerPoint(p1),
        map.value.latLngToLayerPoint(p2)
      )

      if (dist < minDist) {
        minDist = dist
        insertIndex = i + 1
      }
    }

    routeFormData.value.path_data.splice(insertIndex, 0, {
      lat: clickLatLng.lat,
      lng: clickLatLng.lng
    })

    const marker = L.marker([clickLatLng.lat, clickLatLng.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-route-marker',
        html: `<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${insertIndex + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map.value)

    const originalLatLng = L.latLng(clickLatLng.lat, clickLatLng.lng)

    marker.on('dragstart', () => {
      marker.setOpacity(0.7)
    })

    marker.on('drag', (e) => {
      const newLatLng = e.target.getLatLng()
      routeFormData.value.path_data[insertIndex] = {
        lat: newLatLng.lat,
        lng: newLatLng.lng
      }

      if (insertIndex === 0) {
        routeFormData.value.start_lat = newLatLng.lat
        routeFormData.value.start_lng = newLatLng.lng
      } else if (insertIndex === routeFormData.value.path_data.length - 1) {
        routeFormData.value.end_lat = newLatLng.lat
        routeFormData.value.end_lng = newLatLng.lng
      }

      updateEditPolyline()
    })

    marker.on('dragend', (e) => {
      marker.setOpacity(1)
      const newLatLng = e.target.getLatLng()
      toast.success(`New point added at position ${insertIndex + 1}`)

      const distance = originalLatLng.distanceTo(newLatLng)
      if (distance > 50) {
        showPointEditModal.value = true
        editedPointData.value = {
          index: insertIndex,
          oldCoords: { lat: originalLatLng.lat, lng: originalLatLng.lng },
          newCoords: { lat: newLatLng.lat, lng: newLatLng.lng },
          routeId: routeFormData.value.id
        }
      }
    })

    marker.on('contextmenu', (e) => {
      e.originalEvent.preventDefault()
      if (routeFormData.value.path_data.length > 2) {
        routeFormData.value.path_data.splice(insertIndex, 1)
        marker.remove()
        editMarkers.value.splice(insertIndex, 1)

        if (routeFormData.value.path_data.length > 0) {
          routeFormData.value.start_lat = routeFormData.value.path_data[0].lat
          routeFormData.value.start_lng = routeFormData.value.path_data[0].lng
          routeFormData.value.end_lat = routeFormData.value.path_data[routeFormData.value.path_data.length - 1].lat
          routeFormData.value.end_lng = routeFormData.value.path_data[routeFormData.value.path_data.length - 1].lng
        }

        updateEditPolyline()
        updateMarkerNumbers()
        toast.info('Point removed - coordinates updated automatically')
      } else {
        toast.error('Route must have at least 2 points')
      }
    })

    editMarkers.value.splice(insertIndex, 0, marker)
    updateEditPolyline()
    updateMarkerNumbers()
    toast.success('Point added - you can now drag it to adjust position')
  })

  toast.info('Route editing enabled! Drag points to adjust, click line to add points, right-click to remove.')
}

// Update marker numbers during editing
const updateMarkerNumbers = () => {
  editMarkers.value.forEach((marker, index) => {
    marker.setIcon(L.divIcon({
      className: 'edit-route-marker',
      html: `<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${index + 1}</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    }))
  })
}

// Update polyline during editing
const updateEditPolyline = () => {
  if (!selectedRoute.value) return
  const pathCoordinates = routeFormData.value.path_data.map(point => [point.lat, point.lng])
  selectedRoute.value.polyline.setLatLngs(pathCoordinates)
}

// Save route function
const saveRoute = async () => {
  if (isSubmitting.value) return

  if (!routeFormData.value.estimated_time || routeFormData.value.path_data.length < 2) {
    toast.error('Please fill in all required fields and ensure route has at least 2 points')
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      start_lat: parseFloat(routeFormData.value.start_lat),
      start_lng: parseFloat(routeFormData.value.start_lng),
      end_lat: parseFloat(routeFormData.value.end_lat),
      end_lng: parseFloat(routeFormData.value.end_lng),
      estimated_time: routeFormData.value.estimated_time,
      path_data: routeFormData.value.path_data
    }

    let response
    if (routeModalMode.value === 'edit') {
      response = await axios.put(`/routes/${routeFormData.value.id}`, payload)
      toast.success('Route updated successfully!')
      editRouteMode.value = false

      const index = savedRoutes.value.findIndex(r => r.id === routeFormData.value.id)
      if (index !== -1) {
        savedRoutes.value[index] = response.data
      }

      if (selectedRoute.value) {
        selectedRoute.value.data = response.data
      }
    } else {
      response = await axios.post('/routes', payload)
      toast.success('Route saved successfully!')
      savedRoutes.value.push(response.data)
      displayRoute(response.data)
    }

    cancelEditRoute()

  } catch (error) {
    console.error('Error saving route:', error)
    toast.error(error.response?.data?.message || 'Failed to save route')
  } finally {
    isSubmitting.value = false
  }
}

// Route drawing functions
const startDrawingRoute = () => {
  isDrawing.value = true
  routePoints.value = []
  temporaryMarkers.value = [] // Clear temporary markers

  if (drawnRoute.value) {
    drawnRoute.value.remove()
  }

  map.value.getContainer().style.cursor = 'crosshair'
}

const addRoutePoint = (latlng) => {
  routePoints.value.push(latlng)

  if (routePoints.value.length === 1) {
    routeFormData.value.start_lat = latlng.lat
    routeFormData.value.start_lng = latlng.lng
    toast.success('Starting point set!')
  }

  routeFormData.value.end_lat = latlng.lat
  routeFormData.value.end_lng = latlng.lng

  if (drawnRoute.value) {
    drawnRoute.value.remove()
  }

  drawnRoute.value = L.polyline(routePoints.value, {
    color: '#EF4444',
    weight: 4,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(map.value)

  // Store temporary marker for cleanup
  const circleMarker = L.circleMarker(latlng, {
    radius: 5,
    fillColor: '#EF4444',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(map.value)

  temporaryMarkers.value.push(circleMarker)
}

const finishDrawingRoute = () => {
  if (routePoints.value.length < 2) {
    toast.error('Route must have at least 2 points')
    return
  }

  isDrawing.value = false
  drawRouteMode.value = false
  map.value.getContainer().style.cursor = ''

  routeFormData.value.path_data = routePoints.value.map(point => ({
    lat: point.lat,
    lng: point.lng
  }))

  routeModalMode.value = 'add'
  showRouteModal.value = true
}

const cancelDrawingRoute = () => {
  isDrawing.value = false
  drawRouteMode.value = false
  routePoints.value = []

  // Clean up temporary markers
  temporaryMarkers.value.forEach(marker => {
    if (marker && marker.remove) marker.remove()
  })
  temporaryMarkers.value = []

  if (drawnRoute.value) {
    drawnRoute.value.remove()
    drawnRoute.value = null
  }

  map.value.getContainer().style.cursor = ''

  routeFormData.value = {
    id: null,
    start_lat: '',
    start_lng: '',
    end_lat: '',
    end_lng: '',
    estimated_time: '',
    path_data: []
  }
}

const cancelEditRoute = (forceCancel = false) => {
  if (!forceCancel && editRouteMode.value) {
    showRouteModal.value = false
    return
  }

  if (selectedRoute.value) {
    selectedRoute.value.polyline.setStyle({ color: '#3B82F6', weight: 4 })
    selectedRoute.value.polyline.off('click')
  }

  editMarkers.value.forEach(marker => marker.remove())
  editMarkers.value = []

  editRouteMode.value = false
  selectedRoute.value = null
  showRouteModal.value = false
  showPointEditModal.value = false

  routeFormData.value = {
    id: null,
    start_lat: '',
    start_lng: '',
    end_lat: '',
    end_lng: '',
    estimated_time: '',
    path_data: []
  }
  routeModalMode.value = 'add'

  if (drawnRoute.value) {
    drawnRoute.value.remove()
    drawnRoute.value = null
  }

  routePoints.value = []
}

// ========== UI INTERACTION METHODS ==========

// Map click handler
const handleMapClick = (e) => {
  if (!props.isAdmin) return

  if (clickAddModeEnabled.value) {
    markerModalMode.value = 'add'
    markerFormData.value.longitude = e.latlng.lng.toFixed(6)
    markerFormData.value.latitude = e.latlng.lat.toFixed(6)
    showMarkerModal.value = true
  }

  if (drawRouteMode.value && isDrawing.value) {
    addRoutePoint(e.latlng)
  }
}

// Mode toggles
const toggleClickAddMode = () => {
  clickAddModeEnabled.value = !clickAddModeEnabled.value
  if (clickAddModeEnabled.value) {
    drawRouteMode.value = false
    map.value.getContainer().style.cursor = 'crosshair'
    toast.info('Click on the map to add a new location')
  } else {
    map.value.getContainer().style.cursor = ''
  }
}

const toggleDrawRouteMode = () => {
  if (editRouteMode.value) {
    toast.error('Please finish editing current route first')
    return
  }

  drawRouteMode.value = !drawRouteMode.value
  if (drawRouteMode.value) {
    clickAddModeEnabled.value = false
    startDrawingRoute()
    toast.info('Click on map to draw route path')
  } else {
    cancelDrawingRoute()
  }
}

// Search functionality
const selectSearchResult = (location) => {
  selectedLocation.value = location
  searchQuery.value = location.name
  showSearchResults.value = false
  map.value.flyTo([location.lat, location.lng], 17)

  if (!props.isAdmin) {
    routeToLocation()
  }
}

const clearSearch = () => {
  searchQuery.value = ''
  selectedLocation.value = ''
  showSearchResults.value = false

  if (routingControl.value) {
    map.value.removeControl(routingControl.value)
    routingControl.value = null
  }
}

const routeToLocation = () => {
  if (!selectedLocation.value || !userLocation.value) return

  if (routingControl.value) {
    map.value.removeControl(routingControl.value)
  }

  routingControl.value = L.Routing.control({
    waypoints: [
      L.latLng(userLocation.value.lat, userLocation.value.lng),
      L.latLng(selectedLocation.value.lat, selectedLocation.value.lng)
    ],
    routeWhileDragging: false,
    show: false
  }).addTo(map.value)
}

// ========== MODAL METHODS ==========

// Marker modal methods
const closeMarkerModal = () => {
  showMarkerModal.value = false
  markerFormData.value = { id: null, latitude: '', longitude: '', label: '', type: '' }
  markerModalMode.value = 'add'
}

const confirmMarkerReposition = () => {
  markerModalMode.value = 'edit'
  markerFormData.value = {
    id: markerDragData.value.id,
    latitude: markerDragData.value.newCoords.lat.toString(),
    longitude: markerDragData.value.newCoords.lng.toString(),
    label: markerDragData.value.label,
    type: markerDragData.value.type
  }
  showMarkerDragModal.value = false
  showMarkerModal.value = true
}

const revertMarkerPosition = () => {
  if (draggingMarkerInstance) {
    draggingMarkerInstance.setLatLng([
      markerDragData.value.oldCoords.lat,
      markerDragData.value.oldCoords.lng
    ])
  }
  closeMarkerDragModal()
  toast.info('Marker position reverted')
}

const closeMarkerDragModal = () => {
  showMarkerDragModal.value = false
  markerDragData.value = {
    id: null,
    oldCoords: { lat: null, lng: null },
    newCoords: { lat: null, lng: null },
    label: '',
    type: ''
  }
  draggingMarkerInstance = null
}

// Point edit modal methods
const savePointChanges = () => {
  if (editedPointData.value.index === 0) {
    routeFormData.value.start_lat = editedPointData.value.newCoords.lat.toString()
    routeFormData.value.start_lng = editedPointData.value.newCoords.lng.toString()
  } else if (editedPointData.value.index === routeFormData.value.path_data.length - 1) {
    routeFormData.value.end_lat = editedPointData.value.newCoords.lat.toString()
    routeFormData.value.end_lng = editedPointData.value.newCoords.lng.toString()
  }

  showPointEditModal.value = false
  editedPointData.value = {
    index: null,
    oldCoords: { lat: null, lng: null },
    newCoords: { lat: null, lng: null },
    routeId: null
  }
  toast.success('Point position updated')
}

const revertPointChanges = () => {
  if (editedPointData.value.index !== null) {
    routeFormData.value.path_data[editedPointData.value.index] = {
      lat: editedPointData.value.oldCoords.lat,
      lng: editedPointData.value.oldCoords.lng
    }

    if (editedPointData.value.index === 0) {
      routeFormData.value.start_lat = editedPointData.value.oldCoords.lat.toString()
      routeFormData.value.start_lng = editedPointData.value.oldCoords.lng.toString()
    } else if (editedPointData.value.index === routeFormData.value.path_data.length - 1) {
      routeFormData.value.end_lat = editedPointData.value.oldCoords.lat.toString()
      routeFormData.value.end_lng = editedPointData.value.oldCoords.lng.toString()
    }

    if (editMarkers.value[editedPointData.value.index]) {
      editMarkers.value[editedPointData.value.index].setLatLng([
        editedPointData.value.oldCoords.lat,
        editedPointData.value.oldCoords.lng
      ])
    }

    updateEditPolyline()
    showPointEditModal.value = false
    editedPointData.value = {
      index: null,
      oldCoords: { lat: null, lng: null },
      newCoords: { lat: null, lng: null },
      routeId: null
    }
    toast.info('Point position reverted')
  }
}

// Delete confirmation methods
const confirmDelete = async () => {
  if (!deleteModalData.value.id || isSubmitting.value) return

  isSubmitting.value = true

  try {
    if (deleteModalData.value.type === 'route') {
      await axios.delete(`/routes/${deleteModalData.value.id}`)
      toast.success('Route deleted successfully!')

      const routeObj = routePolylines.value.find(r => r.id === deleteModalData.value.id)
      if (routeObj) {
        routeObj.polyline.remove()
      }

      routePolylines.value = routePolylines.value.filter(r => r.id !== deleteModalData.value.id)
      savedRoutes.value = savedRoutes.value.filter(r => r.id !== deleteModalData.value.id)
    } else {
      await axios.delete(`/markers/${deleteModalData.value.id}`)
      toast.success('Marker deleted successfully!')

      locations.value = locations.value.filter(m => m.id !== deleteModalData.value.id)
      await fetchMarkers() // This will properly refresh markers
    }

    closeDeleteModal()

  } catch (error) {
    console.error('Error deleting:', error)
    toast.error(error.response?.data?.message || `Failed to delete ${deleteModalData.value.type}`)
  } finally {
    isSubmitting.value = false
  }
}

const closeDeleteModal = () => {
  showDeleteConfirmModal.value = false
  deleteModalData.value = {
    type: '',
    id: null,
    name: '',
    description: ''
  }
}

// ========== LOCATION & COMPASS METHODS ==========

const getUserLocation = () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation.value = {
          lng: position.coords.longitude,
          lat: position.coords.latitude
        }
        updateUserMarker()
      },
      (error) => {
        console.error('Geolocation error:', error)
      }
    )
  }
}

const updateUserMarker = () => {
  if (!userLocation.value || !map.value) return

  try {
    if (userMarker.value && typeof userMarker.value.setLatLng === 'function') {
      userMarker.value.setLatLng([userLocation.value.lat, userLocation.value.lng])
      const markerElement = userMarker.value.getElement()
      if (markerElement) {
        const svg = markerElement.querySelector('svg')
        if (svg) {
          svg.style.transform = `rotate(${userHeading.value}deg)`
        }
      }
    } else {
      userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
        title: 'You',
        icon: L.divIcon({
          className: 'user-marker',
          html: `<div style="background: #4CAF50; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${userHeading.value}deg); transition: transform 0.3s ease;"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map.value)

      const popupContent = `<div style="font-size: 13px; color: #1f2937; font-weight: 500;">You</div>`
      userMarker.value.bindPopup(popupContent, { offset: [0, -12], closeButton: false })
    }
  } catch (error) {
    console.error('Error updating user marker:', error)
    userMarker.value = null
  }
}

const startCompassTracking = () => {
  if ('ondeviceorientationabsolute' in window) {
    window.addEventListener('deviceorientationabsolute', handleOrientation, true)
  } else if ('ondeviceorientation' in window) {
    window.addEventListener('deviceorientation', handleOrientation, true)
  }
}

const handleOrientation = (event) => {
  let heading = event.alpha || event.webkitCompassHeading || 0

  if (event.webkitCompassHeading) {
    heading = event.webkitCompassHeading
  } else if (event.alpha) {
    heading = 360 - event.alpha
  }

  userHeading.value = heading

  if (userMarker.value) {
    const markerElement = userMarker.value.getElement()
    if (markerElement) {
      const svg = markerElement.querySelector('svg')
      if (svg) {
        svg.style.transform = `rotate(${heading}deg)`
      }
    }
  }
}

// ========== WINDOW FUNCTIONS ==========

window.editMarker = (markerId) => {
  const marker = locations.value.find(m => m.id === markerId)
  if (!marker) {
    toast.error('Marker not found')
    return
  }
   // Close the popup before starting edit
  const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
  if (markerObj && markerObj.closePopup) {
    markerObj.closePopup()
  }
  enableMarkerDragging(markerId)
}

window.deleteMarker = (markerId) => {
  const marker = locations.value.find(m => m.id === markerId)
  if (!marker) {
    toast.error('Marker not found')
    return
  }

   const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
  if (markerObj && markerObj.closePopup) {
    markerObj.closePopup()
  }

  deleteModalData.value = {
    type: 'marker',
    id: markerId,
    name: marker.name,
    description: `${marker.department} - This marker will be permanently removed from the map.`
  }

  showDeleteConfirmModal.value = true
}

window.editRoute = (routeId) => {
  const routeObj = routePolylines.value.find(r => r.id === routeId)
  if (!routeObj) {
    toast.error('Route not found')
    return
  }

    // Close the popup before starting edit
  if (routeObj.polyline && routeObj.polyline.closePopup) {
    routeObj.polyline.closePopup()
  }

  selectedRoute.value = routeObj
  routeModalMode.value = 'edit'

  const pathData = Array.isArray(routeObj.data.path_data)
    ? routeObj.data.path_data
    : JSON.parse(routeObj.data.path_data || '[]')

  routeFormData.value = {
    id: routeObj.data.id,
    start_lat: routeObj.data.start_lat,
    start_lng: routeObj.data.start_lng,
    end_lat: routeObj.data.end_lat,
    end_lng: routeObj.data.end_lng,
    estimated_time: routeObj.data.estimated_time,
    path_data: pathData
  }

  enableRouteEditing(routeObj)
}

window.deleteRoute = (routeId) => {
  const route = savedRoutes.value.find(r => r.id === routeId)
  if (!route) {
    toast.error('Route not found')
    return
  }

   // Close the popup before showing delete modal
  const routeObj = routePolylines.value.find(r => r.id === routeId)
  if (routeObj && routeObj.polyline && routeObj.polyline.closePopup) {
    routeObj.polyline.closePopup()
  }

  deleteModalData.value = {
    type: 'route',
    id: routeId,
    name: `Route ${routeId}`,
    description: `Start: ${parseFloat(route.start_lat).toFixed(4)}, ${parseFloat(route.start_lng).toFixed(4)} | End: ${parseFloat(route.end_lat).toFixed(4)}, ${parseFloat(route.end_lng).toFixed(4)}`
  }

  showDeleteConfirmModal.value = true
}

// ========== LIFECYCLE & WATCHERS ==========

onMounted(() => {
  map.value = L.map('map').setView([8.16953, 126.00306], 16)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 50,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value)

  getUserLocation()
  startCompassTracking()

  fetchMarkers()
  fetchRoutes()

  if (props.isAdmin) {
    map.value.on('click', handleMapClick)
  }
})

watch(searchQuery, (query) => {
  if (query.length > 0) {
    isSearching.value = true
    filteredLocations.value = locations.value.filter(loc =>
      loc.name.toLowerCase().includes(query.toLowerCase()) ||
      loc.department.toLowerCase().includes(query.toLowerCase())
    )
    showSearchResults.value = true
  } else {
    showSearchResults.value = false
    filteredLocations.value = []
  }
  isSearching.value = false
})

watch(() => routeFormData.value.start_lat, (newVal) => {
  console.log('Start latitude updated:', newVal)
})

watch(() => routeFormData.value.start_lng, (newVal) => {
  console.log('Start longitude updated:', newVal)
})

watch(() => routeFormData.value.end_lat, (newVal) => {
  console.log('End latitude updated:', newVal)
})

watch(() => routeFormData.value.end_lng, (newVal) => {
  console.log('End longitude updated:', newVal)
})
let routeRefreshTimeout = null
// Real-time updates
onMounted(() => {
  if(!window.Echo){
    console.warn('Laravel Echo is not available. Real-time updates will be disabled.')
    return
  }

  window.Echo.channel('main-channel')
    .listen('.MainEvent', (e) => {
      console.log('Received MainEvent:', e)
      if(e.type === 'marker'){
        fetchMarkers()
      } else if(e.type === 'route'){
        // Debounce route updates to prevent rapid refreshes
        if (routeRefreshTimeout) {
          clearTimeout(routeRefreshTimeout)
        }
        routeRefreshTimeout = setTimeout(() => {
          fetchRoutes()
          routeRefreshTimeout = null
        }, 300) // 300ms debounce
      }
    })
})
</script>
<template>
  <div class="relative w-full h-screen">
    <!-- Map Container -->
    <div id="map" class="w-full h-full"></div>

    <!-- Search Bar -->
    <div class="absolute top-4 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4">
      <div class="bg-white rounded-lg shadow-lg">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search for rooms, offices, or buildings..."
            class="w-full pl-10 pr-10 py-3 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon class="h-5 w-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div v-if="showSearchResults" class="mt-1 max-h-60 overflow-y-auto border-t border-gray-200">
          <div v-if="isSearching" class="p-4 text-center text-gray-500 text-sm">Searching...</div>
          <div v-else-if="filteredLocations.length === 0" class="p-4 text-center text-gray-500 text-sm">
            No locations found
          </div>
          <div v-else>
            <button
              v-for="location in filteredLocations"
              :key="location.id"
              @click="selectSearchResult(location)"
              class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div class="font-medium text-sm text-gray-900">{{ location.name }}</div>
              <div class="text-xs text-gray-500 mt-1">{{ location.department }}</div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin Controls -->
    <div v-if="isAdmin" class="absolute top-4 right-4 z-[1000] flex gap-2">
      <button
        @click="toggleClickAddMode"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-all',
          clickAddModeEnabled ? 'bg-green-600 text-white' : 'bg-white text-gray-700'
        ]"
      >
        <MapPinIcon class="h-5 w-5" />
        <span class="hidden sm:inline">{{ clickAddModeEnabled ? 'Adding...' : 'Add Location' }}</span>
      </button>

      <button
        @click="toggleDrawRouteMode"
        :class="[
          'flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm transition-all',
          drawRouteMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'
        ]"
        :disabled="editRouteMode"
      >
        <PencilIcon class="h-5 w-5" />
        <span class="hidden sm:inline">{{ drawRouteMode ? 'Drawing...' : 'Draw Route' }}</span>
      </button>

      <button
        v-if="isDrawing"
        @click="finishDrawingRoute"
        class="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm bg-green-600 text-white"
      >
        Finish Route
      </button>

      <button
        v-if="isDrawing"
        @click="cancelDrawingRoute"
        class="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm bg-red-600 text-white"
      >
        Cancel
      </button>

      <button
        v-if="editRouteMode"
        @click="saveRoute"
        class="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm bg-blue-600 text-white"
      >
        Save Changes
      </button>

      <button
        v-if="editRouteMode"
        @click="cancelEditRoute"
        class="flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg font-medium text-sm bg-gray-600 text-white"
      >
        Cancel Edit
      </button>
    </div>

    <!-- Shared Marker Modal (Add/Edit) -->
    <Modal :show="showMarkerModal" @close="closeMarkerModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ markerModalMode === 'edit' ? 'Edit Marker' : 'Create New Marker' }}
          </h3>
        </div>

        <div class="px-6 py-5">
          <!-- Show location change summary for edit mode -->
          <div v-if="markerModalMode === 'edit' && markerDragData.oldCoords.lat" class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <p class="text-sm text-blue-800 font-medium mb-2">Location Change Summary</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p class="text-xs text-blue-700 font-medium">Original Location</p>
                <p class="text-xs text-blue-600">Lat: {{ markerDragData.oldCoords.lat?.toFixed(6) }}</p>
                <p class="text-xs text-blue-600">Lng: {{ markerDragData.oldCoords.lng?.toFixed(6) }}</p>
              </div>
              <div>
                <p class="text-xs text-green-700 font-medium">New Location</p>
                <p class="text-xs text-green-600">Lat: {{ markerDragData.newCoords.lat?.toFixed(6) }}</p>
                <p class="text-xs text-green-600">Lng: {{ markerDragData.newCoords.lng?.toFixed(6) }}</p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Latitude</label>
              <TextInput v-model="markerFormData.latitude" type="text" :readonly="markerModalMode === 'add'" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Longitude</label>
              <TextInput v-model="markerFormData.longitude" type="text" :readonly="markerModalMode === 'add'" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Location Name</label>
              <TextInput v-model="markerFormData.label" type="text" placeholder="e.g., Main Library" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <select v-model="markerFormData.type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="" disabled>Select a type</option>
                <option v-for="type in markerTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeMarkerModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="saveMarker" :disabled="!markerFormData.label || !markerFormData.type || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : (markerModalMode === 'edit' ? 'Save Changes' : 'Save Marker') }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Shared Route Modal (Add/Edit) -->
    <Modal :show="showRouteModal" @close="cancelEditRoute(false)">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ routeModalMode === 'edit' ? 'Edit Route' : 'Save Route' }}
          </h3>
        </div>

        <div class="px-6 py-5">
          <div class="space-y-4">
            <!-- Starting Point (auto-populated, read-only) -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Starting Point</label>
              <TextInput
                :model-value="startingPointDisplay"
                type="text"
                readonly
                placeholder="Click first point on map"
                class="w-full bg-gray-50"
              />
              <p class="text-xs text-gray-500 mt-1">Automatically set from the first point of your route</p>
            </div>

            <!-- Ending Point (auto-populated, read-only) -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Ending Point</label>
              <TextInput
                :model-value="endingPointDisplay"
                type="text"
                readonly
                placeholder="Click last point on map"
                class="w-full bg-gray-50"
              />
              <p class="text-xs text-gray-500 mt-1">Automatically set from the last point of your route</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Estimated Time</label>
              <TextInput v-model="routeFormData.estimated_time" type="text" placeholder="e.g., 5 minutes" class="w-full" />
            </div>

            <div v-if="routeModalMode === 'edit'" class="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p class="text-xs text-blue-800 font-medium mb-1">Editing Tips:</p>
              <ul class="text-xs text-blue-700 space-y-1">
                <li>• Drag red markers to adjust route points</li>
                <li>• Click on the route line to add new points</li>
                <li>• Right-click on markers to remove points</li>
                <li>• Starting and ending points update automatically</li>
              </ul>
            </div>

            <div class="text-sm text-gray-600">
              Route points: {{ routeFormData.path_data.length }}
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="cancelEditRoute" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="saveRoute" :disabled="!routeFormData.estimated_time || routeFormData.path_data.length < 2 || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : (routeModalMode === 'edit' ? 'Save Changes' : 'Save Route') }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Shared Delete Confirmation Modal -->
    <Modal :show="showDeleteConfirmModal" @close="closeDeleteModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            Delete {{ deleteModalData.type === 'route' ? 'Route' : 'Marker' }}
          </h3>
        </div>

        <div class="px-6 py-5">
          <p class="text-sm text-gray-700">
            Are you sure you want to delete this {{ deleteModalData.type }}?
          </p>
          <p class="text-sm font-medium text-gray-900 mt-2">
            {{ deleteModalData.name }}
          </p>
          <p class="text-xs text-gray-500 mt-1">
            {{ deleteModalData.description }}
          </p>
          <p class="text-sm text-red-600 mt-3">
            This action cannot be undone.
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeDeleteModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="confirmDelete" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400">
            {{ isSubmitting ? 'Deleting...' : `Delete ${deleteModalData.type === 'route' ? 'Route' : 'Marker'}` }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Point Edit Confirmation Modal -->
    <Modal :show="showPointEditModal" @close="savePointChanges">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Point Position Updated</h3>
        </div>

        <div class="px-6 py-5">
          <p class="text-sm text-gray-700 mb-4">
            You've moved the point <span class="font-bold">#{{ editedPointData.index + 1 }}</span> in the route.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-red-800 mb-2">Original Position</h4>
              <div class="text-xs text-red-700">
                <div>Lat: {{ editedPointData.oldCoords.lat?.toFixed(6) }}</div>
                <div>Lng: {{ editedPointData.oldCoords.lng?.toFixed(6) }}</div>
              </div>
            </div>

            <div class="bg-green-50 border border-green-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-green-800 mb-2">New Position</h4>
              <div class="text-xs text-green-700">
                <div>Lat: {{ editedPointData.newCoords.lat?.toFixed(6) }}</div>
                <div>Lng: {{ editedPointData.newCoords.lng?.toFixed(6) }}</div>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p class="text-xs text-blue-800">
              The route has been automatically updated. Click "Keep Changes" to confirm or "Revert" to restore the original position.
            </p>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button @click="revertPointChanges" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Revert
          </button>
          <button @click="savePointChanges" class="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
            Keep Changes
          </button>
        </div>
      </div>
    </Modal>

    <!-- Marker Drag Confirmation Modal -->
    <Modal :show="showMarkerDragModal" @close="confirmMarkerReposition">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Marker Position Updated</h3>
        </div>

        <div class="px-6 py-5">
          <p class="text-sm text-gray-700 mb-4">
            You've moved the marker for <span class="font-bold">{{ markerDragData.label }}</span>.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div class="bg-red-50 border border-red-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-red-800 mb-2">Original Position</h4>
              <div class="text-xs text-red-700">
                <div>Lat: {{ markerDragData.oldCoords.lat?.toFixed(6) }}</div>
                <div>Lng: {{ markerDragData.oldCoords.lng?.toFixed(6) }}</div>
              </div>
            </div>

            <div class="bg-green-50 border border-green-200 rounded-md p-3">
              <h4 class="text-sm font-medium text-green-800 mb-2">New Position</h4>
              <div class="text-xs text-green-700">
                <div>Lat: {{ markerDragData.newCoords.lat?.toFixed(6) }}</div>
                <div>Lng: {{ markerDragData.newCoords.lng?.toFixed(6) }}</div>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p class="text-xs text-blue-800">
              Click "Keep Changes" to open the edit form and save the new position, or "Revert" to restore the original position.
            </p>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <button @click="revertMarkerPosition" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
            Revert
          </button>
          <button @click="confirmMarkerReposition" class="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">
            Keep Changes
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.max-h-60::-webkit-scrollbar {
  width: 6px;
}

.max-h-60::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.max-h-60::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.edit-route-marker {
  z-index: 1000 !important;
}

.edit-route-marker:hover {
  z-index: 1001 !important;
}
</style>
