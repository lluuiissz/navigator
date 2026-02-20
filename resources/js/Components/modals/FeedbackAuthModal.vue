<script setup>
import { ref, computed } from 'vue'
import { CheckCircleIcon, XCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import axios from 'axios'

const props = defineProps({
  pendingFeedback: { type: Object, default: null },
  // 'student' | 'faculty' | 'visitor'
  role: { type: String, default: 'student' },
})

const emit = defineEmits(['close', 'success'])
const toast = useToast()

// ─── Step machine ────────────────────────────────────────────────────────────
// student / faculty: 1=ID verify  → 2=register  | 3=login
// visitor:          1=quick-register             | 3=login (existing)
// ─────────────────────────────────────────────────────────────────────────────
const currentStep = ref(1)
const isLoading   = ref(false)

// Form fields
const idNumber            = ref('')
const fullName            = ref('')
const course              = ref('')
const email               = ref('')
const password            = ref('')
const passwordConfirmation = ref('')

const errors              = ref({})
const verificationMessage = ref(null)

// ─── Computed helpers ─────────────────────────────────────────────────────────
const isVerifiedRole = computed(() => ['student', 'faculty'].includes(props.role))
const isVisitor      = computed(() => props.role === 'visitor')

const roleLabel = computed(() => {
  if (props.role === 'faculty') return 'Faculty'
  if (props.role === 'visitor') return 'Visitor'
  return 'Student'
})

const idPlaceholder = computed(() =>
  props.role === 'faculty' ? 'e.g., FAC-2024-001' : 'e.g., M25-01-0067'
)

const stepTitle = computed(() => {
  if (isVisitor.value) {
    return currentStep.value === 1 ? 'Visitor Quick Register' : 'Welcome Back'
  }
  if (currentStep.value === 1) return `Verify ${roleLabel.value} ID`
  if (currentStep.value === 2) return 'Create Account'
  return 'Welcome Back'
})

const stepSubtitle = computed(() => {
  if (isVisitor.value) {
    return currentStep.value === 1
      ? 'Create a free account — no ID required'
      : 'Login to submit feedback'
  }
  if (currentStep.value === 1) return `Enter your ${roleLabel.value.toLowerCase()} ID to continue`
  if (currentStep.value === 2) return 'Complete your registration'
  return 'Login to submit feedback'
})

// ─── Step 1a: Verify ID (student / faculty) ───────────────────────────────────
const verifyId = async () => {
  if (!idNumber.value.trim()) {
    errors.value.id_number = 'Please enter your ID number'
    return
  }

  isLoading.value = true
  errors.value    = {}
  verificationMessage.value = null

  try {
    const response = await axios.post('/auth/verify-id', {
      id_number: idNumber.value,
      role: props.role,      // ← tells backend which allowlist pool to check
    })

    const data = response.data
    fullName.value = data.full_name
    course.value   = data.course || ''

    if (data.available) {
      email.value        = `${idNumber.value}@campus.edu`
      currentStep.value  = 2
      verificationMessage.value = { type: 'success', text: 'ID verified! Please create your account.' }
    } else {
      email.value        = data.email || ''
      currentStep.value  = 3
      verificationMessage.value = { type: 'info', text: data.message || 'Welcome back! Please login.' }
    }
  } catch (error) {
    verificationMessage.value = {
      type: 'error',
      text: error.response?.data?.message || 'ID not found in the allowlist.',
    }
  } finally {
    isLoading.value = false
  }
}

// ─── Step 2: Register (student / faculty — allowlist required) ────────────────
const register = async () => {
  errors.value = {}

  if (!email.value || !email.value.includes('@')) {
    errors.value.email = 'Please enter a valid email'
    return
  }
  if (!password.value || password.value.length < 8) {
    errors.value.password = 'Password must be at least 8 characters'
    return
  }
  if (password.value !== passwordConfirmation.value) {
    errors.value.password_confirmation = 'Passwords do not match'
    return
  }

  isLoading.value = true

  try {
    const response = await axios.post('/register', {
      name:                  fullName.value,
      email:                 email.value,
      password:              password.value,
      password_confirmation: passwordConfirmation.value,
      id_number:             idNumber.value,
    })

    if (response.data.success) {
      toast.success('Account created successfully!')
      emit('success', response.data.user)
    }
  } catch (error) {
    if (error.response?.data?.errors) {
      errors.value = error.response.data.errors
    } else {
      toast.error(error.response?.data?.message || 'Network error. Please try again.')
    }
  } finally {
    isLoading.value = false
  }
}

// ─── Step 1b: Visitor quick-register (name + email + password, no ID) ─────────
const registerVisitor = async () => {
  errors.value = {}

  if (!fullName.value.trim()) {
    errors.value.name = 'Please enter your name'
    return
  }
  if (!email.value || !email.value.includes('@')) {
    errors.value.email = 'Please enter a valid email'
    return
  }
  if (!password.value || password.value.length < 8) {
    errors.value.password = 'Password must be at least 8 characters'
    return
  }
  if (password.value !== passwordConfirmation.value) {
    errors.value.password_confirmation = 'Passwords do not match'
    return
  }

  isLoading.value = true

  try {
    const response = await axios.post('/register/visitor', {
      name:                  fullName.value,
      email:                 email.value,
      password:              password.value,
      password_confirmation: passwordConfirmation.value,
    })

    if (response.data.success) {
      toast.success(response.data.message || 'Account created!')
      emit('success', response.data.user)
    }
  } catch (error) {
    if (error.response?.data?.errors) {
      errors.value = error.response.data.errors
    } else {
      toast.error(error.response?.data?.message || 'Network error. Please try again.')
    }
  } finally {
    isLoading.value = false
  }
}

// ─── Step 3: Login (all verified roles) ──────────────────────────────────────
const login = async () => {
  errors.value = {}

  if (!password.value) {
    errors.value.password = 'Please enter your password'
    return
  }

  isLoading.value = true

  try {
    const response = await axios.post('/login', {
      email:    email.value,
      password: password.value,
    })

    if (response.data.success) {
      toast.success('Login successful!')
      emit('success', response.data.user)
    } else {
      errors.value.password = response.data.message || 'Invalid credentials'
    }
  } catch (error) {
    if (error.response?.status === 401) {
      errors.value.password = error.response.data.message || 'Invalid credentials'
    } else {
      toast.error(error.response?.data?.message || 'Network error. Please try again.')
    }
  } finally {
    isLoading.value = false
  }
}

// ─── Nav helpers ──────────────────────────────────────────────────────────────
const goBack = () => {
  currentStep.value = 1
  password.value = ''
  passwordConfirmation.value = ''
  errors.value = {}
  verificationMessage.value = null
}

const switchToLogin = () => {
  errors.value = {}
  currentStep.value = 3
}

const handleEnter = (cb) => { if (!isLoading.value) cb() }
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div class="relative w-full max-w-md bg-white rounded-lg shadow-xl">

      <!-- Close -->
      <button @click="$emit('close')" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition">
        <XMarkIcon class="h-6 w-6" />
      </button>

      <!-- Header -->
      <div class="border-b border-gray-200 px-6 py-4">
        <!-- Role badge -->
        <div class="mb-2 flex items-center gap-2">
          <span :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
            role === 'faculty' ? 'bg-blue-100 text-blue-800' :
            role === 'visitor' ? 'bg-amber-100 text-amber-800' :
            'bg-green-100 text-green-800'
          ]">
            {{ role === 'faculty' ? '👨‍🏫 Faculty' : role === 'visitor' ? '👤 Visitor' : '🎓 Student' }}
          </span>
        </div>
        <h2 class="text-xl font-bold text-gray-900">{{ stepTitle }}</h2>
        <p class="text-sm text-gray-600 mt-1">{{ stepSubtitle }}</p>
      </div>

      <!-- Body -->
      <div class="px-6 py-6">

        <!-- ══════════════════════════════════════════════════════════════════
             STUDENT / FACULTY ─ Step 1: ID Verification
        ═══════════════════════════════════════════════════════════════════ -->
        <div v-if="isVerifiedRole && currentStep === 1" class="space-y-4">
          <div>
            <label for="id_number" class="block text-sm font-medium text-gray-700 mb-2">
              {{ roleLabel }} ID Number
            </label>
            <input
              id="id_number"
              v-model="idNumber"
              type="text"
              :placeholder="idPlaceholder"
              @keyup.enter="handleEnter(verifyId)"
              class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
              :class="{ 'border-red-500': errors.id_number }"
            />
            <p v-if="errors.id_number" class="mt-1 text-sm text-red-600">{{ errors.id_number }}</p>
          </div>

          <div v-if="verificationMessage" class="p-4 rounded-md" :class="{
            'bg-green-50 border border-green-200': verificationMessage.type === 'success',
            'bg-blue-50  border border-blue-200':  verificationMessage.type === 'info',
            'bg-red-50   border border-red-200':   verificationMessage.type === 'error',
          }">
            <div class="flex">
              <CheckCircleIcon v-if="verificationMessage.type === 'success'" class="h-5 w-5 text-green-400 shrink-0" />
              <XCircleIcon     v-if="verificationMessage.type === 'error'"   class="h-5 w-5 text-red-400 shrink-0" />
              <p class="ml-3 text-sm font-medium" :class="{
                'text-green-800': verificationMessage.type === 'success',
                'text-blue-800':  verificationMessage.type === 'info',
                'text-red-800':   verificationMessage.type === 'error',
              }">{{ verificationMessage.text }}</p>
            </div>
          </div>

          <button @click="verifyId" :disabled="isLoading"
            class="w-full bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isLoading ? 'Verifying…' : 'Continue' }}
          </button>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             STUDENT / FACULTY ─ Step 2: Full Registration
        ═══════════════════════════════════════════════════════════════════ -->
        <div v-if="isVerifiedRole && currentStep === 2" class="space-y-4">
          <div class="p-4 bg-green-50 border border-green-200 rounded-md flex gap-3">
            <CheckCircleIcon class="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-green-800">✓ ID Verified!</p>
              <p class="text-sm text-green-700 mt-0.5">{{ fullName }}</p>
              <p class="text-xs text-green-600">{{ course }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input v-model="fullName" type="text" readonly class="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">ID Number</label>
            <input v-model="idNumber" type="text" readonly class="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
          </div>
          <div v-if="course">
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ role === 'faculty' ? 'Department' : 'Course' }}</label>
            <input v-model="course" type="text" readonly class="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input v-model="email" type="email" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" :class="{ 'border-red-500': errors.email }" />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">{{ errors.email }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input v-model="password" type="password" placeholder="At least 8 characters" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" :class="{ 'border-red-500': errors.password }" />
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <input v-model="passwordConfirmation" type="password" @keyup.enter="handleEnter(register)" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" :class="{ 'border-red-500': errors.password_confirmation }" />
            <p v-if="errors.password_confirmation" class="mt-1 text-sm text-red-600">{{ errors.password_confirmation }}</p>
          </div>

          <div class="flex gap-3">
            <button @click="goBack" class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition">Back</button>
            <button @click="register" :disabled="isLoading" class="flex-1 bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isLoading ? 'Creating…' : 'Create Account & Submit' }}
            </button>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             VISITOR ─ Step 1: Quick Register (name + email + password)
        ═══════════════════════════════════════════════════════════════════ -->
        <div v-if="isVisitor && currentStep === 1" class="space-y-4">
          <div class="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            No ID needed! Just enter your name and email to start giving feedback.
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input v-model="fullName" type="text" placeholder="Your name" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500" :class="{ 'border-red-500': errors.name }" />
            <p v-if="errors.name" class="mt-1 text-sm text-red-600">{{ errors.name }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input v-model="email" type="email" placeholder="your@email.com" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500" :class="{ 'border-red-500': errors.email }" />
            <p v-if="errors.email" class="mt-1 text-sm text-red-600">{{ errors.email }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input v-model="password" type="password" placeholder="At least 8 characters" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500" :class="{ 'border-red-500': errors.password }" />
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
            <input v-model="passwordConfirmation" type="password" @keyup.enter="handleEnter(registerVisitor)" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500" :class="{ 'border-red-500': errors.password_confirmation }" />
            <p v-if="errors.password_confirmation" class="mt-1 text-sm text-red-600">{{ errors.password_confirmation }}</p>
          </div>

          <button @click="registerVisitor" :disabled="isLoading"
            class="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
            {{ isLoading ? 'Creating account…' : 'Create Account & Submit' }}
          </button>

          <p class="text-center text-sm text-gray-500">
            Already have an account?
            <button @click="switchToLogin" class="text-amber-700 font-medium hover:underline">Login</button>
          </p>
        </div>

        <!-- ══════════════════════════════════════════════════════════════════
             ALL ROLES ─ Step 3: Login
        ═══════════════════════════════════════════════════════════════════ -->
        <div v-if="currentStep === 3" class="space-y-4">
          <div class="p-4 bg-blue-50 border border-blue-200 rounded-md flex gap-3">
            <CheckCircleIcon class="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p class="text-sm font-medium text-blue-800">Welcome back!</p>
              <p v-if="fullName" class="text-sm text-blue-700 mt-0.5">{{ fullName }}</p>
              <p v-if="idNumber" class="text-xs text-blue-600">ID: {{ idNumber }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input v-model="email" type="email" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input v-model="password" type="password" placeholder="Enter your password" @keyup.enter="handleEnter(login)" class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500" :class="{ 'border-red-500': errors.password }" />
            <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
          </div>

          <div class="flex gap-3">
            <button @click="goBack" class="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition">Back</button>
            <button @click="login" :disabled="isLoading" class="flex-1 bg-green-900 hover:bg-green-800 text-white px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed">
              {{ isLoading ? 'Logging in…' : 'Login & Submit' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
