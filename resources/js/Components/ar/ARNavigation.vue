<template>
  <div class="ar-navigation-container">
    <!-- Loading State -->
    <div v-if="isLoading" class="ar-loading">
      <div class="loading-spinner"></div>
      <p>Initializing AR Camera...</p>
      <p class="hint">Please allow camera and location permissions</p>
    </div>

    <!-- AR Camera View -->
    <div v-else-if="isARActive" class="ar-view">
      <!-- A-Frame AR Scene with GPS -->
      <a-scene
        ref="arScene"
        embedded
        arjs="sourceType: webcam; debugUIEnabled: false; videoTexture: true;"
        vr-mode-ui="enabled: false"
        renderer="logarithmicDepthBuffer: true; alpha: true; antialias: true;"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
      >
        <!-- GPS Camera -->
        <a-camera
          ref="arCamera"
          gps-camera="minDistance: 5; maxDistance: 1000;"
          rotation-reader
        ></a-camera>
      </a-scene>

      <!-- Overlay UI -->
      <div class="ar-overlay">
        <!-- Mini Map -->
        <div class="mini-map-container">
          <div ref="miniMap" class="mini-map"></div>
        </div>

        <!-- Navigation Info -->
        <div class="nav-info">
          <div class="distance">
            <span class="icon">📍</span>
            <span class="value">{{ formattedDistance }}</span>
          </div>
          <div class="eta">
            <span class="icon">⏱️</span>
            <span class="value">{{ formattedETA }}</span>
          </div>
          <div class="direction">
            <span class="icon">🧭</span>
            <span class="value">{{ compassDirection }}</span>
          </div>
        </div>

        <!-- AR Controls -->
        <div class="ar-controls">
          <button @click="toggleAR" class="btn-close-ar">
            ✕ Exit AR
          </button>
          <button @click="recenterAR" class="btn-recenter">
            🎯 Recenter
          </button>
        </div>
      </div>
    </div>
    
    <!-- Error Message -->
    <div v-if="loadError" class="ar-error">
      <p>❌ {{ loadError }}</p>
      <button @click="handleErrorDismiss" class="btn-dismiss">Dismiss</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import L from 'leaflet'

const props = defineProps({
  destination: {
    type: Object,
    required: true,
    // { lat: number, lng: number, name: string }
  },
  routePoints: {
    type: Array,
    default: () => []
    // Array of { lat, lng }
  }
})

const emit = defineEmits(['ar-started', 'ar-stopped', 'destination-reached'])

// State
const isARActive = ref(false)
const arScene = ref(null)
const arCamera = ref(null)
const miniMap = ref(null)
const miniMapInstance = ref(null)
const isLoading = ref(false)
const loadError = ref(null)

const userPosition = ref({ lat: 0, lng: 0, heading: 0 })
const distance = ref(0)
const eta = ref(0)
const compassDirection = ref('N')

// AR Entities (3D objects)
const arrowEntities = ref([])
const breadcrumbEntities = ref([])

// Computed
const formattedDistance = computed(() => {
  if (distance.value < 1000) {
    return `${Math.round(distance.value)}m`
  }
  return `${(distance.value / 1000).toFixed(2)}km`
})

const formattedETA = computed(() => {
  const minutes = Math.floor(eta.value / 60)
  const seconds = eta.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const displayedRoutePoints = computed(() => {
  // Show max 5 route points for breadcrumbs
  const maxPoints = 5
  if (props.routePoints.length <= maxPoints) {
    return props.routePoints
  }
  // Sample evenly
  const step = Math.floor(props.routePoints.length / maxPoints)
  const sampled = []
  for (let i = 0; i < props.routePoints.length; i += step) {
    sampled.push(props.routePoints[i])
    if (sampled.length >= maxPoints) break
  }
  return sampled
})

// Methods
const startARNavigation = async () => {
  try {
    isLoading.value = true
    loadError.value = null
    
    console.log('Starting AR Navigation...')
    
    // Check if A-Frame is loaded
    if (!window.AFRAME) {
      throw new Error('A-Frame not loaded. Please refresh the page.')
    }
    
    console.log('A-Frame ready:', window.AFRAME.version)

    isARActive.value = true
    isLoading.value = false
    
    // Wait for A-Frame scene to initialize
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Create 3D AR objects
    createARElements()
    
    initializeMiniMap()
    startGPSTracking()
    
    emit('ar-started')
    console.log('✅ AR Navigation started with 3D objects')
  } catch (error) {
    console.error('Failed to start AR:', error)
    loadError.value = error.message
    isLoading.value = false
    alert('AR initialization failed: ' + error.message)
  }
}

const toggleAR = () => {
  if (isARActive.value) {
    stopARNavigation()
  } else {
    startARNavigation()
  }
}

const stopARNavigation = () => {
  isARActive.value = false
  
  // Clear AR entities
  clearARElements()
  
  // Cleanup map
  if (miniMapInstance.value) {
    miniMapInstance.value.remove()
    miniMapInstance.value = null
  }
  
  stopGPSTracking()
  
  emit('ar-stopped')
  console.log('AR Navigation stopped')
}

const createARElements = () => {
  if (!arScene.value || !window.AFRAME) {
    console.error('A-Frame scene not ready')
    return
  }

  console.log('Creating 3D AR objects for', props.routePoints.length, 'points')
  
  // Clear existing entities first
  clearARElements()
  
  const scene = arScene.value
  
  // Create directional arrows for route points
  props.routePoints.forEach((point, index) => {
    // Create arrow entity (cone pointing up)
    const arrow = document.createElement('a-entity')
    arrow.setAttribute('gps-entity-place', `latitude: ${point.lat}; longitude: ${point.lng};`)
    arrow.setAttribute('geometry', 'primitive: cone; radiusBottom: 2; radiusTop: 0; height: 5;')
    arrow.setAttribute('material', 'color: #3B82F6; opacity: 0.8;')
    arrow.setAttribute('rotation', '0 0 0')
    arrow.setAttribute('scale', '1 1 1')
    
    scene.appendChild(arrow)
    arrowEntities.value.push(arrow)
    
    // Create breadcrumb (sphere on ground)
    const breadcrumb = document.createElement('a-entity')
    breadcrumb.setAttribute('gps-entity-place', `latitude: ${point.lat}; longitude: ${point.lng};`)
    breadcrumb.setAttribute('geometry', 'primitive: sphere; radius: 1;')
    breadcrumb.setAttribute('material', `color: ${index === props.routePoints.length - 1 ? '#10B981' : '#FBBF24'}; opacity: 0.9;`)
    breadcrumb.setAttribute('position', '0 0.5 0')
    
    scene.appendChild(breadcrumb)
    breadcrumbEntities.value.push(breadcrumb)
  })
  
  console.log(`✅ Created ${arrowEntities.value.length} arrows and ${breadcrumbEntities.value.length} breadcrumbs`)
}

const clearARElements = () => {
  // Remove all arrow entities
  arrowEntities.value.forEach(entity => {
    if (entity.parentNode) {
      entity.parentNode.removeChild(entity)
    }
  })
  arrowEntities.value = []
  
  // Remove all breadcrumb entities
  breadcrumbEntities.value.forEach(entity => {
    if (entity.parentNode) {
      entity.parentNode.removeChild(entity)
    }
  })
  breadcrumbEntities.value = []
  
  console.log('AR entities cleared')
}

const initializeMiniMap = () => {
  if (!miniMap.value) return

  // Create Leaflet mini-map
  miniMapInstance.value = L.map(miniMap.value, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false
  }).setView([userPosition.value.lat, userPosition.value.lng], 17)

  // Add tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(miniMapInstance.value)

  // Add user marker
  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: '<div class="pulse-marker"></div>',
    iconSize: [20, 20]
  })
  
  L.marker([userPosition.value.lat, userPosition.value.lng], { icon: userIcon })
    .addTo(miniMapInstance.value)

  // Add destination marker
  L.marker([props.destination.lat, props.destination.lng])
    .addTo(miniMapInstance.value)
    .bindPopup(props.destination.name)

  // Draw route if available
  if (props.routePoints.length > 0) {
    L.polyline(props.routePoints.map(p => [p.lat, p.lng]), {
      color: '#3B82F6',
      weight: 3,
      opacity: 0.7
    }).addTo(miniMapInstance.value)
  }
}

let watchId = null

const startGPSTracking = () => {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser')
    return
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      userPosition.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: position.coords.heading || 0
      }
      
      updateNavigation()
      updateMiniMap()
    },
    (error) => {
      console.error('GPS error:', error)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  )

  // Listen to device orientation for compass
  window.addEventListener('deviceorientationabsolute', handleOrientation)
  window.addEventListener('deviceorientation', handleOrientation)
}

const stopGPSTracking = () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  
  window.removeEventListener('deviceorientationabsolute', handleOrientation)
  window.removeEventListener('deviceorientation', handleOrientation)
}

const handleOrientation = (event) => {
  const alpha = event.alpha // Compass direction (0-360)
  if (alpha !== null) {
    userPosition.value.heading = alpha
    updateCompassDirection(alpha)
  }
}

const updateCompassDirection = (heading) => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(heading / 45) % 8
  compassDirection.value = directions[index]
}

const updateNavigation = () => {
  // Calculate distance to destination
  distance.value = calculateDistance(
    userPosition.value.lat,
    userPosition.value.lng,
    props.destination.lat,
    props.destination.lng
  )

  // Calculate ETA (assuming walking speed of 1.4 m/s)
  eta.value = Math.round(distance.value / 1.4)

  // Update AR elements
  updateARElements()

  // Check if destination reached (within 10 meters)
  if (distance.value < 10) {
    emit('destination-reached')
  }
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

const updateMiniMap = () => {
  if (!miniMapInstance.value) return
  
  // Update map center to user position
  miniMapInstance.value.setView([userPosition.value.lat, userPosition.value.lng])
}

const recenterAR = () => {
  // Reset AR camera orientation
  if (arCamera.value) {
    arCamera.value.setAttribute('rotation', '0 0 0')
  }
}

const handleErrorDismiss = () => {
  loadError.value = null
  emit('ar-stopped')
}

// Lifecycle
onMounted(() => {
  // Auto-start AR navigation when component mounts
  console.log('AR Navigation component mounted, auto-starting...')
  startARNavigation()
})

onBeforeUnmount(() => {
  stopARNavigation()
})

// Watch for route changes
watch(() => props.routePoints, () => {
  if (isARActive.value) {
    createARElements()
  }
}, { deep: true })
</script>

<style scoped>
.ar-navigation-container {
  width: 100%;
  height: 100%;
}

.ar-view {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  background: #000;
}

/* A-Frame Scene - Make camera video visible */
a-scene {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 1 !important;
}

/* Ensure A-Frame canvas renders */
a-scene canvas {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 2 !important;
}

/* Make sure video element (camera feed) is visible */
a-scene video,
a-scene .a-canvas {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  z-index: 1 !important;
}

.ar-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.ar-overlay > * {
  pointer-events: auto;
}

/* Mini Map */
.mini-map-container {
  position: absolute;
  bottom: 100px;
  left: 20px;
  width: 150px;
  height: 150px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  border: 3px solid #fff;
}

.mini-map {
  width: 100%;
  height: 100%;
}

/* Directional Arrow */
.ar-arrow-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 150;
  pointer-events: none;
}

.ar-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: pulse-arrow 2s ease-in-out infinite;
}

.arrow-icon {
  font-size: 80px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
  animation: bounce 1s ease-in-out infinite;
}

.arrow-label {
  margin-top: 10px;
  background: rgba(59, 130, 246, 0.9);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@keyframes pulse-arrow {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* Breadcrumb Trail */
.breadcrumb-trail {
  position: absolute;
  bottom: 200px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 15px;
  align-items: center;
  z-index: 150;
}

.breadcrumb {
  animation: fade-in 0.5s ease-in-out;
}

.breadcrumb-dot {
  font-size: 24px;
  color: #FBBF24;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
  animation: glow 2s ease-in-out infinite;
}

.breadcrumb-destination .breadcrumb-dot {
  color: #10B981;
  font-size: 32px;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes glow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
  }
  50% {
    filter: drop-shadow(0 0 16px rgba(251, 191, 36, 1));
  }
}

/* Navigation Info */
.nav-info {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  z-index: 200;
}

.nav-info > div {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  padding: 12px 16px;
  border-radius: 12px;
  color: white;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.nav-info .icon {
  font-size: 20px;
}

.nav-info .value {
  font-family: 'Courier New', monospace;
}

/* AR Controls */
.ar-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
  z-index: 200;
}

.ar-controls button {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.ar-controls button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.6);
}

.btn-close-ar {
  background: rgba(239, 68, 68, 0.9) !important;
}

.btn-close-ar:hover {
  background: rgba(220, 38, 38, 1) !important;
}

/* Start AR Button */
.btn-start-ar {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-start-ar:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.6);
}

/* User location marker animation */
:deep(.pulse-marker) {
  width: 20px;
  height: 20px;
  background: #3B82F6;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

/* Responsive Design for Mobile */
@media (max-width: 640px) {
  .mini-map-container {
    width: 100px;
    height: 100px;
    bottom: 70px;
    left: 10px;
  }

  .nav-info {
    flex-direction: row;
    gap: 6px;
    top: 10px;
    left: 10px;
    right: 10px;
  }

  .nav-info > div {
    font-size: 12px;
    padding: 8px 10px;
    flex: 1;
  }
  
  .nav-info .icon {
    font-size: 16px;
  }
  
  .nav-info .value {
    font-size: 13px;
  }

  .ar-controls {
    bottom: 15px;
    gap: 10px;
    width: calc(100% - 20px);
    max-width: 400px;
  }

  .ar-controls button {
    flex: 1;
    padding: 14px 16px;
    font-size: 14px;
    min-height: 48px; /* Touch-friendly */
  }
}

/* Extra small phones */
@media (max-width: 375px) {
  .mini-map-container {
    width: 80px;
    height: 80px;
    bottom: 60px;
  }
  
  .nav-info > div {
    font-size: 11px;
    padding: 6px 8px;
  }
  
  .ar-controls button {
    padding: 12px 14px;
    font-size: 13px;
  }
}

/* Landscape mode on mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .mini-map-container {
    width: 80px;
    height: 80px;
    bottom: 10px;
  }
  
  .nav-info {
    top: 5px;
    gap: 4px;
  }
  
  .nav-info > div {
    padding: 6px 8px;
    font-size: 11px;
  }
  
  .ar-controls {
    bottom: 10px;
  }
  
  .ar-controls button {
    padding: 10px 12px;
  }
}

/* Ensure full viewport on mobile */
.ar-view {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh; /* Dynamic viewport height for mobile browsers */
  overflow: hidden;
}

/* Loading State */
.ar-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3B82F6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ar-loading p {
  font-size: 16px;
  font-weight: 600;
  color: #3B82F6;
  margin: 8px 0;
}

.ar-loading p.hint {
  font-size: 14px;
  font-weight: 400;
  color: #6B7280;
  margin-top: 12px;
}

/* Error Message */
.ar-error {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #EF4444;
  color: white;
  padding: 16px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
  z-index: 10001;
  max-width: 90%;
  text-align: center;
}

.ar-error p {
  margin: 0 0 12px 0;
  font-weight: 600;
}

.btn-dismiss {
  background: white;
  color: #EF4444;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-dismiss:hover {
  background: #FEE2E2;
}
</style>
