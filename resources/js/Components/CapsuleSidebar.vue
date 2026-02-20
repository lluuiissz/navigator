<script setup>
import { ref } from 'vue';
import { Link } from '@inertiajs/vue3';
import {
  UsersIcon,
  HomeIcon,
  ChartBarIcon,
  MapIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
  GlobeAltIcon,
  GlobeEuropeAfricaIcon,
  ChatBubbleBottomCenterTextIcon,
  ChartBarSquareIcon,
  MagnifyingGlassIcon
} from '@heroicons/vue/24/outline';
import { LayoutDashboardIcon, WarehouseIcon } from 'lucide-vue-next';
import { route } from 'ziggy-js';

// Define props
defineProps({
  navigationSections: {
    type: Array,
    required: true
  }
});

// Tooltip state
const tooltipState = ref({
  visible: false,
  text: '',
  top: 0
});

// Icon component mapping
const iconComponents = {
  HomeIcon,
  UsersIcon,
  ChartBarIcon,
  MapIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  DocumentCheckIcon,
  ClipboardDocumentListIcon,
  WarehouseIcon,
  LayoutDashboardIcon,
  GlobeEuropeAfricaIcon,
  ChatBubbleBottomCenterTextIcon,
  ChartBarSquareIcon,
  MagnifyingGlassIcon

};

const getIconComponent = (iconName) => {
  return iconComponents[iconName] || HomeIcon;
};

// Tooltip handlers
const showTooltip = (event, text) => {
  const rect = event.currentTarget.getBoundingClientRect();
  tooltipState.value = {
    visible: true,
    text: text,
    top: rect.top + rect.height / 2
  };
};

const hideTooltip = () => {
  tooltipState.value.visible = false;
};
</script>

<template>
  <!-- Capsule Sidebar -->
  <div class="fixed top-20 left-4 z-40 w-16 rounded-full bg-white dark:bg-gray-800 shadow-2xl overflow-hidden">
    <div class="py-4">
      <nav>
        <!-- Loop through navigation sections -->
        <div
          v-for="(section, sectionIndex) in navigationSections"
          :key="sectionIndex"
          class="mb-2"
        >
          <!-- Section Items (icons only) -->
          <ul class="space-y-1 px-2">
            <li v-for="(item, itemIndex) in section.items" :key="itemIndex">
              <Link
                :href="item.href"
                class="flex items-center justify-center p-3 text-gray-900 rounded-full dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 relative"
                :class="{
                  'bg-gray-100 dark:bg-gray-700': item.routeName && route().current(item.routeName)
                }"
                @mouseenter="showTooltip($event, item.label)"
                @mouseleave="hideTooltip"
              >
                <component
                  :is="getIconComponent(item.icon)"
                  class="h-6 w-6 flex-shrink-0"
                  stroke="currentColor"
                  fill="none"
                />
              </Link>
            </li>
          </ul>

          <!-- Section Divider -->
          <div
            v-if="sectionIndex < navigationSections.length - 1"
            class="mx-4 my-2 border-t border-gray-200 dark:border-gray-700"
          ></div>
        </div>
      </nav>
    </div>
  </div>

  <!-- External Tooltip - positioned outside sidebar container -->
  <Teleport to="body">
    <div
      v-if="tooltipState.visible"
      class="fixed left-20 z-[9999] pointer-events-none transition-opacity duration-200"
      :style="{ top: tooltipState.top + 'px' }"
    >
      <div class="px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg whitespace-nowrap">
        {{ tooltipState.text }}
        <div class="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
      </div>
    </div>
  </Teleport>
</template>
