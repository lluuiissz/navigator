<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon, PencilIcon, TrashIcon } from '@heroicons/vue/24/outline'
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

// --- Reactive variables ---
const map = ref(null)
const routingControl = ref(null)
const selectedLocation = ref('')
const profile = ref('walking')
const searchQuery = ref('')
const showSearchResults = ref(false)
const isSearching = ref(false)
const showMarkerModal = ref(false)
const showRouteModal = ref(false)
const clickAddModeEnabled = ref(false)
const drawRouteMode = ref(false)
const userLocation = ref(null)
const isSubmitting = ref(false)
const userMarker = ref(null)
const userHeading = ref(0)

// Drawing route variables
const drawnRoute = ref(null)
const routePoints = ref([])
const isDrawing = ref(false)
const editRouteMode = ref(false)
const selectedRoute = ref(null)
const editMarkers = ref([])
const showEditRouteModal = ref(false)
const showDeleteConfirmModal = ref(false)
const routeToDelete = ref(null)

// Enhanced editing variables
const showPointEditModal = ref(false)
const editedPointData = ref({
  index: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  routeId: null
})

// New marker form data
const newMarker = ref({
  latitude: '',
  longitude: '',
  label: '',
  type: ''
})

// Edit marker form data
const editMarker = ref({
  id: null,
  latitude: '',
  longitude: '',
  label: '',
  type: ''
})

// Marker drag data
const showMarkerDragModal = ref(false)
const markerDragData = ref({
  id: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  label: '',
  type: ''
})

const showEditMarkerModal = ref(false)
const showDeleteMarkerConfirmModal = ref(false)
const markerToDelete = ref(null)

// Store dragging marker instance
let draggingMarkerInstance = null

// New route form data
const newRoute = ref({
  start_location: '',
  end_location: '',
  estimated_time: '',
  path_data: []
})

// Edit route form data
const editRoute = ref({
  id: null,
  start_location: '',
  end_location: '',
  estimated_time: '',
  path_data: []
})

// Marker types
const markerTypes = [
  'Administration',
  'Academic',
  'Student Services',
  'Services',
  'Facility',
  'Other'
]

// Enable marker dragging during edit
const enableMarkerDragging = (markerId) => {
  const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
  if (!markerObj) return

  // Store original coordinates
  const originalLatLng = markerObj.getLatLng()

  // Make marker draggable
  markerObj.dragging.enable()
  markerObj.setOpacity(0.8)

  draggingMarkerInstance = markerObj

  // Handle drag start
  markerObj.on('dragstart', () => {
    markerObj.setOpacity(0.6)
  })

  // Handle drag end
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

  toast.info('Drag marker to reposition')
}

// Confirm marker reposition and open edit modal
const confirmMarkerReposition = () => {
  // Set the edit marker data with new coordinates
  editMarker.value = {
    id: markerDragData.value.id,
    latitude: markerDragData.value.newCoords.lat.toString(),
    longitude: markerDragData.value.newCoords.lng.toString(),
    label: markerDragData.value.label,
    type: markerDragData.value.type
  }

  // Close the drag modal and open the edit modal
  showMarkerDragModal.value = false
  showEditMarkerModal.value = true

  toast.info('Please review and save changes in the edit form')
}

// Revert marker position
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

// Close marker drag modal
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

// Window functions for edit/delete (called from marker popups)
window.editMarker = (markerId) => {
  const marker = locations.value.find(m => m.id === markerId)
  if (!marker) return

  // Enable dragging for this marker
  enableMarkerDragging(markerId)
}

window.deleteMarker = (markerId) => {
  const marker = locations.value.find(m => m.id === markerId)
  if (!marker) return

  markerToDelete.value = marker
  showDeleteMarkerConfirmModal.value = true
}

// Save edited marker
const saveEditedMarker = async () => {
  if (isSubmitting.value) return

  if (!editMarker.value.label || !editMarker.value.type) {
    toast.error('Please fill in all required fields')
    return
  }

  isSubmitting.value = true

  try {
    //  Parse coordinates as floats before sending to API
    const response = await axios.put(`/markers/${editMarker.value.id}`, {
      latitude: parseFloat(editMarker.value.latitude),
      longitude: parseFloat(editMarker.value.longitude),
      label: editMarker.value.label,
      type: editMarker.value.type
    })

    toast.success('Marker updated successfully!')

    //  Update the marker in locations array with correct structure
    const index = locations.value.findIndex(m => m.id === editMarker.value.id)
    if (index !== -1) {
      locations.value[index] = {
        id: editMarker.value.id,
        name: editMarker.value.label,
        lng: parseFloat(editMarker.value.longitude),
        lat: parseFloat(editMarker.value.latitude),
        department: editMarker.value.type
      }
    }

    //  Refresh markers on map - remove all and re-add with updated data
    markerInstances.value.forEach(m => {
      if (m && m.remove) {
        m.remove()
      }
    })
    markerInstances.value = []

    // Re-add all markers with updated positions
    locations.value.forEach(location => {
      addMarkerToMap(location)
    })

    closeEditMarkerModal()

    //  Clear drag data after successful save
    draggingMarkerInstance = null

  } catch (error) {
    console.error('Error updating marker:', error)
    toast.error(error.response?.data?.message || 'Failed to update marker')
  } finally {
    isSubmitting.value = false
  }
}

// Delete marker
const confirmDeleteMarker = async () => {
  if (!markerToDelete.value || isSubmitting.value) return

  isSubmitting.value = true

  try {
    await axios.delete(`/markers/${markerToDelete.value.id}`)

    toast.success('Marker deleted successfully!')

    // Remove from locations array
    locations.value = locations.value.filter(m => m.id !== markerToDelete.value.id)

    // Refresh markers on map
    markerInstances.value.forEach(m => m.remove())
    markerInstances.value = []
    locations.value.forEach(location => {
      addMarkerToMap(location)
    })

    closeDeleteMarkerModal()

  } catch (error) {
    console.error('Error deleting marker:', error)
    toast.error(error.response?.data?.message || 'Failed to delete marker')
  } finally {
    isSubmitting.value = false
  }
}

// Close modals
const closeEditMarkerModal = () => {
  showEditMarkerModal.value = false
  editMarker.value = { id: null, latitude: '', longitude: '', label: '', type: '' }
}

const closeDeleteMarkerModal = () => {
  showDeleteMarkerConfirmModal.value = false
  markerToDelete.value = null
}

// Use markers from props
const locations = ref([])
const savedRoutes = ref([])

// Filtered locations based on search
const filteredLocations = ref([])

// Store marker instances
const markerInstances = ref([])
const routePolylines = ref([])

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
      markerInstances.value.forEach(m => m.remove())
      markerInstances.value = []
      locations.value.forEach(location => {
        addMarkerToMap(location)
      })
    }
  } catch (error) {
    console.error('Error fetching markers:', error)
    toast.error('Failed to load markers')
  }
}

// Fetch saved routes from backend
const fetchRoutes = async () => {
  try {
    const response = await axios.get('/routes', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    savedRoutes.value = response.data

    // Display routes on map
    if (map.value) {
      savedRoutes.value.forEach(route => {
        displayRoute(route)
      })
    }
  } catch (error) {
    console.error('Error fetching routes:', error)
  }
}

// Display a saved route on the map
const displayRoute = (route) => {
  if (!route.path_data || route.path_data.length === 0) return

  const pathCoordinates = route.path_data.map(point => [point.lat, point.lng])

  const polyline = L.polyline(pathCoordinates, {
    color: '#3B82F6',
    weight: 4,
    opacity: 0.7,
    routeId: route.id
  }).addTo(map.value)

  polyline.bindPopup(`
    <div class="p-3">
      <h3 class="font-bold text-sm mb-2">${route.start_location} → ${route.end_location}</h3>
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
}

// Enhanced route editing functionality
window.editRoute = (routeId) => {
  const routeObj = routePolylines.value.find(r => r.id === routeId)
  if (!routeObj) return

  selectedRoute.value = routeObj
  editRoute.value = {
    id: routeObj.data.id,
    start_location: routeObj.data.start_location,
    end_location: routeObj.data.end_location,
    estimated_time: routeObj.data.estimated_time,
    path_data: [...routeObj.data.path_data]
  }

  enableRouteEditing(routeObj)
}

// Enhanced route editing mode with better dragging
const enableRouteEditing = (routeObj) => {
  editRouteMode.value = true
  drawRouteMode.value = false
  clickAddModeEnabled.value = false

  // Change polyline color to indicate editing
  routeObj.polyline.setStyle({ color: '#EF4444', weight: 5 })

  // Add enhanced draggable markers at each point
  editMarkers.value = []
  editRoute.value.path_data.forEach((point, index) => {
    const marker = L.marker([point.lat, point.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-route-marker',
        html: `<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${index + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map.value)

    // Store original position for comparison
    const originalLatLng = L.latLng(point.lat, point.lng)

    // Enhanced drag handling with visual feedback
    marker.on('dragstart', () => {
      marker.setOpacity(0.7)
    })

    marker.on('drag', (e) => {
      const newLatLng = e.target.getLatLng()
      editRoute.value.path_data[index] = { lat: newLatLng.lat, lng: newLatLng.lng }
      updateEditPolyline()
    })

    marker.on('dragend', (e) => {
      marker.setOpacity(1)
      const newLatLng = e.target.getLatLng()

      // Show modal with old and new coordinates
      showPointEditModal.value = true
      editedPointData.value = {
        index: index,
        oldCoords: { lat: originalLatLng.lat, lng: originalLatLng.lng },
        newCoords: { lat: newLatLng.lat, lng: newLatLng.lng },
        routeId: editRoute.value.id
      }
    })

    // Right-click to remove point
    marker.on('contextmenu', (e) => {
      e.originalEvent.preventDefault()
      if (editRoute.value.path_data.length > 2) {
        editRoute.value.path_data.splice(index, 1)
        marker.remove()
        editMarkers.value.splice(index, 1)
        updateEditPolyline()
        updateMarkerNumbers()
        toast.info('Point removed')
      } else {
        toast.error('Route must have at least 2 points')
      }
    })

    editMarkers.value.push(marker)
  })

  // Enhanced adding new points by clicking on the polyline
  routeObj.polyline.on('click', (e) => {
    const clickLatLng = e.latlng

    // Find the closest segment
    let minDist = Infinity
    let insertIndex = 0

    for (let i = 0; i < editRoute.value.path_data.length - 1; i++) {
      const p1 = L.latLng(editRoute.value.path_data[i].lat, editRoute.value.path_data[i].lng)
      const p2 = L.latLng(editRoute.value.path_data[i + 1].lat, editRoute.value.path_data[i + 1].lng)
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

    // Insert new point
    editRoute.value.path_data.splice(insertIndex, 0, { lat: clickLatLng.lat, lng: clickLatLng.lng })

    // Add new marker with enhanced styling
    const marker = L.marker([clickLatLng.lat, clickLatLng.lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-route-marker',
        html: `<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${insertIndex + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map.value)

    // Store original position for comparison
    const originalLatLng = L.latLng(clickLatLng.lat, clickLatLng.lng)

    // Enhanced drag handling for new points
    marker.on('dragstart', () => {
      marker.setOpacity(0.7)
    })

    marker.on('drag', (e) => {
      const newLatLng = e.target.getLatLng()
      editRoute.value.path_data[insertIndex] = { lat: newLatLng.lat, lng: newLatLng.lng }
      updateEditPolyline()
    })

    marker.on('dragend', (e) => {
      marker.setOpacity(1)
      const newLatLng = e.target.getLatLng()

      // Show modal with old and new coordinates
      showPointEditModal.value = true
      editedPointData.value = {
        index: insertIndex,
        oldCoords: { lat: originalLatLng.lat, lng: originalLatLng.lng },
        newCoords: { lat: newLatLng.lat, lng: newLatLng.lng },
        routeId: editRoute.value.id
      }
    })

    marker.on('contextmenu', (e) => {
      e.originalEvent.preventDefault()
      if (editRoute.value.path_data.length > 2) {
        editRoute.value.path_data.splice(insertIndex, 1)
        marker.remove()
        editMarkers.value.splice(insertIndex, 1)
        updateEditPolyline()
        updateMarkerNumbers()
        toast.info('Point removed')
      } else {
        toast.error('Route must have at least 2 points')
      }
    })

    editMarkers.value.splice(insertIndex, 0, marker)
    updateEditPolyline()
    updateMarkerNumbers()
    toast.success('Point added')
  })

  showEditRouteModal.value = true
  toast.info('Drag points to edit. Right-click to remove. Click line to add points.')
}

// Update marker numbers after adding/removing points
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

  const pathCoordinates = editRoute.value.path_data.map(point => [point.lat, point.lng])
  selectedRoute.value.polyline.setLatLngs(pathCoordinates)
}

// Save point changes after confirmation
const savePointChanges = () => {
  // The changes are already applied to editRoute.value.path_data
  // We just need to close the modal
  showPointEditModal.value = false
  editedPointData.value = {
    index: null,
    oldCoords: { lat: null, lng: null },
    newCoords: { lat: null, lng: null },
    routeId: null
  }
  toast.success('Point position updated')
}

// Revert point to original position
const revertPointChanges = () => {
  if (editedPointData.value.index !== null) {
    // Revert to original position
    editRoute.value.path_data[editedPointData.value.index] = {
      lat: editedPointData.value.oldCoords.lat,
      lng: editedPointData.value.oldCoords.lng
    }

    // Update the marker position
    if (editMarkers.value[editedPointData.value.index]) {
      editMarkers.value[editedPointData.value.index].setLatLng([
        editedPointData.value.oldCoords.lat,
        editedPointData.value.oldCoords.lng
      ])
    }

    // Update the polyline
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

// Save edited route
const saveEditedRoute = async () => {
  if (isSubmitting.value) return

  if (!editRoute.value.start_location || !editRoute.value.end_location || !editRoute.value.estimated_time) {
    toast.error('Please fill in all required fields')
    return
  }

  isSubmitting.value = true

  try {
    const response = await axios.put(`/routes/${editRoute.value.id}`, {
      start_location: editRoute.value.start_location,
      end_location: editRoute.value.end_location,
      estimated_time: editRoute.value.estimated_time,
      path_data: editRoute.value.path_data
    })

    toast.success('Route updated successfully!')

    // Update the route in savedRoutes array
    const index = savedRoutes.value.findIndex(r => r.id === editRoute.value.id)
    if (index !== -1) {
      savedRoutes.value[index] = response.data
    }

    // Update the route data in routePolylines
    if (selectedRoute.value) {
      selectedRoute.value.data = response.data
      selectedRoute.value.polyline.setStyle({ color: '#3B82F6', weight: 4 })
    }

    cancelEditRoute()

  } catch (error) {
    console.error('Error updating route:', error)
    toast.error(error.response?.data?.message || 'Failed to update route')
  } finally {
    isSubmitting.value = false
  }
}

// Cancel route editing
const cancelEditRoute = () => {
  if (selectedRoute.value) {
    selectedRoute.value.polyline.setStyle({ color: '#3B82F6', weight: 4 })
    selectedRoute.value.polyline.off('click')
  }

  editMarkers.value.forEach(marker => marker.remove())
  editMarkers.value = []

  editRouteMode.value = false
  selectedRoute.value = null
  showEditRouteModal.value = false
  showPointEditModal.value = false

  editRoute.value = {
    id: null,
    start_location: '',
    end_location: '',
    estimated_time: '',
    path_data: []
  }
}

// Delete route
window.deleteRoute = (routeId) => {
  const routeObj = routePolylines.value.find(r => r.id === routeId)
  if (!routeObj) return

  routeToDelete.value = routeObj
  showDeleteConfirmModal.value = true
}

const confirmDeleteRoute = async () => {
  if (!routeToDelete.value || isSubmitting.value) return

  isSubmitting.value = true

  try {
    await axios.delete(`/routes/${routeToDelete.value.id}`)

    toast.success('Route deleted successfully!')

    // Remove from map
    routeToDelete.value.polyline.remove()

    // Remove from arrays
    routePolylines.value = routePolylines.value.filter(r => r.id !== routeToDelete.value.id)
    savedRoutes.value = savedRoutes.value.filter(r => r.id !== routeToDelete.value.id)

    showDeleteConfirmModal.value = false
    routeToDelete.value = null

  } catch (error) {
    console.error('Error deleting route:', error)
    toast.error(error.response?.data?.message || 'Failed to delete route')
  } finally {
    isSubmitting.value = false
  }
}

// Initialize compass tracking
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

// Update user marker
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

onMounted(() => {
  // Initialize Leaflet map
  map.value = L.map('map').setView([8.16953, 126.00306], 16)

  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:50,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map.value)

  // Get user location
  getUserLocation()
  startCompassTracking()

  // Fetch markers and routes
  fetchMarkers()
  fetchRoutes()

  // Admin: Enable click to add markers
  if (props.isAdmin) {
    map.value.on('click', handleMapClick)
  }
})

// Get user current location
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

// Add marker to map
const addMarkerToMap = (location) => {
  const marker = L.marker([location.lat, location.lng], {
    draggable: false, // Disable dragging so edit button works immediately
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

  // Store marker data for reference
  marker._markerData = location
  markerInstances.value.push(marker)

  if (!props.isAdmin) {
    marker.on('click', () => {
      selectedLocation.value = location
      routeToLocation()
    })
  }
}

// Handle map click (Admin only)
const handleMapClick = (e) => {
  if (!props.isAdmin) return

  if (clickAddModeEnabled.value) {
    newMarker.value.longitude = e.latlng.lng.toFixed(6)
    newMarker.value.latitude = e.latlng.lat.toFixed(6)
    showMarkerModal.value = true
  }

  if (drawRouteMode.value && isDrawing.value) {
    addRoutePoint(e.latlng)
  }
}

// Toggle click-add mode
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

// Toggle draw route mode
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

// Start drawing route
const startDrawingRoute = () => {
  isDrawing.value = true
  routePoints.value = []

  if (drawnRoute.value) {
    drawnRoute.value.remove()
  }

  map.value.getContainer().style.cursor = 'crosshair'
}

// Add point to route
const addRoutePoint = (latlng) => {
  routePoints.value.push(latlng)

  if (drawnRoute.value) {
    drawnRoute.value.remove()
  }

  drawnRoute.value = L.polyline(routePoints.value, {
    color: '#EF4444',
    weight: 4,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(map.value)

  L.circleMarker(latlng, {
    radius: 5,
    fillColor: '#EF4444',
    color: '#fff',
    weight: 2,
    fillOpacity: 1
  }).addTo(map.value)
}

// Finish drawing route
const finishDrawingRoute = () => {
  if (routePoints.value.length < 2) {
    toast.error('Route must have at least 2 points')
    return
  }

  isDrawing.value = false
  drawRouteMode.value = false
  map.value.getContainer().style.cursor = ''

  newRoute.value.path_data = routePoints.value.map(point => ({
    lat: point.lat,
    lng: point.lng
  }))

  showRouteModal.value = true
}

// Cancel drawing route
const cancelDrawingRoute = () => {
  isDrawing.value = false
  drawRouteMode.value = false
  routePoints.value = []

  if (drawnRoute.value) {
    drawnRoute.value.remove()
    drawnRoute.value = null
  }

  map.value.getContainer().style.cursor = ''
}

// Submit new marker
const submit = async () => {
  if (isSubmitting.value) return

  if (!newMarker.value.label || !newMarker.value.type) {
    toast.error('Please fill in all required fields')
    return
  }

  isSubmitting.value = true

  try {
    const response = await axios.post('/markers', {
      latitude: parseFloat(newMarker.value.latitude),
      longitude: parseFloat(newMarker.value.longitude),
      label: newMarker.value.label,
      type: newMarker.value.type
    })

    toast.success('Marker added successfully!')

    const newLoc = {
      id: response.data.id,
      name: newMarker.value.label,
      lng: parseFloat(newMarker.value.longitude),
      lat: parseFloat(newMarker.value.latitude),
      department: newMarker.value.type
    }

    locations.value.push(newLoc)
    addMarkerToMap(newLoc)

    closeMarkerModal()
    clickAddModeEnabled.value = false
    map.value.getContainer().style.cursor = ''

  } catch (error) {
    console.error('Error saving marker:', error)
    toast.error(error.response?.data?.message || 'Failed to save marker')
  } finally {
    isSubmitting.value = false
  }
}

// Submit new route
const submitRoute = async () => {
  if (isSubmitting.value) return

  if (!newRoute.value.start_location || !newRoute.value.end_location || !newRoute.value.estimated_time) {
    toast.error('Please fill in all required fields')
    return
  }

  isSubmitting.value = true

  try {
    const response = await axios.post('/routes', {
      start_location: newRoute.value.start_location,
      end_location: newRoute.value.end_location,
      estimated_time: newRoute.value.estimated_time,
      path_data: newRoute.value.path_data
    })

    toast.success('Route saved successfully!')

    savedRoutes.value.push(response.data)
    displayRoute(response.data)

    closeRouteModal()

  } catch (error) {
    console.error('Error saving route:', error)
    toast.error(error.response?.data?.message || 'Failed to save route')
  } finally {
    isSubmitting.value = false
  }
}

// Close modals
const closeMarkerModal = () => {
  showMarkerModal.value = false
  newMarker.value = { latitude: '', longitude: '', label: '', type: '' }
}

const closeRouteModal = () => {
  showRouteModal.value = false
  newRoute.value = { start_location: '', end_location: '', estimated_time: '', path_data: [] }

  if (drawnRoute.value) {
    drawnRoute.value.remove()
    drawnRoute.value = null
  }

  routePoints.value = []
}

const closeDeleteModal = () => {
  showDeleteConfirmModal.value = false
  routeToDelete.value = null
}

// Watch for search query
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

// Handle routing
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

// Handle search result selection
const selectSearchResult = (location) => {
  selectedLocation.value = location
  searchQuery.value = location.name
  showSearchResults.value = false

  map.value.flyTo([location.lat, location.lng], 17)

  if (!props.isAdmin) {
    routeToLocation()
  }
}

// Clear search
const clearSearch = () => {
  searchQuery.value = ''
  selectedLocation.value = ''
  showSearchResults.value = false

  if (routingControl.value) {
    map.value.removeControl(routingControl.value)
    routingControl.value = null
  }
}
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
        @click="showEditRouteModal = true"
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

    <!-- Add Marker Modal -->
    <Modal :show="showMarkerModal" @close="closeMarkerModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Create New Marker</h3>
        </div>

        <div class="px-6 py-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Latitude</label>
              <TextInput v-model="newMarker.latitude" type="text" readonly class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Longitude</label>
              <TextInput v-model="newMarker.longitude" type="text" readonly class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Location Name</label>
              <TextInput v-model="newMarker.label" type="text" placeholder="e.g., Main Library" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <select v-model="newMarker.type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="" disabled>Select a type</option>
                <option v-for="type in markerTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeMarkerModal" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="submit" :disabled="!newMarker.label || !newMarker.type || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : 'Save Marker' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Add Route Modal -->
    <Modal :show="showRouteModal" @close="closeRouteModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Save Route</h3>
        </div>

        <div class="px-6 py-5">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Start Location</label>
              <TextInput v-model="newRoute.start_location" type="text" placeholder="e.g., Main Gate" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">End Location</label>
              <TextInput v-model="newRoute.end_location" type="text" placeholder="e.g., Library" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Estimated Time</label>
              <TextInput v-model="newRoute.estimated_time" type="text" placeholder="e.g., 5 minutes" class="w-full" />
            </div>

            <div class="text-sm text-gray-600">
              Route points: {{ routePoints.length }}
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeRouteModal" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="submitRoute" :disabled="!newRoute.start_location || !newRoute.end_location || !newRoute.estimated_time || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : 'Save Route' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Edit Route Modal -->
    <Modal :show="showEditRouteModal" @close="showEditRouteModal = false">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Edit Route</h3>
        </div>

        <div class="px-6 py-5">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Start Location</label>
              <TextInput v-model="editRoute.start_location" type="text" placeholder="e.g., Main Gate" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">End Location</label>
              <TextInput v-model="editRoute.end_location" type="text" placeholder="e.g., Library" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Estimated Time</label>
              <TextInput v-model="editRoute.estimated_time" type="text" placeholder="e.g., 5 minutes" class="w-full" />
            </div>

            <div class="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p class="text-xs text-blue-800 font-medium mb-1">Editing Tips:</p>
              <ul class="text-xs text-blue-700 space-y-1">
                <li>• Drag red markers to adjust route points</li>
                <li>• Click on the route line to add new points</li>
                <li>• Right-click on markers to remove points</li>
                <li>• After dragging, a modal will show coordinate changes</li>
              </ul>
            </div>

            <div class="text-sm text-gray-600">
              Route points: {{ editRoute.path_data.length }}
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="cancelEditRoute" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="saveEditedRoute" :disabled="!editRoute.start_location || !editRoute.end_location || !editRoute.estimated_time || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
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
            You've moved point <span class="font-bold">#{{ editedPointData.index + 1 }}</span> in the route.
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

    <!-- Edit Marker Modal -->
    <Modal :show="showEditMarkerModal" @close="closeEditMarkerModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Edit Marker</h3>
        </div>

        <div class="px-6 py-5">
          <div class="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
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
              <TextInput v-model="editMarker.latitude" type="text" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Longitude</label>
              <TextInput v-model="editMarker.longitude" type="text" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Location Name</label>
              <TextInput v-model="editMarker.label" type="text" placeholder="e.g., Main Library" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <select v-model="editMarker.type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="" disabled>Select a type</option>
                <option v-for="type in markerTypes" :key="type" :value="type">{{ type }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeEditMarkerModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="saveEditedMarker" :disabled="!editMarker.label || !editMarker.type || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Delete Marker Modal -->
    <Modal :show="showDeleteMarkerConfirmModal" @close="closeDeleteMarkerModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Delete Marker</h3>
        </div>

        <div class="px-6 py-5">
          <p class="text-sm text-gray-700">
            Are you sure you want to delete this marker?
          </p>
          <p v-if="markerToDelete" class="text-sm font-medium text-gray-900 mt-2">
            {{ markerToDelete.name }}
          </p>
          <p v-if="markerToDelete" class="text-xs text-gray-500 mt-1">
            {{ markerToDelete.department }}
          </p>
          <p class="text-sm text-red-600 mt-3">
            This action cannot be undone.
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeDeleteMarkerModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="confirmDeleteMarker" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400">
            {{ isSubmitting ? 'Deleting...' : 'Delete Marker' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- Delete Route Modal -->
    <Modal :show="showDeleteConfirmModal" @close="closeDeleteModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Delete Route</h3>
        </div>

        <div class="px-6 py-5">
          <p class="text-sm text-gray-700">
            Are you sure you want to delete this route?
          </p>
          <p v-if="routeToDelete" class="text-sm font-medium text-gray-900 mt-2">
            {{ routeToDelete.data.start_location }} → {{ routeToDelete.data.end_location }}
          </p>
          <p class="text-sm text-red-600 mt-3">
            This action cannot be undone.
          </p>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closeDeleteModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="confirmDeleteRoute" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-400">
            {{ isSubmitting ? 'Deleting...' : 'Delete Route' }}
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

/* Enhanced marker styling */
.edit-route-marker {
  z-index: 1000 !important;
}

.edit-route-marker:hover {
  z-index: 1001 !important;
}
</style>
