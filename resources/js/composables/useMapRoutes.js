import { ref } from 'vue'
import L from 'leaflet'
import axios from 'axios'
import { useToast } from 'vue-toastification'

export function useMapRoutes(map, isAdmin) {
  const toast = useToast()

  const savedRoutes = ref([])
  const routePolylines = ref([])
  const drawnRoute = ref(null)
  const routePoints = ref([])
  const temporaryMarkers = ref([])
  const isDrawing = ref(false)
  const drawRouteMode = ref(false)
  const editRouteMode = ref(false)
  const selectedRoute = ref(null)
  const editMarkers = ref([])

  // Fetch routes from backend - COMPLETE REFRESH
  const fetchRoutes = async () => {
    try {
      const response = await axios.get('/routes', {
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })

      const newRoutes = response.data

      // COMPLETE REFRESH: Remove ALL existing routes first
      routePolylines.value.forEach(routePoly => {
        if (routePoly.polyline && routePoly.polyline.remove) {
          try {
            routePoly.polyline.remove()
          } catch (err) {
            // Ignore removal errors
          }
        }
      })
      routePolylines.value = []

      // Add all routes fresh from backend
      newRoutes.forEach(newRoute => {
        if (!newRoute.path_data || newRoute.path_data.length === 0) {
          return
        }
        displayRoute(newRoute)
      })

      savedRoutes.value = newRoutes

    } catch (error) {
      // Silently ignore fetch errors
    }
  }

  // Display a route on the map
  const displayRoute = (route) => {
    if (!route.path_data || route.path_data.length === 0) return

    const existingRoute = routePolylines.value.find(r => r.id === route.id)
    if (existingRoute) {
      // console.log('Route already exists, skipping duplicate:', route.id)
      return
    }

    try {
      const pathCoordinates = route.path_data.map(point => [point.lat, point.lng])
      const displayColor = route.color || '#3B82F6'
      // console.log(`Displaying route ${route.id} with color: ${displayColor}`)

      const polyline = L.polyline(pathCoordinates, {
        color: displayColor,
        weight: 4,
        opacity: 0.7,
        routeId: route.id
      }).addTo(map.value)

      const popupContent = createRoutePopup(route)
      polyline.bindPopup(popupContent)

      routePolylines.value.push({ id: route.id, polyline, data: route })
    } catch (error) {
      console.error('Error displaying route:', error, route)
    }
  }

  // Update existing route display - NO LONGER USED (using complete refresh instead)
  const _updateRouteDisplay = (existingRoute, newRoute) => {
    const pathCoordinates = newRoute.path_data.map(point => [point.lat, point.lng])
    existingRoute.polyline.setLatLngs(pathCoordinates)

    // Update color if it changed
    const oldColor = existingRoute.data.color || '#3B82F6'
    const newColor = newRoute.color || '#3B82F6'
    if (oldColor !== newColor) {
      existingRoute.polyline.setStyle({ color: newColor })
    }

    existingRoute.polyline.setPopupContent(createRoutePopup(newRoute))
    existingRoute.data = newRoute
  }

  // Create route popup content
  const createRoutePopup = (route) => {
    const startPoint = `${parseFloat(route.start_lat).toFixed(4)}, ${parseFloat(route.start_lng).toFixed(4)}`
    const endPoint = `${parseFloat(route.end_lat).toFixed(4)}, ${parseFloat(route.end_lng).toFixed(4)}`

    return `
      <div class="p-3">
        <h3 class="font-bold text-sm mb-2">Route ${route.id}</h3>
        <p class="text-xs text-gray-600 mb-1">Start: ${startPoint}</p>
        <p class="text-xs text-gray-600 mb-2">End: ${endPoint}</p>
        <p class="text-xs text-gray-600 mb-3">Est. Time: ${route.estimated_time}</p>
        ${isAdmin ? `
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
    `
  }

  // Start drawing route
  const startDrawingRoute = () => {
    isDrawing.value = true
    routePoints.value = []
    temporaryMarkers.value = []

    if (drawnRoute.value) {
      drawnRoute.value.remove()
    }

    map.value.getContainer().style.cursor = 'crosshair'
  }

  // Add point to route
  const addRoutePoint = (latlng) => {
    routePoints.value.push(latlng)

    if (routePoints.value.length === 1) {
    //   toast.success('Starting point set!')
    }

    if (drawnRoute.value) {
      drawnRoute.value.remove()
    }

    drawnRoute.value = L.polyline(routePoints.value, {
      color: '#EF4444',
      weight: 4,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(map.value)

    const circleMarker = L.circleMarker(latlng, {
      radius: 5,
      fillColor: '#EF4444',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(map.value)

    temporaryMarkers.value.push(circleMarker)
  }

  // Cancel drawing
  const cancelDrawing = () => {
    isDrawing.value = false
    drawRouteMode.value = false
    routePoints.value = []

    temporaryMarkers.value.forEach(marker => {
      if (marker && marker.remove) marker.remove()
    })
    temporaryMarkers.value = []

    if (drawnRoute.value) {
      drawnRoute.value.remove()
      drawnRoute.value = null
    }

    map.value.getContainer().style.cursor = ''
  }

  // Enable route editing - allow dragging and modifying route points
  const enableRouteEditing = (routeId, onUpdate) => {
    const routeObj = routePolylines.value.find(r => r.id === routeId)
    if (!routeObj) {
      toast.error('Route not found')
      return null
    }

    editRouteMode.value = true
    selectedRoute.value = routeObj

    // Close popup
    if (routeObj.polyline && routeObj.polyline.closePopup) {
      routeObj.polyline.closePopup()
    }

    // Change route style to indicate editing
    routeObj.polyline.setStyle({
      color: '#F59E0B',
      weight: 5,
      dashArray: '5, 5',
      opacity: 0.9
    })

    // Get current path data
    const pathData = Array.isArray(routeObj.data.path_data)
      ? routeObj.data.path_data
      : JSON.parse(routeObj.data.path_data || '[]')

    // Clear existing edit markers
    editMarkers.value.forEach(marker => {
      if (marker && marker.remove) marker.remove()
    })
    editMarkers.value = []

    // Create draggable markers for each point
    pathData.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: L.divIcon({
          className: 'edit-route-marker',
          html: `<div style="background: #F59E0B; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">${index + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(map.value)

      marker.on('drag', (e) => {
        const newLatLng = e.target.getLatLng()
        pathData[index] = {
          lat: newLatLng.lat,
          lng: newLatLng.lng
        }

        // Update the polyline in real-time
        const updatedCoordinates = pathData.map(p => [p.lat, p.lng])
        routeObj.polyline.setLatLngs(updatedCoordinates)

        if (onUpdate) {
          onUpdate(pathData)
        }
      })

      marker.on('dragend', () => {
        // toast.success(`Point ${index + 1} position updated`)
      })

      // Right-click to remove point (minimum 2 points for a route)
      marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault()
        if (pathData.length > 2) {
          pathData.splice(index, 1)
          routeObj.polyline.setLatLngs(pathData.map(p => [p.lat, p.lng]))
          marker.remove()
          editMarkers.value.splice(index, 1)
          updateRouteMarkerNumbers(pathData)
          toast.info('Point removed')

          if (onUpdate) {
            onUpdate(pathData)
          }
        } else {
          toast.error('Route must have at least 2 points')
        }
      })

      editMarkers.value.push(marker)
    })

    map.value.getContainer().style.cursor = 'default'
    // toast.info('Click and drag markers to adjust route. Right-click to remove points.')
  }

  // Update route marker numbers after removing a point
  const updateRouteMarkerNumbers = (pathData) => {
    editMarkers.value.forEach((marker, index) => {
      marker.setIcon(L.divIcon({
        className: 'edit-route-marker',
        html: `<div style="background: #F59E0B; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: bold;">${index + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }))
    })
  }

  // Cleanup routes
  const cleanupRoutes = () => {
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

    cancelDrawing()
  }

  return {
    savedRoutes,
    routePolylines,
    drawnRoute,
    routePoints,
    temporaryMarkers,
    isDrawing,
    drawRouteMode,
    editRouteMode,
    selectedRoute,
    editMarkers,
    fetchRoutes,
    displayRoute,
    startDrawingRoute,
    addRoutePoint,
    cancelDrawing,
    enableRouteEditing,
    cleanupRoutes
  }
}
