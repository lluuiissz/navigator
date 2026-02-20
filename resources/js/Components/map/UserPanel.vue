<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'
import {
  UserCircleIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
} from '@heroicons/vue/24/outline'
import { useToast } from 'vue-toastification'
import axios from 'axios'

const page    = usePage()
const toast   = useToast()
const isOpen  = ref(false)
const isLoggingOut = ref(false)
const activities   = ref([])
const isLoadingAct = ref(false)

const user = computed(() => page.props.auth?.user)

const roleLabel = computed(() => {
  const r = user.value?.role
  if (r === 'faculty')  return { text: 'Faculty',  emoji: '👨‍🏫', cls: 'bg-blue-100 text-blue-800' }
  if (r === 'visitor')  return { text: 'Visitor',  emoji: '👤',  cls: 'bg-amber-100 text-amber-800' }
  return                       { text: 'Student',  emoji: '🎓',  cls: 'bg-green-100 text-green-800' }
})

const initials = computed(() => {
  const name = user.value?.name || ''
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
})

const toggle = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && activities.value.length === 0) {
    await loadActivities()
  }
}

const loadActivities = async () => {
  isLoadingAct.value = true
  try {
    const res = await axios.get('/user/activity')
    activities.value = res.data.activities || []
  } catch (e) {
    console.error('Failed to load activities', e)
  } finally {
    isLoadingAct.value = false
  }
}

const logout = async () => {
  if (!confirm('Are you sure you want to logout?')) return
  isLoggingOut.value = true
  try {
    await axios.post('/logout')
    toast.success('Logged out successfully')
    setTimeout(() => window.location.reload(), 600)
  } catch (e) {
    toast.error('Logout failed. Please try again.')
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="relative z-30">
    <!-- Trigger button -->
    <button
      @click="toggle"
      class="flex items-center gap-2 bg-white shadow-lg rounded-full pl-1 pr-3 py-1
             border border-gray-200 hover:shadow-xl transition-all duration-200 select-none"
    >
      <!-- Avatar circle -->
      <div class="w-8 h-8 rounded-full bg-green-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
        {{ initials }}
      </div>
      <div class="text-left leading-tight hidden sm:block">
        <p class="text-xs font-semibold text-gray-800 max-w-[120px] truncate">{{ user?.name }}</p>
        <p class="text-[10px] text-gray-500">{{ roleLabel.emoji }} {{ roleLabel.text }}</p>
      </div>
      <ChevronDownIcon v-if="!isOpen" class="w-4 h-4 text-gray-400" />
      <ChevronUpIcon   v-else         class="w-4 h-4 text-gray-400" />
    </button>

    <!-- Dropdown panel -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 scale-95 translate-y-1"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-95 translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      >
        <!-- User info header -->
        <div class="bg-gradient-to-br from-green-900 to-green-700 px-4 py-4 text-white">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              {{ initials }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-semibold truncate">{{ user?.name }}</p>
              <p class="text-green-200 text-xs truncate">{{ user?.email }}</p>
              <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1', roleLabel.cls]">
                {{ roleLabel.emoji }} {{ roleLabel.text }}
              </span>
            </div>
          </div>
          <p v-if="user?.id_number" class="text-green-300 text-xs mt-2">
            ID: {{ user.id_number }}
          </p>
        </div>

        <!-- Recent activities -->
        <div class="px-4 py-3 border-b border-gray-100">
          <div class="flex items-center gap-2 mb-3">
            <ClockIcon class="w-4 h-4 text-gray-500" />
            <h3 class="text-sm font-semibold text-gray-700">Recent Feedback</h3>
          </div>

          <!-- Loading -->
          <div v-if="isLoadingAct" class="flex justify-center py-4">
            <div class="w-5 h-5 border-2 border-green-900 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <!-- Empty -->
          <div v-else-if="activities.length === 0" class="text-center py-4">
            <ChatBubbleLeftRightIcon class="w-8 h-8 text-gray-300 mx-auto mb-1" />
            <p class="text-xs text-gray-400">No feedback submitted yet</p>
          </div>

          <!-- Activity list -->
          <ul v-else class="space-y-2 max-h-48 overflow-y-auto">
            <li
              v-for="item in activities"
              :key="item.id"
              class="flex gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition"
            >
              <ChatBubbleLeftRightIcon class="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium text-gray-800 truncate">{{ item.facility_name }}</p>
                <p class="text-xs text-gray-500 truncate italic">"{{ item.message }}"</p>
                <p class="text-[10px] text-gray-400 mt-0.5">{{ item.created_at }}</p>
              </div>
            </li>
          </ul>

          <!-- Refresh -->
          <button
            @click="loadActivities"
            class="w-full mt-2 text-xs text-green-700 hover:text-green-900 font-medium py-1 transition"
          >
            ↻ Refresh
          </button>
        </div>

        <!-- Logout -->
        <div class="px-4 py-3">
          <button
            @click="logout"
            :disabled="isLoggingOut"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl
                   bg-red-50 hover:bg-red-100 text-red-700 font-medium text-sm
                   transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <!-- logout icon (arrow right out of door) -->
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M18 12H9m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ isLoggingOut ? 'Logging out…' : 'Logout' }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Backdrop -->
    <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-[-1]" />
  </div>
</template>
