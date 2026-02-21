<script setup>
import { ref, toRefs } from 'vue';
import { Link } from '@inertiajs/vue3';
import { BxSolidNavigation, AkDashboard, ClBuilding01, BsChatDots, BsFileText, BsMap, BsSearch, BsPersonCircle, BsBoxArrowRight, BsDash, BsClipboardCheck } from '@kalimahapps/vue-icons';
import { route } from 'ziggy-js';
import axios from 'axios';
import { useReactiveStore } from '../store/reactives/reactive';
import Loader from '../Components/loader/Loader.vue';
import { BuildingOffice2Icon } from '@heroicons/vue/24/outline';

const reactive = useReactiveStore();
const { isLoading } = toRefs(reactive);

const message = ref('Processing logout...');
const mobileMenuOpen = ref(false);

const logout = async () => {
  try {
    isLoading.value = true;
    message.value = 'Processing logout...';

    const response = await axios.post(route('logout'));

    message.value = response.data.message || 'Logged out successfully. Redirecting to login page...';

    setTimeout(() => {
      window.location.href = route('login');
    }, 2000);

  } catch (error) {
    console.error('Logout error:', error);
    message.value = 'An error occurred during logout. Please try again.';
    setTimeout(() => {
      isLoading.value = false;
    }, 2000);
  }
};

const navItems = [
  { name: 'Overview', route: 'reports.dashboard', icon: AkDashboard },
  { name: 'Facilities', route: 'facility.get', icon: ClBuilding01 },
  { name: 'Allowlist', route: 'admin.allowlist', icon: BsClipboardCheck },
  { name: 'Feedbacks', route: 'feedback.index', icon: BsChatDots },
  { name: 'Notes', route: 'admin.notes', icon: BsFileText },
  { name: 'Campus Map', route: 'map.get', icon: BsMap },
  { name: 'Search Logs', route: 'logs.index', icon: BsSearch },
];
</script>

<template>
  <div>
    <div class="min-h-screen bg-slate-50">
      <!-- Mobile Header -->
      <div class="lg:hidden fixed top-0 left-0 right-0 z-30 bg-green-900 border-b border-green-800">
        <div class="flex items-center justify-between px-4 py-3">
          <Link :href="route('dashboard')" class="flex items-center gap-2">
            <div class="h-8 w-8 bg-white rounded-full flex items-center justify-center">
              <img src="../../assets/logo.png" alt="ASSCAT Logo" class="h-8 w-8 object-contain"/>
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-bold text-white">ASSCAT</span>
              <span class="text-[10px] font-medium text-green-200">Campus Navigator</span>
            </div>
          </Link>
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="p-2 text-white hover:bg-green-800 rounded-md"
          >
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                :class="{ hidden: mobileMenuOpen, 'inline-flex': !mobileMenuOpen }"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
              <path
                :class="{ hidden: !mobileMenuOpen, 'inline-flex': mobileMenuOpen }"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- Sidebar -->
      <aside
        :class="[
          'fixed top-0 left-0 z-40 h-screen w-64 bg-green-900 border-r border-green-800 transition-transform flex flex-col',
          'lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        ]"
      >
        <!-- Logo -->
        <div class="hidden lg:flex items-center gap-2 px-6 py-5 border-b border-green-800 bg-green-900 flex-shrink-0">
          <div class="h-20 w-20 bg-white rounded-full flex items-center justify-center p-2">
            <img src="../../assets/logo.png" alt="ASSCAT Logo" class="h-full w-full object-contain"/>
          </div>
          <div class="flex flex-col">
            <span class="text-xl font-bold text-white">ASSCAT</span>
            <span class="text-xs font-medium text-green-200">Campus Navigator</span>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto mt-16 lg:mt-0 bg-green-900 scrollbar-thin scrollbar-thumb-green-700 scrollbar-track-green-800 hover:scrollbar-thumb-green-600">
          <Link
            v-for="item in navItems"
            :key="item.route"
            :href="route(item.route)"
            :class="[
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
              route().current(item.route)
                ? 'bg-white text-green-900'
                : 'text-white hover:bg-green-800 hover:text-white'
            ]"
            @click="mobileMenuOpen = false"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.name }}
          </Link>
        </nav>

        <!-- User Section -->
        <div class="border-t border-green-800 bg-green-900 flex-shrink-0">
          <div class="px-4 py-4">
            <div class="flex items-center gap-3 mb-3 px-2 py-2 rounded-lg bg-green-800">
              <BsPersonCircle class="h-8 w-8 text-white" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white truncate">
                  {{ $page.props.auth.user.name }}
                </p>
                <p class="text-xs text-green-200 truncate">
                  {{ $page.props.auth.user.email }}
                </p>
              </div>
            </div>
            <div class="space-y-1">
              <Link
                :href="route('profile.index')"
                class="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-green-800 rounded-lg transition-all duration-200"
                @click="mobileMenuOpen = false"
              >
                <BsPersonCircle class="h-4 w-4" />
                Profile
              </Link>
              <button
                @click="logout"
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-green-800 rounded-lg transition-all duration-200"
              >
                <BsBoxArrowRight class="h-4 w-4" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      <div
        v-if="mobileMenuOpen"
        @click="mobileMenuOpen = false"
        class="fixed inset-0 z-30 bg-gray-900 bg-opacity-50 lg:hidden"
      ></div>

      <!-- Main Content -->
      <div class="lg:pl-64 pt-16 lg:pt-0">
        <!-- Page Heading -->
        <header v-if="$slots.header" class="bg-white shadow">
          <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <slot name="header" />
          </div>
        </header>

        <!-- Page Content -->
        <main>
          <slot />
        </main>
      </div>
    </div>

    <Loader :is-loading="isLoading" :message="message" />
  </div>
</template>

<style scoped>
/* Custom minimalist scrollbar */
nav::-webkit-scrollbar {
  width: 5px;
}

nav::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  transition: background 0.2s ease;
}

nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Firefox scrollbar */
nav {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
}
</style>
