<script setup>
import { PixelSpinner,  FulfillingSquareSpinner, AtomSpinner} from 'epic-spinners';

defineProps({
  isLoading: {
    type: Boolean,
    required: true
  },
  message: {
    type: String,
    default: 'Processing...'
  }
});
</script>

<template>
  <!-- Minimal Loader Overlay -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    leave-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isLoading"
      class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/50"
    >
      <!-- Simple Loader Card -->
      <div class="flex flex-col items-center space-y-4 bg-gray-900/60 px-8 py-6 rounded-lg">
        <!-- Spinner -->
        <PixelSpinner
          :animation-duration="2000"
          color="#10b981"
          :size="70"
        />

        <!-- Message -->
        <p class="text-green-50 text-base">
          {{ message }}
        </p>
      </div>
    </div>
  </Transition>
</template>
