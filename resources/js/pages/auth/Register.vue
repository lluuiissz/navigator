<script setup>
import { ref } from 'vue'
import { useForm } from '@inertiajs/vue3';
import { useToast } from 'vue-toastification'
import { route } from 'ziggy-js'
import { LoaderCircle, Eye, EyeOff } from 'lucide-vue-next'
import { BxSolidNavigation } from '@kalimahapps/vue-icons'

defineProps({
  stats: {
    type: Object,
    default: () => ({ facilities: 0, markers: 0, routes: 0, polygons: 0 })
  }
})

const toast = useToast()
const showPassword = ref(false)

const form = useForm({
    name: 'admin',
    email: '',
    password: '',
    password_confirmation: '',
});

const submit = () => {
    // Auto-fill password_confirmation with password value
    form.password_confirmation = form.password;

    form.post(route('register.post'), {
        onFinish: () => form.reset('password', 'password_confirmation'),
        onSuccess: () => {
            toast.success('Registration successful! Redirecting to login...')
        },
        onError: () => {
            toast.error('Registration failed. Please check your information.')
        }
    });
};

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const goToLogin = () => {
  window.location.href = route('login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
    <div class="w-full max-w-md">
      <!-- Logo and Title -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center gap-4 mb-6">
          <div class="h-16 w-16 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
            <img src="../../../assets/logo.png" alt="ASSCAT Logo" class="h-full w-full object-contain"/>
          </div>
          <div class="flex flex-col items-start">
            <span class="text-2xl font-bold text-green-900">ASSCAT</span>
            <span class="text-sm font-medium text-gray-600">Campus Navigator</span>
          </div>
        </div>

        <h1 class="text-3xl font-semibold text-gray-900 mb-2">Welcome to ASSCAT Campus Navigator</h1>
        <p class="text-gray-600">Sign up and get access in under 3 minutes.</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="submit" class="space-y-6">
        <!-- Email Input -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-900 mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autofocus
            v-model="form.email"
            placeholder="example@company.com"
            class="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
            :class="{ 'border-red-500 focus:ring-red-500': form.errors.email }"
          />
          <div v-if="form.errors.email" class="text-red-600 text-xs mt-1.5">
            {{ form.errors.email }}
          </div>
        </div>

        <!-- Password Input -->
        <div>
          <label for="password" class="block text-sm font-medium text-gray-900 mb-2">
            Password
          </label>
          <p class="text-xs text-gray-500 mb-2">Must be at least 8 characters in length</p>
          <div class="relative">
            <input
              id="password"
              :type="showPassword ? 'text' : 'password'"
              required
              v-model="form.password"
              placeholder="New password"
              class="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-900 focus:border-transparent text-sm"
              :class="{ 'border-red-500 focus:ring-red-500': form.errors.password }"
            />
            <button
              type="button"
              @click="togglePasswordVisibility"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              <Eye v-if="!showPassword" class="h-4 w-4" />
              <EyeOff v-else class="h-4 w-4" />
            </button>
          </div>
          <div v-if="form.errors.password" class="text-red-600 text-xs mt-1.5">
            {{ form.errors.password }}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          class="w-full bg-green-900 hover:bg-green-800 text-white px-6 py-2.5 rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          :disabled="form.processing"
        >
          <span v-if="!form.processing">Continue</span>
          <LoaderCircle v-else class="h-4 w-4 animate-spin" />
          <svg v-if="!form.processing" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <!-- Terms and Policy -->
        <div class="text-xs text-gray-600 text-center">
          By creating an account, you agree to our
          <a href="#" class="text-green-700 hover:text-green-800 underline">Terms of Service</a>
          and
          <a href="#" class="text-green-700 hover:text-green-800 underline">Privacy Policy</a>.
        </div>

        <!-- Login Link -->
        <div class="text-sm text-gray-600 text-center">
          Already have an account?
          <button
            type="button"
            @click="goToLogin"
            class="text-green-700 hover:text-green-800 font-medium underline ml-1"
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
