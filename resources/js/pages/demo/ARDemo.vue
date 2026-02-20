<template>
  <div class="ar-test-page">
    <div class="header">
      <h1>📱 AR Navigation Test</h1>
      <p>Test camera with AR arrows, breadcrumbs, and mini-map</p>
    </div>

    <!-- Quick Test Buttons -->
    <div v-if="!arActive" class="test-controls">
      <div class="preset-destinations">
        <h3>Choose a test destination:</h3>
        <button 
          v-for="preset in presets" 
          :key="preset.name"
          @click="selectPreset(preset)"
          class="preset-btn"
        >
          {{ preset.icon }} {{ preset.name }}
        </button>
      </div>

      <div v-if="selectedDestination" class="destination-info">
        <h3>Selected Destination:</h3>
        <p><strong>{{ selectedDestination.name }}</strong></p>
        <p>📍 {{ selectedDestination.lat }}, {{ selectedDestination.lng }}</p>
        <p class="hint">💡 Make sure you're outside for best GPS accuracy!</p>
      </div>
    </div>

    <!-- AR Navigation Component -->
    <ARNavigation
      v-if="selectedDestination"
      :destination="selectedDestination"
      :route-points="routePoints"
      @ar-started="handleARStarted"
      @ar-stopped="handleARStopped"
      @destination-reached="handleDestinationReached"
    />

    <!-- Status Messages -->
    <div v-if="statusMessage" class="status-toast" :class="statusType">
      {{ statusMessage }}
    </div>

    <!-- Instructions -->
    <div v-if="!arActive && !selectedDestination" class="instructions">
      <h3>📋 How to Test AR Navigation:</h3>
      <ol>
        <li>✅ AR dependencies are installed</li>
        <li>📍 Choose a test destination above</li>
        <li>📱 Click "Start AR Navigation"</li>
        <li>✅ Allow camera and location permissions</li>
        <li>🚶 Go outside for best GPS accuracy</li>
        <li>👀 Look around to see AR arrows and breadcrumbs!</li>
      </ol>

      <div class="features">
        <h4>What you'll see:</h4>
        <ul>
          <li>📹 <strong>Camera view</strong> - Real-world through your camera</li>
          <li>➡️ <strong>Blue arrows</strong> - 3D markers pointing to waypoints</li>
          <li>🟡 <strong>Yellow breadcrumbs</strong> - Trail showing the path</li>
          <li>🗺️ <strong>Mini-map</strong> - Small map in bottom-left corner</li>
          <li>📊 <strong>Navigation info</strong> - Distance, ETA, compass</li>
        </ul>
      </div>

      <div class="requirements">
        <h4>⚠️ Requirements:</h4>
        <ul>
          <li>📱 Mobile device (Android or iOS)</li>
          <li>🌐 HTTPS connection (iOS requirement)</li>
          <li>📡 GPS enabled</li>
          <li>📹 Camera permission</li>
          <li>☀️ Outdoor location (for GPS accuracy)</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ARNavigation from '@/Components/ar/ARNavigation.vue'

// Test destinations (adjust coordinates to your campus/area)
const presets = [
  {
    name: 'Engineering Building',
    icon: '🏫',
    lat: 8.16953,
    lng: 126.00306
  },
  {
    name: 'Library',
    icon: '📚',
    lat: 8.16963,
    lng: 126.00316
  },
  {
    name: 'Cafeteria',
    icon: '🍽️',
    lat: 8.16943,
    lng: 126.00296
  },
  {
    name: 'Main Gate',
    icon: '🚪',
    lat: 8.16933,
    lng: 126.00286
  }
]

const selectedDestination = ref(null)
const routePoints = ref([])
const arActive = ref(false)
const statusMessage = ref('')
const statusType = ref('info')

const selectPreset = (preset) => {
  selectedDestination.value = {
    name: preset.name,
    lat: preset.lat,
    lng: preset.lng
  }

  // Generate sample route points (straight line for testing)
  // In production, this would come from your routing API
  const start = { lat: 8.16933, lng: 126.00286 } // Sample start point
  const end = { lat: preset.lat, lng: preset.lng }
  
  const steps = 5
  const points = []
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    points.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio
    })
  }
  
  routePoints.value = points
  
  showStatus(`Destination set: ${preset.name}. Click "Start AR Navigation" below!`, 'success')
}

const handleARStarted = () => {
  arActive.value = true
  showStatus('🎉 AR Navigation started! Point your camera around to see arrows and breadcrumbs.', 'success')
}

const handleARStopped = () => {
  arActive.value = false
  showStatus('AR Navigation stopped. Select another destination to try again.', 'info')
}

const handleDestinationReached = () => {
  showStatus('🎯 Congratulations! You reached your destination!', 'success')
  
  // Reset after 5 seconds
  setTimeout(() => {
    selectedDestination.value = null
    routePoints.value = []
    arActive.value = false
  }, 5000)
}

const showStatus = (message, type = 'info') => {
  statusMessage.value = message
  statusType.value = type
  
  setTimeout(() => {
    statusMessage.value = ''
  }, 5000)
}
</script>

<style scoped>
.ar-test-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.header {
  text-align: center;
  color: white;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 10px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.header p {
  font-size: 18px;
  opacity: 0.9;
}

.test-controls {
  max-width: 800px;
  margin: 0 auto 30px;
}

.preset-destinations {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
}

.preset-destinations h3 {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 16px;
  color: #1F2937;
}

.preset-btn {
  display: block;
  width: 100%;
  padding: 16px 20px;
  margin-bottom: 12px;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.preset-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

.preset-btn:active {
  transform: translateY(0);
}

.destination-info {
  background: #EFF6FF;
  border: 3px solid #3B82F6;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
}

.destination-info h3 {
  font-size: 18px;
  font-weight: 700;
  color: #1E40AF;
  margin-bottom: 12px;
}

.destination-info p {
  margin: 8px 0;
  color: #374151;
  font-size: 16px;
}

.destination-info .hint {
  margin-top: 16px;
  padding: 12px;
  background: #FEF3C7;
  border-radius: 8px;
  color: #92400E;
  font-weight: 600;
}

.instructions {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.instructions h3 {
  font-size: 24px;
  font-weight: 700;
  color: #1F2937;
  margin-bottom: 20px;
}

.instructions h4 {
  font-size: 20px;
  font-weight: 700;
  color: #374151;
  margin: 24px 0 12px;
}

.instructions ol,
.instructions ul {
  padding-left: 24px;
  line-height: 1.8;
  color: #4B5563;
}

.instructions li {
  margin-bottom: 12px;
  font-size: 16px;
}

.instructions strong {
  color: #1F2937;
  font-weight: 600;
}

.features {
  background: #F0FDF4;
  border-left: 4px solid #10B981;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.requirements {
  background: #FEF2F2;
  border-left: 4px solid #EF4444;
  padding: 20px;
  border-radius: 8px;
  margin-top: 20px;
}

.status-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px 32px;
  border-radius: 12px;
  font-weight: 600;
  font-size: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  max-width: 90%;
  text-align: center;
  animation: slideUp 0.3s ease-out;
}

.status-toast.success {
  background: #10B981;
  color: white;
}

.status-toast.error {
  background: #EF4444;
  color: white;
}

.status-toast.info {
  background: #3B82F6;
  color: white;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

@media (max-width: 640px) {
  .header h1 {
    font-size: 24px;
  }

  .header p {
    font-size: 16px;
  }

  .preset-destinations,
  .instructions {
    padding: 20px;
  }

  .preset-btn {
    font-size: 16px;
    padding: 14px 18px;
  }
}
</style>
