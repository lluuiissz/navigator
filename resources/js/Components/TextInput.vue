<script setup>
import { onMounted, ref } from 'vue';

const model = defineModel({
    type: String,
    required: true,
});

const input = ref(null);

onMounted(() => {
    if (input.value?.hasAttribute('autofocus')) {
        input.value.focus();
    }
});

defineExpose({ focus: () => input.value?.focus() });
</script>

<template>
    <input
        class="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-gray-500 focus:ring-gray-300 focus:outline-none focus:ring-1 dark:bg-gray-900 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white sm:text-sm h-10"
        v-model="model"
        ref="input"
        v-bind="$attrs"
    />
</template>
