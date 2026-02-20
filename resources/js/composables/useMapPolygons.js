import { ref } from 'vue'
import L from 'leaflet'
import axios from 'axios'
import { useToast } from 'vue-toastification'

export function useMapPolygons(map, isAdmin) {
  const toast = useToast()

  const polygons = ref([])
  const polygonInstances = ref([])
  const isDrawingPolygon = ref(false)
  const drawPolygonMode = ref(false)
  const currentPolygonPoints = ref([])
  const temporaryPolygon = ref(null)
  const temporaryPolygonMarkers = ref([])
  const editPolygonMode = ref(false)
  const selectedPolygon = ref(null)
  const editPolygonMarkers = ref([])
  let _keydownHandler = null

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
        // Clear existing polygons and their event handlers
        polygonInstances.value.forEach(p => {
          if (p && p.polygon) {
            try {
              // Remove all event listeners
              p.polygon.off()
              // Remove from map
              if (p.polygon.remove) {
                p.polygon.remove()
              }
            } catch (err) {
              // console.warn('Error removing existing polygon:', err)
              // Silently ignore errors when removing polygons
            }
          }
        })
        polygonInstances.value = []

        // Add new polygons
        polygons.value.forEach(polygon => {
          displayPolygon(polygon)
        })
      }
    } catch (error) {
      // console.error('Error fetching polygons:', error)
      toast.error('Failed to load facility polygons')
    }
  }

  // Display polygon on map
  const displayPolygon = (polygonData) => {
    if (!polygonData.coordinates || polygonData.coordinates.length === 0) return

    const existingPolygon = polygonInstances.value.find(p => p.id === polygonData.id)
    if (existingPolygon) {
      // console.log('Polygon already exists, skipping duplicate:', polygonData.id)
      return
    }

    try {
      const coordinates = polygonData.coordinates.map(point => [point.lat, point.lng])

      const polygon = L.polygon(coordinates, {
        color: polygonData.color || '#FF6B6B',
        fillColor: polygonData.fill_color || '#FF6B6B',
        fillOpacity: polygonData.fill_opacity || 0.3,
        weight: 3,
        polygonId: polygonData.id
      }).addTo(map.value)


      // Only right-click (contextmenu) opens a small popup with Edit / Delete actions (admin-only)
      polygon.on('contextmenu', (e) => {
        if (!isAdmin) return

        const ctxContent = `
          <div style="min-width:140px">
            <div style="font-weight:600; margin-bottom:6px">${polygonData.name}</div>
            <div style="display:flex; gap:6px;">
              <button onclick="window.editPolygon(${polygonData.id})" style="flex:1; padding:6px; background:#2563EB; color:#fff; border-radius:4px; border:0; font-size:12px">Edit</button>
              <button onclick="window.deletePolygon(${polygonData.id})" style="flex:1; padding:6px; background:#DC2626; color:#fff; border-radius:4px; border:0; font-size:12px">Delete</button>
            </div>
          </div>
        `

        L.popup({ maxWidth: 220, closeButton: true, autoClose: true })
          .setLatLng(e.latlng)
          .setContent(ctxContent)
          .openOn(map.value)
      })

      polygonInstances.value.push({
        id: polygonData.id,
        polygon,
        data: polygonData
      })
    } catch (error) {
      // console.error('Error displaying polygon:', error, polygonData)
      // Silently ignore display errors for individual polygons
    }
  }


  // Start drawing polygon
  const startDrawingPolygon = () => {
    isDrawingPolygon.value = true
    currentPolygonPoints.value = []
    temporaryPolygonMarkers.value = []

    if (temporaryPolygon.value) {
      temporaryPolygon.value.remove()
      temporaryPolygon.value = null
    }

    map.value.getContainer().style.cursor = 'crosshair'
    // toast.info('Click on map to add polygon points. Double-click or press Enter to finish.')

    // Add keyboard handler to allow finishing with Enter or cancelling with Escape
    _keydownHandler = (e) => {
      if (!isDrawingPolygon.value) return

      if (e.key === 'Enter') {
        // Finish drawing and dispatch event with coordinates
        const data = finishDrawingPolygon()
        if (data) {
          // Dispatch a window event so the component can open the modal
          window.dispatchEvent(new CustomEvent('polygon:finished', { detail: data }))
        }
      } else if (e.key === 'Escape') {
        cancelDrawingPolygon()
        window.dispatchEvent(new CustomEvent('polygon:cancelled'))
      }
    }

    window.addEventListener('keydown', _keydownHandler)
  }

  // Add point to polygon
  const addPolygonPoint = (latlng) => {
    currentPolygonPoints.value.push(latlng)

    // Add marker at point
    const marker = L.circleMarker(latlng, {
      radius: 5,
      fillColor: '#FF6B6B',
      color: '#fff',
      weight: 2,
      fillOpacity: 1
    }).addTo(map.value)

    temporaryPolygonMarkers.value.push(marker)

    // Update or create polygon preview
    if (currentPolygonPoints.value.length >= 3) {
      if (temporaryPolygon.value) {
        temporaryPolygon.value.setLatLngs(currentPolygonPoints.value)
      } else {
        temporaryPolygon.value = L.polygon(currentPolygonPoints.value, {
          color: '#FF6B6B',
          fillColor: '#FF6B6B',
          fillOpacity: 0.3,
          weight: 3,
          dashArray: '10, 10'
        }).addTo(map.value)
      }
    } else if (currentPolygonPoints.value.length === 2) {
      // Show line for first two points
      if (temporaryPolygon.value) {
        temporaryPolygon.value.remove()
      }
      temporaryPolygon.value = L.polyline(currentPolygonPoints.value, {
        color: '#FF6B6B',
        weight: 3,
        dashArray: '10, 10'
      }).addTo(map.value)
    }

    toast.success(`Point ${currentPolygonPoints.value.length} added`)
  }

  // Finish drawing polygon
  const finishDrawingPolygon = () => {
    if (currentPolygonPoints.value.length < 3) {
      toast.error('Polygon must have at least 3 points')
      return null
    }

    const coordinates = currentPolygonPoints.value.map(point => ({
      lat: point.lat,
      lng: point.lng
    }))

    // Create bounds (create a temporary polygon just to get bounds, then immediately destroy it)
    const tempPolygonForBounds = L.polygon(currentPolygonPoints.value)
    const bounds = tempPolygonForBounds.getBounds()
    // No need to add to map or remove since we never added it

    // Cleanup temporary drawing artifacts
    isDrawingPolygon.value = false
    drawPolygonMode.value = false

    temporaryPolygonMarkers.value.forEach(marker => {
      try {
        if (marker && marker.remove) {
          marker.remove()
        }
      } catch (err) {
        // console.warn('Error removing temporary marker:', err)
        // Silently ignore cleanup errors
      }
    })
    temporaryPolygonMarkers.value = []

    if (temporaryPolygon.value) {
      try {
        temporaryPolygon.value.remove()
      } catch (err) {
        // console.warn('Error removing temporary polygon:', err)
        // Silently ignore cleanup errors
      }
      temporaryPolygon.value = null
    }

    if (map.value) {
      map.value.getContainer().style.cursor = ''
    }

    // Remove keyboard handler
    if (_keydownHandler) {
      window.removeEventListener('keydown', _keydownHandler)
      _keydownHandler = null
    }

    // Dispatch event for convenience (component may also call this method directly)
    const data = { coordinates, bounds }
    try {
      window.dispatchEvent(new CustomEvent('polygon:finished', { detail: data }))
    } catch {
      // ignore dispatch errors in non-browser test environments
    }

    return data
  }

  // Cancel drawing polygon
  const cancelDrawingPolygon = () => {
    isDrawingPolygon.value = false
    drawPolygonMode.value = false
    currentPolygonPoints.value = []

    // Remove temporary markers safely
    temporaryPolygonMarkers.value.forEach(marker => {
      try {
        if (marker && marker.remove) {
          marker.remove()
        }
      } catch (err) {
        // console.warn('Error removing temporary marker:', err)
        // Silently ignore cleanup errors
      }
    })
    temporaryPolygonMarkers.value = []

    // Remove temporary polygon safely
    if (temporaryPolygon.value) {
      try {
        temporaryPolygon.value.remove()
      } catch (err) {
        // console.warn('Error removing temporary polygon:', err)
        // Silently ignore cleanup errors
      }
      temporaryPolygon.value = null
    }

    if (map.value) {
      map.value.getContainer().style.cursor = ''
    }

    // Remove keyboard handler if present
    if (_keydownHandler) {
      window.removeEventListener('keydown', _keydownHandler)
      _keydownHandler = null
    }
  }

  // Enable polygon editing
  const enablePolygonEditing = (polygonId, onUpdate) => {
    const polygonObj = polygonInstances.value.find(p => p.id === polygonId)
    if (!polygonObj) {
        //   toast.error('Polygon not found')
        console.error('Polygon not found')
      return null
    }

    editPolygonMode.value = true
    selectedPolygon.value = polygonObj

    // Close popup
    if (polygonObj.polygon && polygonObj.polygon.closePopup) {
      polygonObj.polygon.closePopup()
    }

    // Change polygon style to indicate editing
    polygonObj.polygon.setStyle({
      color: '#EF4444',
      weight: 4,
      dashArray: '5, 5'
    })

    // Get current coordinates
    const coordinates = polygonObj.polygon.getLatLngs()[0]

    // Clear existing edit markers
    editPolygonMarkers.value.forEach(marker => {
      if (marker && marker.remove) marker.remove()
    })
    editPolygonMarkers.value = []

    // Create draggable markers for each vertex
    coordinates.forEach((latlng, index) => {
      const marker = L.marker([latlng.lat, latlng.lng], {
        draggable: true,
        icon: L.divIcon({
          className: 'edit-polygon-marker',
          html: `<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${index + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map.value)

      marker.on('drag', (e) => {
        const newLatLng = e.target.getLatLng()
        coordinates[index] = newLatLng
        polygonObj.polygon.setLatLngs(coordinates)

        if (onUpdate) {
          onUpdate(coordinates)
        }
      })

      marker.on('dragend', () => {
        // toast.success(`Point ${index + 1} position updated`)
        console.log(`Point ${index + 1} position updated`)
      })

      // Right-click to remove point
      marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault()
        if (coordinates.length > 3) {
          coordinates.splice(index, 1)
          polygonObj.polygon.setLatLngs(coordinates)
          marker.remove()
          editPolygonMarkers.value.splice(index, 1)
          updatePolygonMarkerNumbers()
          toast.info('Point removed')

          if (onUpdate) {
            onUpdate(coordinates)
          }
        } else {
          toast.error('Polygon must have at least 3 points')
        }
      })

      editPolygonMarkers.value.push(marker)
    })

    // Allow adding points by clicking on polygon edges
    polygonObj.polygon.on('click', (e) => {
      const clickLatLng = e.latlng

      // Find nearest edge
      let minDist = Infinity
      let insertIndex = 0

      for (let i = 0; i < coordinates.length; i++) {
        const p1 = coordinates[i]
        const p2 = coordinates[(i + 1) % coordinates.length]

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
      coordinates.splice(insertIndex, 0, clickLatLng)
      polygonObj.polygon.setLatLngs(coordinates)

      // Create marker for new point
      const marker = L.marker([clickLatLng.lat, clickLatLng.lng], {
        draggable: true,
        icon: L.divIcon({
          className: 'edit-polygon-marker',
          html: `<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${insertIndex + 1}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(map.value)

      marker.on('drag', (e) => {
        const newLatLng = e.target.getLatLng()
        coordinates[insertIndex] = newLatLng
        polygonObj.polygon.setLatLngs(coordinates)

        if (onUpdate) {
          onUpdate(coordinates)
        }
      })

      marker.on('dragend', () => {
        // toast.success(`Point ${insertIndex + 1} position updated`)
        console.log(`Point ${insertIndex + 1} position updated`)
      })

      marker.on('contextmenu', (e) => {
        e.originalEvent.preventDefault()
        if (coordinates.length > 3) {
          coordinates.splice(insertIndex, 1)
          polygonObj.polygon.setLatLngs(coordinates)
          marker.remove()
          editPolygonMarkers.value.splice(insertIndex, 1)
          updatePolygonMarkerNumbers()
          // toast.info('Point removed')
            console.log('Point removed')

          if (onUpdate) {
            onUpdate(coordinates)
          }
        } else {
          toast.error('Polygon must have at least 3 points')
        }
      })

      editPolygonMarkers.value.splice(insertIndex, 0, marker)
      updatePolygonMarkerNumbers()
      toast.success('Point added - drag to adjust position')

      if (onUpdate) {
        onUpdate(coordinates)
      }
    })

    // toast.info('Polygon editing enabled! Drag points to adjust, click edges to add points, right-click to remove.')

    return coordinates
  }

  // Update marker numbers during editing
  const updatePolygonMarkerNumbers = () => {
    editPolygonMarkers.value.forEach((marker, index) => {
      marker.setIcon(L.divIcon({
        className: 'edit-polygon-marker',
        html: `<div style="background: #EF4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); cursor: move; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">${index + 1}</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      }))
    })
  }

  // Cancel polygon editing
  const cancelPolygonEditing = () => {
    if (selectedPolygon.value) {
      selectedPolygon.value.polygon.setStyle({
        color: selectedPolygon.value.data.color || '#FF6B6B',
        weight: 3,
        dashArray: null
      })
      selectedPolygon.value.polygon.off('click')
    }

    editPolygonMarkers.value.forEach(marker => {
      if (marker && marker.remove) marker.remove()
    })
    editPolygonMarkers.value = []

    editPolygonMode.value = false
    selectedPolygon.value = null
  }

  // Cleanup polygons
  const cleanupPolygons = () => {
    // Remove all polygon instances and their event handlers
    polygonInstances.value.forEach(p => {
      if (p && p.polygon) {
        try {
          // Remove all event listeners first
          p.polygon.off()
          // Then remove from map
          if (p.polygon.remove) {
            p.polygon.remove()
          }
        } catch (error) {
          // console.warn('Error removing polygon:', error)
          // Silently ignore cleanup errors
        }
      }
    })
    polygonInstances.value = []

    cancelDrawingPolygon()
    cancelPolygonEditing()
  }

  return {
    polygons,
    polygonInstances,
    isDrawingPolygon,
    drawPolygonMode,
    currentPolygonPoints,
    temporaryPolygon,
    editPolygonMode,
    selectedPolygon,
    editPolygonMarkers,
    fetchPolygons,
    displayPolygon,
    startDrawingPolygon,
    addPolygonPoint,
    finishDrawingPolygon,
    cancelDrawingPolygon,
    enablePolygonEditing,
    cancelPolygonEditing,
    cleanupPolygons
  }
}
