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
  },
  polygons: {
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
const sessionCheckInterval = ref(null);

const transportMode = ref('walking') // walking, riding, driving
const transportModes = [
  { value: 'walking', label: 'Walking', icon: '🚶', speed: 5 },
  { value: 'riding', label: 'Riding', icon: '🚴', speed: 15 },
  { value: 'driving', label: 'Driving', icon: '🚗', speed: 40 }
]

const noteMarkers = ref([])
const polygonLayers = ref([])

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

// Check session expiration periodically
const startSessionChecker = () => {
  // Check every minute
  sessionCheckInterval.value = setInterval(() => {
    const savedGuestInfo = sessionStorage.getItem('guestInfo')
    if (savedGuestInfo) {
      try {
        const parsed = JSON.parse(savedGuestInfo)
        // Check if session has expired
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          console.log('Session expired, reloading page...')
          clearSessionAndReload()
        }
      } catch (error) {
        console.error('Error checking session:', error)
        clearSessionAndReload()
      }
    }
  }, 60000) // Check every minute
}

const clearSessionAndReload = () => {
  sessionStorage.removeItem('guestInfo')
  window.location.reload()
}

// Load guest info from sessionStorage with expiration check
const loadGuestInfoFromSession = () => {
  const savedGuestInfo = sessionStorage.getItem('guestInfo')
  if (savedGuestInfo) {
    try {
      const parsed = JSON.parse(savedGuestInfo)

      // Check if session has expired
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        console.log('Session expired, clearing stored data')
        sessionStorage.removeItem('guestInfo')
        return false
      }

      guestInfo.value = parsed
      isGuestInfoComplete.value = true
      showGuestModal.value = false

      startSessionChecker();
      return true
    } catch (error) {
      console.error('Error parsing guest info:', error)
      sessionStorage.removeItem('guestInfo')
    }
  }
  return false
}

// Transform facilities to locations format - UPDATED
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
          id: facility.id, // Facility ID
          marker_id: facility.marker.id, // Add marker ID
          name: facility.name || 'Unnamed Facility',
          lng: parseFloat(facility.marker.longitude),
          lat: parseFloat(facility.marker.latitude),
          department: facility.marker?.type || 'Unknown',
          markerType: markerType,
          category: facility.category || 'General',
          description: facility.description || '',
          icon: markerTypeIcons[markerType] || markerTypeIcons.default,
          marker: facility.marker // Include the full marker object
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

    // Store with 24-hour expiration
    const guestData = {
      ...guestInfo.value,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }

    sessionStorage.setItem('guestInfo', JSON.stringify(guestData))
    isGuestInfoComplete.value = true
    showGuestModal.value = false

    console.log(`Welcome, ${guestInfo.value.nickname}!`)

    startSessionChecker();

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

// Calculate distance using Haversine formula
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3 // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
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

// Find clicked LineString feature
const findClickedLineString = (clickPoint, features, threshold = 30) => {
  let closestFeature = null
  let closestPoint = null
  let minDist = Infinity

  features.forEach((feature) => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates
      const nearest = getNearestPointOnLine(clickPoint, coords)

      if (nearest.distance < minDist) {
        minDist = nearest.distance
        closestFeature = feature
        closestPoint = nearest
      }
    }
  })

  return minDist <= threshold ? { feature: closestFeature, point: closestPoint } : null
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

const getPublicRoute = async (start, end) => {
  try {
    const profile = transportMode.value === 'driving' ? 'driving' : transportMode.value === 'riding' ? 'cycling' : 'walking'
    const url = `https://router.project-osrm.org/route/v1/${profile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
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
// Build campus graph from GeoJSON features
const buildCampusGraph = (geojsonFeatures) => {
  const graph = new Map()
  const nodeMap = new Map() // To deduplicate nodes by coordinates

  const getNodeId = (lat, lng) => {
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
    if (!nodeMap.has(key)) {
      const nodeId = `node_${nodeMap.size}`
      nodeMap.set(key, nodeId)
      graph.set(nodeId, {
        id: nodeId,
        lat,
        lng,
        neighbors: []
      })
    }
    return nodeMap.get(key)
  }

  geojsonFeatures.forEach((feature) => {
    if (feature.geometry.type !== 'LineString') return

    const coords = feature.geometry.coordinates
    let prevNodeId = null

    coords.forEach(([lng, lat], index) => {
      const nodeId = getNodeId(lat, lng)
      const currentNode = graph.get(nodeId)

      // Connect to previous node (bidirectional)
      if (prevNodeId) {
        const prevNode = graph.get(prevNodeId)
        const distance = calculateDistance(prevNode.lat, prevNode.lng, lat, lng)

        // Check if connection already exists
        if (!currentNode.neighbors.some(n => n.id === prevNodeId)) {
          currentNode.neighbors.push({ id: prevNodeId, cost: distance })
        }
        if (!prevNode.neighbors.some(n => n.id === nodeId)) {
          prevNode.neighbors.push({ id: nodeId, cost: distance })
        }
      }

      prevNodeId = nodeId
    })
  })

  console.log(`Built graph with ${graph.size} nodes and ${Array.from(graph.values()).reduce((sum, node) => sum + node.neighbors.length, 0)} edges`)
  return graph
}

// Find nearest node in graph
const findNearestNode = (point, graph, maxDistance = 100) => {
  let nearestId = null
  let minDist = Infinity

  for (const [nodeId, node] of graph.entries()) {
    const dist = calculateDistance(point.lat, point.lng, node.lat, node.lng)
    if (dist < minDist && dist <= maxDistance) {
      minDist = dist
      nearestId = nodeId
    }
  }

  return nearestId
}

// A* Pathfinding Algorithm
const findPathAStar = (startId, goalId, graph) => {
 if (!graph.has(startId) || !graph.has(goalId)) {
  console.warn('Start or goal node not in graph');
  return null;
 }

 // The set of nodes already evaluated.
 const closedSet = new Set();

 // The set of currently discovered nodes that are not evaluated yet.
 // Initially, only the start node is known.
 const openSet = [startId];

 // For each node, which node it can most efficiently be reached from.
 // If a node can be reached from many nodes, cameFrom will eventually contain the most efficient previous step.
 const cameFrom = new Map();

 // For each node, the cost of getting from the start node to that node.
 const gScore = new Map();
 gScore.set(startId, 0); // The cost of going from start to start is 0.

 // For each node, the total cost of getting from the start node to the goal
 // by passing by that node. That value is partly known, partly heuristic.
 const fScore = new Map();

 const startNode = graph.get(startId);
 const goalNode = graph.get(goalId);

 // Heuristic function (straight-line distance), which is admissible.
 const heuristic = (nodeA, nodeB) => {
  return calculateDistance(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng);
 };

 // For the first node, the fScore is completely heuristic.
 fScore.set(startId, heuristic(startNode, goalNode));

 while (openSet.length > 0) {
  // Find the node in openSet having the lowest fScore[] value
  let currentId = openSet.reduce((lowest, id) => {
   return (fScore.get(id) || Infinity) < (fScore.get(lowest) || Infinity) ? id : lowest;
  }, openSet[0]);

  if (currentId === goalId) {
   return reconstructPath(cameFrom, currentId, graph);
  }

  // Move currentId from openSet to closedSet
  openSet.splice(openSet.indexOf(currentId), 1);
  closedSet.add(currentId);

  const currentNode = graph.get(currentId);
  const currentG = gScore.get(currentId);

  for (const neighbor of currentNode.neighbors) {
   const neighborId = neighbor.id;
   const neighborNode = graph.get(neighborId);

   // Ignore the neighbor which is already evaluated.
   if (closedSet.has(neighborId) || !neighborNode) {
    continue;
   }

   // The distance from start to a neighbor
   const tentativeG = currentG + neighbor.cost;

   // Discover a new node
   if (!openSet.includes(neighborId)) {
    openSet.push(neighborId);
   } else if (tentativeG >= (gScore.get(neighborId) || Infinity)) {
    // This is not a better path.
    continue;
   }

   // This path is the best until now. Record it!
   cameFrom.set(neighborId, currentId);
   gScore.set(neighborId, tentativeG);
   fScore.set(neighborId, tentativeG + heuristic(neighborNode, goalNode));
  }
 }

 console.warn('No path found between nodes');
 return null;
}

// Reconstruct path from cameFrom map
const reconstructPath = (cameFrom, currentId, graph) => {
  const path = []
  let current = currentId

  while (current) {
    const node = graph.get(current)
    path.unshift({ lat: node.lat, lng: node.lng })
    current = cameFrom.get(current)
  }

  return path
}

// Calculate total route distance
const calculateRouteDistance = (route) => {
  let totalDistance = 0
  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += calculateDistance(
      route[i].lat, route[i].lng,
      route[i + 1].lat, route[i + 1].lng
    )
  }
  return totalDistance
}

// Find campus entrances
const findCampusEntrances = (graph, maxDistance = 50) => {
  const entrances = []
  for (const [nodeId, node] of graph.entries()) {
    entrances.push({
      id: nodeId,
      lat: node.lat,
      lng: node.lng,
      node: node
    })
  }

  return entrances
}

// Create route with pathfinding
const createRouteWithPathfinding = async (clickLatLng) => {
  if (!userLocation.value) {
    toast.error('Waiting for GPS location...')
    return
  }

  // Clear previous route
  if (routePolyline.value) map.value.removeLayer(routePolyline.value)
  if (destinationMarker.value) map.value.removeLayer(destinationMarker.value)
  map.value.closePopup()

  const userPos = { lat: userLocation.value.lat, lng: userLocation.value.lng }
  const destPos = { lat: clickLatLng.lat, lng: clickLatLng.lng }

  console.log('🔍 Calculating optimal route...')

  // Check if user clicked ON a LineString (within 30m)
  if (privateRoutes.value && privateRoutes.value.features) {
    const clickedLineString = findClickedLineString(destPos, privateRoutes.value.features, 30)

    if (clickedLineString) {
      console.log('🎯 User clicked on a private path! Using hybrid route...')

      const lineCoords = clickedLineString.feature.geometry.coordinates
      const nearestPoint = clickedLineString.point

      // Get the entry point of the LineString
      const lineStart = {
        lat: lineCoords[0][1],
        lng: lineCoords[0][0]
      }

      // Step 1: Public route from user to LineString start
      const publicToLine = await getPublicRoute(userPos, lineStart)
      let fullRoute = []

      if (publicToLine && publicToLine.length > 0) {
        fullRoute = [...publicToLine]
      } else {
        fullRoute = [userPos, lineStart]
      }

      // Step 2: Follow the LineString to the clicked point
      for (let i = 0; i <= nearestPoint.index; i++) {
        const [lng, lat] = lineCoords[i]
        fullRoute.push({ lat, lng })
      }

      // Draw this hybrid route
      drawRouteOnMap(fullRoute, 'hybrid', true)
      console.log('Hybrid route to private path completed')
      return
    }
  }

  // If no private routes available, use public route only
  if (!privateRoutes.value || !privateRoutes.value.features || privateRoutes.value.features.length === 0) {
    console.warn('No private routes available, using public route only')
    const publicRoute = await getPublicRoute(userPos, destPos)
    if (publicRoute) {
      drawRouteOnMap(publicRoute, 'public', false)
    } else {
      drawRouteOnMap([userPos, destPos], 'direct', false)
    }
    return
  }

  // Build campus graph
  const campusGraph = buildCampusGraph(privateRoutes.value.features)

  if (campusGraph.size === 0) {
    console.warn('Campus graph is empty, using public route only')
    const publicRoute = await getPublicRoute(userPos, destPos)
    if (publicRoute) {
      drawRouteOnMap(publicRoute, 'public', false)
    } else {
      drawRouteOnMap([userPos, destPos], 'direct', false)
    }
    return
  }

  // Calculate all possible route options
  const routeOptions = []

  // Option 1: Public route only
  try {
    const publicRoute = await getPublicRoute(userPos, destPos)
    if (publicRoute && publicRoute.length > 0) {
      const distance = calculateRouteDistance(publicRoute)
      routeOptions.push({
        type: 'public',
        route: publicRoute,
        distance: distance,
        isPrivate: false
      })
      console.log(`🟢 Public route: ${Math.round(distance)}m`)
    }
  } catch (error) {
    console.error('❌ Public route error:', error)
  }

  // Option 2: Private campus route (if both points are near campus)
  try {
    const startNodeId = findNearestNode(userPos, campusGraph, 100)
    const goalNodeId = findNearestNode(destPos, campusGraph, 100)

    if (startNodeId && goalNodeId) {
      console.log(`🔍 Trying A* from ${startNodeId} to ${goalNodeId}`)
      const privateRoute = findPathAStar(startNodeId, goalNodeId, campusGraph)

      if (privateRoute && privateRoute.length > 0) {
        const distance = calculateRouteDistance(privateRoute)
        routeOptions.push({
          type: 'private',
          route: privateRoute,
          distance: distance,
          isPrivate: true
        })
        console.log(`🔴 Private route: ${Math.round(distance)}m`)
      }
    }
  } catch (error) {
    console.error('❌ Private route error:', error)
  }

  // Option 3: Hybrid routes (public to campus entrance + private path)
  try {
    const campusEntrances = findCampusEntrances(campusGraph)

    // Try nearest entrance to destination
    if (campusEntrances.length > 0) {
      const nearestEntrance = campusEntrances.reduce((nearest, entrance) => {
        const dist = calculateDistance(destPos.lat, destPos.lng, entrance.lat, entrance.lng)
        return dist < nearest.distance ? { entrance, distance: dist } : nearest
      }, { entrance: null, distance: Infinity })

      if (nearestEntrance.entrance && nearestEntrance.distance < 200) {
        const entrancePos = { lat: nearestEntrance.entrance.lat, lng: nearestEntrance.entrance.lng }
        const publicToEntrance = await getPublicRoute(userPos, entrancePos)

        if (publicToEntrance && publicToEntrance.length > 0) {
          const goalNodeId = findNearestNode(destPos, campusGraph, 100)

          if (goalNodeId) {
            const privatePath = findPathAStar(nearestEntrance.entrance.id, goalNodeId, campusGraph)

            if (privatePath && privatePath.length > 0) {
              const hybridRoute = [...publicToEntrance, ...privatePath]
              const distance = calculateRouteDistance(hybridRoute)
              routeOptions.push({
                type: 'hybrid',
                route: hybridRoute,
                distance: distance,
                isPrivate: true
              })
              console.log(`🟡 Hybrid route: ${Math.round(distance)}m`)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Hybrid route error:', error)
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

/**
 * Helper function to draw route on map
 */
const drawRouteOnMap = (route, routeType, isPrivatePath) => {
  // Convert route to [lat, lng] array format
  const routeCoords = route.map(p => [p.lat, p.lng])

  // Draw route
  const routeColors = {
    public: '#4CAF50',
    private: '#FF6B6B',
    hybrid: '#2196F3',
    direct: '#9E9E9E'
  }

  routePolyline.value = L.polyline(routeCoords, {
    color: routeColors[routeType] || '#9E9E9E',
    weight: 6,
    opacity: 0.8
  }).addTo(map.value)

  // Place destination marker at route end
  const finalDest = route[route.length - 1]
  destinationMarker.value = L.marker([finalDest.lat, finalDest.lng], {
    title: 'Destination',
    icon: L.divIcon({
      className: 'destination-marker',
      html: '<div style="background: #FF5252; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
  }).addTo(map.value)

  // Calculate and display route info
  const totalDistance = calculateRouteDistance(route)
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

  navigationInstructions.value = generateInstructions(routeCoords, isPrivatePath)
  showInstructions.value = true

  // Fit to route bounds
  map.value.fitBounds(routePolyline.value.getBounds(), { padding: [50, 50] })

  toast.success(`Route via ${routeLabels[routeType]}`)
}

// Use the new pathfinding function as the main routing function
const createRoute = createRouteWithPathfinding

const deleteNote = async (noteId) => {
  try {
    await axios.delete(`/notes/${noteId}`)
    toast.success('Note deleted successfully!')

    // Remove the note marker from map
    const noteMarkerIndex = noteMarkers.value.findIndex(nm => nm.noteId === noteId)
    if (noteMarkerIndex !== -1) {
      map.value.removeLayer(noteMarkers.value[noteMarkerIndex].marker)
      noteMarkers.value.splice(noteMarkerIndex, 1)
    }
  } catch (error) {
    console.error('Error deleting note:', error)
    toast.error('Failed to delete note')
  }
}

const displayPolygons = (polygons) => {
  if (!map.value || !polygons || !Array.isArray(polygons)) {
    console.warn('Cannot display polygons: map or data not ready')
    return
  }

  // Clear existing polygon layers
  polygonLayers.value.forEach(layer => {
    if (map.value && map.value.hasLayer && map.value.hasLayer(layer)) {
      try {
        map.value.removeLayer(layer)
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
        fillOpacity: polygon.fill_opacity || 0.2,
        weight: 2,
        opacity: 0.8
      })

      // Only add to map if map still exists
      if (map.value && map.value.addLayer) {
        polygonLayer.addTo(map.value)

        // Add popup with polygon info
        const popupContent = `
          <div class="p-2">
            <h3 class="font-semibold text-sm mb-1">${polygon.name}</h3>
            ${polygon.description ? `<p class="text-xs text-gray-600">${polygon.description}</p>` : ''}
            ${polygon.type ? `<p class="text-xs text-gray-500 mt-1">Type: ${polygon.type}</p>` : ''}
          </div>
        `
        polygonLayer.bindPopup(popupContent)

      }
    } catch (error) {
      console.error('Error creating polygon:', polygon, error)
    }
  })

  console.log(`📐 Displayed ${polygonLayers.value.length} polygons on map`)
}

const displayNotesOnMap = () => {
  // Clear existing note markers
  noteMarkers.value.forEach(nm => {
    if (map.value) {
      map.value.removeLayer(nm.marker)
    }
  })
  noteMarkers.value = []

  if (!props.notes || !Array.isArray(props.notes)) {
    return
  }

  props.notes.forEach(note => {
    // Find the facility this note belongs to
    const facility = locations.value.find(loc => loc.id === note.marker_id)

    if (!facility) return

    // Create a note marker positioned above the facility marker
    const noteMarker = L.marker([facility.lat, facility.lng], {
      icon: L.divIcon({
        className: 'note-marker',
        html: `
          <div class="note-bubble">
            <button class="note-delete-btn" data-note-id="${note.id}" title="Delete note">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div class="note-content">${note.content}</div>
            <div class="note-arrow"></div>
          </div>
        `,
        iconSize: [200, 80],
        iconAnchor: [100, 100] // Position above the facility marker
      }),
      zIndexOffset: 1000 // Ensure notes appear above other markers
    }).addTo(map.value)

    // Add click handler for delete button
    noteMarker.on('add', () => {
      setTimeout(() => {
        const deleteBtn = document.querySelector(`[data-note-id="${note.id}"]`)
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            if (confirm('Are you sure you want to delete this note?')) {
              deleteNote(note.id)
            }
          })
        }
      }, 100)
    })

    noteMarkers.value.push({
      noteId: note.id,
      marker: noteMarker
    })
  })

  console.log(`📝 Displayed ${noteMarkers.value.length} notes on map`)
}

watch(() => props.notes, () => {
  if (map.value) {
    displayNotesOnMap()
  }
}, { deep: true })

watch(() => props.polygons, () => {
  if (map.value) {
    displayPolygons(props.polygons)
  }
}, { deep: true })

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

  marker.bindTooltip(location.name, {
    permanent: true,
    direction: 'auto', // Automatically adjust direction to prevent overlap
    offset: [0, -25],
    className: 'facility-label',
    opacity: 0.9
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
      <button id="route-btn-${location.id}" class="flex-1 bg-blue-500 text-white px-0 py-1.5 rounded-md text-xs border-none cursor-pointer flex items-center justify-center gap-1 hover:bg-blue-600">
        🧭 Route
      </button>

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

const startTracking = () => {
  if (!navigator.geolocation) {
    console.error('Geolocation not supported')
    toast.error('Geolocation is not supported by your browser')
    return
  }

  console.log('Starting GPS tracking with real-time updates...')

  // More aggressive real-time settings for better responsiveness
  watchId.value = navigator.geolocation.watchPosition(
    (pos) => {
      const newLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy, // Track accuracy for visualization
        heading: pos.coords.heading,   // Track direction if available
        speed: pos.coords.speed        // Track speed if available
      }

      console.log('GPS Update:', {
        position: `${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`,
        accuracy: `${Math.round(newLocation.accuracy)}m`,
        heading: newLocation.heading,
        speed: newLocation.speed
      })

      // Only update if position changed significantly (reduces jitter)
      if (userLocation.value) {
        const distance = calculateDistance(
          userLocation.value.lat, userLocation.value.lng,
          newLocation.lat, newLocation.lng
        )

        // Update if moved more than 2 meters or accuracy improved significantly
        const accuracyImproved = newLocation.accuracy < (userLocation.value.accuracy * 0.7)

        if (distance > 2 || accuracyImproved) {
          userLocation.value = newLocation
          updateUserMarker()
          updateAccuracyCircle(newLocation)

          console.log(`Position updated: Moved ${Math.round(distance)}m, Accuracy: ${Math.round(newLocation.accuracy)}m`)

          // Auto-pan map to follow user if they're moving significantly
          if (distance > 10 && map.value) {
            map.value.panTo([newLocation.lat, newLocation.lng], {
              animate: true,
              duration: 1.0
            })
          }
        }
      } else {
        // First position acquisition
        userLocation.value = newLocation
        updateUserMarker()
        updateAccuracyCircle(newLocation)

        // Center map on user's location
        if (map.value) {
          map.value.setView([newLocation.lat, newLocation.lng], 17, {
            animate: true,
            duration: 1.5
          })
        }

        toast.success(`GPS acquired! Accuracy: ${Math.round(newLocation.accuracy)}m`)
      }
    },
    (err) => {
      console.error('Geolocation watch error:', err)
      let errorMessage = 'GPS signal lost'

      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'GPS permission denied. Please enable location services.'
          break
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'GPS position unavailable. Check your location settings.'
          break
        case err.TIMEOUT:
          errorMessage = 'GPS timeout. Trying to reconnect...'
          // Auto-retry on timeout
          setTimeout(startTracking, 2000)
          break
      }

      toast.error(errorMessage)

      // Fallback: use last known position or default location
      if (!userLocation.value) {
        userLocation.value = { lat: 8.169, lng: 126.003 }
        updateUserMarker()
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,           // Shorter timeout for faster response
      maximumAge: 2000         // Accept positions no older than 2 seconds
    }
  )
}

const accuracyCircle = ref(null)

const updateAccuracyCircle = (location) => {
  if (!map.value || !location.accuracy) return

  // Remove existing accuracy circle
  if (accuracyCircle.value) {
    map.value.removeLayer(accuracyCircle.value)
  }

  // Create new accuracy circle (only if accuracy is reasonable)
  if (location.accuracy < 100) { // Don't show if accuracy is worse than 100m
    accuracyCircle.value = L.circle([location.lat, location.lng], {
      radius: location.accuracy,
      color: '#3388ff',
      fillColor: '#3388ff',
      fillOpacity: 0.1,
      weight: 1,
      opacity: 0.5
    }).addTo(map.value)

    // Add tooltip showing accuracy
    accuracyCircle.value.bindTooltip(
      `GPS Accuracy: ${Math.round(location.accuracy)}m`,
      {
        permanent: false,
        direction: 'top',
        offset: [0, -10]
      }
    )
  }
}
const stopTracking = () => {
  if (watchId.value !== null) {
    navigator.geolocation.clearWatch(watchId.value)
    watchId.value = null
    console.log('GPS tracking stopped')
  }

  // Remove accuracy circle
  if (accuracyCircle.value && map.value) {
    map.value.removeLayer(accuracyCircle.value)
    accuracyCircle.value = null
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

      // Update popup content with fresh info
      const updatedPopupContent = `
        <div style="font-size: 13px; color: #1f2937; font-weight: 500;">
          ${guestInfo.value.nickname || 'You'}
          ${userLocation.value.accuracy ? `<br><small style="color: #6b7280;">Accuracy: ${Math.round(userLocation.value.accuracy)}m</small>` : ''}
        </div>
      `
      userMarker.value.setPopupContent(updatedPopupContent)
    } else {
      console.log('📍 Creating new user marker...')

      // Create a DRAGGABLE Leaflet marker with better styling
      userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
        title: guestInfo.value.nickname || 'You',
        draggable: true,
        autoPan: true,
        zIndexOffset: 1000, // Ensure user marker is always on top
        icon: L.divIcon({
          className: 'user-location-marker',
          html: `
            <div style="
              background: #3388ff;
              border: 3px solid white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.3);
              animation: pulse 2s infinite;
            "></div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map.value)

      // Add drag event listener
      userMarker.value.on('dragstart', () => {
        console.log('🎯 User started dragging marker')
      })

      userMarker.value.on('dragend', function(event) {
        const marker = event.target
        const position = marker.getLatLng()

        // Update user location
        userLocation.value = {
          lat: position.lat,
          lng: position.lng,
          accuracy: userLocation.value?.accuracy || 10, // Assume good accuracy when manually placed
          isManual: true // Flag to indicate manual placement
        }

        console.log('🎯 Marker dragged to:', userLocation.value)
        updateAccuracyCircle(userLocation.value)

        // Recalculate route if one exists
        if (selectedLocation.value) {
          console.log('🔄 Recalculating route from new position...')
          createRoute(L.latLng(selectedLocation.value.lat, selectedLocation.value.lng))
        }

        toast.info('Location updated manually')
      })

      // Bind popup with user info
      const popupContent = `
        <div style="font-size: 13px; color: #1f2937; font-weight: 500;">
          ${guestInfo.value.nickname || 'You'}
          ${userLocation.value.accuracy ? `<br><small style="color: #6b7280;">Accuracy: ${Math.round(userLocation.value.accuracy)}m</small>` : ''}
          ${userLocation.value.isManual ? '<br><small style="color: #f59e0b;">📍 Manually placed</small>' : ''}
        </div>
      `
      userMarker.value.bindPopup(popupContent, {
        offset: [0, -12],
        closeButton: false,
        className: 'user-popup'
      })

      // Open popup if name available
      if (guestInfo.value.nickname) {
        setTimeout(() => {
          if (userMarker.value && !userMarker.value.isPopupOpen()) {
            userMarker.value.openPopup()
            setTimeout(() => userMarker.value.closePopup(), 3000)
          }
        }, 1000)
      }
    }

  } catch (error) {
    console.error('❌ Error updating user marker:', error)
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
    console.log('Loaded routes from database:', privateRoutes.value)
    isLoaded.value = true
  } catch (error) {
    console.error('❌ Error loading routes from database:', error)
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

    console.log(`Added ${privateRoutes.value.features.length} new private route layers`);
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

      map.value.whenReady(() => {
      console.log(' Map is fully loaded and ready')

      // Add facility markers
      if (locations.value.length > 0) {
        console.log(` Adding ${locations.value.length} facility markers`)
        locations.value.forEach(location => {
          addFacilityMarker(location, map.value)
        })
      }

      displayNotesOnMap()

      // Display polygons on map load
      if (props.polygons && props.polygons.length > 0) {
        displayPolygons(props.polygons)
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

      // Start GPS tracking with a small delay to ensure map is ready
      setTimeout(() => {
        startTracking()
      }, 500)
    })

  } catch (error) {
    console.error('Error initializing map:', error)
    toast.error('Failed to initialize map. Please refresh the page.')
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

const saveFeedback = async () => {
    console.log('Guest Info:', guestInfo.value.id)
    console.log('Selected marker:', selectedMarker.value.marker.id)
    console.log('Saving feedback:', feedback.value)
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
            marker_id: selectedMarker.value.marker.id,
            message: feedback.value.trim(),
        })
        message.value = response.data.message
        console.log(message.value)
        toast.success(message.value || 'Added');
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
const hasGuestInfo = loadGuestInfoFromSession()
let channel;

onMounted(() => {
    console.log('Notes:', props.notes)
    console.log('Polygons:', props.polygons)
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
       if(e.type === "polygon"){
        // Reload polygons when updated
        axios.get('/facilities/polygons').then(response => {
          displayPolygons(response.data)
        })
        console.log('Polygon updated:', e.action);
       }
    });
})

onBeforeUnmount(() => {
  // Stop GPS tracking
  stopTracking()

  // Clear all markers and layers
  if (map.value) {
    // Remove facility markers
    facilityMarkers.value.forEach(marker => {
      if (map.value.hasLayer && map.value.hasLayer(marker)) {
        try {
          map.value.removeLayer(marker)
        } catch (error) {
          console.warn('Error removing marker:', error)
        }
      }
    })

    // Remove note markers
    noteMarkers.value.forEach(nm => {
      if (map.value.hasLayer && map.value.hasLayer(nm.marker)) {
        try {
          map.value.removeLayer(nm.marker)
        } catch (error) {
          console.warn('Error removing note marker:', error)
        }
      }
    })

    // Remove polygon layers
    polygonLayers.value.forEach(layer => {
      if (map.value.hasLayer && map.value.hasLayer(layer)) {
        try {
          map.value.removeLayer(layer)
        } catch (error) {
          console.warn('Error removing polygon:', error)
        }
      }
    })

    // Remove GeoJSON layers
    geoJsonLayers.value.forEach(layer => {
      if (map.value.hasLayer && map.value.hasLayer(layer)) {
        try {
          map.value.removeLayer(layer)
        } catch (error) {
          console.warn('Error removing GeoJSON layer:', error)
        }
      }
    })

    // Remove route polyline and destination marker
    if (routePolyline.value && map.value.hasLayer(routePolyline.value)) {
      try {
        map.value.removeLayer(routePolyline.value)
      } catch (error) {
        console.warn('Error removing route:', error)
      }
    }

    if (destinationMarker.value && map.value.hasLayer(destinationMarker.value)) {
      try {
        map.value.removeLayer(destinationMarker.value)
      } catch (error) {
        console.warn('Error removing destination marker:', error)
      }
    }

    // Remove the map instance
    try {
      map.value.remove()
      map.value = null
    } catch (error) {
      console.warn('Error removing map:', error)
    }
  }

  // Clear session checker interval
  if (sessionCheckInterval.value) {
    clearInterval(sessionCheckInterval.value)
    sessionCheckInterval.value = null
  }
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
        <div v-if="guestStep === 1" class="p-6 sm:p-8">
          <div class="text-center mb-6 sm:mb-8">
            <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Welcome to Campus Navigator</h2>
            <p class="text-xs sm:text-sm text-gray-500">Let's get started with your nickname</p>
          </div>

          <div class="space-y-4">
            <input
              v-model="guestInfo.nickname"
              type="text"
              placeholder="Enter your nickname"
              class="w-full px-4 py-3 text-sm sm:text-base text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
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
        <div v-if="guestStep === 2" class="p-6 sm:p-8">
          <div class="text-center mb-6 sm:mb-8">
            <h2 class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Select Your Role</h2>
            <p class="text-xs sm:text-sm text-gray-500">How are you visiting our campus?</p>
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
              <span class="text-xl sm:text-2xl">{{ role.icon }}</span>
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

    <!-- Search Bar - Responsive positioning -->
    <div
      v-if="isGuestInfoComplete"
      class="absolute top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-10 sm:w-full sm:max-w-md sm:px-4"
    >
      <div class="bg-white rounded-lg shadow-lg">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon class="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search for facilities..."
            class="w-full pl-9 sm:pl-10 pr-10 py-2.5 sm:py-3 border-0 rounded-lg focus:ring-2 focus:ring-blue-500 text-xs sm:text-sm"
          />
          <button
            v-if="searchQuery"
            @click="clearSearch"
            class="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <XMarkIcon class="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div
          v-if="showSearchResults"
          class="mt-1 max-h-48 sm:max-h-60 overflow-y-auto border-t border-gray-200"
        >
          <div v-if="isSearching" class="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
            Searching...
          </div>
          <div v-else-if="filteredLocations.length === 0" class="p-3 sm:p-4 text-center text-gray-500 text-xs sm:text-sm">
            No facilities found
          </div>
          <div v-else>
            <button
              v-for="location in filteredLocations"
              :key="location.id"
              @click="selectSearchResult(location)"
              class="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div class="flex items-center gap-2">
                <span class="text-lg sm:text-xl">{{ location.icon }}</span>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-xs sm:text-sm text-gray-900 truncate">{{ location.name }}</div>
                  <div class="text-xs text-gray-500 mt-0.5 truncate">{{ location.markerType }} • {{ location.category }}</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Transport Mode Selector - Bottom left for both mobile and desktop -->
    <div
      v-if="isGuestInfoComplete"
      class="absolute bottom-4 left-4 z-10"
    >
      <div class="bg-white rounded-lg shadow-lg p-1.5 sm:p-2 flex gap-1 sm:gap-2 flex-wrap max-w-[calc(100vw-6rem)] sm:max-w-none">
        <button
          v-for="mode in transportModes"
          :key="mode.value"
          @click="transportMode = mode.value"
          :class="[
            'px-2.5 py-2 sm:px-3 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center justify-center gap-1 min-w-[44px]',
            transportMode === mode.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
          :title="mode.label"
        >
          <span class="text-base sm:text-lg">{{ mode.icon }}</span>
          <span class="hidden lg:inline text-xs">{{ mode.label }}</span>
        </button>
      </div>
    </div>

    <!-- User Profile Button -->
    <div
        v-if="isGuestInfoComplete"
        class="absolute top-4 right-4 z-10"
        >
        <div class="flex items-center gap-2 bg-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg shadow-lg">
            <UserCircleIcon class="h-5 w-5 text-blue-600" />
            <div class="text-left hidden sm:block">
            <div class="text-xs font-semibold text-gray-900 truncate max-w-[120px]">{{ guestInfo.nickname }}</div>
            <div class="text-xs text-gray-500">{{ guestInfo.role }}</div>
            </div>
        </div>
    </div>

    <!-- Route Info Panel - Responsive, hidden on small mobile to avoid overlap -->
    <div
      v-if="isGuestInfoComplete && routeInfo"
      class="hidden sm:block absolute top-20 left-4 bg-white rounded-lg shadow-lg w-64 sm:w-72 lg:max-w-xs z-10 border border-gray-200"
    >
      <div class="px-3 py-2 border-b border-gray-200 bg-gray-900 flex justify-between items-center">
        <h3 class="font-semibold text-white text-xs sm:text-sm">Route Info</h3>
        <button
          @click="routeInfo = null"
          class="text-gray-400 hover:text-white transition text-lg leading-none w-5 h-5 flex items-center justify-center sm:hidden"
        >
          ×
        </button>
      </div>
      <div class="px-3 py-2 text-xs text-gray-700 leading-relaxed whitespace-pre-line max-h-32 sm:max-h-40 overflow-y-auto">
        {{ routeInfo }}
      </div>
    </div>

    <!-- Navigation Instructions Panel - Responsive, cleaner mobile layout -->
    <div
      v-if="showInstructions"
      class="absolute left-4 right-4 bottom-20 sm:left-auto sm:right-4 sm:bottom-4 sm:w-72 bg-white rounded-lg shadow-lg z-20 max-h-52 sm:max-h-72 overflow-hidden flex flex-col border border-gray-200"
    >
      <div class="px-3 py-2 border-b border-gray-200 flex justify-between items-center bg-gray-900">
        <h3 class="font-semibold text-white text-xs sm:text-sm">Navigation</h3>
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
          <span class="text-sm sm:text-base mt-0.5">{{ instruction.icon }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium text-gray-900 leading-snug">{{ instruction.text }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ instruction.distance }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Modal - Responsive -->
    <Modal :show="isReviewModalOpen" @close="isReviewModalOpen = false">
      <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto">
        <div class="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-xl sm:text-2xl">📝</span>
              <h3 class="text-base sm:text-lg font-bold text-gray-900">Feedback</h3>
            </div>
            <button @click="isReviewModalOpen = false" class="text-gray-400 hover:text-gray-600">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div>
            <label class="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
              Your Feedback
            </label>
            <textarea
              v-model="feedback"
              placeholder="Write your note about this location..."
              rows="4"
              class="w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
              maxlength="500"
            ></textarea>
            <p class="text-xs text-gray-500 mt-1">
              {{ feedback.length }}/500 characters
            </p>
          </div>
        </div>
        <div class="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 flex gap-2 sm:gap-3">
          <button
            @click="isReviewModalOpen = false"
            type="button"
            :disabled="isSavingFeedback"
            class="flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveFeedback"
            type="button"
            :disabled="!feedback.trim() || isSavingFeedback"
            :class="[
              'flex-1 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all',
              feedback.trim() && !isSavingFeedback
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            ]"
          >
            {{ isSavingFeedback ? 'Saving...' : 'Save Feedback' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
#map {
  height: 100vh;
  width: 100%;
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
  font-size: 11px;
  color: #1E3A8A;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  white-space: nowrap;
  pointer-events: none;
}

.polygon-tooltip {
  background: rgba(59, 130, 246, 0.9);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
}

.leaflet-marker-draggable {
  cursor: move !important;
}

.leaflet-marker-draggable:hover {
  cursor: grab !important;
}

.leaflet-marker-draggable:active {
  cursor: grabbing !important;
}

/* Custom scrollbar for search results and route info */
.max-h-48::-webkit-scrollbar,
.max-h-60::-webkit-scrollbar,
.max-h-32::-webkit-scrollbar,
.max-h-40::-webkit-scrollbar {
  width: 4px;
}

.max-h-48::-webkit-scrollbar-track,
.max-h-60::-webkit-scrollbar-track,
.max-h-32::-webkit-scrollbar-track,
.max-h-40::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.max-h-48::-webkit-scrollbar-thumb,
.max-h-60::-webkit-scrollbar-thumb,
.max-h-32::-webkit-scrollbar-thumb,
.max-h-40::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.max-h-48::-webkit-scrollbar-thumb:hover,
.max-h-60::-webkit-scrollbar-thumb:hover,
.max-h-32::-webkit-scrollbar-thumb:hover,
.max-h-40::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Mobile optimization */
@media (max-width: 640px) {
  /* Ensure touch-friendly sizes */
  button {
    min-height: 44px;
  }

  /* Prevent text selection on buttons for better mobile UX */
  button {
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
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

/* Accuracy circle styling */
.leaflet-interactive {
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
