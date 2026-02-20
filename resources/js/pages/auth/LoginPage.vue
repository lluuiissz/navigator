<script setup>
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { router } from '@inertiajs/vue3'
import axios from 'axios'
import { BxSolidNavigation } from '@kalimahapps/vue-icons'
import { route } from 'ziggy-js'
import { LoaderCircle, Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps({
  stats: {
    type: Object,
    default: () => ({ facilities: 0, markers: 0, routes: 0, polygons: 0 })
  }
})

const toast = useToast()

const email = ref('')
const password = ref('')
const remember = ref(false)
const processing = ref(false)
const showPassword = ref(false)
const errors = ref({})

// Login function
const login = async () => {
  errors.value = {}
  processing.value = true

  try {
    const res = await axios.post('/login', {
      email: email.value,
      password: password.value,
      remember: remember.value
    })

    toast.success(res.data.message || 'Login successful!')
    setTimeout(() => {
      window.location.href = '/reports'
    }, 1000)

  } catch (error) {
    console.error('Login failed:', error)

    if (error.response?.status === 422) {
      errors.value = error.response.data.errors
    }

    toast.error(
      error.response?.data?.message ||
      'Login failed. Please check your credentials.'
    )
  } finally {
    processing.value = false
  }
}

const goToRequestAccess = () => {
  router.visit(route('register.get'))
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}
</script>

<template>
  <div class="h-screen flex bg-green-900 overflow-hidden">
    <!-- Left Side - Login Form -->
    <div class="w-full lg:w-1/2 flex items-center justify-center px-8 py-12 overflow-y-auto bg-white">
      <div class="w-full max-w-md">
        <!-- Logo and Title -->
        <div class="mb-12">
          <div class="flex items-center gap-4 mb-8">
            <div class="h-16 w-16 bg-white rounded-full flex items-center justify-center p-2 shadow-md">
              <img src="../../../assets/logo.png" alt="ASSCAT Logo" class="h-full w-full object-contain"/>
            </div>
            <div class="flex flex-col">
              <span class="text-2xl font-bold text-green-900">ASSCAT</span>
              <span class="text-sm font-medium text-gray-600">Campus Navigator</span>
            </div>
          </div>

          <h1 class="text-3xl font-semibold text-green-900 mb-2">Sign in</h1>
          <p class="text-gray-600">Sign in to ASSCAT Campus Navigator</p>
        </div>

        <!-- Form -->
        <form @submit.prevent="login" class="space-y-6">
          <!-- Email Input -->
          <div>
            <label for="email" class="block text-sm font-medium text-green-900 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autofocus
              v-model="email"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
              :class="{ 'border-red-500 focus:ring-red-500': errors.email }"
            />
            <div v-if="errors.email" class="text-red-600 text-xs mt-1.5">
              {{ errors.email[0] || errors.email }}
            </div>
          </div>

          <!-- Password Input -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label for="password" class="block text-sm font-medium text-green-900">
                Password
              </label>
              <a href="#" class="text-sm text-green-700 hover:text-green-800">
                Forgot password?
              </a>
            </div>
            <div class="relative">
              <input
                id="password"
                :type="showPassword ? 'text' : 'password'"
                required
                v-model="password"
                class="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
                :class="{ 'border-red-500 focus:ring-red-500': errors.password }"
              />
              <button
                type="button"
                @click="togglePasswordVisibility"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-green-900"
              >
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
            <div v-if="errors.password" class="text-red-600 text-xs mt-1.5">
              {{ errors.password[0] || errors.password }}
            </div>
          </div>

          <!-- Remember Me -->
          <div class="flex items-center">
            <input
              type="checkbox"
              id="remember"
              v-model="remember"
              class="h-4 w-4 text-green-900 border-gray-300 rounded focus:ring-green-900"
            />
            <label for="remember" class="ml-2 text-sm text-gray-700">
              Remember me
            </label>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            class="w-full bg-green-900 hover:bg-green-800 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            :disabled="processing"
          >
            <span v-if="!processing">Continue</span>
            <LoaderCircle v-else class="h-4 w-4 animate-spin" />
            <svg v-if="!processing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Register Link -->
          <div class="text-sm text-gray-600">
            Don't have an account?
            <button
            disabled
              type="button"
              @click="goToRequestAccess"
              class="text-green-700 hover:text-green-800 font-medium ml-1"
            >
              Create account
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Right Side - Statistics Panel (Browser UI Style) -->
    <div class="hidden lg:flex w-1/2 bg-green-800 items-center justify-center p-8 overflow-hidden">
      <div class="w-full max-w-2xl">
        <!-- Mock Browser Window -->
        <div class="bg-white rounded-lg shadow-2xl overflow-hidden border border-green-700">
          <!-- Browser Header -->
          <div class="bg-green-900 px-4 py-3 flex items-center gap-2 border-b border-green-800">
            <div class="flex gap-2">
              <div class="w-3 h-3 rounded-full bg-red-400"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div class="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div class="flex-1 flex items-center justify-center">
              <div class="bg-white px-4 py-1.5 rounded text-xs text-gray-600 border border-green-700 w-64 text-center">
                asscat-campus-navigator.com/dashboard
              </div>
            </div>
          </div>

          <!-- Browser Content - Dashboard Preview -->
          <div class="p-8 bg-gradient-to-br from-green-50 to-white">
            <div class="mb-6">
              <div class="flex items-center gap-3 mb-2">
                <div class="h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-sm p-1.5">
                  <img src="../../../assets/logo.png" alt="ASSCAT Logo" class="h-full w-full object-contain"/>
                </div>
                <div>
                  <h2 class="text-lg font-bold text-green-900">ASSCAT Campus Navigator</h2>
                  <p class="text-xs text-gray-600">Agusan del Sur State College of Agriculture and Technology</p>
                </div>
              </div>
              <p class="text-sm text-gray-600 mt-3">Campus Navigation System Statistics</p>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Facilities Card -->
              <div class="bg-white rounded-lg p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                  <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Active</span>
                </div>
                <div class="text-2xl font-bold text-green-900 mb-1">{{ stats.facilities }}</div>
                <div class="text-xs text-gray-600 font-medium">Facilities</div>
              </div>

              <!-- Markers Card -->
              <div class="bg-white rounded-lg p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                  <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Active</span>
                </div>
                <div class="text-2xl font-bold text-green-900 mb-1">{{ stats.markers }}</div>
                <div class="text-xs text-gray-600 font-medium">Markers</div>
              </div>

              <!-- Routes Card -->
              <div class="bg-white rounded-lg p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                  <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Active</span>
                </div>
                <div class="text-2xl font-bold text-green-900 mb-1">{{ stats.routes }}</div>
                <div class="text-xs text-gray-600 font-medium">Routes</div>
              </div>

              <!-- Polygons Card -->
              <div class="bg-white rounded-lg p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                  <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  </div>
                  <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Active</span>
                </div>
                <div class="text-2xl font-bold text-green-900 mb-1">{{ stats.polygons }}</div>
                <div class="text-xs text-gray-600 font-medium">Polygons</div>
              </div>
            </div>

            <!-- Additional Info -->
            <div class="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg class="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-green-900 mb-1">Real-time Navigation</h3>
                  <p class="text-xs text-gray-600">Access campus maps, routes, and facility information from anywhere.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
