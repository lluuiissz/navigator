import { ref } from 'vue'
import L from 'leaflet'
import { useToast } from 'vue-toastification'

export function useGuestRouting(map, userLocation, transportMode) {
  const toast = useToast()

  const routePolyline = ref(null)
  const destinationMarker = ref(null)
  const routeInfo = ref(null)
  const navigationInstructions = ref([])
  const showInstructions = ref(false)

  const transportModes = [
    { value: 'walking', label: 'Walking', icon: '🚶', speed: 5 },
    { value: 'riding', label: 'Riding', icon: '🚴', speed: 15 },
    { value: 'driving', label: 'Driving', icon: '🚗', speed: 40 }
  ]

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

  // Calculate ETA
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

  // Get public route from OSRM
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

  // Draw route on map
  const drawRouteOnMap = (route, routeType, isPrivatePath) => {
    if (!map.value) return

    // Clear existing route
    if (routePolyline.value) {
      map.value.removeLayer(routePolyline.value)
    }
    if (destinationMarker.value) {
      map.value.removeLayer(destinationMarker.value)
    }

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

    // toast.success(`Route via ${routeLabels[routeType]}`)
  }

  // Clear route
  const clearRoute = () => {
    if (map.value) {
      if (routePolyline.value) map.value.removeLayer(routePolyline.value)
      if (destinationMarker.value) map.value.removeLayer(destinationMarker.value)
    }
    routeInfo.value = null
    showInstructions.value = false
  }

  return {
    routePolyline,
    destinationMarker,
    routeInfo,
    navigationInstructions,
    showInstructions,
    transportModes,
    calculateDistance,
    calculateRouteDistance,
    getPublicRoute,
    drawRouteOnMap,
    clearRoute
  }
}
