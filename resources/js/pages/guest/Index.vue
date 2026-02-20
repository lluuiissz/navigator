<script setup>
import GuestMap from '../../Components/map/GuestMap.vue';
import { Head } from '@inertiajs/vue3';
import GuestMapV1 from '../../Components/map/GuestMapV1.vue';
import GuestMapV2 from '../../Components/map/GuestMapV2.vue';


const props = defineProps({
  facilities: {
    type: Array,
    default: () => []
  },
  notes: {
    type: Array,
    default: () => []
  },
  polygons: {
    type: Array,
    default: () => []
  }
});

</script>

<template>
  <div>
    <div class="w-full h-screen overflow-hidden">
      <GuestMapV2 :facilities="facilities" :notes="notes" :polygons="polygons" />
    </div>
  </div>
</template>
