<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { XMarkIcon, EyeIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
    feedbacks: {
        type: Array,
        default: () => []
    }
});

const searchQuery = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const showViewModal = ref(false);
const selectedFeedback = ref(null);
const displayedFeedbacks = ref(20);
const observer = ref(null);
const loadMoreTrigger = ref(null);

// Filtered feedbacks based on search and date
const filteredFeedbacks = computed(() => {
    if (!props.feedbacks || !Array.isArray(props.feedbacks)) {
        return [];
    }

    return props.feedbacks.filter((feedback) => {
        // Search filter
        const matchSearch = !searchQuery.value ||
            feedback.message?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            feedback.guest?.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            feedback.marker?.label?.toLowerCase().includes(searchQuery.value.toLowerCase());

        // Date filter
        let matchDate = true;
        if (dateFrom.value || dateTo.value) {
            const feedbackDate = new Date(feedback.created_at);
            if (dateFrom.value) {
                matchDate = matchDate && feedbackDate >= new Date(dateFrom.value);
            }
            if (dateTo.value) {
                matchDate = matchDate && feedbackDate <= new Date(dateTo.value);
            }
        }

        return matchSearch && matchDate;
    });
});

// Paginated feedbacks for infinite scroll
const paginatedFeedbacks = computed(() => {
    return filteredFeedbacks.value.slice(0, displayedFeedbacks.value);
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
    return searchQuery.value || dateFrom.value || dateTo.value;
});

// Format date
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Open view modal
const viewFeedback = (feedback) => {
    selectedFeedback.value = feedback;
    showViewModal.value = true;
};

// Close modal
const closeModal = () => {
    showViewModal.value = false;
    selectedFeedback.value = null;
};

// Clear all filters
const clearFilters = () => {
    searchQuery.value = '';
    dateFrom.value = '';
    dateTo.value = '';
};

// Load more feedbacks
const loadMore = () => {
    if (displayedFeedbacks.value < filteredFeedbacks.value.length) {
        displayedFeedbacks.value += 20;
    }
};

// Setup intersection observer for infinite scroll
onMounted(() => {
    observer.value = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting) {
                loadMore();
            }
        },
        { threshold: 0.1 }
    );

    if (loadMoreTrigger.value) {
        observer.value.observe(loadMoreTrigger.value);
    }
});

onBeforeUnmount(() => {
    if (observer.value && loadMoreTrigger.value) {
        observer.value.unobserve(loadMoreTrigger.value);
    }
});

// Reset pagination when filters change
const resetPagination = () => {
    displayedFeedbacks.value = 20;
};

// Watch for filter changes
watch([searchQuery, dateFrom, dateTo], resetPagination);
</script>

<template>
    <AuthenticatedLayout>
        <div class="py-4 max-w-7xl mx-auto sm:px-4 bg-white min-h-screen">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div>
                    <h2 class="text-2xl font-bold text-green-900">Feedback</h2>
                    <p class="mt-1 text-sm text-green-700">View all guest feedback and reviews</p>
                </div>
                <div class="mt-4 sm:mt-0">
                    <span class="text-sm text-green-700 font-medium">
                        {{ filteredFeedbacks.length }} {{ filteredFeedbacks.length === 1 ? 'feedback' : 'feedbacks' }}
                    </span>
                </div>
            </div>

            <!-- Filters -->
            <div class="flex flex-col sm:flex-row gap-3 mb-6">
                <!-- Search -->
                <div class="relative flex-1 max-w-md">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search feedback, guests, or locations..."
                        class="w-full px-4 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        class="absolute right-3 top-2.5 text-green-600 hover:text-green-900 transition-colors"
                    >
                        <XMarkIcon class="w-4 h-4" />
                    </button>
                </div>

                <!-- Date Filters -->
                <div class="flex items-center gap-2">
                    <input
                        type="date"
                        v-model="dateFrom"
                        class="px-3 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                    />
                    <span class="text-green-700 text-sm">to</span>
                    <input
                        type="date"
                        v-model="dateTo"
                        class="px-3 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                    />
                </div>

                <!-- Clear Filters Button -->
                <button
                    v-if="hasActiveFilters"
                    @click="clearFilters"
                    class="px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                >
                    Clear Filters
                </button>
            </div>

            <!-- Masonry Grid -->
            <div v-if="paginatedFeedbacks.length > 0" class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                <div
                    v-for="feedback in paginatedFeedbacks"
                    :key="feedback.id"
                    class="break-inside-avoid bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer group"
                    @click="viewFeedback(feedback)"
                >
                    <!-- Guest Info -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center">
                                <span class="text-sm font-medium text-white">
                                    {{ feedback.guest?.name?.charAt(0).toUpperCase() || 'G' }}
                                </span>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-green-900">{{ feedback.guest?.name || 'Guest' }}</p>
                                <p class="text-xs text-green-700">{{ feedback.guest?.role || 'Visitor' }}</p>
                            </div>
                        </div>
                        <button class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-50 rounded">
                            <EyeIcon class="w-4 h-4 text-green-700" />
                        </button>
                    </div>

                    <!-- Location -->
                    <div class="mb-3">
                        <p class="text-xs font-semibold text-green-900 mb-1">📍 Location</p>
                        <p class="text-sm text-green-800">{{ feedback.marker?.label || 'Unknown Location' }}</p>
                        <p class="text-xs text-green-700">{{ feedback.marker?.type || 'General' }}</p>
                    </div>

                    <!-- Feedback Content -->
                    <div class="mb-3">
                        <p class="text-sm text-green-800 line-clamp-4">{{ feedback.message }}</p>
                    </div>

                    <!-- Date -->
                    <div class="text-xs text-green-700">
                        {{ formatDate(feedback.created_at) }}
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                    <span class="text-2xl">💭</span>
                </div>
                <h3 class="text-lg font-semibold text-green-900 mb-2">No feedback found</h3>
                <p class="text-sm text-green-700">Try adjusting your filters or search query</p>
            </div>

            <!-- Infinite Scroll Trigger -->
            <div
                v-if="paginatedFeedbacks.length < filteredFeedbacks.length"
                ref="loadMoreTrigger"
                class="flex justify-center py-8"
            >
                <div class="animate-spin rounded-full h-8 w-8 border-2 border-green-200 border-t-green-900"></div>
            </div>

            <!-- View Modal with Smooth Transition -->
            <Transition name="modal-fade">
                <div
                    v-if="showViewModal"
                    class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
                    @click="closeModal"
                >
                    <Transition name="modal-scale">
                        <div
                            v-if="showViewModal"
                            class="bg-white rounded-lg shadow-lg w-full max-w-xl max-h-[75vh] overflow-hidden"
                            @click.stop
                        >
                            <!-- Modal Header -->
                            <div class="flex items-center justify-between p-5 border-b border-green-200">
                                <h3 class="text-lg font-semibold text-green-900">Feedback Details</h3>
                                <button
                                    @click="closeModal"
                                    class="text-green-700 hover:text-green-900 transition-colors"
                                >
                                    <XMarkIcon class="w-5 h-5" />
                                </button>
                            </div>

                            <!-- Modal Body -->
                            <div class="p-5 overflow-y-auto max-h-[calc(75vh-140px)] space-y-4">
                                <!-- Guest Info -->
                                <div>
                                    <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Guest</h4>
                                    <div class="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                        <div class="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center">
                                            <span class="text-sm font-medium text-white">
                                                {{ selectedFeedback?.guest?.name?.charAt(0).toUpperCase() || 'G' }}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="font-medium text-green-900 text-sm">{{ selectedFeedback?.guest?.name || 'Guest' }}</p>
                                            <p class="text-xs text-green-700">{{ selectedFeedback?.guest?.role || 'Visitor' }}</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Location Info -->
                                <div>
                                    <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Location</h4>
                                    <div class="p-3 bg-green-50 rounded-lg">
                                        <div class="flex items-start gap-2 mb-2">
                                            <span class="text-lg">📍</span>
                                            <div>
                                                <p class="font-medium text-gray-900 text-sm">{{ selectedFeedback?.marker?.label || 'Unknown' }}</p>
                                                <p class="text-xs text-gray-600">{{ selectedFeedback?.marker?.type || 'General' }}</p>
                                            </div>
                                        </div>
                                        <div class="mt-2 text-xs text-green-700 space-x-2">
                                            <span>Lat: {{ selectedFeedback?.marker?.latitude || 'N/A' }}</span>
                                            <span>•</span>
                                            <span>Lng: {{ selectedFeedback?.marker?.longitude || 'N/A' }}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Feedback Message -->
                                <div>
                                    <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Message</h4>
                                    <div class="p-3 bg-green-50 rounded-lg">
                                        <p class="text-sm text-green-800 whitespace-pre-wrap">{{ selectedFeedback?.message }}</p>
                                    </div>
                                </div>

                                <!-- Timestamp -->
                                <div>
                                    <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Created</h4>
                                    <div class="p-3 bg-green-50 rounded-lg">
                                        <p class="text-sm text-green-800">{{ formatDate(selectedFeedback?.created_at) }}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Modal Footer -->
                            <div class="flex justify-end p-5 border-t border-green-200">
                                <button
                                    @click="closeModal"
                                    class="px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </Transition>
                </div>
            </Transition>
        </div>
    </AuthenticatedLayout>
</template>

<style scoped>
/* Line clamp utility */
.line-clamp-4 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* Modal fade transition */
.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

/* Modal scale transition */
.modal-scale-enter-active,
.modal-scale-leave-active {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.modal-scale-enter-from,
.modal-scale-leave-to {
    transform: scale(0.95) translateY(-20px);
    opacity: 0;
}

/* Smooth transitions */
* {
    transition-property: color, background-color, border-color, box-shadow;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
