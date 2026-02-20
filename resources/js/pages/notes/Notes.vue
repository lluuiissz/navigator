<script setup>
import { computed, toRefs, ref, onMounted, onBeforeUnmount, watch} from 'vue';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { useReactiveStore } from '../../store/reactives/reactive';
import { XMarkIcon, EyeIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
    notes: {
        type: Array,
        default: () => []
    }
});

const reactive = useReactiveStore();
const { searchQuery, dateFrom, dateTo } = toRefs(reactive);

const isLoading = ref(false);
const showViewModal = ref(false);
const selectedNote = ref(null);
const displayedNotes = ref(20);
const observer = ref(null);
const loadMoreTrigger = ref(null);

// Filtered notes based on search and date
const filteredNotes = computed(() => {
    if (!props.notes || !Array.isArray(props.notes)) {
        return [];
    }

    return props.notes.filter((note) => {
        // Search filter
        const matchSearch = !searchQuery.value ||
            note.content?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            note.guest?.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            note.marker?.label?.toLowerCase().includes(searchQuery.value.toLowerCase());

        // Date filter
        let matchDate = true;
        if (dateFrom.value || dateTo.value) {
            const noteDate = new Date(note.created_at);
            if (dateFrom.value) {
                matchDate = matchDate && noteDate >= new Date(dateFrom.value);
            }
            if (dateTo.value) {
                matchDate = matchDate && noteDate <= new Date(dateTo.value);
            }
        }

        return matchSearch && matchDate;
    });
});

// Paginated notes for infinite scroll
const paginatedNotes = computed(() => {
    return filteredNotes.value.slice(0, displayedNotes.value);
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
const viewNote = (note) => {
    selectedNote.value = note;
    showViewModal.value = true;
};

// Close modal
const closeModal = () => {
    showViewModal.value = false;
    selectedNote.value = null;
};

// Clear all filters
const clearFilters = () => {
    searchQuery.value = '';
    dateFrom.value = '';
    dateTo.value = '';
};

// Load more notes
const loadMore = () => {
    if (displayedNotes.value < filteredNotes.value.length) {
        displayedNotes.value += 20;
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
    displayedNotes.value = 20;
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
                    <h2 class="text-2xl font-bold text-gray-900">Notes</h2>
                    <p class="mt-1 text-sm text-gray-600">View all guest notes and feedback</p>
                </div>
                <div class="mt-4 sm:mt-0">
                    <span class="text-sm text-gray-700 font-medium">
                        {{ filteredNotes.length }} {{ filteredNotes.length === 1 ? 'note' : 'notes' }}
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
                        placeholder="Search notes, guests, or locations..."
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        class="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <XMarkIcon class="w-4 h-4" />
                    </button>
                </div>

                <!-- Date Filters -->
                <div class="flex items-center gap-2">
                    <input
                        type="date"
                        v-model="dateFrom"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                    <span class="text-gray-600 text-sm">to</span>
                    <input
                        type="date"
                        v-model="dateTo"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                    />
                </div>

                <!-- Clear Filters Button -->
                <button
                    v-if="hasActiveFilters"
                    @click="clearFilters"
                    class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                    Clear Filters
                </button>
            </div>

            <!-- Masonry Grid -->
            <div v-if="paginatedNotes.length > 0" class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                <div
                    v-for="note in paginatedNotes"
                    :key="note.id"
                    class="break-inside-avoid bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg hover:border-gray-300 transition-all duration-200 cursor-pointer group"
                    @click="viewNote(note)"
                >
                    <!-- Guest Info -->
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center">
                                <span class="text-sm font-medium text-white">
                                    {{ note.guest?.name?.charAt(0).toUpperCase() || 'G' }}
                                </span>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-gray-900">{{ note.guest?.name || 'Guest' }}</p>
                                <p class="text-xs text-gray-600">{{ note.guest?.role || 'Visitor' }}</p>
                            </div>
                        </div>
                        <button class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
                            <EyeIcon class="w-4 h-4 text-gray-700" />
                        </button>
                    </div>

                    <!-- Location -->
                    <div class="mb-3">
                        <p class="text-xs font-semibold text-gray-900 mb-1">📍 Location</p>
                        <p class="text-sm text-gray-700">{{ note.marker?.label || 'Unknown Location' }}</p>
                        <p class="text-xs text-gray-600">{{ note.marker?.type || 'General' }}</p>
                    </div>

                    <!-- Note Content -->
                    <div class="mb-3">
                        <p class="text-sm text-gray-700 line-clamp-4">{{ note.content }}</p>
                    </div>

                    <!-- Date -->
                    <div class="text-xs text-gray-600">
                        {{ formatDate(note.created_at) }}
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                    <span class="text-2xl">📝</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">No notes found</h3>
                <p class="text-sm text-gray-600">Try adjusting your filters or search query</p>
            </div>

            <!-- Infinite Scroll Trigger -->
            <div
                v-if="paginatedNotes.length < filteredNotes.length"
                ref="loadMoreTrigger"
                class="flex justify-center py-8"
            >
                <div class="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-gray-900"></div>
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
                            <div class="flex items-center justify-between p-5 border-b border-gray-200">
                                <h3 class="text-lg font-semibold text-gray-900">Note Details</h3>
                                <button
                                    @click="closeModal"
                                    class="text-gray-600 hover:text-gray-900 transition-colors"
                                >
                                    <XMarkIcon class="w-5 h-5" />
                                </button>
                            </div>

                            <!-- Modal Body -->
                            <div class="p-5 overflow-y-auto max-h-[calc(75vh-140px)] space-y-4">
                                <!-- Guest Info -->
                                <div>
                                    <h4 class="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">Guest</h4>
                                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div class="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center">
                                            <span class="text-sm font-medium text-white">
                                                {{ selectedNote?.guest?.name?.charAt(0).toUpperCase() || 'G' }}
                                            </span>
                                        </div>
                                        <div>
                                            <p class="font-medium text-gray-900 text-sm">{{ selectedNote?.guest?.name || 'Guest' }}</p>
                                            <p class="text-xs text-gray-600">{{ selectedNote?.guest?.role || 'Visitor' }}</p>
                                        </div>
                                    </div>
                                </div>

                                <!-- Location Info -->
                                <div>
                                    <h4 class="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">Location</h4>
                                    <div class="p-3 bg-gray-50 rounded-lg">
                                        <div class="flex items-start gap-2 mb-2">
                                            <span class="text-lg">📍</span>
                                            <div>
                                                <p class="font-medium text-gray-900 text-sm">{{ selectedNote?.marker?.label || 'Unknown' }}</p>
                                                <p class="text-xs text-gray-600">{{ selectedNote?.marker?.type || 'General' }}</p>
                                            </div>
                                        </div>
                                        <div class="mt-2 text-xs text-gray-600 space-x-2">
                                            <span>Lat: {{ selectedNote?.marker?.latitude || 'N/A' }}</span>
                                            <span>•</span>
                                            <span>Lng: {{ selectedNote?.marker?.longitude || 'N/A' }}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Note Content -->
                                <div>
                                    <h4 class="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">Content</h4>
                                    <div class="p-3 bg-gray-50 rounded-lg">
                                        <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ selectedNote?.content }}</p>
                                    </div>
                                </div>

                                <!-- Timestamp -->
                                <div>
                                    <h4 class="text-xs font-semibold text-gray-900 mb-2 uppercase tracking-wide">Created</h4>
                                    <div class="p-3 bg-gray-50 rounded-lg">
                                        <p class="text-sm text-gray-700">{{ formatDate(selectedNote?.created_at) }}</p>
                                    </div>
                                </div>
                            </div>

                            <!-- Modal Footer -->
                            <div class="flex justify-end p-5 border-t border-gray-200">
                                <button
                                    @click="closeModal"
                                    class="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
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
