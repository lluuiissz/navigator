<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount, toRefs } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useReactiveStore } from '../../store/reactives/reactive'
import { useToast } from 'vue-toastification'
import { useMapRouting } from '../../composables/useMapRouting'
import { useGuestTracking } from '../../composables/useGuestTracking'
import { useFacilityMarkers } from '../../composables/useFacilityMarkers'
import { ReCompass3Fill } from '@kalimahapps/vue-icons';

// Props
const props = defineProps({
  facilities: {
    type: Array,
    default: () => []
  },
  notes: {
    type: Array,
    default: () => []
  },
  polygons: {
    type: Array,
    default: () => []
  }
})

const toast = useToast()
const react = useReactiveStore()
const {
  isSearching,
  showSearchResults,
  showGuestModal,
  isGuestInfoComplete,
  showInstructions,
  isSavingFeedback,
  map,
  searchQuery,
  destinationMarker,
  routePolyline,
  routeInfo,
  privateRoutes,
  guestStep,
  selectedMarker,
  feedback,
  message,
  filteredLocations,
  selectedLocation,
  geoJsonLayers,
  navigationInstructions,
} = toRefs(react)

// Use composables
const routingUtils = useMapRouting()
const tracking = useGuestTracking()
const { addFacilityMarker, displayPolygons, markerTypeIcons, facilityMarkers, polygonLayers } = useFacilityMarkers()

const guestInfo = ref({
  id: null,
  nickname: '',
  role: ''
})
const sessionCheckInterval = ref(null)
const transportMode = ref('walking')
const lastRouteCalculationPosition = ref(null)
const navigationInstructionsContainer = ref(null)

const transportModes = [
  { value: 'walking', label: 'Walking', icon: '🚶', speed: 5 },
  { value: 'riding', label: 'Riding', icon: '🚴', speed: 15 },
  { value: 'driving', label: 'Driving', icon: '🚗', speed: 40 }
]

const noteMarkers = ref([])

const guestRoles = [
  { value: 'student', label: 'Student', icon: '🎓' },
  { value: 'faculty', label: 'Faculty', icon: '👨‍🏫' },
  { value: 'visitor', label: 'Visitor', icon: '👤' },
]
const localNotes = ref([])
const localFeedback = ref([])
const facilityPhotos = ref({})
const isDetailsPanelVisible = ref(false)
const isRoutingActive = ref(false)
const selectedPhotoFile = ref(null)
const photoPreviewUrl = ref(null)
const photoCaption = ref('')
const isUploadingPhoto = ref(false)
const noteContent = ref('')
const isSavingNote = ref(false)
const photoInput = ref(null)
const isShowingNoteInput = ref(false)
const isShowingFeedbackInput = ref(false)
const isPhotoGalleryOpen = ref(false)
const currentPhotoIndex = ref(0)
const showAllPhotos = ref(false)
const activeBaseLayer = ref('navigation')
const STORAGE_TYPE = 'localStorage'

const hydrateFeedback = () => {
  const aggregated = []

  if (Array.isArray(props.facilities)) {
    props.facilities.forEach(facility => {
      const markerFeedbacks = facility?.marker?.feedbacks
      if (Array.isArray(markerFeedbacks)) {
        markerFeedbacks.forEach(feedbackItem => {
          if (feedbackItem) {
            aggregated.push(feedbackItem)
          }
        })
      }
    })
  }

  localFeedback.value = aggregated
}

const hydratePhotos = () => {
  const mapping = {}

  if (Array.isArray(props.facilities)) {
    props.facilities.forEach(facility => {
      if (!facility || !facility.id) {
        return
      }

      mapping[facility.id] = Array.isArray(facility.photos)
        ? [...facility.photos]
        : []
    })
  }

  facilityPhotos.value = mapping
}

hydrateFeedback()
hydratePhotos()

const fetchFacilityPhotos = async (facilityId) => {
  if (!facilityId) {
    return
  }

  try {
    const response = await axios.get(`/pub/facilities/${facilityId}/photos`)
    facilityPhotos.value = {
      ...facilityPhotos.value,
      [facilityId]: Array.isArray(response.data?.photos) ? response.data.photos : []
    }
  } catch (error) {
    console.error('Error fetching facility photos:', error)
  }
}

watch(() => props.notes, (newNotes) => {
  localNotes.value = Array.isArray(newNotes) ? [...newNotes] : []
}, { deep: true })

watch(() => props.facilities, () => {
  hydrateFeedback()
  hydratePhotos()
}, { deep: true })

const currentFacilityId = computed(() => selectedLocation.value?.id ?? null)
const currentMarkerId = computed(() => selectedLocation.value?.marker_id ?? selectedLocation.value?.marker?.id ?? null)

const currentFacilityPhotos = computed(() => {
  if (!currentFacilityId.value) {
    return []
  }

  const allPhotos = facilityPhotos.value[currentFacilityId.value] || []

  // Show only first 2 photos unless "Show All" is clicked
  if (!showAllPhotos.value && allPhotos.length > 2) {
    return allPhotos.slice(0, 2)
  }

  return allPhotos
})

const allFacilityPhotos = computed(() => {
  if (!currentFacilityId.value) {
    return []
  }
  return facilityPhotos.value[currentFacilityId.value] || []
})

const displayedPhotosCount = computed(() => {
  if (!currentFacilityId.value) {
    return { displayed: 0, total: 0 }
  }

  const allPhotos = facilityPhotos.value[currentFacilityId.value] || []
  return {
    displayed: currentFacilityPhotos.value.length,
    total: allPhotos.length
  }
})

const currentFacilityNotes = computed(() => {
  if (!currentMarkerId.value) {
    return []
  }

  return localNotes.value.filter(note => note.marker_id === currentMarkerId.value)
})

const currentFacilityFeedback = computed(() => {
  if (!currentMarkerId.value) {
    return []
  }

  return localFeedback.value.filter(entry => entry.marker_id === currentMarkerId.value)
})

const currentUserHasNote = computed(() => {
  if (!currentMarkerId.value || !guestInfo.value.id) {
    return false
  }

  return currentFacilityNotes.value.some(note => note.guest_id === guestInfo.value.id)
})

const debounce = (func, delay) => {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

const logSearchToBackend = async (query) => {
  if (!query.trim() || !guestInfo.value.id) return
  try {
    await axios.post('/search-logs', {
      guest_id: guestInfo.value.id,
      query: query.trim(),
      search_at: new Date().toISOString(),
    })
    console.log('Search logged successfully')
  } catch (error) {
    console.error('Failed to log search:', error)
  }
}

const debouncedLogSearch = debounce(logSearchToBackend, 500)

// Watch for navigation instructions updates and scroll to top
watch(navigationInstructions, () => {
  if (navigationInstructionsContainer.value) {
    // Scroll to top when instructions update
    navigationInstructionsContainer.value.scrollTop = 0
  }
}, { deep: true })

watch(searchQuery, (query) => {
  if (query.length > 0) {
    debouncedLogSearch(query)
  }

  if (query.length > 0) {
    isSearching.value = true
      filteredLocations.value = locations.value.filter(loc =>
        (loc.name && loc.name.toLowerCase().includes(query.toLowerCase())) ||
        (loc.department && loc.department.toLowerCase().includes(query.toLowerCase())) ||
        (loc.description && loc.description.toLowerCase().includes(query.toLowerCase())) ||
        (loc.floor_number && loc.floor_number.toLowerCase().includes(query.toLowerCase())) ||
        (loc.category && loc.category.toLowerCase().includes(query.toLowerCase()))
      )
    showSearchResults.value = true
  } else {
    showSearchResults.value = false
    filteredLocations.value = []
  }
  isSearching.value = false
})

const startSessionChecker = () => {
  sessionCheckInterval.value = setInterval(() => {
    const savedGuestInfo = sessionStorage.getItem('guestInfo')
    if (savedGuestInfo) {
      try {
        const parsed = JSON.parse(savedGuestInfo)
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          console.log('⏱️ Session expired, reloading page...')
          clearSessionAndReload()
        }
      } catch (error) {
        console.error('Error checking session:', error)
        clearSessionAndReload()
      }
    }
  }, 60000)
}

const clearSessionAndReload = () => {
  sessionStorage.removeItem('guestInfo')
  window.location.reload()
}

const loadGuestInfoFromSession = () => {
  const savedGuestInfo = sessionStorage.getItem('guestInfo')
  if (savedGuestInfo) {
    try {
      const parsed = JSON.parse(savedGuestInfo)
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        console.log('⏱️ Session expired, clearing stored data')
        sessionStorage.removeItem('guestInfo')
        return false
      }
      guestInfo.value = parsed
      isGuestInfoComplete.value = true
      showGuestModal.value = false
      startSessionChecker()
      return true
    } catch (error) {
      console.error('Error parsing guest info:', error)
      sessionStorage.removeItem('guestInfo')
    }
  }
  return false
}

const locations = computed(() => {
  if (!props.facilities || !Array.isArray(props.facilities)) {
    console.warn('No facilities data')
    return []
  }

  return props.facilities
    .filter(facility => {
      const hasValidMarker = facility &&
        facility.marker &&
        facility.marker.longitude !== null &&
        facility.marker.latitude !== null &&
        !isNaN(parseFloat(facility.marker.longitude)) &&
        !isNaN(parseFloat(facility.marker.latitude))

      if (!hasValidMarker) {
        // console.warn('Skipping facility with invalid marker:', facility)
      }
      return hasValidMarker
    })
    .map(facility => {
      try {
        const markerType = facility.marker?.type?.toLowerCase() || 'default'
        return {
          id: facility.id,
          marker_id: facility.marker.id,
          name: facility.name || 'Unnamed Facility',
          lng: parseFloat(facility.marker.longitude),
          lat: parseFloat(facility.marker.latitude),
          department: facility.marker?.type || 'Unknown',
          markerType: markerType,
          category: facility.category || 'General',
          description: facility.description || '',
          floor_number: facility.floor_number ? String(facility.floor_number) : 'Not specified',
          hours: facility.hours || 'Not specified',
          icon: markerTypeIcons[markerType] || markerTypeIcons.default,
          marker: facility.marker,
          photos: Array.isArray(facility.photos) ? facility.photos : [],
          feedbacks: facility.marker?.feedbacks || [],
        }
      } catch (error) {
        console.error('Error processing facility:', facility, error)
        return null
      }
    })
    .filter(location => location !== null)
})

const goToStep2 = () => {
  if (!guestInfo.value.nickname.trim()) {
    toast.error('Please enter your nickname')
    return
  }
  guestStep.value = 2
}

const backToStep1 = () => {
  guestStep.value = 1
}

const saveGuestInfo = async () => {
  if (!guestInfo.value.nickname || !guestInfo.value.role) {
    toast.error('Please complete all steps')
    return
  }

  try {
    const response = await axios.post('/guests', {
      name: guestInfo.value.nickname,
      role: guestInfo.value.role,
    })

    const data = response.data
    guestInfo.value.id = data.id

    const guestData = {
      ...guestInfo.value,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    }

    sessionStorage.setItem('guestInfo', JSON.stringify(guestData))
    isGuestInfoComplete.value = true
    showGuestModal.value = false

    toast.success(`Welcome, ${guestInfo.value.nickname}!`)
    startSessionChecker()

    if (!map.value) {
      await initializeMap()
    } else {
      if (tracking.userLocation.value) {
        tracking.updateUserMarker(guestInfo.value, map.value, handleLocationUpdate)
      } else {
        tracking.startTracking(guestInfo.value, map.value, handleLocationUpdate)
      }
    }
  } catch (error) {
    console.error('Error saving guest info:', error)
    toast.error(error.response?.data?.message || 'Failed to save guest information')
  }
}

const calculateETA = (distanceMeters) => {
  const currentMode = transportModes.find(m => m.value === transportMode.value)
  const speedKmH = currentMode ? currentMode.speed : 5
  const speedMS = speedKmH * 1000 / 3600
  const timeSeconds = distanceMeters / speedMS
  const timeMinutes = Math.ceil(timeSeconds / 60)

  const now = new Date()
  const eta = new Date(now.getTime() + timeSeconds * 1000)

  return {
    minutes: timeMinutes,
    arrivalTime: eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
}

const generateInstructions = (route, isPrivatePath) => {
  return routingUtils.generateEnhancedInstructions(route, isPrivatePath)
}

const openLocationPanel = (location, { centerOnMap = true } = {}) => {
  if (!location) {
    return
  }

  const isSameLocation = selectedLocation.value && selectedLocation.value.id === location.id

  selectedMarker.value = location
  selectedLocation.value = location
  isDetailsPanelVisible.value = true

  if (!isSameLocation) {
    feedback.value = ''
    noteContent.value = ''
    isShowingNoteInput.value = false
    clearPhotoSelection()
    showAllPhotos.value = false // Reset photo display

    // Load notes from localStorage/sessionStorage for this facility
    const storage = STORAGE_TYPE === 'localStorage' ? localStorage : sessionStorage
    const storageKey = `facility_notes_${location.id}`
    const storedNotes = storage.getItem(storageKey)

    if (storedNotes) {
      try {
        const parsedNotes = JSON.parse(storedNotes)
        const now = Date.now()

        // Filter out expired notes
        const validNotes = parsedNotes.filter(note => {
          if (note.expiresAt && note.expiresAt < now) {
            return false // Expired
          }
          return true
        })

        // Save back without expired notes
        if (validNotes.length !== parsedNotes.length) {
          storage.setItem(storageKey, JSON.stringify(validNotes))
        }

        // Merge valid notes with local notes
        const storageNoteIds = new Set(validNotes.map(n => n.id))
        const otherNotes = localNotes.value.filter(n => !storageNoteIds.has(n.id))
        localNotes.value = [...validNotes, ...otherNotes]
      } catch (e) {
        console.warn('Error parsing stored notes:', e)
      }
    }
  }

  if (location.id) {
    fetchFacilityPhotos(location.id)
  }

  if (centerOnMap && map.value) {
    try {
      map.value.panTo([location.lat, location.lng], { animate: true })
    } catch (error) {
      console.warn('Failed to pan to location:', error)
    }
  }
}

const closeDetailsPanel = () => {
  isDetailsPanelVisible.value = false
}

const startRouteToSelected = () => {
  if (!selectedLocation.value || !map.value) {
    toast.error('Select a destination first')
    return
  }

  createRoute(L.latLng(selectedLocation.value.lat, selectedLocation.value.lng), selectedLocation.value)
}

const createRoute = async (clickLatLng, location = null, routeColor = null) => {
  if (!tracking.userLocation.value) {
    toast.error('Waiting for GPS location...')
    return
  }

  if (location) {
    const isNewSelection = !selectedLocation.value || selectedLocation.value.id !== location.id
    if (isNewSelection || !isDetailsPanelVisible.value) {
      openLocationPanel(location, { centerOnMap: false })
    }
  } else {
    isDetailsPanelVisible.value = false
    selectedLocation.value = null
  }

  // Clear existing route safely
  if (routePolyline.value && map.value) {
    try {
      if (map.value.hasLayer(routePolyline.value)) {
        map.value.removeLayer(routePolyline.value)
      }
    } catch (e) {
      console.warn('Error removing route polyline:', e)
    }
    routePolyline.value = null
  }
  if (destinationMarker.value && map.value) {
    try {
      if (map.value.hasLayer(destinationMarker.value)) {
        map.value.removeLayer(destinationMarker.value)
      }
    } catch (e) {
      console.warn('Error removing destination marker:', e)
    }
    destinationMarker.value = null
  }
  if (map.value) {
    map.value.closePopup()
  }

  const userPos = { lat: tracking.userLocation.value.lat, lng: tracking.userLocation.value.lng }
  const destPos = { lat: clickLatLng.lat, lng: clickLatLng.lng }

  // Store the position where we're calculating this route from
  lastRouteCalculationPosition.value = { lat: userPos.lat, lng: userPos.lng }

  console.log('Calculating optimal route...')

  // Check if user clicked ON a campus path (within 30m)
  if (privateRoutes.value && privateRoutes.value.features) {
    const clickedLineString = routingUtils.findClickedLineString(destPos, privateRoutes.value.features, 30)

    if (clickedLineString) {
      console.log('User clicked on a campus path! Using hybrid route...')

      const lineCoords = clickedLineString.feature.geometry.coordinates
      const nearestPoint = clickedLineString.point

      // Get the entry point of the LineString
      const lineStart = {
        lat: lineCoords[0][1],
        lng: lineCoords[0][0]
      }

      // Step 1: Public route from user to campus path start
      const publicToLine = await routingUtils.getPublicRoute(userPos, lineStart, transportMode.value)
      let fullRoute = []

      if (publicToLine && publicToLine.length > 0) {
        fullRoute = [...publicToLine]
      } else {
        fullRoute = [userPos, lineStart]
      }

      // Step 2: Follow the campus path to the clicked point
      for (let i = 0; i <= nearestPoint.index; i++) {
        const [lng, lat] = lineCoords[i]
        fullRoute.push({ lat, lng })
      }

      drawRouteOnMap(fullRoute, 'hybrid', true, routeColor)
      console.log('Hybrid route to campus path completed')
      return
    }
  }

  // If no private routes available, use public route only
  if (!privateRoutes.value || !privateRoutes.value.features || privateRoutes.value.features.length === 0) {
    console.warn('No campus paths available, using public route only')
    const publicRoute = await routingUtils.getPublicRoute(userPos, destPos, transportMode.value)
    if (publicRoute) {
      drawRouteOnMap(publicRoute, 'public', false, routeColor)
    } else {
      drawRouteOnMap([userPos, destPos], 'direct', false, routeColor)
    }
    return
  }

  // Build campus graph from private routes
  const campusGraph = routingUtils.buildCampusGraph(privateRoutes.value.features)

  if (campusGraph.size === 0) {
    console.warn('Campus graph is empty, using public route only')
    const publicRoute = await routingUtils.getPublicRoute(userPos, destPos, transportMode.value)
    if (publicRoute) {
      drawRouteOnMap(publicRoute, 'public', false, routeColor)
    } else {
      drawRouteOnMap([userPos, destPos], 'direct', false, routeColor)
    }
    return
  }

  // Calculate all possible route options
  const routeOptions = []

  // Option 1: Public route only
  try {
    const publicRoute = await routingUtils.getPublicRoute(userPos, destPos, transportMode.value)
    if (publicRoute && publicRoute.length > 0) {
      const distance = routingUtils.calculateRouteDistance(publicRoute)
      routeOptions.push({
        type: 'public',
        route: publicRoute,
        distance: distance,
        isPrivate: false
      })
      console.log(`Public route: ${Math.round(distance)}m`)
    }
  } catch (error) {
    console.error('Public route error:', error)
  }

  // Option 2: Private campus route (if both points are near campus)
  try {
    const startNodeId = routingUtils.findNearestNode(userPos, campusGraph, 100)
    const goalNodeId = routingUtils.findNearestNode(destPos, campusGraph, 100)

    if (startNodeId && goalNodeId) {
      console.log(`🔍 Trying A* from ${startNodeId} to ${goalNodeId}`)
      const privateRoute = routingUtils.findPathAStar(startNodeId, goalNodeId, campusGraph)

      if (privateRoute && privateRoute.length > 0) {
        const distance = routingUtils.calculateRouteDistance(privateRoute)
        routeOptions.push({
          type: 'private',
          route: privateRoute,
          distance: distance,
          isPrivate: true
        })
        console.log(`Campus route: ${Math.round(distance)}m`)
      }
    }
  } catch (error) {
    console.error('Campus route error:', error)
  }

  // Option 3: Hybrid routes (public to campus entrance + private path)
  try {
    const campusEntrances = routingUtils.findCampusEntrances(campusGraph)

    if (campusEntrances.length > 0) {
      const nearestEntrance = campusEntrances.reduce((nearest, entrance) => {
        const dist = routingUtils.calculateDistance(destPos.lat, destPos.lng, entrance.lat, entrance.lng)
        return dist < nearest.distance ? { entrance, distance: dist } : nearest
      }, { entrance: null, distance: Infinity })

      if (nearestEntrance.entrance && nearestEntrance.distance < 200) {
        const entrancePos = { lat: nearestEntrance.entrance.lat, lng: nearestEntrance.entrance.lng }
        const publicToEntrance = await routingUtils.getPublicRoute(userPos, entrancePos, transportMode.value)

        if (publicToEntrance && publicToEntrance.length > 0) {
          const goalNodeId = routingUtils.findNearestNode(destPos, campusGraph, 100)

          if (goalNodeId) {
            const privatePath = routingUtils.findPathAStar(nearestEntrance.entrance.id, goalNodeId, campusGraph)

            if (privatePath && privatePath.length > 0) {
              const hybridRoute = [...publicToEntrance, ...privatePath]
              const distance = routingUtils.calculateRouteDistance(hybridRoute)
              routeOptions.push({
                type: 'hybrid',
                route: hybridRoute,
                distance: distance,
                isPrivate: true
              })
              console.log(`Hybrid route: ${Math.round(distance)}m`)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Hybrid route error:', error)
  }

  // Select the best route (shortest distance)
  if (routeOptions.length === 0) {
    console.warn('All routing failed, using direct line')
    drawRouteOnMap([userPos, destPos], 'direct', false)
    return
  }

  const bestRoute = routeOptions.reduce((best, current) =>
    current.distance < best.distance ? current : best
  )

  console.log(`Selected: ${bestRoute.type.toUpperCase()} route (${Math.round(bestRoute.distance)}m)`)
  drawRouteOnMap(bestRoute.route, bestRoute.type, bestRoute.isPrivate)
}

const drawRouteOnMap = (route, routeType, isPrivatePath, routeColor = null) => {
  if (!map.value) {
    console.warn('Cannot draw route: map not initialized')
    return
  }

  // Remove old route layers safely before adding new ones
  if (routePolyline.value) {
    try {
      if (map.value.hasLayer(routePolyline.value)) {
        map.value.removeLayer(routePolyline.value)
      }
    } catch (e) {
      console.warn('Error removing old route polyline:', e)
    }
    routePolyline.value = null
  }

  if (destinationMarker.value) {
    try {
      if (map.value.hasLayer(destinationMarker.value)) {
        map.value.removeLayer(destinationMarker.value)
      }
    } catch (e) {
      console.warn('Error removing old destination marker:', e)
    }
    destinationMarker.value = null
  }

  const routeCoords = route.map(p => [p.lat, p.lng])

  const routeColors = {
    public: '#4CAF50',
    private: '#FF6B6B',
    hybrid: '#2196F3',
    direct: '#9E9E9E'
  }

  // Use database color if provided, otherwise use type-based color
  const finalColor = routeColor || routeColors[routeType] || '#9E9E9E'

  routePolyline.value = L.polyline(routeCoords, {
    color: finalColor,
    weight: 6,
    opacity: 0.8,
    smoothFactor: 1.0
  }).addTo(map.value)

  isRoutingActive.value = true

  // Destination marker removed - using facility marker instead

  const totalDistance = routingUtils.calculateRouteDistance(route)
  const distanceText = totalDistance > 1000
    ? `${(totalDistance / 1000).toFixed(2)} km`
    : `${Math.round(totalDistance)} m`

  const eta = calculateETA(totalDistance)

  const routeLabels = {
    public: '🟢 Public Roads',
    private: '🔴 Campus Path',
    hybrid: '🔵 Public → Campus',
    direct: '⚪ Direct Line'
  }

  const currentMode = transportModes.find(m => m.value === transportMode.value)
  routeInfo.value = `${routeLabels[routeType]}\n${currentMode.icon} ${currentMode.label}\n📏 ${distanceText}\n⏱️ ${eta.minutes} min\n🕐 Arrive at ${eta.arrivalTime}`

  // Generate updated navigation instructions (use original route array with {lat, lng} objects)
  navigationInstructions.value = generateInstructions(route, isPrivatePath)
  showInstructions.value = true

  console.log(`Generated ${navigationInstructions.value.length} navigation instructions`)

  // Fit bounds to the new route with safeguards
  try {
    if (routePolyline.value && map.value.hasLayer(routePolyline.value)) {
      map.value.fitBounds(routePolyline.value.getBounds(), { padding: [50, 50] })
    }
  } catch (error) {
    console.warn('Error fitting bounds:', error)
  }

  toast.success(`Route via ${routeLabels[routeType]}`)
}

const loadAllNotesFromStorage = () => {
  // Load notes from all facilities in localStorage/sessionStorage
  const storage = STORAGE_TYPE === 'localStorage' ? localStorage : sessionStorage
  const allNotes = []
  const now = Date.now()

  // Iterate through all storage keys
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && key.startsWith('facility_notes_')) {
      try {
        const notesData = storage.getItem(key)
        if (notesData) {
          const notes = JSON.parse(notesData)
          // Filter out expired notes
          const validNotes = notes.filter(note => {
            if (note.expiresAt && note.expiresAt < now) {
              return false // Expired
            }
            return true
          })

          // Update storage if we filtered out expired notes
          if (validNotes.length !== notes.length) {
            storage.setItem(key, JSON.stringify(validNotes))
          }

          allNotes.push(...validNotes)
        }
      } catch (e) {
        console.warn(`Error parsing notes from ${key}:`, e)
      }
    }
  }

  localNotes.value = allNotes
  console.log(`📝 Loaded ${allNotes.length} notes from ${STORAGE_TYPE}`)
}

// Jump to user's current GPS location
const jumpToMyLocation = () => {
  if (!map.value) {
    toast.error('Map not initialized')
    return
  }

  if (!tracking.userLocation.value) {
    toast.error('GPS location not available yet')
    return
  }

  const { lat, lng } = tracking.userLocation.value

  map.value.flyTo([lat, lng], 18, {
    animate: true,
    duration: 1.5
  })

  toast.success('Centered on your location')

  // Open popup if marker exists
  if (tracking.userMarker.value) {
    setTimeout(() => {
      tracking.userMarker.value.openPopup()
      setTimeout(() => tracking.userMarker.value.closePopup(), 2000)
    }, 1500)
  }
}

const deleteNote = async (noteId) => {
  try {
    const storage = STORAGE_TYPE === 'localStorage' ? localStorage : sessionStorage

    // Find the note to get its facility ID
    const noteToDelete = localNotes.value.find(n => n.id === noteId)
    if (!noteToDelete) {
    //   toast.error('Note not found')
      return
    }

    // Get the facility associated with this note's marker
    let removedFromStorage = false
    const facility = locations.value.find(loc => loc.marker_id === noteToDelete.marker_id)
    if (facility) {
      const storageKey = `facility_notes_${facility.id}`
      const existingNotesData = storage.getItem(storageKey)

      if (existingNotesData) {
        let notesArray = JSON.parse(existingNotesData)
        const filtered = notesArray.filter(note => note.id !== noteId)
        if (filtered.length !== notesArray.length) {
          if (filtered.length === 0) {
            storage.removeItem(storageKey)
          } else {
            storage.setItem(storageKey, JSON.stringify(filtered))
          }
          removedFromStorage = true
        }
      }
    }

    if (!removedFromStorage) {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i)
        if (!key || !key.startsWith('facility_notes_')) continue
        try {
          const data = storage.getItem(key)
          if (!data) continue
          let notesArr = JSON.parse(data)
          const filtered = notesArr.filter(n => n.id !== noteId)
          if (filtered.length !== notesArr.length) {
            if (filtered.length === 0) {
              storage.removeItem(key)
            } else {
              storage.setItem(key, JSON.stringify(filtered))
            }
            removedFromStorage = true
            break
          }
        } catch (e) {
          console.warn('Error checking storage key for note deletion:', key, e)
        }
      }
    }

    // Remove from map - ensure safe removal
    const noteMarkerIndex = noteMarkers.value.findIndex(nm => nm.noteId === noteId)
    if (noteMarkerIndex !== -1 && map.value) {
      const marker = noteMarkers.value[noteMarkerIndex].marker
      if (marker) {
        try {
          // Remove all event listeners first
          marker.off()
          // Remove from map if it's still there
          if (map.value.hasLayer(marker)) {
            map.value.removeLayer(marker)
          }
        } catch (e) {
          console.warn('Error removing note marker:', e)
        }
      }
      noteMarkers.value.splice(noteMarkerIndex, 1)
    }

    // Remove from local state (this will trigger the watch and redisplay)
    localNotes.value = localNotes.value.filter(note => note.id !== noteId)

    if (removedFromStorage) {
      toast.success('Note deleted')
    } else {
      toast.warning('Note removed from view but not found in storage')
    }
  } catch (error) {
    console.error('Error deleting note:', error)
    // toast.error('Failed to delete note')
  }
}

const saveNote = async () => {
  if (!noteContent.value.trim()) {
    toast.error('Please enter a note before saving')
    return
  }

  if (!guestInfo.value.id) {
    toast.error('Guest information not found')
    return
  }

  if (!selectedLocation.value) {
    toast.error('Select a destination to attach the note')
    return
  }

  isSavingNote.value = true

  try {
    const storage = STORAGE_TYPE === 'localStorage' ? localStorage : sessionStorage
    const storageKey = `facility_notes_${selectedLocation.value.id}`
    const expirationKey = `${storageKey}_expiration`

    // Get existing notes
    const existingNotesData = storage.getItem(storageKey)
    let notesArray = existingNotesData ? JSON.parse(existingNotesData) : []

    // Remove any expired notes
    const now = Date.now()
    notesArray = notesArray.filter(note => {
      if (note.expiresAt && note.expiresAt < now) {
        return false // Expired
      }
      return true
    })

    // Check if this guest already has a note for this facility
    const existingNoteIndex = notesArray.findIndex(note => note.guest_id === guestInfo.value.id)

    // Create new note with 24-hour expiration
    const expiresAt = now + (24 * 60 * 60 * 1000) // 24 hours from now
    const newNote = {
      id: `${STORAGE_TYPE}_${Date.now()}`,
      content: noteContent.value.trim(),
      marker_id: selectedLocation.value.marker_id,
      guest_id: guestInfo.value.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expiresAt: expiresAt,
      guest: {
        id: guestInfo.value.id,
        name: guestInfo.value.nickname
      }
    }

    // Replace existing note or add new one
    if (existingNoteIndex !== -1) {
      // Replace old note
      notesArray[existingNoteIndex] = newNote
    } else {
      // Add new note
      notesArray.push(newNote)
    }

    // Save to storage
    storage.setItem(storageKey, JSON.stringify(notesArray))

    // Update local state - remove old note from this guest if exists
    localNotes.value = localNotes.value.filter(note =>
      !(note.marker_id === selectedLocation.value.marker_id && note.guest_id === guestInfo.value.id)
    )
    localNotes.value = [...localNotes.value, newNote]

    // Refresh the page to reload all notes and ensure clean state
      window.location.reload()
  } catch (error) {
    console.error('Error saving note:', error)
    toast.error('Failed to save note')
  } finally {
    isSavingNote.value = false
  }
}

const handlePhotoSelected = (event) => {
  const file = event?.target?.files?.[0]

  if (!file) {
    return
  }

  if (photoPreviewUrl.value) {
    URL.revokeObjectURL(photoPreviewUrl.value)
  }

  selectedPhotoFile.value = file
  photoPreviewUrl.value = URL.createObjectURL(file)

  if (event?.target) {
    event.target.value = ''
  }
}

const clearPhotoSelection = () => {
  if (photoPreviewUrl.value) {
    URL.revokeObjectURL(photoPreviewUrl.value)
  }

  selectedPhotoFile.value = null
  photoPreviewUrl.value = null
  photoCaption.value = ''

  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

const openNoteInput = () => {
  // Check if user already has a note and pre-fill it
  const existingNote = currentFacilityNotes.value.find(note => note.guest_id === guestInfo.value.id)
  if (existingNote) {
    noteContent.value = existingNote.content
  } else {
    noteContent.value = ''
  }
  isShowingNoteInput.value = true
}

const uploadPhoto = async () => {
  if (!selectedLocation.value) {
    toast.error('Select a destination before uploading photos')
    return
  }

  if (!guestInfo.value.id) {
    toast.error('Guest information not found')
    return
  }

  if (!selectedPhotoFile.value) {
    toast.error('Choose a photo to upload')
    return
  }

  isUploadingPhoto.value = true

  try {
    const formData = new FormData()
    formData.append('photo', selectedPhotoFile.value)
    formData.append('guest_id', guestInfo.value.id)
    if (photoCaption.value.trim()) {
      formData.append('caption', photoCaption.value.trim())
    }

    const response = await axios.post(`/pub/facilities/${selectedLocation.value.id}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    const uploadedPhoto = response.data.photo
    const facilityId = selectedLocation.value.id
    facilityPhotos.value = {
      ...facilityPhotos.value,
      [facilityId]: [uploadedPhoto, ...(facilityPhotos.value[facilityId] || [])]
    }

    toast.success(response.data.message || 'Photo uploaded successfully!')
    clearPhotoSelection()
  } catch (error) {
    console.error('Error uploading photo:', error)
    toast.error('Failed to upload photo')
  } finally {
    isUploadingPhoto.value = false
  }
}

const triggerPhotoPicker = () => {
  if (photoInput.value) {
    photoInput.value.click()
  }
}

const formatTimestamp = (value) => {
  if (!value) {
    return ''
  }

  try {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (error) {
    console.warn('Failed to format timestamp:', error)
    return value
  }
}

const displayNotesOnMap = () => {
  // Notes are now displayed as permanent bubbles using separate markers
  // This avoids all tooltip animation issues during zoom
  if (!map.value || !map.value._loaded || !Array.isArray(facilityMarkers.value)) {
    console.warn('displayNotesOnMap: Map or markers not ready')
    return
  }

  if (!guestInfo.value || !guestInfo.value.id) {
    console.warn('displayNotesOnMap: Guest info not available')
    return
  }

  if (isZoomInProgress || map.value._animatingZoom || map.value._isZooming) {
    console.warn('displayNotesOnMap: BLOCKED - Zoom in progress!')
    // Don't retry automatically - let zoomend handler trigger it
    return
  }

  // Extra safety: Wait a tick to ensure any pending zoom animations are complete
  if (map.value._zoom !== map.value.getZoom()) {
    console.warn('displayNotesOnMap: Zoom level mismatch, delaying...')
    setTimeout(() => displayNotesOnMap(), 300)
    return
  }

//   console.log('displayNotesOnMap: Starting (safe to proceed)')

  // First, remove all existing note markers safely
  noteMarkers.value.forEach(nm => {
    if (nm.marker && map.value) {
      try {
        // Remove all event listeners
        nm.marker.off()
        // Remove from map only if it's still there
        if (map.value.hasLayer(nm.marker)) {
          map.value.removeLayer(nm.marker)
        }
      } catch (e) {
        console.warn('Error removing note marker:', e)
      }
    }
  })
  noteMarkers.value = []

  // Create new note markers for each facility with a note
  facilityMarkers.value.forEach((marker, index) => {
    const location = locations.value[index]
    if (!location) return

    // Find user's note for this facility
    const userNote = localNotes.value.find(note =>
      note.marker_id === location.marker_id &&
      note.guest_id === guestInfo.value.id
    )

    if (userNote) {
      try {
        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
          const div = document.createElement('div')
          div.textContent = text
          return div.innerHTML
        }

        // Create note bubble HTML with inline styles for guaranteed visibility
        const noteBubbleHTML = `
          <div class="note-bubble-container" data-note-id="${userNote.id}" style="
            background: white !important;
            border: 2px solid #E5E7EB !important;
            border-radius: 12px !important;
            padding: 14px 16px !important;
            min-width: 220px !important;
            max-width: 300px !important;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.08) !important;
            position: relative !important;
            opacity: 1 !important;
            transform: translateY(-100%) !important;
            margin-bottom: 20px !important;
            pointer-events: auto !important;
          ">
            <div class="note-bubble-header" style="
              display: flex !important;
              align-items: flex-start !important;
              gap: 10px !important;
              margin-bottom: 10px !important;
              padding-bottom: 10px !important;
              border-bottom: 1px solid #F3F4F6 !important;
            ">
              <div class="note-bubble-icon" style="font-size: 20px !important; line-height: 1 !important; flex-shrink: 0 !important;">💬</div>
              <div class="note-bubble-meta" style="
                flex: 1 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 3px !important;
              ">
                <span class="note-bubble-label" style="
                  font-size: 11px !important;
                  font-weight: 700 !important;
                  color: #6366F1 !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.8px !important;
                ">Your Note</span>
                <span class="note-bubble-time" style="
                  font-size: 10px !important;
                  color: #9CA3AF !important;
                  font-weight: 500 !important;
                ">${formatTimestamp(userNote.created_at)}</span>
              </div>
              <button
                class="note-bubble-delete"
                title="Delete note"
                data-note-id="${userNote.id}"
                style="
                  background: #FEE2E2 !important;
                  border: none !important;
                  border-radius: 6px !important;
                  width: 24px !important;
                  height: 24px !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  cursor: pointer !important;
                  color: #EF4444 !important;
                  transition: all 0.2s ease !important;
                  flex-shrink: 0 !important;
                  padding: 0 !important;
                "
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M9 3L3 9M3 3L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
            <div class="note-bubble-content" style="
              font-size: 14px !important;
              color: #1F2937 !important;
              line-height: 1.6 !important;
              word-wrap: break-word !important;
              font-weight: 400 !important;
              padding: 0 !important;
            ">${escapeHtml(userNote.content)}</div>
            <div class="note-bubble-arrow" style="
              position: absolute !important;
              bottom: -10px !important;
              left: 50% !important;
              transform: translateX(-50%) !important;
              width: 0 !important;
              height: 0 !important;
              border-left: 12px solid transparent !important;
              border-right: 12px solid transparent !important;
              border-top: 12px solid white !important;
              filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.1)) !important;
            "></div>
          </div>
        `

        // Create a custom DivIcon for the note bubble
        const noteBubbleIcon = L.divIcon({
          className: 'note-bubble-marker',
          html: noteBubbleHTML,
          iconSize: [280, 'auto'],
          iconAnchor: [140, 70] // Center horizontally, position above marker
        })

        // SAFETY CHECK: Verify map is still valid and not zooming before adding marker
        if (!map.value || isZoomInProgress || map.value._animatingZoom) {
          console.warn(`Aborting note marker creation for ${location.name} - zoom in progress`)
          return
        }

        const noteMarker = L.marker([location.lat, location.lng], {
          icon: noteBubbleIcon,
          interactive: true,
          zIndexOffset: 1000,
          bubblingMouseEvents: true
        })

        // Add to map with error handling
        try {
          noteMarker.addTo(map.value)
        } catch (addError) {
          console.error(`Failed to add note marker to map:`, addError)
          return
        }

        // Store reference to note marker
        noteMarkers.value.push({
          noteId: userNote.id,
          marker: noteMarker,
          facilityMarkerId: location.marker_id
        })

        // Add click handler for delete button after marker is added to map
        setTimeout(() => {
          const deleteBtn = document.querySelector(`.note-bubble-delete[data-note-id="${userNote.id}"]`)
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation()
              deleteNote(userNote.id)
            })
          }
        }, 150)

      } catch (error) {
        console.error(`❌ Error creating note marker for ${location.name}:`, error)
      }
    }
  })

  console.log(`📝 Created ${noteMarkers.value.length} note bubble markers`)
}

// Debounce timer for note display to prevent rapid updates during zoom
let noteDisplayTimeout = null
let isZoomInProgress = false // Track zoom state globally

const debouncedDisplayNotes = () => {
  // Skip if zoom is in progress
  if (isZoomInProgress) {
    console.warn('debouncedDisplayNotes: Skipping due to zoom in progress')
    return
  }

  if (noteDisplayTimeout) {
    clearTimeout(noteDisplayTimeout)
  }
  noteDisplayTimeout = setTimeout(() => {
    // Double-check zoom state before executing
    if (!isZoomInProgress && map.value && !map.value._animatingZoom) {
      displayNotesOnMap()
    }
  }, 250) // Increased delay to 250ms
}

watch(localNotes, () => {
  if (map.value && !isZoomInProgress) {
    debouncedDisplayNotes()
  }
}, { deep: true })

watch(() => props.polygons, () => {
  if (map.value) {
    displayPolygons(props.polygons, map.value)
  }
}, { deep: true, immediate: false })

const loadPrivateRoutes = async () => {
  try {
    const response = await axios.get('/routes/export/geojson-pub', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    privateRoutes.value = response.data

    if (map.value) {
      refreshPrivateRoutesOnMap()
    }
    console.log('Loaded routes from database:', privateRoutes.value)
  } catch (error) {
    console.error('Error loading routes from database:', error)
    toast.error('Failed to load campus paths')
  }
}

const refreshPrivateRoutesOnMap = () => {
  if (!map.value || !privateRoutes.value || !privateRoutes.value.features) {
    console.warn('Cannot refresh private routes: Map or data not ready')
    return
  }

  // Remove existing route layers
  geoJsonLayers.value.forEach(layer => {
    if (map.value && map.value.hasLayer && map.value.hasLayer(layer)) {
      try {
        map.value.removeLayer(layer)
      } catch (error) {
        console.warn('Error removing route layer:', error)
      }
    }
  })
  geoJsonLayers.value = []

  // Add new route layers with database color
  privateRoutes.value.features.forEach((feature) => {
    if (feature.geometry && feature.geometry.type === 'LineString') {
      const routeColor = feature.properties?.color || '#FF6B6B'

      const layer = L.geoJSON(feature, {
        style: {
          color: routeColor,
          weight: 6,
          opacity: 0.9,
          dashArray: '10, 5',
          lineCap: 'round',
          lineJoin: 'round'
        }
      }).addTo(map.value)

      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        createRoute(e.latlng, null, feature.properties?.color)
      })

      geoJsonLayers.value.push(layer)
    }
  })

  console.log(`Added ${privateRoutes.value.features.length} campus path layers`)
//   toast.success('Campus paths updated in real-time!')
}

// Load and refresh facilities with their markers
const loadFacilities = async () => {
  try {
    // In Inertia, we need to fetch from root to get facilities
    const response = await axios.get('/', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (response.data && response.data.props && response.data.props.facilities) {
      react.facilities = response.data.props.facilities

      // Clear all existing facility markers from map
      facilityMarkers.value.forEach(marker => {
        if (map.value && map.value.hasLayer && map.value.hasLayer(marker)) {
          try {
            map.value.removeLayer(marker)
          } catch (error) {
            console.warn('Error removing marker:', error)
          }
        }
      })
      facilityMarkers.value = []

      // Re-add all facility markers with full setup (popups, events, geocoding)
      if (locations.value.length > 0) {
        for (let i = 0; i < locations.value.length; i++) {
          const location = locations.value[i]
          const marker = addFacilityMarker(location, map.value)

          if (marker) {
            // Remove any existing popup
            if (typeof marker.unbindPopup === 'function') {
              marker.unbindPopup()
            }

            // Get address from reverse geocoding
            let address = location.marker?.label || location.department || 'Loading location...'

            // Initial popup with loading text
            let popupContent = `
              <div style="padding: 8px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="font-size: 20px;">${location.icon}</span>
                  <strong style="font-size: 14px; color: #1f2937;">${location.name}</strong>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${address}</p>
                <button
                  onclick="window.dispatchEvent(new CustomEvent('open-facility-panel', { detail: ${location.id} }))"
                  style="margin-top: 8px; width: 100%; background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;"
                  onmouseover="this.style.background='#2563eb'"
                  onmouseout="this.style.background='#3b82f6'"
                >
                  View Details
                </button>
              </div>
            `

            marker.bindPopup(popupContent, {
              closeButton: false,
              className: 'facility-popup',
              offset: [0, -15]
            })

            // Fetch real address in background with staggered delay to avoid rate limiting
            setTimeout(() => {
              console.log(`Geocoding ${location.name} at [${location.lat}, ${location.lng}]`)
              reverseGeocode(location.lat, location.lng)
                .then(geocodedAddress => {
                  if (geocodedAddress) {
                    address = geocodedAddress
                    // console.log(`Updated popup for ${location.name}: ${address}`)
                    // Update popup content with real address
                    popupContent = `
                      <div style="padding: 8px; min-width: 200px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                          <span style="font-size: 20px;">${location.icon}</span>
                          <strong style="font-size: 14px; color: #1f2937;">${location.name}</strong>
                        </div>
                        <p style="font-size: 12px; color: #6b7280; margin: 0;">${address}</p>
                        <button
                          onclick="window.dispatchEvent(new CustomEvent('open-facility-panel', { detail: ${location.id} }))"
                          style="margin-top: 8px; width: 100%; background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;"
                          onmouseover="this.style.background='#2563eb'"
                          onmouseout="this.style.background='#3b82f6'"
                        >
                          View Details
                        </button>
                      </div>
                    `
                    marker.setPopupContent(popupContent)
                  } else {
                    console.warn(`No geocoded address for ${location.name}, keeping fallback`)
                  }
                })
                .catch(err => {
                  console.error(`Geocoding failed for ${location.name}:`, err)
                })
            }, i * 1000)

            // Show popup on hover
            marker.on('mouseover', function() {
              this.openPopup()
            })

            // Keep popup open on hover over popup itself
            marker.on('popupopen', function() {
              const popup = this.getPopup()
              const popupElement = popup.getElement()

              if (popupElement) {
                popupElement.addEventListener('mouseenter', () => {
                  marker.openPopup()
                })
                popupElement.addEventListener('mouseleave', () => {
                  marker.closePopup()
                })
              }
            })

            // Close popup when mouse leaves marker
            marker.on('mouseout', function() {
              const markerElement = this
              setTimeout(() => {
                const popup = markerElement.getPopup()
                if (popup && popup.getElement()) {
                  const popupElement = popup.getElement()
                  if (!popupElement.matches(':hover')) {
                    markerElement.closePopup()
                  }
                }
              }, 100)
            })

            // Click opens the sidebar panel
            marker.on('click', () => {
              openLocationPanel(location)
            })
          }
        }
      }

      console.log('✓ Facilities loaded and markers refreshed:', locations.value.length)
    }
  } catch (error) {
    console.error('Error loading facilities:', error)
    toast.error('Failed to load facilities')
  }
}

// Load and refresh polygons
const loadPolygons = async () => {
  try {
    const response = await axios.get('/facilities/polygons', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    if (response.data) {
      // Clear existing polygon layers
      polygonLayers.value.forEach(layer => {
        if (map.value && map.value.hasLayer && map.value.hasLayer(layer)) {
          try {
            map.value.removeLayer(layer)
          } catch (error) {
            console.warn('Error removing polygon:', error)
          }
        }
      })
      polygonLayers.value = []

      // Re-display all polygons
      displayPolygons(response.data, map.value)
      console.log('✓ Polygons loaded and refreshed')
    }
  } catch (error) {
    console.error('Error loading polygons:', error)
    toast.error('Failed to load polygons')
  }
}

const handleLocationUpdate = (newLocation) => {
  // Only recalculate if there's an active destination and routing is active
  if (selectedLocation.value && isRoutingActive.value) {
    // Check if we need to recalculate based on distance moved since last calculation
    if (lastRouteCalculationPosition.value) {
      const distanceMoved = routingUtils.calculateDistance(
        lastRouteCalculationPosition.value.lat,
        lastRouteCalculationPosition.value.lng,
        newLocation.lat,
        newLocation.lng
      )

      // Recalculate route only if moved more than 10 meters
      if (distanceMoved > 10) {
        console.log(`User moved ${Math.round(distanceMoved)}m since last route calculation, updating route...`)
        lastRouteCalculationPosition.value = { lat: newLocation.lat, lng: newLocation.lng }

        // Show a subtle notification about route update
        toast.info(`Updating route from new position...`, { timeout: 2000 })

        // Recalculate route - this will update instructions automatically
        createRoute(L.latLng(selectedLocation.value.lat, selectedLocation.value.lng), selectedLocation.value)
      } else {
        console.log(`User moved ${Math.round(distanceMoved)}m (< 10m threshold, keeping current route)`)
      }
    } else if (routePolyline.value) {
      // First recalculation since panel opened while route exists
      console.log(`Initial GPS sync for existing route, recalculating...`)
      lastRouteCalculationPosition.value = { lat: newLocation.lat, lng: newLocation.lng }
      createRoute(L.latLng(selectedLocation.value.lat, selectedLocation.value.lng), selectedLocation.value)
    }
  }
}

// Reverse geocode coordinates to get address (city and province only)
const reverseGeocode = async (lat, lng) => {
  try {
    // console.log(`Geocoding: ${lat}, ${lng}`)

    // Use backend proxy endpoint instead of direct API call
    const response = await axios.get('/api/geocode/reverse', {
      params: {
        lat: lat,
        lng: lng
      }
    })

    if (response.data && response.data.success) {
      const address = response.data.address
    //   console.log(`Geocoded: ${address}`)
      return address
    }

    console.warn('No address data in response')
    return null
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return null
  }
}

const initializeMap = async () => {
  try {
    await loadPrivateRoutes()

    // Load all notes from localStorage/sessionStorage
    loadAllNotesFromStorage()

    // Define base map layers
    const standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    })

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
    )

    // Initialize map with standard view
    map.value = L.map('map', {
      center: [8.169500, 126.001838],
      zoom: 17,
      layers: [standard],
      zoomControl: true
    })

    activeBaseLayer.value = 'navigation'

    // Registry of base layers for manual control switching
    const baseLayerRegistry = {
      navigation: { layer: standard },
      satellite: { layer: satellite }
    }

    const setBaseLayer = (mode) => {
      if (!baseLayerRegistry[mode] || activeBaseLayer.value === mode) {
        return
      }

      const currentLayer = baseLayerRegistry[activeBaseLayer.value]?.layer
      if (currentLayer && map.value.hasLayer(currentLayer)) {
        map.value.removeLayer(currentLayer)
      }

      const targetLayer = baseLayerRegistry[mode].layer
      targetLayer.addTo(map.value)
      activeBaseLayer.value = mode
    }

    // Unified map controls (location + base layer toggle)
    const ControlStack = L.Control.extend({
      options: {
        position: 'bottomright'
      },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'leaflet-control guest-map-controls')

        container.innerHTML = `
          <button type="button" class="guest-control-button guest-control-button__locate" data-action="locate" title="Jump to my location">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 5V3" />
              <path d="M12 21v-2" />
              <path d="M5 12H3" />
              <path d="M21 12h-2" />
              <path d="M19.071 4.929l-1.414 1.414" />
              <path d="M6.343 17.657l-1.414 1.414" />
              <path d="M4.929 4.929l1.414 1.414" />
              <path d="M17.657 17.657l1.414 1.414" />
            </svg>
          </button>
          <div class="guest-base-toggle">
            <button type="button" class="guest-control-button" data-layer="navigation" title="Navigation view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 20l-6-2V6l6 2 6-2 6 2v12l-6-2-6 2z" />
                <path d="M9 8v12" />
                <path d="M15 6v12" />
              </svg>
            </button>
            <button type="button" class="guest-control-button" data-layer="satellite" title="Satellite view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h6l10 10-6 6L4 10V4z" />
                <path d="M2 12l4-4" />
                <path d="M12 22l4-4" />
                <path d="M14 10l-4 4" />
              </svg>
            </button>
          </div>
        `

        const locateBtn = container.querySelector('[data-action="locate"]')
        const layerButtons = container.querySelectorAll('[data-layer]')

        const updateActiveState = () => {
          layerButtons.forEach((btn) => {
            btn.classList.toggle('is-active', btn.dataset.layer === activeBaseLayer.value)
          })
        }

        L.DomEvent.on(locateBtn, 'click', (event) => {
          L.DomEvent.stopPropagation(event)
          L.DomEvent.preventDefault(event)
          jumpToMyLocation()
        })

        layerButtons.forEach((btn) => {
          L.DomEvent.on(btn, 'click', (event) => {
            L.DomEvent.stopPropagation(event)
            L.DomEvent.preventDefault(event)
            const targetLayer = btn.dataset.layer
            setBaseLayer(targetLayer)
            updateActiveState()
          })
        })

        updateActiveState()
        L.DomEvent.disableClickPropagation(container)
        L.DomEvent.disableScrollPropagation(container)
        return container
      }
    })

    map.value.addControl(new ControlStack())

    map.value.whenReady(() => {
    //   console.log('Map is fully loaded and ready')

      // Add facility markers
      if (locations.value.length > 0) {
        console.log(`Adding ${locations.value.length} facility markers`)

        for (let i = 0; i < locations.value.length; i++) {
          const location = locations.value[i]
          const marker = addFacilityMarker(location, map.value)

          if (marker) {
            // Remove any existing popup
            if (typeof marker.unbindPopup === 'function') {
              marker.unbindPopup()
            }

            // Get address from reverse geocoding
            let address = location.marker?.label || location.department || 'Loading location...'

            // Initial popup with loading text
            let popupContent = `
              <div style="padding: 8px; min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <span style="font-size: 20px;">${location.icon}</span>
                  <strong style="font-size: 14px; color: #1f2937;">${location.name}</strong>
                </div>
                <p style="font-size: 12px; color: #6b7280; margin: 0;">${address}</p>
                <button
                  onclick="window.dispatchEvent(new CustomEvent('open-facility-panel', { detail: ${location.id} }))"
                  style="margin-top: 8px; width: 100%; background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;"
                  onmouseover="this.style.background='#2563eb'"
                  onmouseout="this.style.background='#3b82f6'"
                >
                  View Details
                </button>
              </div>
            `

            marker.bindPopup(popupContent, {
              closeButton: false,
              className: 'facility-popup',
              offset: [0, -15]
            })

            // Fetch real address in background with staggered delay
            setTimeout(() => {
            //   console.log(`Geocoding ${location.name} at [${location.lat}, ${location.lng}]`)
              reverseGeocode(location.lat, location.lng)
                .then(geocodedAddress => {
                  if (geocodedAddress) {
                    address = geocodedAddress
                    // console.log(`Updated popup for ${location.name}: ${address}`)
                    // Update popup content with real address
                    popupContent = `
                      <div style="padding: 8px; min-width: 200px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                          <span style="font-size: 20px;">${location.icon}</span>
                          <strong style="font-size: 14px; color: #1f2937;">${location.name}</strong>
                        </div>
                        <p style="font-size: 12px; color: #6b7280; margin: 0;">${address}</p>
                        <button
                          onclick="window.dispatchEvent(new CustomEvent('open-facility-panel', { detail: ${location.id} }))"
                          style="margin-top: 8px; width: 100%; background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer;"
                          onmouseover="this.style.background='#2563eb'"
                          onmouseout="this.style.background='#3b82f6'"
                        >
                          View Details
                        </button>
                      </div>
                    `
                    marker.setPopupContent(popupContent)
                  } else {
                    // console.warn(`No geocoded address for ${location.name}, keeping fallback`)
                  }
                })
                .catch(err => {
                  console.error(`Geocoding failed for ${location.name}:`, err)
                })
            }, i * 1000)

            // Show popup on hover
            marker.on('mouseover', function() {
              this.openPopup()
            })

            // Keep popup open on hover over popup itself
            marker.on('popupopen', function() {
              const popup = this.getPopup()
              const popupElement = popup.getElement()

              if (popupElement) {
                popupElement.addEventListener('mouseenter', () => {
                  marker.openPopup()
                })
                popupElement.addEventListener('mouseleave', () => {
                  marker.closePopup()
                })
              }
            })

            // Close popup when mouse leaves marker (with small delay)
            marker.on('mouseout', function() {
              const markerElement = this
              setTimeout(() => {
                const popup = markerElement.getPopup()
                if (popup && popup.getElement()) {
                  const popupElement = popup.getElement()
                  if (!popupElement.matches(':hover')) {
                    markerElement.closePopup()
                  }
                }
              }, 100)
            })

            // Click opens the sidebar panel
            marker.on('click', () => {
              openLocationPanel(location)
            })
          }
        }
      }

      // Display notes after markers are settled
      setTimeout(() => {
        displayNotesOnMap()
      }, 300)

      // Display polygons on map load
      if (props.polygons && props.polygons.length > 0) {
        displayPolygons(props.polygons, map.value)
      }

      // Add campus route layers with enhanced visibility
      if (privateRoutes.value && privateRoutes.value.features) {
        privateRoutes.value.features.forEach((feature) => {
          if (feature.geometry && feature.geometry.type === 'LineString') {
            // Get color from database or use default
            const routeColor = feature.properties?.color || '#FF6B6B'

            const layer = L.geoJSON(feature, {
              style: {
                color: routeColor,
                weight: 6,
                opacity: 0.9,
                dashArray: '10, 5',
                lineCap: 'round',
                lineJoin: 'round'
              }
            }).addTo(map.value)

            layer.on('click', (e) => {
              L.DomEvent.stopPropagation(e)
              createRoute(e.latlng, null, feature.properties?.color)
            })

            geoJsonLayers.value.push(layer)
          }
        })
      }

      // Map click handler for route creation
      map.value.on('click', (e) => {
        createRoute(e.latlng)
      })

      // Protect note markers during zoom animations
      let pendingNoteDisplay = false

      map.value.on('zoomstart', () => {
        // Flag that zoom is in progress
        isZoomInProgress = true
        map.value._isZooming = true
        // console.log('Zoom started - blocking note operations')
      })

      map.value.on('zoomend', () => {
        // Clear zoom flag after animation completes
        // console.log('Zoom ended - allowing note operations')

        // Small delay to ensure animation is fully complete
        setTimeout(() => {
          isZoomInProgress = false
          map.value._isZooming = false

          // If notes were pending display during zoom, show them now
          if (pendingNoteDisplay) {
            pendingNoteDisplay = false
            // console.log('Displaying pending notes after zoom')
            debouncedDisplayNotes()
          }
        }, 100)
      })

      // Track if notes need to be displayed after zoom
      const originalDebouncedDisplayNotes = debouncedDisplayNotes
      window.addEventListener('notesPending', () => {
        if (isZoomInProgress) {
          pendingNoteDisplay = true
        }
      })

      // Start GPS tracking after map is ready
      setTimeout(() => {
        tracking.startTracking(guestInfo.value, map.value, handleLocationUpdate)
      }, 500)
    })

  } catch (error) {
    console.error('Error initializing map:', error)
    toast.error('Failed to initialize map. Please refresh the page.')
  }
}

const selectSearchResult = (location) => {
  openLocationPanel(location)
  searchQuery.value = location.name
  showSearchResults.value = false
  createRoute(L.latLng(location.lat, location.lng), location)
  console.log(`Routing to ${location.name}`)
}

const clearSearch = () => {
  searchQuery.value = ''
  selectedLocation.value = null
  selectedMarker.value = null
  showSearchResults.value = false
  lastRouteCalculationPosition.value = null // Reset route calculation tracker
  isRoutingActive.value = false
  isDetailsPanelVisible.value = false
  noteContent.value = ''
  isShowingNoteInput.value = false
  feedback.value = ''
  clearPhotoSelection()

  if (routePolyline.value && map.value) {
    try {
      if (map.value.hasLayer(routePolyline.value)) {
        map.value.removeLayer(routePolyline.value)
      }
    } catch (e) {
      console.warn('Error removing route polyline:', e)
    }
    routePolyline.value = null
  }
  if (destinationMarker.value && map.value) {
    try {
      if (map.value.hasLayer(destinationMarker.value)) {
        map.value.removeLayer(destinationMarker.value)
      }
    } catch (e) {
      console.warn('Error removing destination marker:', e)
    }
    destinationMarker.value = null
  }

  routeInfo.value = null
  showInstructions.value = false
  console.log('Route cleared')
}

const saveFeedback = async () => {
  if (!feedback.value.trim()) {
    toast.error('Please enter your feedback')
    return
  }

  if (!guestInfo.value.id) {
    toast.error('Guest information not found')
    return
  }

  if (!selectedLocation.value) {
    toast.error('Select a destination before sending feedback')
    return
  }

  isSavingFeedback.value = true

  try {
    const response = await axios.post('/create/feedback', {
      guest_id: guestInfo.value.id,
      marker_id: selectedLocation.value.marker_id,
      message: feedback.value.trim(),
    })

    const createdFeedback = {
      ...response.data.feedback,
      message: feedback.value.trim(),
      marker_id: selectedLocation.value.marker_id,
      guest: {
        id: guestInfo.value.id,
        name: guestInfo.value.nickname
      }
    }

    localFeedback.value = [...localFeedback.value, createdFeedback]
    message.value = response.data.message
    toast.success(message.value || 'Feedback saved successfully!')
    feedback.value = ''
  } catch (error) {
    console.error('Error saving feedback:', error)
    toast.error('Failed to save feedback')
  } finally {
    isSavingFeedback.value = false
  }
}

// Photo Gallery Functions
const openPhotoGallery = (index) => {
  currentPhotoIndex.value = index
  isPhotoGalleryOpen.value = true
}

const closePhotoGallery = () => {
  isPhotoGalleryOpen.value = false
}

const nextPhoto = () => {
  if (currentPhotoIndex.value < currentFacilityPhotos.value.length - 1) {
    currentPhotoIndex.value++
  }
}

const previousPhoto = () => {
  if (currentPhotoIndex.value > 0) {
    currentPhotoIndex.value--
  }
}

const hasGuestInfo = loadGuestInfoFromSession()

onMounted(() => {

  if (hasGuestInfo) {
    initializeMap()
    console.log(`Welcome back, ${guestInfo.value.nickname}!`)
  }

  // Listen for custom event from popup button
  window.addEventListener('open-facility-panel', (event) => {
    const facilityId = event.detail
    const facility = locations.value.find(loc => loc.id === facilityId)
    if (facility) {
      openLocationPanel(facility)
    }
  })

  // Listen for delete note from tooltip
  window.addEventListener('delete-note', (event) => {
    const noteId = event.detail
    if (confirm('Are you sure you want to delete this note?')) {
      deleteNote(noteId)
    }
  })

  // Listen for real-time updates
  window.Echo.channel('main-channel')
    .listen('.MainEvent', (e) => {
      // Route events - reload all routes
      if (e.type === "route") {
        loadPrivateRoutes()
        console.log('Route event:', e.action)
      }

      // Facility events - reload all facilities and markers
      if (e.type === "facility") {
        loadFacilities()
        console.log('Facility event:', e.action)
      }

      // Marker events - reload facilities (which include markers)
      if (e.type === "marker") {
        loadFacilities()
        console.log('Marker event:', e.action)
      }

      // Polygon events - reload all polygons
      if (e.type === "polygon") {
        loadPolygons()
        console.log('Polygon event:', e.action)
      }

      // Photo events - add to local cache if creating
      if (e.type === 'photo' && e.action === 'create' && e.data) {
        const facilityId = e.data?.facility_id
        if (facilityId) {
          const existing = facilityPhotos.value[facilityId] || []
          const alreadyPresent = existing.some(photo => photo.id === e.data.id)

          if (!alreadyPresent) {
            facilityPhotos.value = {
              ...facilityPhotos.value,
              [facilityId]: [e.data, ...existing]
            }
          }
        }
      }

      // Feedback events - add to local cache if creating
      if (e.type === 'feedback' && e.action === 'create' && e.data) {
        const exists = localFeedback.value.some(item => item.id === e.data.id)
        if (!exists) {
          localFeedback.value = [...localFeedback.value, e.data]
        }
      }
    })
})

onBeforeUnmount(() => {
  // Clean up tracking
  tracking.stopTracking(map.value)

  // Clear session checker
  if (sessionCheckInterval.value) {
    clearInterval(sessionCheckInterval.value)
  }

  clearPhotoSelection()

  // Clean up map layers safely
  if (map.value) {
    try {
      if (routePolyline.value && map.value.hasLayer(routePolyline.value)) {
        map.value.removeLayer(routePolyline.value)
      }
      if (destinationMarker.value && map.value.hasLayer(destinationMarker.value)) {
        map.value.removeLayer(destinationMarker.value)
      }

      geoJsonLayers.value.forEach(layer => {
        if (map.value.hasLayer(layer)) {
          map.value.removeLayer(layer)
        }
      })

      noteMarkers.value.forEach(nm => {
        if (nm.marker && map.value.hasLayer(nm.marker)) {
          map.value.removeLayer(nm.marker)
        }
      })
    } catch (error) {
      console.warn('Error during cleanup:', error)
    }
  }

  console.log('Component unmounted, cleanup complete')
})
</script>

<template>
  <div class="relative flex h-screen w-full">
    <transition name="details-panel">
      <aside
        v-if="isGuestInfoComplete && isDetailsPanelVisible && selectedLocation"
        class="z-20 flex flex-col border-gray-200 bg-white shadow-xl
               fixed bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
               md:relative md:h-full md:w-full md:max-w-md md:border-r md:rounded-none md:max-h-full"
      >
        <!-- Mobile Drag Handle -->
        <div class="md:hidden flex justify-center pt-2 pb-1">
          <div class="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        <div class="relative border-b border-gray-200 bg-white shadow-sm">
            <div class="absolute top-0 left-0 right-0 h-1 bg-green-900/10"></div>

            <div class="px-4 py-3">
                <div class="flex items-start justify-between gap-3">

                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-3 mb-2">
                    <div class="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 text-2xl shadow-sm">
                        {{ selectedLocation.icon }}
                    </div>

                    <div class="min-w-0">
                        <h2 class="text-sm font-bold text-gray-900 leading-tight truncate">
                        {{ selectedLocation.name }}
                        </h2>
                        <div class="flex items-center gap-2 mt-0.5">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 uppercase tracking-wide">
                            {{ selectedLocation.category }}
                        </span>
                        <span v-if="selectedLocation.department" class="text-[10px] text-gray-500 truncate">
                            {{ selectedLocation.department }}
                        </span>
                        </div>
                    </div>
                    </div>

                    <div class="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2 bg-gray-50/50 rounded-md p-2 border border-gray-100">

                    <div v-if="selectedLocation.marker?.label" class="flex items-center gap-1.5 min-w-0">
                        <MapPinIcon class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span class="text-[11px] font-medium text-gray-700 truncate" title="Location">
                        {{ selectedLocation.marker.label ?? 'Not specified' }}
                        </span>
                    </div>

                    <div v-if="selectedLocation.marker?.floor || selectedLocation.floor_number" class="flex items-center gap-1.5 min-w-0">
                        <Square3Stack3DIcon class="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span class="text-[11px] font-medium text-gray-700 truncate">
                        Floor {{ selectedLocation.floor_number ?? 'Not specified' }}
                        </span>
                    </div>

                    <div v-if="selectedLocation.hours" class="col-span-2 flex items-start gap-1.5 min-w-0 pt-1 border-t border-gray-100">
                        <ClockIcon class="w-3.5 h-3.5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span class="text-[11px] font-medium text-gray-700 leading-snug">
                        {{ selectedLocation.hours ?? 'Operating hours not specified' }}
                        </span>
                    </div>
                    </div>
                </div>

                <button
                    @click="closeDetailsPanel"
                    class="flex-shrink-0 -mt-1 -mr-1 p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-lg transition-colors"
                >
                    <XMarkIcon class="h-5 w-5" />
                </button>
                </div>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto bg-gray-50">
          <section class="space-y-4 px-4 py-4 bg-white">
            <p v-if="selectedLocation.description" class="text-sm leading-relaxed text-gray-600">
              {{ selectedLocation.description }}
            </p>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                @click="startRouteToSelected"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                <ReCompass3Fill class="h-5 w-5" /> Start Navigation
              </button>
              <button
                v-if="routePolyline"
                type="button"
                @click="clearSearch"
                class="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                ✖ Clear
              </button>
            </div>

            <div v-if="routeInfo" class="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-200 bg-gray-100 px-3 py-2">
                <h3 class="text-xs font-semibold text-gray-800">Route Info</h3>
              </div>
              <p class="whitespace-pre-line px-3 py-3 text-sm text-gray-700">{{ routeInfo }}</p>
            </div>

            <div v-if="showInstructions && navigationInstructions.length" class="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div class="border-b border-gray-200 bg-gray-100 px-3 py-2">
                <h3 class="text-xs font-semibold text-gray-800">Navigation Steps</h3>
              </div>
              <div class="max-h-60 overflow-y-auto" ref="navigationInstructionsContainer">
                <div
                  v-for="(instruction, idx) in navigationInstructions"
                  :key="idx"
                  class="flex gap-3 px-3 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <span class="mt-0.5 text-lg">{{ instruction.icon }}</span>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-800">{{ instruction.text }}</p>
                    <p class="text-xs text-gray-500">{{ instruction.distance }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="border-t border-gray-200 px-4 py-4 bg-white">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800">Photos</h3>
              <span class="text-xs text-gray-500">{{ displayedPhotosCount.total }} total</span>
            </div>

            <div class="space-y-3">
              <div class="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center hover:border-gray-400 transition">
                <input
                  ref="photoInput"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handlePhotoSelected"
                />

                <div v-if="!photoPreviewUrl" class="space-y-2">
                  <p class="text-sm text-gray-600">📸 Click to upload a photo</p>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-md bg-green-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-800"
                    @click="triggerPhotoPicker"
                  >
                    Choose Photo
                  </button>
                </div>

                <div v-else class="space-y-3">
                  <img :src="photoPreviewUrl" alt="Photo preview" class="mx-auto max-h-40 rounded-md object-cover shadow-sm" />
                  <input
                    v-model="photoCaption"
                    type="text"
                    maxlength="255"
                    placeholder="Add a short caption (optional)"
                    class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                  />
                  <div class="flex justify-end gap-2">
                    <button
                      type="button"
                      class="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                      @click="clearPhotoSelection"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      class="rounded-md bg-green-900 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 transition"
                      :disabled="isUploadingPhoto"
                      @click="uploadPhoto"
                    >
                      {{ isUploadingPhoto ? 'Uploading...' : 'Save Photo' }}
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="displayedPhotosCount.total > 0" class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <article
                    v-for="(photo, index) in currentFacilityPhotos"
                    :key="photo.id"
                    @click="openPhotoGallery(index)"
                    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm cursor-pointer transition hover:shadow-md hover:border-gray-300"
                  >
                    <img
                      :src="photo.url"
                      :alt="photo.caption || selectedLocation.name"
                      class="h-28 w-full object-cover"
                    />
                    <div class="space-y-1 px-3 py-2 bg-gray-50">
                      <p class="text-xs font-medium text-gray-900 truncate">
                        {{ photo.caption || 'Shared photo' }}
                      </p>
                      <p class="text-[11px] text-gray-500">
                        {{ photo.guest?.name || 'Guest' }} • {{ formatTimestamp(photo.created_at) }}
                      </p>
                    </div>
                  </article>
                </div>

                <!-- Show More Button -->
                <button
                  v-if="displayedPhotosCount.total > 2 && !showAllPhotos"
                  @click="showAllPhotos = true"
                  class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:border-gray-400"
                >
                  + {{ displayedPhotosCount.total - 2 }} More Photo{{ displayedPhotosCount.total - 2 > 1 ? 's' : '' }}
                </button>

                <!-- Show Less Button -->
                <button
                  v-if="showAllPhotos && displayedPhotosCount.total > 2"
                  @click="showAllPhotos = false"
                  class="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:border-gray-400"
                >
                  Show Less
                </button>
              </div>

              <p v-else class="text-center text-sm text-gray-500">Be the first to share a photo for this place.</p>
            </div>
          </section>

          <section class="border-t border-gray-200 px-4 py-4 space-y-3 bg-white">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800">Notes</h3>
              <span class="text-xs text-gray-500">{{ currentFacilityNotes.length }} total</span>
            </div>

            <!-- Info: One note per guest -->
            <div class="text-xs text-gray-500 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1">
              <p>You can add one note that will appear on the map. It expires after 24 hours and is stored in your browser ({{ STORAGE_TYPE === 'localStorage' ? 'persists across sessions' : 'session only' }}).</p>
              <p class="font-semibold text-green-700">Notes appear as purple bubbles above markers. Click the ✕ button to delete!</p>
            </div>

            <!-- Note Input - Hidden by Default -->
            <div v-if="isShowingNoteInput" class="space-y-2 rounded-lg border border-gray-300 bg-gray-50 p-3 shadow-sm">
              <textarea
                v-model="noteContent"
                rows="3"
                maxlength="500"
                placeholder="Share a quick note or tip about this spot..."
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                autofocus
                @keydown.enter.prevent
              ></textarea>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                  @click.prevent="isShowingNoteInput = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded-md bg-green-900 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 transition"
                  :disabled="isSavingNote || !noteContent.trim()"
                  @click.prevent="saveNote"
                >
                  {{ isSavingNote ? 'Saving...' : 'Save Note' }}
                </button>
              </div>
            </div>

            <!-- Add Note Button - Only Show if Input is Hidden -->
            <div v-if="!isShowingNoteInput">
              <button
                type="button"
                class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-100"
                @click.prevent="openNoteInput"
              >
                {{ currentUserHasNote ? '✏️ Edit Your Note' : '+ Add Note' }}
              </button>
            </div>

            <!-- Display Notes as Chat Bubbles -->
            <div v-if="currentFacilityNotes.length" class="space-y-3">
              <article
                v-for="note in currentFacilityNotes"
                :key="note.id"
                :class="[
                  'rounded-lg p-3 shadow-sm transition',
                  note.guest_id === guestInfo.id
                    ? 'ml-8 bg-green-100 border-l-4 border-green-700'
                    : 'mr-8 bg-gray-100 border-l-4 border-gray-400'
                ]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-xs font-semibold text-gray-700">
                      {{ note.guest?.name || 'Guest' }}
                      <span v-if="note.guest_id === guestInfo.id" class="text-green-700"> (You)</span>
                    </p>
                    <p class="text-xs text-gray-500">{{ formatTimestamp(note.created_at) }}</p>
                  </div>
                  <button
                    v-if="note.guest_id === guestInfo.id"
                    type="button"
                    class="rounded-md p-1 text-gray-400 transition hover:bg-gray-200 hover:text-red-500"
                    @click.prevent="deleteNote(note.id)"
                    title="Delete note"
                  >
                    <XMarkIcon class="h-4 w-4" />
                  </button>
                </div>
                <p class="mt-2 text-sm text-gray-800 leading-relaxed">{{ note.content }}</p>
              </article>
            </div>
            <p v-else class="text-center text-sm text-gray-500">No notes yet. Be the first to share!</p>
          </section>

          <section class="border-t border-gray-200 px-4 py-4 space-y-3 bg-white">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-800">Feedback</h3>
              <span class="text-xs text-gray-500">{{ currentFacilityFeedback.length }} total</span>
            </div>

            <!-- Feedback Input - Hidden by Default -->
            <div v-if="isShowingFeedbackInput" class="space-y-2 rounded-lg border border-gray-300 bg-gray-50 p-3 shadow-sm">
              <textarea
                v-model="feedback"
                rows="3"
                maxlength="500"
                placeholder="How was your experience here?"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                autofocus
              ></textarea>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                  @click.prevent="isShowingFeedbackInput = false"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="rounded-md bg-green-900 px-3 py-2 text-xs font-semibold text-white hover:bg-green-800 transition"
                  :disabled="isSavingFeedback || !feedback.trim()"
                  @click.prevent="saveFeedback"
                >
                  {{ isSavingFeedback ? 'Sending...' : 'Submit Feedback' }}
                </button>
              </div>
            </div>

            <!-- Add Feedback Button - Only Show if Input is Hidden -->
            <div v-if="!isShowingFeedbackInput">
              <button
                type="button"
                class="w-full rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-100"
                @click.prevent="isShowingFeedbackInput = !isShowingFeedbackInput"
              >
                + Add Feedback
              </button>
            </div>

            <!-- Feedback List with Scroll Container -->
            <div v-if="currentFacilityFeedback.length" class="space-y-2">
              <h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Recent Feedback</h4>
              <div class="max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <article
                  v-for="item in currentFacilityFeedback"
                  :key="item.id"
                  class="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 shadow-sm"
                >
                  <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold text-gray-800">{{ item.guest?.name || 'Guest' }}</p>
                    <p class="text-xs text-gray-500">{{ formatTimestamp(item.created_at) }}</p>
                  </div>
                  <p class="mt-2 text-sm text-gray-700">{{ item.message }}</p>
                </article>
              </div>
            </div>
            <p v-else class="text-sm text-gray-500 text-center">No feedback yet. Share your thoughts!</p>
          </section>
        </div>
      </aside>
    </transition>

    <div class="relative flex-1">
      <div
        id="map"
        :class="[
          'h-full w-full transition-all duration-300',
          !isGuestInfoComplete ? 'blur-sm pointer-events-none' : ''
        ]"
      ></div>

     <!-- Search Bar -->
<div
  v-if="isGuestInfoComplete"
  class="absolute top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:transform z-10 sm:w-full sm:max-w-2xl sm:px-4"
>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <!-- Search Input -->
    <div class="relative">
      <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
        <MagnifyingGlassIcon class="h-4 w-4 text-gray-400" />
      </div>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search facilities by name, category, or floor..."
        class="w-full border-0 py-3 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none bg-gray-50"
      />
      <button
        v-if="searchQuery"
        @click="clearSearch"
        class="absolute inset-y-0 right-0 flex items-center pr-3.5 transition-colors"
        aria-label="Clear search"
      >
        <XMarkIcon class="h-4 w-4 text-gray-400 hover:text-gray-600" />
      </button>
    </div>

    <!-- Search Results -->
    <div
      v-if="showSearchResults"
      class="border-t border-gray-200 bg-white"
    >
      <!-- Loading State -->
      <div v-if="isSearching" class="px-4 py-8 text-center">
        <div class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600"></div>
        <p class="mt-2.5 text-xs text-gray-500 font-medium">Searching facilities...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredLocations.length === 0" class="px-4 py-8 text-center">
        <div class="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
          <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
        </div>
        <p class="mt-3 text-xs font-semibold text-gray-900">No results found</p>
        <p class="mt-1 text-xs text-gray-500">Try adjusting your search criteria</p>
      </div>

      <!-- Results List -->
      <div v-else class="max-h-[70vh] overflow-y-auto">
        <!-- Results Header -->
        <div class="sticky top-0 z-10 bg-white px-4 py-2 border-b border-gray-100">
          <p class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {{ filteredLocations.length }} {{ filteredLocations.length === 1 ? 'Facility' : 'Facilities' }} Found
          </p>
        </div>

        <!-- Results Items -->
        <div class="divide-y divide-gray-100">
          <button
            v-for="location in filteredLocations"
            :key="location.id"
            @click="selectSearchResult(location)"
            class="flex w-full items-start gap-3 px-4 py-3 text-left transition-all hover:bg-gray-50 group"
          >
            <!-- Icon Container -->
            <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-green-50 transition-colors">
              <span class="text-lg group-hover:scale-105 transition-transform">{{ location.icon }}</span>
            </div>

            <!-- Content -->
            <div class="min-w-0 flex-1 space-y-2">
              <!-- Header Row -->
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold text-gray-900 text-xs leading-tight group-hover:text-green-700 transition-colors">
                  {{ location.name }}
                </h3>
                <span class="flex-shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  Floor {{ location.floor_number ?? 'Not specified' }}
                </span>
              </div>

              <!-- Meta Tags -->
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-green-50 border border-green-200 text-green-700 text-[10px] font-medium">
                  {{ location.markerType ?? 'Not specified' }}
                </span>
                <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-medium">
                  {{ location.category ?? 'Not specified' }}
                </span>
              </div>

              <!-- Description -->
              <p v-if="location.description" class="text-[11px] text-gray-600 leading-relaxed line-clamp-2">
                {{ location.description ?? 'No description available' }}
              </p>

              <!-- Details Grid -->
              <div v-if="location.capacity || location.amenities || location.status || location.hours"
                   class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-gray-100">
                <div v-if="location.capacity" class="flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                  </svg>
                  <span class="text-[10px] text-gray-600">
                    <span class="font-medium text-gray-900">{{ location.capacity }}</span> capacity
                  </span>
                </div>

                <div v-if="location.amenities" class="flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span class="text-[10px] text-gray-600">
                    <span class="font-medium text-gray-900">{{ location.amenities.length }}</span> amenities
                  </span>
                </div>

                <div v-if="location.status" class="flex items-center gap-1.5">
                  <span :class="[
                    'w-2 h-2 rounded-full flex-shrink-0',
                    location.status === 'available' ? 'bg-green-500' :
                    location.status === 'occupied' ? 'bg-red-500' : 'bg-gray-400'
                  ]"></span>
                  <span class="text-[10px] text-gray-600 capitalize">{{ location.status }}</span>
                </div>

                <div v-if="location.hours" class="flex items-center gap-1.5">
                  <svg class="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <span class="text-[10px] text-gray-600">{{ location.hours }}</span>
                </div>
              </div>
            </div>

            <!-- Action Icon -->
            <div class="flex-shrink-0 mt-1.5">
              <svg class="w-4 h-4 text-gray-300 group-hover:text-green-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

      <!-- Transport Mode Selector -->
      <div v-if="isGuestInfoComplete" class="absolute bottom-4 left-4 z-10">
        <div class="flex max-w-[calc(100vw-6rem)] flex-wrap gap-1 rounded-lg bg-white p-1.5 shadow-lg sm:max-w-none sm:p-2">
          <button
            v-for="mode in transportModes"
            :key="mode.value"
            @click="transportMode = mode.value"
            :class="[
              'min-w-[44px] rounded-md px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm',
              transportMode === mode.value
                ? 'bg-green-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            ]"
            :title="mode.label"
          >
            <span class="text-base sm:text-lg">{{ mode.icon }}</span>
            <span class="hidden text-xs lg:inline">{{ mode.label }}</span>
          </button>
        </div>
      </div>

      <!-- User Profile -->
      <div v-if="isGuestInfoComplete" class="absolute top-4 right-4 z-10">
        <div class="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-lg sm:px-4">
          <UserCircleIcon class="h-5 w-5 text-green-900" />
          <div class="hidden text-left sm:block">
            <p class="max-w-[120px] truncate text-xs font-semibold text-gray-900">{{ guestInfo.nickname }}</p>
            <p class="text-xs text-gray-500">{{ guestInfo.role }}</p>
          </div>
        </div>
      </div>

      <!-- Route Info Floating Panel -->
      <div
        v-if="isGuestInfoComplete && routeInfo && !isDetailsPanelVisible"
        class="absolute left-4 top-20 hidden w-64 rounded-lg border border-gray-200 bg-white shadow-lg sm:block sm:w-72"
      >
        <div class="flex items-center justify-between border-b border-gray-200 bg-green-900 px-3 py-2">
          <h3 class="text-xs font-semibold text-white">Route Info</h3>
          <button
            @click="routeInfo = null"
            class="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:text-white"
          >
            ×
          </button>
        </div>
        <p class="max-h-40 overflow-y-auto px-3 py-2 text-xs leading-relaxed text-gray-700">
          {{ routeInfo }}
        </p>
      </div>

      <!-- Navigation Instructions Floating Panel -->
      <div
        v-if="showInstructions && !isDetailsPanelVisible"
        class="absolute bottom-20 left-4 right-4 z-20 flex max-h-52 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg sm:bottom-4 sm:left-auto sm:w-72"
      >
        <div class="flex items-center justify-between border-b border-gray-200 bg-green-900 px-3 py-2">
          <h3 class="text-xs font-semibold text-white">Navigation</h3>
          <button
            @click="showInstructions = false"
            class="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:text-white"
          >
            ×
          </button>
        </div>
        <div ref="navigationInstructionsContainer" class="overflow-y-auto">
          <div
            v-for="(instruction, idx) in navigationInstructions"
            :key="idx"
            class="flex items-start gap-2 border-b border-gray-100 px-3 py-2 text-xs last:border-b-0"
          >
            <span class="mt-0.5 text-sm">{{ instruction.icon }}</span>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900">{{ instruction.text }}</p>
              <p class="text-gray-500">{{ instruction.distance }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Guest Registration Modal -->
    <div v-if="showGuestModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div class="relative w-full max-w-sm rounded-lg bg-white shadow-2xl">
        <div v-if="guestStep === 1" class="p-6 sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <!-- Logo -->
            <div class="flex items-center justify-center gap-3 mb-4">
              <div class="h-12 w-12 bg-green-900 rounded-full flex items-center justify-center p-1.5 shadow-md">
                <img src="../../../assets/logo.png" alt="ASSCAT Logo" class="h-full w-full object-contain" />
              </div>
              <div class="flex flex-col items-start">
                <span class="text-lg font-bold text-green-900">ASSCAT</span>
                <span class="text-xs font-medium text-gray-600">Campus Navigator</span>
              </div>
            </div>
            <h2 class="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">Welcome to ASSCAT Campus Navigator</h2>
            <p class="text-xs text-gray-500 sm:text-sm">Let's get started with your nickname</p>
          </div>

          <div class="space-y-4">
            <input
              v-model="guestInfo.nickname"
              type="text"
              placeholder="Enter your nickname"
              maxlength="50"
              class="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900 sm:text-base"
              @keyup.enter="goToStep2"
            />

            <button
              @click="goToStep2"
              :disabled="!guestInfo.nickname.trim()"
              :class="[
                'w-full rounded-lg px-4 py-3 text-sm font-medium transition',
                guestInfo.nickname.trim()
                  ? 'bg-green-900 text-white hover:bg-green-800'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              ]"
            >
              Continue
            </button>
          </div>
        </div>

        <div v-else-if="guestStep === 2" class="p-6 sm:p-8">
          <div class="mb-6 text-center sm:mb-8">
            <h2 class="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">Select Your Role</h2>
            <p class="text-xs text-gray-500 sm:text-sm">How are you visiting our campus?</p>
          </div>

          <div class="mb-6 space-y-3">
            <button
              v-for="role in guestRoles"
              :key="role.value"
              @click="guestInfo.role = role.value"
              :class="[
                'flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 transition',
                guestInfo.role === role.value
                  ? 'border-green-700 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              ]"
            >
              <span class="text-xl sm:text-2xl">{{ role.icon }}</span>
              <span class="text-sm font-medium text-gray-900">{{ role.label }}</span>
            </button>
          </div>

          <div class="space-y-2">
            <button
              @click="saveGuestInfo"
              :disabled="!guestInfo.role"
              :class="[
                'w-full rounded-lg px-4 py-3 text-sm font-medium transition',
                guestInfo.role
                  ? 'bg-green-900 text-white hover:bg-green-800'
                  : 'cursor-not-allowed bg-gray-200 text-gray-400'
              ]"
            >
              Start Exploring
            </button>
            <button
              @click="backToStep1"
              class="w-full rounded-lg px-4 py-3 text-sm font-medium text-gray-600 transition hover:text-gray-900"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Photo Gallery Modal -->
    <div
      v-if="isPhotoGalleryOpen"
      @click="closePhotoGallery"
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4"
    >
      <div
        @click.stop
        class="relative w-full max-w-5xl"
      >
        <!-- Close Button -->
        <button
          @click="closePhotoGallery"
          class="absolute -top-12 right-0 text-white hover:text-gray-300 transition"
        >
          <XMarkIcon class="h-8 w-8" />
        </button>

        <!-- Image Container -->
        <div class="relative bg-white rounded-lg overflow-hidden shadow-2xl">
          <img
            v-if="allFacilityPhotos[currentPhotoIndex]"
            :src="allFacilityPhotos[currentPhotoIndex].url"
            :alt="allFacilityPhotos[currentPhotoIndex].caption || 'Photo'"
            class="w-full max-h-[80vh] object-contain bg-gray-100"
          />

          <!-- Photo Info -->
          <div class="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <p v-if="allFacilityPhotos[currentPhotoIndex]?.caption" class="text-sm font-medium text-gray-900 mb-1">
              {{ allFacilityPhotos[currentPhotoIndex].caption }}
            </p>
            <p class="text-xs text-gray-600">
              {{ allFacilityPhotos[currentPhotoIndex]?.guest?.name || 'Guest' }} •
              {{ formatTimestamp(allFacilityPhotos[currentPhotoIndex]?.created_at) }}
            </p>
            <p class="text-xs text-gray-500 mt-1">
              Photo {{ currentPhotoIndex + 1 }} of {{ allFacilityPhotos.length }}
            </p>
          </div>

          <!-- Navigation Buttons -->
          <button
            v-if="currentPhotoIndex > 0"
            @click="previousPhoto"
            class="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            v-if="currentPhotoIndex < allFacilityPhotos.length - 1"
            @click="nextPhoto"
            class="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#map {
  height: 100vh;
  width: 100%;
  position: relative;
  z-index: 0;
}

:global(.guest-map-controls) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.96);
  padding: 12px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(4px);
}

:global(.guest-base-toggle) {
  display: flex;
  gap: 8px;
}

:global(.guest-control-button) {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #374151;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
}

:global(.guest-control-button svg) {
  width: 20px;
  height: 20px;
}

:global(.guest-control-button:hover) {
  background: #eef2ff;
  color: #1d4ed8;
  border-color: #c7d2fe;
  box-shadow: 0 8px 18px rgba(59, 130, 246, 0.25);
  transform: translateY(-1px);
}

:global(.guest-control-button.is-active) {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #1d4ed8;
  box-shadow: 0 10px 24px rgba(29, 78, 216, 0.35);
}

:global(.guest-control-button__locate) {
  background: #111827;
  color: #ffffff;
  border-color: #111827;
  width: 48px;
  height: 48px;
}

:global(.guest-control-button__locate:hover) {
  background: #1f2937;
  border-color: #1f2937;
  box-shadow: 0 8px 22px rgba(17, 24, 39, 0.35);
}

.user-marker, .destination-marker, .facility-marker {
  background: none;
  border: none;
}

.facility-label {
  background: white;
  border: 1px solid #3B82F6;
  border-radius: 6px;
  padding: 2px 6px;
  font-size: 11px;
  color: #1E3A8A;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  white-space: nowrap;
  pointer-events: none;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.user-location-marker {
  background: none !important;
  border: none !important;
}

.user-popup {
  font-family: system-ui, -apple-system, sans-serif;
  font-weight: 500;
}

.leaflet-interactive {
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* Enhanced visibility for satellite view */
.leaflet-overlay-pane .leaflet-interactive {
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}

/* Ensure facility markers are visible on all base layers */
.facility-marker {
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
}

/* Enhanced polygon borders for satellite view */
.leaflet-overlay-pane svg path.leaflet-interactive {
  stroke-width: 3;
}

/* Facility popup styling (Google Maps style) */
.facility-popup .leaflet-popup-content-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  padding: 0;
  overflow: hidden;
}

.facility-popup .leaflet-popup-content {
  margin: 0;
  min-width: 220px;
}

.facility-popup .leaflet-popup-tip {
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Polygon tooltip styling */
.polygon-tooltip {
  background: rgba(0, 0, 0, 0.8) !important;
  border: none !important;
  border-radius: 6px !important;
  padding: 6px 12px !important;
  color: white !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
}

.polygon-tooltip::before {
  border-top-color: rgba(0, 0, 0, 0.8) !important;
}

/* Note Bubble Marker (Custom DivIcon - No Tooltip Issues!) */
.note-bubble-marker {
  background: white;
  border: none !important;
  pointer-events: none !important; /* Marker itself doesn't block clicks */
}

.note-bubble-container {
  background: white;
  border: 2px solid #E5E7EB;
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 220px;
  max-width: 300px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.08);
  position: relative;
  animation: bubblePop 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  pointer-events: auto !important; /* Bubble content is interactive */
}

@keyframes bubblePop {
  0% {
    transform: scale(0.8) translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: scale(1) translateY(-100%);
    opacity: 1;
  }
}

.note-bubble-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #F3F4F6;
}

.note-bubble-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.note-bubble-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.note-bubble-label {
  font-size: 11px;
  font-weight: 700;
  color: #6366F1;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.note-bubble-time {
  font-size: 10px;
  color: #9CA3AF;
  font-weight: 500;
}

.note-bubble-delete {
  background: #FEE2E2;
  border: none;
  border-radius: 6px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #EF4444;
  transition: all 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}

.note-bubble-delete:hover {
  background: #EF4444;
  color: white;
  transform: scale(1.1);
}

.note-bubble-delete:active {
  transform: scale(0.95);
}

.note-bubble-content {
  font-size: 14px;
  color: #1F2937;
  line-height: 1.6;
  word-wrap: break-word;
  font-weight: 400;
  padding: 0;
}

.note-bubble-arrow {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 12px solid white;
  filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.1));
}

/* Arrow border (creates the outline effect) */
.note-bubble-arrow::before {
  content: '';
  position: absolute;
  bottom: 2px;
  left: -12px;
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-top: 12px solid #E5E7EB;
}

/* Note bubble for own notes (displayed on map) */
.note-bubble-own {
  position: relative;
  background: #DBEAFE;
  border: 2px solid #3B82F6;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  max-width: 200px;
}

/* Note bubble for other users' notes */
.note-bubble-other {
  position: relative;
  background: #F3F4F6;
  border: 2px solid #9CA3AF;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  max-width: 200px;
}

/* Legacy note-bubble class (for backward compatibility) */
.note-bubble {
  position: relative;
  background: white;
  border: 2px solid #fbbf24;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  max-width: 200px;
}

.note-content {
  font-size: 12px;
  color: #374151;
  line-height: 1.4;
}

.note-delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ef4444;
  color: white;
  border: 2px solid white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: all 0.2s;
}

.note-delete-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.note-arrow {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid;
  border-top-color: inherit;
}

.note-bubble-own .note-arrow {
  border-top-color: #3B82F6;
}

.note-bubble-other .note-arrow {
  border-top-color: #9CA3AF;
}

/* Animation for navigation instructions update */
@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.navigation-instruction-enter-active {
  animation: slideInRight 0.3s ease-out;
}

.details-panel-enter-active,
.details-panel-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

/* Desktop: slide from left */
@media (min-width: 768px) {
  .details-panel-enter-from,
  .details-panel-leave-to {
    transform: translateX(-16px);
    opacity: 0;
  }
}

/* Mobile: slide from bottom */
@media (max-width: 767px) {
  .details-panel-enter-from,
  .details-panel-leave-to {
    transform: translateY(100%);
    opacity: 0;
  }
}

/* Custom scrollbar for feedback list */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
