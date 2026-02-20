<script setup>
import { ref, onMounted, watch, computed, onBeforeUnmount, toRefs } from 'vue'
import { MagnifyingGlassIcon, XMarkIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import axios from 'axios'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Modal from '../Modal.vue'
import { useReactiveStore } from '../../store/reactives/reactive'
import { useToast } from 'vue-toastification'

// Props
const props = defineProps({
  facilities: {
    type: Array,
    default: () => []
  },
  notes: {
    type: Array,
    default: () => []
  }
})

const toast = useToast();
const react = useReactiveStore();
const {
    // Boolean
        isSearching,
        showSearchResults,
        showGuestModal,
        isLoaded,
        isGuestInfoComplete,
        markerNote,
        isSavingNote,
        showNoteModal,
        showInstructions,
        isReviewModalOpen,
        isSavingFeedback,


    // Holder
        userLocation,
        map,
        searchQuery,
        userMarker,
        destinationMarker,
        routePolyline,
        watchId,
        routeInfo,
        privateRoutes,
        guestStep,
        selectedMarker,
        feedback,
        message,
        filteredLocations,

        // Selection
        selectedLocation,

        // Data Arrays
        facilityMarkers,
        geoJsonLayers,
        navigationInstructions,

    } = toRefs(react);

const guestInfo = ref({
  id: null,
  nickname: '',
  role: ''
})

// Guest roles
const guestRoles = [
  { value: 'student', label: 'Student', icon: '🎓' },
  { value: 'faculty', label: 'Faculty', icon: '👨‍🏫' },
  { value: 'visitor', label: 'Visitor', icon: '👤' },
]

// Marker type icons mapping
const markerTypeIcons = {
  'academic': '🏫',
  'library': '📚',
  'laboratory': '🔬',
  'office': '🏢',
  'cafeteria': '🍽️',
  'sports': '⚽',
  'dormitory': '🏠',
  'parking': '🅿️',
  'medical': '🏥',
  'building': '🏢',
  'classroom': '🏫',
  'administration': '🏛️',
  'default': '📍'
}

const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func(...args), delay)
    }
}
const logSearchToBackend =  async (query) => {
    if(!query.trim() || !guestInfo.value.id){
        return
    }
    try {

        await axios.post('/search-logs',{
            guest_id: guestInfo.value.id,
            query: query.trim(),
            search_at: new Date().toISOString(),
        });
        console.log('Search Log Silently');
    } catch (error) {
        console.error('Failed to log search (non-blocking):', error)
    }
}

const debouncedLogSearch = debounce(logSearchToBackend, 500);

// Search functionality
watch(searchQuery, (query) => {
    if(query.length > 0){
        debouncedLogSearch(query);
    }

  if (query.length > 0) {
    isSearching.value = true
    filteredLocations.value = locations.value.filter(loc =>
      loc.name.toLowerCase().includes(query.toLowerCase()) ||
      loc.department.toLowerCase().includes(query.toLowerCase()) ||
      (loc.category && loc.category.toLowerCase().includes(query.toLowerCase()))
    )
    showSearchResults.value = true
  } else {
    showSearchResults.value = false
    filteredLocations.value = []
  }
  isSearching.value = false
})

// Load guest info from sessionStorage
const loadGuestInfoFromSession = () => {
  const savedGuestInfo = sessionStorage.getItem('guestInfo')
  if (savedGuestInfo) {
    try {
      const parsed = JSON.parse(savedGuestInfo)
      guestInfo.value = parsed
      isGuestInfoComplete.value = true
      showGuestModal.value = false
      return true
    } catch (error) {
      console.error('Error parsing guest info:', error)
      sessionStorage.removeItem('guestInfo')
    }
  }
  return false
}

// Transform facilities to locations format
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
        console.warn('Skipping facility with invalid marker:', facility)
      }

      return hasValidMarker
    })
    .map(facility => {
      try {
        const markerType = facility.marker?.type?.toLowerCase() || 'default'
        return {
          id: facility.id,
          name: facility.name || 'Unnamed Facility',
          lng: parseFloat(facility.marker.longitude),
          lat: parseFloat(facility.marker.latitude),
          department: facility.marker?.type || 'Unknown',
          markerType: markerType,
          category: facility.category || 'General',
          description: facility.description || '',
          icon: markerTypeIcons[markerType] || markerTypeIcons.default
        }
      } catch (error) {
        console.error('Error processing facility:', facility, error)
        return null
      }
    })
    .filter(location => location !== null)
})

// Step navigation
const goToStep2 = () => {
  if (!guestInfo.value.nickname.trim()) {
    console.error('Please enter your nickname')
    return
  }
  guestStep.value = 2
}

const backToStep1 = () => {
  guestStep.value = 1
}

// Save guest info
const saveGuestInfo = async () => {
  if (!guestInfo.value.nickname || !guestInfo.value.role) {
    console.error('Please complete all steps')
    return
  }

  try {
    const response = await axios.post('/guests', {
      name: guestInfo.value.nickname,
      role: guestInfo.value.role,
    })

    const data = response.data
    guestInfo.value.id = data.id
    sessionStorage.setItem('guestInfo', JSON.stringify(guestInfo.value))
    isGuestInfoComplete.value = true
    showGuestModal.value = false

    console.log(`Welcome, ${guestInfo.value.nickname}!`)

    // Initialize map AFTER guest info is saved if not already initialized
    if (!map.value) {
      await initializeMap()
    } else {
      // If map is already initialized, ensure user marker is properly set up
      if (userLocation.value) {
        updateUserMarker()
      } else {
        // Force a location update if we have GPS but no location yet
        startTracking()
      }
    }
  } catch (error) {
    console.error('Error saving guest info:', error)
    console.error(error.response?.data?.message || 'Failed to save guest information')
  }
}

// Calculate distance
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

// Find nearest point on LineString
const getNearestPointOnLine = (point, coordinates) => {
  let nearestIndex = 0
  let minDist = Infinity

  coordinates.forEach((coord, idx) => {
    const dist = calculateDistance(point.lat, point.lng, coord[1], coord[0])
    if (dist < minDist) {
      minDist = dist
      nearestIndex = idx
    }
  })

  return { index: nearestIndex, coord: coordinates[nearestIndex], distance: minDist }
}

// Find clicked LineString
const findClickedLineString = (clickPoint, features, threshold = 30) => {
  let closestFeature = null
  let minDist = Infinity

  features.forEach((feature) => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates
      coords.forEach((coord) => {
        const dist = calculateDistance(clickPoint.lat, clickPoint.lng, coord[1], coord[0])
        if (dist < minDist) {
          minDist = dist
          closestFeature = feature
        }
      })
    }
  })

  return minDist <= threshold ? closestFeature : null
}

// Generate navigation instructions
const generateInstructions = (route, isPrivatePath) => {
  const instructions = []

  instructions.push({
    icon: '🚶',
    text: 'Start from your location',
    distance: '0 m'
  })

  let cumulativeDistance = 0
  for (let i = 0; i < route.length - 1; i++) {
    const segmentDist = calculateDistance(
      route[i][0], route[i][1],
      route[i + 1][0], route[i + 1][1]
    )
    cumulativeDistance += segmentDist

    if (i === Math.floor(route.length * 0.3)) {
      instructions.push({
        icon: '➡️',
        text: isPrivatePath ? 'Continue on public road' : 'Continue straight',
        distance: `${Math.round(cumulativeDistance)} m`
      })
    }

    if (i === Math.floor(route.length * 0.6) && isPrivatePath) {
      instructions.push({
        icon: '🏫',
        text: 'Enter private campus path',
        distance: `${Math.round(cumulativeDistance)} m`
      })
    }
  }

  instructions.push({
    icon: '🎯',
    text: 'You have arrived at your destination',
    distance: `${Math.round(cumulativeDistance)} m`
  })

  return instructions
}

// Calculate ETA
const calculateETA = (distanceMeters) => {
  const walkingSpeedKmH = 5
  const walkingSpeedMS = walkingSpeedKmH * 1000 / 3600
  const timeSeconds = distanceMeters / walkingSpeedMS
  const timeMinutes = Math.ceil(timeSeconds / 60)

  const now = new Date()
  const eta = new Date(now.getTime() + timeSeconds * 1000)

  return {
    minutes: timeMinutes,
    arrivalTime: eta.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }
}

// Get public route from OSRM
const getPublicRoute = async (start, end) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
    const response = await fetch(url)
    const data = await response.json()

    if (data.code === 'Ok' && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates
      return coords.map(([lng, lat]) => ({ lat, lng }))
    }
  } catch (err) {
    console.error('OSRM routing error:', err)
  }
  return null
}

// const getPublicRoute = async (start, end) => {
//   try {
//     const baseUrl = 'http://127.0.0.1:5000';
//     const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
//     const url = `${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

//     const response = await fetch(url);
//     const data = await response.json();

//     if (data.code === 'Ok' && data.routes.length > 0) {
//       const coords = data.routes[0].geometry.coordinates;
//       return coords.map(([lng, lat]) => ({ lat, lng }));
//     } else {
//       console.error(' OSRM returned invalid response:', data);
//     }
//   } catch (err) {
//     console.error('🚨 Local OSRM routing error:', err);
//   }
//   return null;
// };



// Main routing function
const createRoute = async (clickLatLng) => {
  if (!userLocation.value) {
    console.error(' Waiting for GPS location...')
    return
  }

  if (!privateRoutes.value || !privateRoutes.value.features) {
    console.error('No route data available')
    return
  }

  // Clear previous route (but NOT facility markers)
  if (routePolyline.value) map.value.removeLayer(routePolyline.value)
  if (destinationMarker.value) map.value.removeLayer(destinationMarker.value)
  map.value.closePopup();

  const userPos = { lat: userLocation.value.lat, lng: userLocation.value.lng }
  let fullRoute = []
  let isPrivatePath = false
  let finalDestination = { lat: clickLatLng.lat, lng: clickLatLng.lng } // Default to click

  // Check if clicked on LineString (private path)
  const clickedFeature = findClickedLineString(clickLatLng, privateRoutes.value.features, 30) // Threshold in meters

  if (clickedFeature) {
    console.log('Routing via private path')
    isPrivatePath = true

    const lineCoords = clickedFeature.geometry.coordinates
    const nearestToClick = getNearestPointOnLine({ lat: clickLatLng.lat, lng: clickLatLng.lng }, lineCoords)

    const lineStart = {
      lat: lineCoords[0][1],
      lng: lineCoords[0][0]
    }

    // Step 1: Public route to start of LineString
    const publicSegment = await getPublicRoute(userPos, lineStart)
    if (publicSegment) {
      publicSegment.forEach(p => fullRoute.push([p.lat, p.lng]))
    } else {
      fullRoute.push([userPos.lat, userPos.lng])
      fullRoute.push([lineStart.lat, lineStart.lng])
    }

    // Step 2: Follow private LineString to nearest point
    for (let i = 0; i <= nearestToClick.index; i++) {
      const [lng, lat] = lineCoords[i]
      fullRoute.push([lat, lng])
    }

    const snappedDest = nearestToClick.coord // Use nearest point on line as endpoint
    fullRoute.push([snappedDest[1], snappedDest[0]]) // [lat, lng]
    finalDestination = { lat: snappedDest[1], lng: snappedDest[0] } // Update marker to snapped end

    console.log('Private path snapped destination:', finalDestination) // Debug log
  } else {
    console.log('🟢 Public roads only')

    const destPos = { lat: clickLatLng.lat, lng: clickLatLng.lng }
    const publicRoute = await getPublicRoute(userPos, destPos)

    if (publicRoute) {
      publicRoute.forEach(p => fullRoute.push([p.lat, p.lng]))
      // NEW: Set final destination to the ACTUAL end of OSRM route (snapped point)
      const routeEnd = publicRoute[publicRoute.length - 1]
      finalDestination = { lat: routeEnd.lat, lng: routeEnd.lng }
      console.log('Public route snapped destination:', finalDestination, 'vs original click:', clickLatLng) // Debug log
    } else {
      fullRoute.push([userPos.lat, userPos.lng])
      fullRoute.push([destPos.lat, destPos.lng])
      finalDestination = destPos // Fallback to click if no route
    }
  }

  // Draw route using fullRoute (now ends at snapped/accurate point)
  routePolyline.value = L.polyline(fullRoute, {
    color: isPrivatePath ? '#2196F3' : '#4CAF50',
    weight: 6,
    opacity: 0.8
  }).addTo(map.value)

  // Place marker at FINAL DESTINATION (snapped end of route, not raw click)
  destinationMarker.value = L.marker([finalDestination.lat, finalDestination.lng], {
    title: 'Destination',
    icon: L.divIcon({
      className: 'destination-marker',
      html: '<div style="background: #FF5252; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map.value)

  // Calculate distance from route (not raw click)
  let totalDistance = 0
  for (let i = 0; i < fullRoute.length - 1; i++) {
    totalDistance += calculateDistance(
      fullRoute[i][0], fullRoute[i][1],
      fullRoute[i + 1][0], fullRoute[i + 1][1]
    )
  }

  const distanceText = totalDistance > 1000
    ? `${(totalDistance / 1000).toFixed(2)} km`
    : `${Math.round(totalDistance)} m`

  const eta = calculateETA(totalDistance)
  routeInfo.value = `${isPrivatePath ? '🟢 Public →  Private' : '🟢 Public Roads'}\n📏 ${distanceText}\n⏱️ ${eta.minutes} min\n🕐 Arrive at ${eta.arrivalTime}`

  navigationInstructions.value = generateInstructions(fullRoute, isPrivatePath)
  showInstructions.value = true

  // Fit to route bounds (marker will now align with route end)
  map.value.fitBounds(routePolyline.value.getBounds(), { padding: [50, 50] })
}


// Add facility marker
const addFacilityMarker = (location) => {
  if (!map.value) return

  const marker = L.marker([location.lat, location.lng], {
    title: location.name,
    icon: L.divIcon({
      className: 'facility-marker',
      html: `
        <div style="
          background: white;
          border: 2px solid #3B82F6;
          border-radius: 50%;
          width: 40px;
          height: 40px;
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
  }).addTo(map.value)
     .bindTooltip(location.name, {
        permanent: true,
        direction: 'top',
        offset: [0 ,-20],
        className: 'facility-label'
     })

const popupContent = `
  <div class="p-2 min-w-[230px] font-inter">
    <div class="flex items-center gap-2 mb-2">
      <span class="text-xl">${location.icon}</span>
      <h3 class="font-semibold text-gray-800 m-0 text-sm">${location.name}</h3>
    </div>

    <p class="text-xs text-gray-600 my-1"><strong>Type:</strong> ${location.department}</p>
    <p class="text-xs text-gray-600 my-1"><strong>Category:</strong> ${location.category}</p>
    ${
      location.description
        ? `<p class="text-xs text-gray-600 mt-2">${location.description}</p>`
        : ''
    }

    <div class="flex justify-between items-center gap-1.5 mt-2.5">
      <!-- Route Button -->
      <button id="route-btn-${location.id}" class="flex-1 bg-blue-500 text-white px-0 py-1.5 rounded-md text-xs border-none cursor-pointer flex items-center justify-center gap-1 hover:bg-blue-600">
        🧭 Route
      </button>

      <!-- Add Note Button -->
      <button id="note-btn-${location.id}" class="flex-1 bg-emerald-500 text-white px-0 py-1.5 rounded-md text-xs border-none cursor-pointer flex items-center justify-center gap-1 hover:bg-emerald-700">
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-4 h-4'>
          <path stroke-linecap='round' stroke-linejoin='round' d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125' />
        </svg>
        Note
      </button>

      <!-- Review Button -->
      <button id="review-btn-${location.id}" class="flex-1 bg-amber-500 text-white px-0 py-1.5 rounded-md text-xs border-none cursor-pointer flex items-center justify-center gap-1 hover:bg-amber-600">
        <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class='w-4 h-4'>
          <path stroke-linecap='round' stroke-linejoin='round' d='M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z' />
        </svg>
        Review
      </button>
    </div>
  </div>
`;


  marker.bindPopup(popupContent)

  marker.on('popupopen', () => {
    const routeBtn = document.getElementById(`route-btn-${location.id}`)
    const noteBtn = document.getElementById(`note-btn-${location.id}`)
    const reviewBtn = document.getElementById(`review-btn-${location.id}`)


    if (routeBtn) {
      routeBtn.addEventListener('click', () => {
        createRoute(L.latLng(location.lat, location.lng))
        selectedLocation.value = location
        marker.closePopup()
        console.info(`Routing to ${location.name}`)
      })
    }

    if (noteBtn) {
      noteBtn.addEventListener('click', () => {
        selectedMarker.value = location
        markerNote.value = ''
        showNoteModal.value = true
        marker.closePopup()
      })
    }

    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            selectedMarker.value = location
            feedback.value = ''
            isReviewModalOpen.value = true
            marker.closePopup()
        })
    }
  })

  facilityMarkers.value.push(marker)
  return marker
}

// Start tracking user
const startTracking = () => {
  if (!navigator.geolocation) {
    console.error('Geolocation not supported')
    return
  }

  // Get initial position first, then watch
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation.value = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }
      console.log('Initial GPS position acquired:', userLocation.value)
      updateUserMarker()

      // Now start watching for changes
      watchId.value = navigator.geolocation.watchPosition(
        (pos) => {
          userLocation.value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
          updateUserMarker()
        },
        (err) => console.error('Geolocation watch error:', err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      )
    },
    (err) => {
      console.error('Initial geolocation error:', err)
      // Fallback: use a default location if GPS fails
      userLocation.value = { lat: 8.169, lng: 126.003 }
      updateUserMarker()
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  )
}

const stopTracking = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
  }
}

// Update user marker
const updateUserMarker = () => {
  if (!userLocation.value || !map.value) {
    console.warn('Cannot update user marker: missing location or map')
    return
  }

  try {
    // If marker already exists, just update its position
    if (userMarker.value && typeof userMarker.value.setLatLng === 'function') {
      userMarker.value.setLatLng([userLocation.value.lat, userLocation.value.lng])
    } else {
      console.log('Creating new user marker...')

      // Create a default Leaflet marker
      userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
        title: 'You'
      }).addTo(map.value)

      // Bind a simple popup
      const popupContent = `<div style="font-size: 13px; color: #1f2937; font-weight: 500;">${guestInfo.value.nickname || 'You'}</div>`
      userMarker.value.bindPopup(popupContent, {
        offset: [0, -12],
        closeButton: false,
        className: 'minimal-popup'
      })

      // Open popup if name available
      if (guestInfo.value.nickname) {
        setTimeout(() => {
          if (userMarker.value && !userMarker.value.isPopupOpen()) {
            userMarker.value.openPopup()
          }
        }, 1000)
      }
    }

    // Update popup when info changes
    if (userMarker.value && typeof userMarker.value.setPopupContent === 'function') {
      const updatedPopupContent = `<div style="font-size: 13px; color: #1f2937; font-weight: 500;">${guestInfo.value.nickname || 'You'}</div>`
      userMarker.value.setPopupContent(updatedPopupContent)
    }

  } catch (error) {
    console.error('Error updating user marker:', error)
    userMarker.value = null
  }
}
const loadPrivateRoutes = async () => {
  try {
    const response = await axios.get('/routes/export/geojson-pub', {
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    })

    privateRoutes.value = response.data

    // Refresh map layers immediately after loading
    if (map.value) {
      refreshPrivateRoutesOnMap();
    }
    console.log(' Loaded routes from database:', privateRoutes.value)
    isLoaded.value = true
  } catch (error) {
    console.error(' Error loading routes from database:', error)
    toast.error('Failed to load campus paths')
  }
}

const refreshPrivateRoutesOnMap = () =>{
     if (!map.value || !privateRoutes.value || !privateRoutes.value.features) {
        console.warn('Cannot refresh private routes: Map or data not ready');
        return;
    }
    // Step 1: Clear existing private route layers
    geoJsonLayers.value.forEach(layer => {
        if (map.value) {
        map.value.removeLayer(layer);
        }
    });
    geoJsonLayers.value = []; // Reset the array (reactive update)
    console.log(`🗑️ Cleared ${geoJsonLayers.value.length} old private route layers`);

      privateRoutes.value.features.forEach((feature) => {
    if (feature.geometry && feature.geometry.type === 'LineString') {
      const layer = L.geoJSON(feature, {
        style: {
          color: '#FF6B6B', // Red for private paths
          weight: 5,
          opacity: 0.7,
          dashArray: '8, 4' // Dashed style
        }
      }).addTo(map.value);
      // Make layers clickable for routing
      layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        createRoute(e.latlng);
      });
      geoJsonLayers.value.push(layer);
    }
  });

    console.log(` Added ${privateRoutes.value.features.length} new private route layers`);
    toast.success('Campus paths updated in real-time!'); // Optional feedback
};

// Initialize map
const initializeMap = async () => {
  try {
    await loadPrivateRoutes()

    const standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    })

    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles © Esri' }
    )

    map.value = L.map('map', {
      center: [8.169500, 126.001838],
      zoom: 17,
      layers: [standard]
    })

    L.control.layers({ '🗺️ Standard': standard, '🛰️ Satellite': satellite }).addTo(map.value)

    // Wait for map to be fully loaded
    map.value.whenReady(() => {
      console.log('Map is fully loaded and ready')

      // Add facility markers
      if (locations.value.length > 0) {
        console.log(`📍 Adding ${locations.value.length} facility markers`)
        locations.value.forEach(location => {
          addFacilityMarker(location, map.value)
        })
      }

      // Add private routes
      if (privateRoutes.value) {
        privateRoutes.value.features.forEach((feature) => {
          if (feature.geometry.type === 'LineString') {
            const layer = L.geoJSON(feature, {
              style: {
                color: '#FF6B6B',
                weight: 5,
                opacity: 0.7,
                dashArray: '8, 4'
              }
            }).addTo(map.value)

            layer.on('click', (e) => {
              L.DomEvent.stopPropagation(e)
              createRoute(e.latlng)
            })

            geoJsonLayers.value.push(layer)
          }
        })
      }

      map.value.on('click', (e) => {
        createRoute(e.latlng)
      })

      startTracking()
    })

  } catch (error) {
    console.error('Error initializing map:', error)
    console.error('Failed to initialize map')
  }
}



const selectSearchResult = (location) => {
  selectedLocation.value = location
  searchQuery.value = location.name
  showSearchResults.value = false
  createRoute(L.latLng(location.lat, location.lng))
  console.info(`Routing to ${location.name}`)
}

const clearSearch = () => {
  searchQuery.value = ''
  selectedLocation.value = null
  showSearchResults.value = false
  if (routePolyline.value) map.value.removeLayer(routePolyline.value)
  if (destinationMarker.value) map.value.removeLayer(destinationMarker.value)
  routeInfo.value = null
  showInstructions.value = false
  console.info('Route cleared')
}

// Save marker note
const saveMarkerNote = async () => {
  if (!markerNote.value.trim()) {
    console.error('Please enter a note')
    return
  }

  if (!guestInfo.value.id) {
    console.error('Guest information not found')
    return
  }

  isSavingNote.value = true

  try {
    await axios.post('/create/note', {
      guest_id: guestInfo.value.id,
      marker_id: selectedMarker.value.id,
      content: markerNote.value.trim(),
    })

    console.log('Note saved successfully!')
    showNoteModal.value = false
    markerNote.value = ''
    selectedMarker.value = null
  } catch (error) {
    console.error('Error saving note:', error)
    console.error('Failed to save note')
  } finally {
    isSavingNote.value = false
  }
}

const saveFeedback = async () => {
    if(!feedback.value.trim()){
        console.error('Empty bitch!')
        toast.error('Empty')
        return
    }


    if (!guestInfo.value.id) {
        console.error('Guest information not found')
        toast.error('Error')
        return
    }

    isSavingFeedback.value = true;

    try {
        const response = await axios.post('/create/feedback',{
            guest_id: guestInfo.value.id,
            marker_id: selectedMarker.value.id,
            message: feedback.value.trim(),
        })
        message.value = response.data.message
        console.log(message.value)
        toast.success(message.value || ' Added');
        isReviewModalOpen.value = false;
        feedback.value = '';
        selectedMarker.value = null;
        isSavingFeedback.value = false;
    } catch (error) {
        console.log('Error saving feedback', error)
        toast.error(error)
    }finally{
        isReviewModalOpen.value = false;
    }
}

const closeNoteModal = () => {
  showNoteModal.value = false
  markerNote.value = ''
  selectedMarker.value = null
}

const clearGuestSession = () => {
  sessionStorage.removeItem('guestInfo')
  guestInfo.value = { id: null, nickname: '', role: '' }
  isGuestInfoComplete.value = false
  showGuestModal.value = true
  guestStep.value = 1
  console.info('Please enter your information again')
}

const hasGuestInfo = loadGuestInfoFromSession()
let channel;
onMounted(() => {
    console.log('Notes:', props.notes)
  if (hasGuestInfo) {
    initializeMap()
    console.log(`Welcome back, ${guestInfo.value.nickname}!`)
  }

  window.Echo.channel('main-channel')
    .listen('.MainEvent', (e) => {
       if(e.type === "route"){
        loadPrivateRoutes();
        console.log('Payload:', e.action);
       }
    });


})

onBeforeUnmount(() => {
  stopTracking()
})
</script>

<template>
  <div class="relative w-full h-screen">
    <!-- Map Container -->
    <div
      id="map"
      :class="[
        'w-full h-full transition-all duration-300 z-0',
        !isGuestInfoComplete ? 'blur-sm pointer-events-none' : ''
      ]"
    ></div>

    <!-- Guest Info Modal -->
    <div v-if="showGuestModal" class="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-sm mx-auto">
        <!-- Step 1: Nickname -->
        <div v-if="guestStep === 1" class="p-8">
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Campus Navigator</h2>
            <p class="text-sm text-gray-500">Let's get started with your nickname</p>
          </div>

          <div class="space-y-4">
            <input
              v-model="guestInfo.nickname"
              type="text"
              placeholder="Enter your nickname"
              class="w-full px-4 py-3 text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              maxlength="50"
              @keyup.enter="goToStep2"
            />

            <button
              @click="goToStep2"
              :disabled="!guestInfo.nickname.trim()"
              :class="[
                'w-full px-4 py-3 text-sm font-medium rounded-lg transition-all',
                guestInfo.nickname.trim()
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              Continue
            </button>
          </div>
        </div>

        <!-- Step 2: Role Selection -->
        <div v-if="guestStep === 2" class="p-8">
          <div class="text-center mb-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Select Your Role</h2>
            <p class="text-sm text-gray-500">How are you visiting our campus?</p>
          </div>

          <div class="space-y-3 mb-6">
            <button
              v-for="role in guestRoles"
              :key="role.value"
              @click="guestInfo.role = role.value"
              :class="[
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all',
                guestInfo.role === role.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              ]"
            >
              <span class="text-2xl">{{ role.icon }}</span>
              <span class="text-sm font-medium text-gray-900">{{ role.label }}</span>
            </button>
          </div>

          <div class="space-y-2">
            <button
              @click="saveGuestInfo"
              :disabled="!guestInfo.role"
              :class="[
                'w-full px-4 py-3 text-sm font-medium rounded-lg transition-all',
                guestInfo.role
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              ]"
            >
              Start Exploring
            </button>

            <button
              @click="backToStep1"
              class="w-full px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Bar -->
    <div
      v-if="isGuestInfoComplete"
      class="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 w-full max-w-md px-4"
    >
      <div class="bg-white rounded-lg shadow-lg">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search for facilities..."
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

        <div
          v-if="showSearchResults"
          class="mt-1 max-h-60 overflow-y-auto border-t border-gray-200"
        >
          <div v-if="isSearching" class="p-4 text-center text-gray-500 text-sm">
            Searching...
          </div>
          <div v-else-if="filteredLocations.length === 0" class="p-4 text-center text-gray-500 text-sm">
            No facilities found
          </div>
          <div v-else>
            <button
              v-for="location in filteredLocations"
              :key="location.id"
              @click="selectSearchResult(location)"
              class="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span class="text-xl">{{ location.icon }}</span>
                <div class="flex-1">
                  <div class="font-medium text-sm text-gray-900">{{ location.name }}</div>
                  <div class="text-xs text-gray-500 mt-1">{{ location.markerType }} • {{ location.category }}</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Profile Button -->
    <div
      v-if="isGuestInfoComplete"
      class="absolute top-4 right-4 z-10"
    >
      <div class="relative group">
        <button
          class="flex items-center gap-2 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          <UserCircleIcon class="h-5 w-5 text-blue-600" />
          <div class="text-left hidden sm:block">
            <div class="text-xs font-semibold text-gray-900">{{ guestInfo.nickname }}</div>
            <div class="text-xs text-gray-500">{{ guestInfo.role }}</div>
          </div>
        </button>

        <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
          <button
            @click="clearGuestSession"
            class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>

<!-- Route Info Panel -->
<div
  v-if="isGuestInfoComplete && routeInfo"
  class="absolute top-20 left-4 bg-white rounded-lg shadow-lg max-w-xs z-10 border border-gray-200"
>
  <div class="px-3 py-2 border-b border-gray-200 bg-gray-900">
    <h3 class="font-semibold text-white text-sm">Route Info</h3>
  </div>
  <div class="px-3 py-2 text-xs text-gray-700 leading-relaxed whitespace-pre-line">
    {{ routeInfo }}
  </div>
</div>

    <!-- Navigation Instructions Panel -->
<!-- Navigation Instructions Panel -->
<div
  v-if="showInstructions"
  class="absolute bottom-4 right-4 w-72 bg-white rounded-lg shadow-lg z-20 max-h-72 overflow-hidden flex flex-col border border-gray-200"
>
  <div class="px-3 py-2 border-b border-gray-200 flex justify-between items-center bg-gray-900">
    <h3 class="font-semibold text-white text-sm">Navigation</h3>
    <button
      @click="showInstructions = false"
      class="text-gray-400 hover:text-white transition text-lg leading-none w-5 h-5 flex items-center justify-center"
    >
      ×
    </button>
  </div>
  <div class="overflow-y-auto">
    <div
      v-for="(instruction, idx) in navigationInstructions"
      :key="idx"
      class="flex items-start gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition"
    >
      <span class="text-base mt-0.5">{{ instruction.icon }}</span>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-medium text-gray-900 leading-snug">{{ instruction.text }}</p>
        <p class="text-xs text-gray-500 mt-0.5">{{ instruction.distance }}</p>
      </div>
    </div>
  </div>
</div>

    <!-- Note Modal -->
     <Modal :show="showNoteModal" @close="showNoteModal = false">
      <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto">
        <div class="px-6 py-4 border-b border-gray-200">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📝</span>
              <h3 class="text-lg font-bold text-gray-900">Add Note</h3>
            </div>
            <button @click="closeNoteModal" class="text-gray-400 hover:text-gray-600">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
        </div>

        <div class="px-6 py-5">
          <div v-if="selectedMarker" class="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-2">
            <span class="text-xl">{{ selectedMarker.icon }}</span>
            <div>
              <div class="font-semibold text-sm text-gray-900">{{ selectedMarker.name }}</div>
              <div class="text-xs text-gray-600 mt-1">{{ selectedMarker.markerType }}</div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-900 mb-2">
              Your Note
            </label>
            <textarea
              v-model="markerNote"
              placeholder="Write your note about this location..."
              rows="4"
              class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              maxlength="500"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">
              {{ markerNote.length }}/500 characters
            </p>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            @click="closeNoteModal"
            type="button"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            :disabled="isSavingNote"
          >
            Cancel
          </button>
          <button
            @click="saveMarkerNote"
            type="button"
            :disabled="!markerNote.trim() || isSavingNote"
            :class="[
              'flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
              markerNote.trim() && !isSavingNote
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            ]"
          >
            {{ isSavingNote ? 'Saving...' : 'Save Note' }}
          </button>
        </div>
      </div>
     </Modal>

     <!-- Reviw Modal-->
     <Modal :show="isReviewModalOpen" @close="isReviewModalOpen = false">
        <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                    <span class="text-2xl">📝</span>
                    <h3 class="text-lg font-bold text-gray-900">Feedback</h3>
                    </div>
                    <button @click="isReviewModalOpen = false" class="text-gray-400 hover:text-gray-600">
                    <XMarkIcon class="h-5 w-5" />
                    </button>
                </div>

                <div>
                    <label class="block text-sm font-semibold text-gray-900 mb-2">
                    Your Feedback
                    </label>
                    <textarea
                    v-model="feedback"
                    placeholder="Write your note about this location..."
                    rows="4"
                    class="w-full px-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                    maxlength="500"
                    ></textarea>
                    <p class="text-xs text-gray-500 mt-1">
                    {{ feedback.length }}/500 characters
                    </p>
                </div>
                <div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3">
                    <button
                        @click="isReviewModalOpen = false"
                        type="button"
                        :disabled="isSavingFeedback"
                        class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                    Cancel
                    </button>
                    <button
                        @click="saveFeedback"
                        type="button"
                        :disabled="!feedback.trim() || isSavingFeedback"
                        :class="[
                            'flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
                            feedback.trim() && !isSavingFeedback
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        ]"
                        >
                        {{ isSavingFeedback ? 'Saving...' : 'Save Feedback' }}
                    </button>
                </div>
            </div>
        </div>
     </Modal>
  </div>
</template>

<style scoped>
#map {
  height: 100vh;
  width: 100%;
  /* Ensure map stays in its own stacking context below modals */
  position: relative;
  z-index: 0;
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
  font-size: 12px;
  color: #1E3A8A;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}


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

.max-h-60::-webkit-scrollbar-thumb:hover {
  background: #555;
}

@media (max-width: 768px) {
  .absolute.top-20.left-4 {
    max-width: calc(100vw - 2rem);
    font-size: 0.875rem;
  }
}
</style>
