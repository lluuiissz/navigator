<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, MapPinIcon, PencilIcon, Square3Stack3DIcon, CheckIcon, GlobeAltIcon } from '@heroicons/vue/24/outline'
import Modal from '../Modal.vue'
import TextInput from '../TextInput.vue'
import axios from 'axios'
import { useToast } from 'vue-toastification'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'

// Import composables
import { useMapMarkers } from '../../composables/useMapMarkers'
import { useMapRoutes } from '../../composables/useMapRoutes'
import { useMapPolygons } from '../../composables/useMapPolygons'

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

// ========== CORE MAP VARIABLES ==========
const map = ref(null)
const routingControl = ref(null)
const userLocation = ref(null)
const userMarker = ref(null)
const userHeading = ref(0)
const isSubmitting = ref(false)
const baseLayers = ref({})
const currentBaseLayer = ref('osm')

// ========== SEARCH VARIABLES ==========
const selectedLocation = ref('')
const searchQuery = ref('')
const showSearchResults = ref(false)
const isSearching = ref(false)
const filteredLocations = ref([])

// ========== INITIALIZE COMPOSABLES ==========
const {
  locations,
  markerInstances,
  markerTypes,
  draggingMarkerInstance,
  fetchMarkers,
  addMarkerToMap,
  enableMarkerDragging
} = useMapMarkers(map, props.isAdmin)

const {
  savedRoutes,
  routePolylines,
  drawnRoute,
  routePoints,
  isDrawing: isDrawingRoute,
  drawRouteMode,
  editRouteMode,
  selectedRoute,
  editMarkers,
  fetchRoutes,
  startDrawingRoute,
  addRoutePoint,
  enableRouteEditing,
  cancelDrawing: cancelRouteDrawing,
  cleanupRoutes
} = useMapRoutes(map, props.isAdmin)

const {
  polygons,
  polygonInstances,
  isDrawingPolygon,
  drawPolygonMode,
  currentPolygonPoints,
  editPolygonMode,
  selectedPolygon,
  editPolygonMarkers,
  fetchPolygons,
  startDrawingPolygon,
  addPolygonPoint,
  finishDrawingPolygon,
  cancelDrawingPolygon,
  enablePolygonEditing,
  cancelPolygonEditing,
  cleanupPolygons
} = useMapPolygons(map, props.isAdmin)

// ========== UI STATE VARIABLES ==========
const clickAddModeEnabled = ref(false)

// ========== MODAL STATE VARIABLES ==========
// Marker Modal
const showMarkerModal = ref(false)
const markerModalMode = ref('add')
const markerFormData = ref({
  id: null,
  latitude: '',
  longitude: '',
  label: '',
  type: ''
})

const showMarkerDragModal = ref(false)
const markerDragData = ref({
  id: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  label: '',
  type: ''
})

// Route Modal
const showRouteModal = ref(false)
const routeModalMode = ref('add')
const routeFormData = ref({
  id: null,
  start_lat: '',
  start_lng: '',
  end_lat: '',
  end_lng: '',
  estimated_time: '',
  path_data: [],
  color: '#3B82F6'
})

const showPointEditModal = ref(false)
const editedPointData = ref({
  index: null,
  oldCoords: { lat: null, lng: null },
  newCoords: { lat: null, lng: null },
  routeId: null
})

// Polygon Modal
const showPolygonModal = ref(false)
const polygonModalMode = ref('add')
const polygonFormData = ref({
  id: null,
  name: '',
  description: '',
  type: 'Building',
  color: '#FF6B6B',
  fill_color: '#FF6B6B',
  fill_opacity: 0.3,
  coordinates: []
})

const polygonTypes = [
  'Building',
  'Parking Lot',
  'Sports Field',
  'Garden',
  'Plaza',
  'Restricted Area',
  'Other'
]

// Delete Modal
const showDeleteConfirmModal = ref(false)
const deleteModalData = ref({
  type: '',
  id: null,
  name: '',
  description: ''
})

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

// ========== MARKER METHODS ==========
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

    if (markerModalMode.value === 'edit') {
      await axios.put(`/markers/${markerFormData.value.id}`, payload)
      toast.success('Marker updated successfully!')
    } else {
      await axios.post('/markers', payload)
      toast.success('Marker added successfully!')
    }

    await fetchMarkers()
    closeMarkerModal()

    if (clickAddModeEnabled.value) {
      clickAddModeEnabled.value = false
      map.value.getContainer().style.cursor = ''
    }

  } catch (error) {
    // console.error('Error saving marker:', error)
    toast.error(error.response?.data?.message || 'Failed to save marker')
  } finally {
    isSubmitting.value = false
  }
}

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
  if (draggingMarkerInstance.value) {
    draggingMarkerInstance.value.setLatLng([
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
}

// ========== ROUTE METHODS ==========
const saveRoute = async () => {
  if (isSubmitting.value) return

  // If in edit mode but modal not shown, show modal first
  if (editRouteMode.value && !showRouteModal.value) {
    showRouteModal.value = true
    toast.info('Adjust route details in the modal and click save to confirm.')
    return
  }

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
      path_data: routeFormData.value.path_data,
      color: routeFormData.value.color || '#3B82F6'
    }

    // console.log('Saving route with payload:', payload)  // DEBUG

    if (routeModalMode.value === 'edit') {
      await axios.put(`/routes/${routeFormData.value.id}`, payload)
      toast.success('Route updated successfully!')
    } else {
      await axios.post('/routes', payload)
      toast.success('Route saved successfully!')
    }

    await fetchRoutes()
    cancelEditRoute()

  } catch (error) {
    // console.error('Error saving route:', error)
    toast.error(error.response?.data?.message || 'Failed to save route')
  } finally {
    isSubmitting.value = false
  }
}

const finishDrawingRoute = () => {
  if (routePoints.value.length < 2) {
    toast.error('Route must have at least 2 points')
    return
  }

  // Reset form data to fresh state
  routeFormData.value = {
    id: null,
    start_lat: routePoints.value[0].lat,
    start_lng: routePoints.value[0].lng,
    end_lat: routePoints.value[routePoints.value.length - 1].lat,
    end_lng: routePoints.value[routePoints.value.length - 1].lng,
    estimated_time: '',
    path_data: routePoints.value.map(point => ({
      lat: point.lat,
      lng: point.lng
    })),
    color: '#3B82F6'
  }

  routeModalMode.value = 'add'
  showRouteModal.value = true
}

const cancelEditRoute = () => {
  if (selectedRoute.value) {
    // Restore original color from database
    const originalColor = selectedRoute.value.data.color || '#3B82F6'
    selectedRoute.value.polyline.setStyle({ color: originalColor, weight: 4 })
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
    path_data: [],
    color: '#3B82F6'
  }
  routeModalMode.value = 'add'

  cancelRouteDrawing()
}

// ========== POLYGON METHODS ==========
const savePolygon = async () => {
  if (isSubmitting.value) return

  // If in edit mode but modal not shown, show modal first
  if (editPolygonMode.value && !showPolygonModal.value) {
    showPolygonModal.value = true
    toast.info('Adjust polygon details in the modal and click save to confirm.')
    return
  }

  if (!polygonFormData.value.name || polygonFormData.value.coordinates.length < 3) {
    toast.error('Please fill in all required fields and ensure polygon has at least 3 points')
    return
  }

  isSubmitting.value = true

  try {
    const payload = {
      name: polygonFormData.value.name,
      description: polygonFormData.value.description,
      type: polygonFormData.value.type,
      color: polygonFormData.value.color,
      fill_color: polygonFormData.value.fill_color,
      fill_opacity: polygonFormData.value.fill_opacity,
      coordinates: polygonFormData.value.coordinates
    }

    if (polygonModalMode.value === 'edit') {
      await axios.put(`/facilities/polygons/${polygonFormData.value.id}`, payload)
      toast.success('Facility polygon updated successfully!')
    } else {
      await axios.post('/facilities/polygons', payload)
      toast.success('Facility polygon created successfully!')
    }

    await fetchPolygons()
    closePolygonModal()

  } catch (error) {
    // console.error('Error saving polygon:', error)
    toast.error(error.response?.data?.message || 'Failed to save polygon')
  } finally {
    isSubmitting.value = false
  }
}

const finishDrawingPolygonHandler = () => {
  const polygonData = finishDrawingPolygon()

  if (!polygonData) return

  polygonFormData.value.coordinates = polygonData.coordinates
  polygonModalMode.value = 'add'
  showPolygonModal.value = true
}

const closePolygonModal = () => {
  showPolygonModal.value = false
  polygonFormData.value = {
    id: null,
    name: '',
    description: '',
    type: 'Building',
    color: '#FF6B6B',
    fill_color: '#FF6B6B',
    fill_opacity: 0.3,
    coordinates: []
  }
  polygonModalMode.value = 'add'
  cancelDrawingPolygon()
  cancelPolygonEditing()
}

// ========== UI INTERACTION METHODS ==========
const handleMapClick = (e) => {
  if (!props.isAdmin) return

  if (clickAddModeEnabled.value) {
    markerModalMode.value = 'add'
    markerFormData.value.longitude = e.latlng.lng.toFixed(6)
    markerFormData.value.latitude = e.latlng.lat.toFixed(6)
    showMarkerModal.value = true
  }

  if (drawRouteMode.value && isDrawingRoute.value) {
    addRoutePoint(e.latlng)
  }

  if (drawPolygonMode.value && isDrawingPolygon.value) {
    addPolygonPoint(e.latlng)
  }
}

const handleMapDblClick = (e) => {
  if (drawPolygonMode.value && isDrawingPolygon.value) {
    L.DomEvent.stopPropagation(e)
    finishDrawingPolygonHandler()
  }
}

const toggleClickAddMode = () => {
  clickAddModeEnabled.value = !clickAddModeEnabled.value
  if (clickAddModeEnabled.value) {
    drawRouteMode.value = false
    drawPolygonMode.value = false
    cancelRouteDrawing()
    cancelDrawingPolygon()
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
    drawPolygonMode.value = false
    cancelDrawingPolygon()
    startDrawingRoute()
    toast.info('Click on map to draw route path')
  } else {
    cancelRouteDrawing()
  }
}

const toggleDrawPolygonMode = () => {
  if (editPolygonMode.value) {
    toast.error('Please finish editing current polygon first')
    return
  }

  drawPolygonMode.value = !drawPolygonMode.value
  if (drawPolygonMode.value) {
    clickAddModeEnabled.value = false
    drawRouteMode.value = false
    cancelRouteDrawing()
    startDrawingPolygon()
  } else {
    cancelDrawingPolygon()
  }
}

const toggleBaseLayer = () => {
  if (!map.value) return

  const oldLayer = currentBaseLayer.value
  const nextLayer = oldLayer === 'osm' ? 'satellite' : 'osm'

  try {
    if (baseLayers.value[oldLayer] && map.value.hasLayer(baseLayers.value[oldLayer])) {
      map.value.removeLayer(baseLayers.value[oldLayer])
    }
  } catch (err) {
    // ignore
  }

  if (baseLayers.value[nextLayer]) {
    baseLayers.value[nextLayer].addTo(map.value)
    currentBaseLayer.value = nextLayer
    toast.info(nextLayer === 'osm' ? 'Switched to OpenStreetMap' : 'Switched to Satellite')
  } else {
    toast.error('Base layer not available')
  }
}

// ========== SEARCH FUNCTIONALITY ==========
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

// ========== DELETE METHODS ==========
const confirmDelete = async () => {
  if (!deleteModalData.value.id || isSubmitting.value) return

  isSubmitting.value = true

  try {
    if (deleteModalData.value.type === 'route') {
      await axios.delete(`/routes/${deleteModalData.value.id}`)
      toast.success('Route deleted successfully!')
      await fetchRoutes()
    } else if (deleteModalData.value.type === 'polygon') {
      await axios.delete(`/facilities/polygons/${deleteModalData.value.id}`)
      toast.success('Polygon deleted successfully!')
      await fetchPolygons()
    } else {
      await axios.delete(`/markers/${deleteModalData.value.id}`)
      toast.success('Marker deleted successfully!')
      await fetchMarkers()
    }

    closeDeleteModal()

  } catch (error) {
    // console.error('Error deleting:', error)
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
        // console.error('Geolocation error:', error)
        // Silently ignore geolocation errors
      }
    )
  }
}

const updateUserMarker = () => {
  if (!userLocation.value || !map.value) return

  try {
    if (userMarker.value && typeof userMarker.value.setLatLng === 'function') {
      userMarker.value.setLatLng([userLocation.value.lat, userLocation.value.lng])
    } else {
      userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
        title: 'You',
        icon: L.divIcon({
          className: 'user-marker',
          html: `<div style="background: #4CAF50; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map.value)

      userMarker.value.bindPopup('You', { offset: [0, -12], closeButton: false })
    }
  } catch (error) {
    // console.error('Error updating user marker:', error)
    // Silently ignore user marker errors
    userMarker.value = null
  }
}

// ========== WINDOW FUNCTIONS ==========
window.editMarker = (markerId) => {
  const marker = locations.value.find(m => m.id === markerId)
  if (!marker) {
    toast.error('Marker not found')
    return
  }

  const markerObj = markerInstances.value.find(m => m._markerData && m._markerData.id === markerId)
  if (markerObj && markerObj.closePopup) {
    markerObj.closePopup()
  }

  enableMarkerDragging(markerId, (dragData) => {
    markerDragData.value = dragData
    showMarkerDragModal.value = true
  })
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
    path_data: pathData,
    color: routeObj.data.color || '#3B82F6'
  }

  // Enable editing mode with draggable markers
  // Do NOT show modal - only show when user clicks check button
  enableRouteEditing(routeId, (updatedPathData) => {
    // Update form data as user drags points
    routeFormData.value.path_data = updatedPathData

    // Update start and end points
    if (updatedPathData.length > 0) {
      routeFormData.value.start_lat = updatedPathData[0].lat
      routeFormData.value.start_lng = updatedPathData[0].lng
      routeFormData.value.end_lat = updatedPathData[updatedPathData.length - 1].lat
      routeFormData.value.end_lng = updatedPathData[updatedPathData.length - 1].lng
    }
  })

  toast.info('Drag route points to edit the path. Click check (✓) when done, then adjust in the modal.')
}


window.deleteRoute = (routeId) => {
  const route = savedRoutes.value.find(r => r.id === routeId)
  if (!route) {
    toast.error('Route not found')
    return
  }

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

window.editPolygon = (polygonId) => {
  const polygon = polygons.value.find(p => p.id === polygonId)
  if (!polygon) {
    toast.error('Polygon not found')
    return
  }

  const polygonObj = polygonInstances.value.find(p => p.id === polygonId)
  if (polygonObj && polygonObj.polygon && polygonObj.polygon.closePopup) {
    polygonObj.polygon.closePopup()
  }

  polygonFormData.value = {
    id: polygon.id,
    name: polygon.name,
    description: polygon.description || '',
    type: polygon.type || 'Building',
    color: polygon.color || '#FF6B6B',
    fill_color: polygon.fill_color || '#FF6B6B',
    fill_opacity: polygon.fill_opacity || 0.3,
    coordinates: polygon.coordinates
  }

  polygonModalMode.value = 'edit'

  // Enable editing mode with draggable markers
  // Do NOT show modal - only show when user clicks check button
  enablePolygonEditing(polygonId, (updatedCoordinates) => {
    polygonFormData.value.coordinates = updatedCoordinates.map(latlng => ({
      lat: latlng.lat,
      lng: latlng.lng
    }))
  })

  toast.info('Drag polygon points to edit. Click check (✓) when done, then adjust in the modal.')
}

window.deletePolygon = (polygonId) => {
  const polygon = polygons.value.find(p => p.id === polygonId)
  if (!polygon) {
    toast.error('Polygon not found')
    return
  }

  const polygonObj = polygonInstances.value.find(p => p.id === polygonId)
  if (polygonObj && polygonObj.polygon && polygonObj.polygon.closePopup) {
    polygonObj.polygon.closePopup()
  }

  deleteModalData.value = {
    type: 'polygon',
    id: polygonId,
    name: polygon.name,
    description: `Type: ${polygon.type} - This facility polygon will be permanently removed from the map.`
  }

  showDeleteConfirmModal.value = true
}

// ========== LIFECYCLE & WATCHERS ==========
let echoListener = null

onMounted(() => {
  map.value = L.map('map').setView([8.16953, 126.00306], 16)

  // Base layers: OSM and Satellite (Esri World Imagery)
  baseLayers.value.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 50,
    attribution: '© OpenStreetMap contributors'
  })

  baseLayers.value.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 50,
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
  })

  // Add default base layer
  baseLayers.value[currentBaseLayer.value].addTo(map.value)

  getUserLocation()

  fetchMarkers()
  fetchRoutes()
  fetchPolygons()

  if (props.isAdmin) {
    map.value.on('click', handleMapClick)
    map.value.on('dblclick', handleMapDblClick)
  }

  // Real-time updates with Echo
  if (!window.Echo) {
    // console.warn('Laravel Echo is not available. Real-time updates will be disabled.')
  } else {
    echoListener = window.Echo.channel('main-channel')
      .listen('.MainEvent', (e) => {
        // COMPLETE REFRESH ON ANY EVENT
        // Always fetch all three to ensure consistency

        if (e.type === 'route') {
          fetchRoutes()
        } else if (e.type === 'facility') {
          fetchMarkers()
          fetchPolygons()
        } else if (e.type === 'marker') {
          fetchMarkers()
        } else if (e.type === 'polygon') {
          fetchPolygons()
        }

        // Always ensure all three are fresh for consistency
        setTimeout(() => {
          if (e.type !== 'route') fetchRoutes()
          if (e.type !== 'marker') fetchMarkers()
          if (e.type !== 'polygon') fetchPolygons()
        }, 100)
      })

    // console.log('Real-time event listener registered')
  }

  // Listen for keyboard/finish events from polygon composable
  const _onPolygonFinished = (e) => {
    const data = e.detail
    if (!data || !data.coordinates) return

    // Normalize coordinates and open polygon modal
    polygonFormData.value.coordinates = data.coordinates.map(pt => ({ lat: pt.lat, lng: pt.lng }))
    polygonModalMode.value = 'add'
    showPolygonModal.value = true

    // Make sure drawing mode is turned off
    drawPolygonMode.value = false
    try {
      cancelDrawingPolygon()
    } catch (err) {
      // ignore if cancel is not available or already cleaned up
    }
  }

  const _onPolygonCancelled = () => {
    toast.info('Polygon drawing cancelled')
  }

  window.addEventListener('polygon:finished', _onPolygonFinished)
  window.addEventListener('polygon:cancelled', _onPolygonCancelled)

  return () => {
    window.removeEventListener('polygon:finished', _onPolygonFinished)
    window.removeEventListener('polygon:cancelled', _onPolygonCancelled)
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

    <!-- Admin Controls (right, vertical, icons only) -->
    <div v-if="isAdmin" class="absolute top-15 right-4 z-[1000] flex flex-col items-end">
      <!-- Primary controls: single column, 3 rows -->
      <div class="flex flex-col gap-2 bg-white/90 p-0 rounded-lg shadow-lg">
        <div class="mb-2">
        <button
          @click="toggleBaseLayer"
          class="w-10 h-10 flex items-center justify-center rounded-md bg-white text-gray-800 hover:bg-gray-100 shadow"
          :title="currentBaseLayer === 'osm' ? 'Switch to Satellite' : 'Switch to OSM'"
          aria-label="Toggle Base Layer"
        >
          <GlobeAltIcon class="h-5 w-5" />
        </button>
      </div>
        <button
          @click="toggleClickAddMode"
          :class="[
            'w-12 h-12 flex items-center justify-center rounded-md transition-all',
            clickAddModeEnabled ? 'bg-green-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'
          ]"
          :title="clickAddModeEnabled ? 'Adding Marker' : 'Add Marker'"
          aria-label="Add Marker"
        >
          <MapPinIcon class="h-5 w-5" />
        </button>

        <button
          @click="toggleDrawRouteMode"
          :class="[
            'w-12 h-12 flex items-center justify-center rounded-md transition-all',
            drawRouteMode ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'
          ]"
          :disabled="editRouteMode"
          :title="drawRouteMode ? 'Drawing Route' : 'Draw Route'"
          aria-label="Draw Route"
        >
          <PencilIcon class="h-5 w-5" />
        </button>

        <button
          @click="toggleDrawPolygonMode"
          :class="[
            'w-12 h-12 flex items-center justify-center rounded-md transition-all',
            drawPolygonMode ? 'bg-purple-600 text-white' : 'bg-white text-gray-800 hover:bg-gray-100'
          ]"
          :disabled="editPolygonMode"
          :title="drawPolygonMode ? 'Drawing Facility' : 'Draw Facility'"
          aria-label="Draw Facility"
        >
          <Square3Stack3DIcon class="h-5 w-5" />
        </button>
      </div>

      <!-- Secondary action buttons (icons only) -->
      <div class="flex flex-col gap-2 mt-1">
        <button
          v-if="isDrawingRoute"
          @click="finishDrawingRoute"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-green-600 text-white shadow"
          title="Finish Route"
          aria-label="Finish Route"
        >
          <CheckIcon class="h-5 w-5" />
        </button>

        <button
          v-if="isDrawingRoute"
          @click="cancelRouteDrawing"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-red-600 text-white shadow"
          title="Cancel Route"
          aria-label="Cancel Route"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>

        <button
          v-if="isDrawingPolygon"
          @click="finishDrawingPolygonHandler"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-green-600 text-white shadow"
          title="Finish Polygon"
          aria-label="Finish Polygon"
        >
          <CheckIcon class="h-5 w-5" />
        </button>

        <button
          v-if="isDrawingPolygon"
          @click="cancelDrawingPolygon"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-red-600 text-white shadow"
          title="Cancel Polygon"
          aria-label="Cancel Polygon"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>

        <button
          v-if="editRouteMode"
          @click="saveRoute"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-blue-600 text-white shadow"
          title="Save Route"
          aria-label="Save Route"
        >
          <CheckIcon class="h-5 w-5" />
        </button>

        <button
          v-if="editPolygonMode"
          @click="savePolygon"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-purple-600 text-white shadow"
          title="Save Polygon"
          aria-label="Save Polygon"
        >
          <CheckIcon class="h-5 w-5" />
        </button>

        <button
          v-if="editRouteMode || editPolygonMode"
          @click="editRouteMode ? cancelEditRoute() : closePolygonModal()"
          class="w-12 h-12 flex items-center justify-center rounded-md bg-gray-600 text-white shadow"
          title="Cancel Edit"
          aria-label="Cancel Edit"
        >
          <XMarkIcon class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- Marker Modal -->
    <Modal :show="showMarkerModal" @close="closeMarkerModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ markerModalMode === 'edit' ? 'Edit Marker' : 'Create New Marker' }}
          </h3>
        </div>

        <div class="px-6 py-5">
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
              <TextInput v-model="markerFormData.type" type="text" placeholder="e.g., Building, Office, Classroom" class="w-full" />
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

    <!-- Route Modal -->
    <Modal :show="showRouteModal" @close="cancelEditRoute">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ routeModalMode === 'edit' ? 'Edit Route' : 'Save Route' }}
          </h3>
        </div>

        <div class="px-6 py-5">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Starting Point</label>
              <TextInput
                :model-value="startingPointDisplay"
                type="text"
                readonly
                placeholder="Click first point on map"
                class="w-full bg-gray-50"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Ending Point</label>
              <TextInput
                :model-value="endingPointDisplay"
                type="text"
                readonly
                placeholder="Click last point on map"
                class="w-full bg-gray-50"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Estimated Time</label>
              <TextInput v-model="routeFormData.estimated_time" type="text" placeholder="e.g., 5 minutes" class="w-full" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-2">Route Color</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="routeFormData.color"
                    type="color"
                    class="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    v-model="routeFormData.color"
                    type="text"
                    placeholder="#3B82F6"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p class="text-xs text-gray-500 mt-1">Choose a color for this route path</p>
              </div>

              <div class="flex items-end">
                <div class="w-full">
                  <label class="block text-sm font-medium text-gray-900 mb-2">Preview</label>
                  <div
                    class="h-10 w-full rounded border border-gray-300"
                    :style="{ backgroundColor: routeFormData.color }"
                  ></div>
                </div>
              </div>
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

    <!-- Polygon Modal -->
    <Modal :show="showPolygonModal" @close="closePolygonModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ polygonModalMode === 'edit' ? 'Edit Facility Polygon' : 'Create Facility Polygon' }}
          </h3>
        </div>

        <div class="px-6 py-5">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Facility Name *</label>
              <TextInput v-model="polygonFormData.name" type="text" placeholder="e.g., Engineering Building" class="w-full" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-900 mb-2">Description</label>
              <textarea
                v-model="polygonFormData.description"
                placeholder="Optional description..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                rows="3"
              ></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-2">Type</label>
                <select v-model="polygonFormData.type" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option v-for="type in polygonTypes" :key="type" :value="type">{{ type }}</option>
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 mb-2">Border Color</label>
                <input v-model="polygonFormData.color" type="color" class="w-full h-10 px-1 py-1 border border-gray-300 rounded-md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 mb-2">Fill Color</label>
                <input v-model="polygonFormData.fill_color" type="color" class="w-full h-10 px-1 py-1 border border-gray-300 rounded-md" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 mb-2">Fill Opacity</label>
                <input v-model.number="polygonFormData.fill_opacity" type="range" min="0" max="1" step="0.1" class="w-full" />
                <div class="text-xs text-gray-500 text-center mt-1">{{ (polygonFormData.fill_opacity * 100).toFixed(0) }}%</div>
              </div>
            </div>

            <div class="text-sm text-gray-600">
              Polygon points: {{ polygonFormData.coordinates.length }}
            </div>

            <div v-if="polygonModalMode === 'edit'" class="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p class="text-xs text-blue-800 font-medium mb-1">Editing Tips:</p>
              <ul class="text-xs text-blue-700 space-y-1">
                <li>• Drag markers to adjust polygon shape</li>
                <li>• Click on edges to add new points</li>
                <li>• Right-click on markers to remove points (min 3)</li>
              </ul>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button @click="closePolygonModal" :disabled="isSubmitting" class="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md">
            Cancel
          </button>
          <button @click="savePolygon" :disabled="!polygonFormData.name || polygonFormData.coordinates.length < 3 || isSubmitting" class="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md disabled:bg-gray-400">
            {{ isSubmitting ? 'Saving...' : (polygonModalMode === 'edit' ? 'Save Changes' : 'Save Polygon') }}
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

    <!-- Delete Confirmation Modal -->
    <Modal :show="showDeleteConfirmModal" @close="closeDeleteModal">
      <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            Delete {{ deleteModalData.type === 'route' ? 'Route' : deleteModalData.type === 'polygon' ? 'Polygon' : 'Marker' }}
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
            {{ isSubmitting ? 'Deleting...' : `Delete ${deleteModalData.type === 'route' ? 'Route' : deleteModalData.type === 'polygon' ? 'Polygon' : 'Marker'}` }}
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

.edit-polygon-marker {
  z-index: 1000 !important;
}

.edit-polygon-marker:hover {
  z-index: 1001 !important;
}

.polygon-tooltip {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}
</style>
