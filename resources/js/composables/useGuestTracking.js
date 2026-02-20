import { ref } from 'vue'
import L from 'leaflet'
import { useToast } from 'vue-toastification'
import { useMapRouting } from './useMapRouting'

export function useGuestTracking() {
  const toast = useToast()
  const { calculateDistance } = useMapRouting()

  const userLocation = ref(null)
  const userMarker = ref(null)
  const watchId = ref(null)
  const accuracyCircle = ref(null)

  // Update accuracy circle on map
  const updateAccuracyCircle = (location, map) => {
    if (!map || !location || !location.accuracy) return

    try {
      // Remove existing accuracy circle
      if (accuracyCircle.value && map.hasLayer && map.hasLayer(accuracyCircle.value)) {
        map.removeLayer(accuracyCircle.value)
        accuracyCircle.value = null
      }

      // Create new accuracy circle (only if accuracy is reasonable)
      if (location.accuracy < 100) {
        accuracyCircle.value = L.circle([location.lat, location.lng], {
          radius: location.accuracy,
          color: '#3388ff',
          fillColor: '#3388ff',
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.5
        }).addTo(map)

        accuracyCircle.value.bindTooltip(
          `GPS Accuracy: ${Math.round(location.accuracy)}m`,
          {
            permanent: false,
            direction: 'top',
            offset: [0, -10]
          }
        )
      }
    } catch (error) {
      console.warn('Error updating accuracy circle:', error)
    }
  }

  // Update user marker position
  const updateUserMarker = (guestInfo, map, onDragEnd) => {
    if (!userLocation.value || !map) {
      console.warn('Cannot update user marker: missing location or map')
      return
    }

    // Defer if map is mid-zoom to avoid _latLngToNewLayerPoint null crash
    if (map._animatingZoom || map._isZooming) {
      map.once('zoomend', () => updateUserMarker(guestInfo, map, onDragEnd))
      return
    }

    try {
      if (userMarker.value && typeof userMarker.value.setLatLng === 'function' && map.hasLayer && map.hasLayer(userMarker.value)) {
        // Extra guard: ensure map is still valid before updating position
        if (!map._loaded) return
        userMarker.value.setLatLng([userLocation.value.lat, userLocation.value.lng])

        const updatedPopupContent = `
          <div style="font-size: 13px; color: #1f2937; font-weight: 500;">
            ${guestInfo.nickname || 'You'}
            ${userLocation.value.accuracy ? `<br><small style="color: #6b7280;">Accuracy: ${Math.round(userLocation.value.accuracy)}m</small>` : ''}
          </div>
        `
        userMarker.value.setPopupContent(updatedPopupContent)
      } else {
        console.log('Creating new user marker...')

        // Final zoom-check before .addTo() to prevent Leaflet internal null crash
        if (map._animatingZoom || map._isZooming) {
          map.once('zoomend', () => updateUserMarker(guestInfo, map, onDragEnd))
          return
        }

        userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
          title: guestInfo.nickname || 'You',
          draggable: true,
          autoPan: true,
          zIndexOffset: 1000,
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
        }).addTo(map)

        // Patch _animateZoom on this marker instance to guard against the
        // 'Cannot read properties of null (reading _latLngToNewLayerPoint)' crash.
        // This error fires inside requestAnimationFrame (from wheel-scroll zoom) —
        // a place our call-site zoom-state guard cannot reach.
        const _origAnimateZoom = userMarker.value._animateZoom.bind(userMarker.value)
        userMarker.value._animateZoom = function (opt) {
          if (!this._map) return
          _origAnimateZoom(opt)
        }

        userMarker.value.on('dragend', (event) => {
          const marker = event.target
          const position = marker.getLatLng()

          userLocation.value = {
            lat: parseFloat(position.lat.toFixed(8)), // Precision: decimal(10,8)
            lng: parseFloat(position.lng.toFixed(8)), // Precision: decimal(11,8)
            accuracy: userLocation.value?.accuracy || 10,
            isManual: true
          }

          console.log('Marker dragged to:', userLocation.value)
          updateAccuracyCircle(userLocation.value, map)

          if (onDragEnd) {
            onDragEnd(userLocation.value)
          }

          toast.info('Location updated manually')
        })

        const popupContent = `
          <div style="font-size: 13px; color: #1f2937; font-weight: 500;">
            ${guestInfo.nickname || 'You'}
            ${userLocation.value.accuracy ? `<br><small style="color: #6b7280;">Accuracy: ${Math.round(userLocation.value.accuracy)}m</small>` : ''}
            ${userLocation.value.isManual ? '<br><small style="color: #f59e0b;">📍 Manually placed</small>' : ''}
          </div>
        `
        userMarker.value.bindPopup(popupContent, {
          offset: [0, -12],
          closeButton: false,
          autoPan: false,
          className: 'user-popup'
        })

        if (guestInfo.nickname) {
          setTimeout(() => {
            if (userMarker.value && !userMarker.value.isPopupOpen()) {
              userMarker.value.openPopup()
              setTimeout(() => userMarker.value.closePopup(), 3000)
            }
          }, 1000)
        }
      }
    } catch (error) {
      console.error('Error updating user marker:', error)
      userMarker.value = null
    }
  }

  // Start GPS tracking
  const startTracking = (guestInfo, map, onLocationUpdate) => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported')
      toast.error('Geolocation is not supported by your browser')
      return
    }

    if (!map) {
      console.warn('Cannot start tracking: map not initialized')
      return
    }

    console.log('Starting GPS tracking with real-time updates...')

    watchId.value = navigator.geolocation.watchPosition(
      (pos) => {
        // Check if map still exists
        if (!map) {
          console.warn('Map destroyed during GPS update, stopping tracking')
          stopTracking(map)
          return
        }

        const newLocation = {
          lat: parseFloat(pos.coords.latitude.toFixed(8)), // Precision: decimal(10,8)
          lng: parseFloat(pos.coords.longitude.toFixed(8)), // Precision: decimal(11,8)
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed
        }

        console.log('GPS Update:', {
          position: `${newLocation.lat.toFixed(8)}, ${newLocation.lng.toFixed(8)}`,
          accuracy: `${Math.round(newLocation.accuracy)}m`,
          heading: newLocation.heading,
          speed: newLocation.speed
        })

        if (userLocation.value) {
          const distance = calculateDistance(
            userLocation.value.lat, userLocation.value.lng,
            newLocation.lat, newLocation.lng
          )

          const accuracyImproved = newLocation.accuracy < (userLocation.value.accuracy * 0.7)

          if (distance > 2 || accuracyImproved) {
            userLocation.value = newLocation
            updateUserMarker(guestInfo, map, onLocationUpdate)
            updateAccuracyCircle(newLocation, map)

            // Don't pan the map when location updates - keep centered on ASSCAT Bunawan
            // if (distance > 10 && map) {
            //   map.panTo([newLocation.lat, newLocation.lng], {
            //     animate: true,
            //     duration: 1.0
            //   })
            // }

            if (onLocationUpdate) {
              onLocationUpdate(newLocation)
            }
          }
        } else {
          userLocation.value = newLocation
          updateUserMarker(guestInfo, map, onLocationUpdate)
          updateAccuracyCircle(newLocation, map)

          // Don't auto-center on user's GPS location - keep map centered on ASSCAT Bunawan
          // if (map) {
          //   map.setView([newLocation.lat, newLocation.lng], 17, {
          //     animate: true,
          //     duration: 1.5
          //   })
          // }

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
            setTimeout(() => startTracking(guestInfo, map, onLocationUpdate), 2000)
            break
        }

        // toast.error(errorMessage)
        console.warn(errorMessage)

        if (!userLocation.value) {
          userLocation.value = { lat: 8.169, lng: 126.003 }
          updateUserMarker(guestInfo, map, onLocationUpdate)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 2000
      }
    )
  }

  // Stop GPS tracking
  const stopTracking = (map) => {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
      console.log('GPS tracking stopped')
    }

    if (accuracyCircle.value && map && map.hasLayer && map.hasLayer(accuracyCircle.value)) {
      try {
        map.removeLayer(accuracyCircle.value)
      } catch (error) {
        console.warn('Error removing accuracy circle:', error)
      }
      accuracyCircle.value = null
    }

    if (userMarker.value && map && map.hasLayer && map.hasLayer(userMarker.value)) {
      try {
        map.removeLayer(userMarker.value)
      } catch (error) {
        console.warn('Error removing user marker:', error)
      }
      userMarker.value = null
    }
  }

  return {
    userLocation,
    userMarker,
    watchId,
    accuracyCircle,
    startTracking,
    stopTracking,
    updateUserMarker,
    updateAccuracyCircle
  }
}
