import { ref } from 'vue'
import L from 'leaflet'
import { useToast } from 'vue-toastification'

export function useGPSTracking(map, guestInfo) {
  const toast = useToast()

  const userLocation = ref(null)
  const userMarker = ref(null)
  const watchId = ref(null)
  const accuracyCircle = ref(null)

  // Calculate distance using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Update user marker
  const updateUserMarker = () => {
    if (!userLocation.value || !map.value) {
      console.warn('Cannot update user marker: missing location or map')
      return
    }

    try {
      // Check if marker exists and is still on the map
      if (userMarker.value && typeof userMarker.value.setLatLng === 'function' && map.value.hasLayer(userMarker.value)) {
        userMarker.value.setLatLng([userLocation.value.lat, userLocation.value.lng])

        const updatedPopupContent = `
          <div style="font-size: 13px; color: #1f2937; font-weight: 500;">
            ${guestInfo.value.nickname || 'You'}
            ${userLocation.value.accuracy ? `<br><small style="color: #6b7280;">Accuracy: ${Math.round(userLocation.value.accuracy)}m</small>` : ''}
          </div>
        `
        userMarker.value.setPopupContent(updatedPopupContent)
      } else {
        console.log('Creating new user marker...')

        userMarker.value = L.marker([userLocation.value.lat, userLocation.value.lng], {
          title: guestInfo.value.nickname || 'You',
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
        }).addTo(map.value)

        // Drag events
        userMarker.value.on('dragend', function(event) {
          const marker = event.target
          const position = marker.getLatLng()

          userLocation.value = {
            lat: position.lat,
            lng: position.lng,
            accuracy: userLocation.value?.accuracy || 10,
            isManual: true
          }

          console.log('🎯 Marker dragged to:', userLocation.value)
          updateAccuracyCircle(userLocation.value)
          // toast.info('Location updated manually')
        })

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
      console.error('Error updating user marker:', error)
      userMarker.value = null
    }
  }

  // Update accuracy circle
  const updateAccuracyCircle = (location) => {
    if (!map.value || !location.accuracy) return

    // Safely remove existing circle
    if (accuracyCircle.value && map.value.hasLayer(accuracyCircle.value)) {
      try {
        map.value.removeLayer(accuracyCircle.value)
      } catch (error) {
        console.warn('Error removing accuracy circle:', error)
      }
      accuracyCircle.value = null
    }

    if (location.accuracy < 100) {
      accuracyCircle.value = L.circle([location.lat, location.lng], {
        radius: location.accuracy,
        color: '#3388ff',
        fillColor: '#3388ff',
        fillOpacity: 0.1,
        weight: 1,
        opacity: 0.5
      }).addTo(map.value)

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

  // Start GPS tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported')
    //   toast.error('Geolocation is not supported by your browser')
      return
    }

    console.log('Starting GPS tracking...')

    watchId.value = navigator.geolocation.watchPosition(
      (pos) => {
        const newLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed
        }

        console.log('GPS Update:', {
          position: `${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`,
          accuracy: `${Math.round(newLocation.accuracy)}m`
        })

        if (userLocation.value) {
          const distance = calculateDistance(
            userLocation.value.lat, userLocation.value.lng,
            newLocation.lat, newLocation.lng
          )

          const accuracyImproved = newLocation.accuracy < (userLocation.value.accuracy * 0.7)

          if (distance > 2 || accuracyImproved) {
            userLocation.value = newLocation
            updateUserMarker()
            updateAccuracyCircle(newLocation)

            if (distance > 10 && map.value && map.value._zoom) {
              try {
                map.value.panTo([newLocation.lat, newLocation.lng], {
                  animate: true,
                  duration: 1.0
                })
              } catch (error) {
                console.warn('Error panning map:', error)
              }
            }
          }
        } else {
          userLocation.value = newLocation
          updateUserMarker()
          updateAccuracyCircle(newLocation)

          if (map.value && map.value._zoom) {
            try {
              map.value.setView([newLocation.lat, newLocation.lng], 17, {
                animate: true,
                duration: 1.5
              })
            } catch (error) {
              console.warn('Error setting map view:', error)
              // Fallback without animation
              map.value.setView([newLocation.lat, newLocation.lng], 17, { animate: false })
            }
          }

        //   toast.success(`GPS acquired! Accuracy: ${Math.round(newLocation.accuracy)}m`)
        }
      },
      (err) => {
        console.error('Geolocation error:', err)
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
            setTimeout(startTracking, 5000)
            break
        }

        toast.error(errorMessage)

        if (!userLocation.value) {
          userLocation.value = { lat: 8.169, lng: 126.003 }
          updateUserMarker()
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
  const stopTracking = () => {
    if (watchId.value !== null) {
      navigator.geolocation.clearWatch(watchId.value)
      watchId.value = null
      console.log('GPS tracking stopped')
    }

    // Safely remove accuracy circle
    if (accuracyCircle.value && map.value && map.value.hasLayer(accuracyCircle.value)) {
      try {
        map.value.removeLayer(accuracyCircle.value)
      } catch (error) {
        console.warn('Error removing accuracy circle on stop:', error)
      }
      accuracyCircle.value = null
    }
  }

  return {
    userLocation,
    userMarker,
    watchId,
    startTracking,
    stopTracking,
    updateUserMarker
  }
}
