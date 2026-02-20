<script setup>
import { ref, computed } from 'vue';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { router } from '@inertiajs/vue3';
import { MagnifyingGlassIcon, ArrowDownTrayIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
    feedbacks: Object,
    courses: Array,
    filters: Object
});

const searchQuery = ref(props.filters?.search || '');
const courseFilter = ref(props.filters?.course || 'all');
const dateFrom = ref(props.filters?.date_from || '');
const dateTo = ref(props.filters?.date_to || '');

// Apply filters
const applyFilters = () => {
    router.get('/admin/feedback', {
        search: searchQuery.value,
        course: courseFilter.value !== 'all' ? courseFilter.value : null,
        date_from: dateFrom.value || null,
        date_to: dateTo.value || null
    }, {
        preserveState: true
    });
};

// Export to CSV
const exportCSV = () => {
    const params = new URLSearchParams({
        search: searchQuery.value,
        course: courseFilter.value !== 'all' ? courseFilter.value : '',
        date_from: dateFrom.value || '',
        date_to: dateTo.value || ''
    });
    window.location.href = `/admin/feedback/export?${params.toString()}`;
};

// Format date
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Clear filters
const clearFilters = () => {
    searchQuery.value = '';
    courseFilter.value = 'all';
    dateFrom.value = '';
    dateTo.value = '';
    applyFilters();
};

const hasActiveFilters = computed(() => {
    return searchQuery.value || courseFilter.value !== 'all' || dateFrom.value || dateTo.value;
});
</script>

<template>
    <AuthenticatedLayout>
        <div class="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Header -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-green-900">Recent Feedback</h2>
                <p class="mt-1 text-sm text-green-700">View all student feedback with details</p>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <!-- Search -->
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search by ID, name, or message..."
                        @keyup.enter="applyFilters"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />

                    <!-- Course Filter -->
                    <select
                        v-model="courseFilter"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                        <option value="all">All Courses</option>
                        <option v-for="course in courses" :key="course" :value="course">{{ course }}</option>
                    </select>

                    <!-- Date From -->
                    <input
                        v-model="dateFrom"
                        type="date"
                        placeholder="From Date"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />

                    <!-- Date To -->
                    <input
                        v-model="dateTo"
                        type="date"
                        placeholder="To Date"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-2">
                    <button
                        @click="applyFilters"
                        class="px-4 py-2 bg-green-900 text-white rounded-lg font-medium hover:bg-green-800 flex items-center gap-2"
                    >
                        <MagnifyingGlassIcon class="w-5 h-5" />
                        Search
                    </button>
                    <button
                        v-if="hasActiveFilters"
                        @click="clearFilters"
                        class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                    >
                        Clear Filters
                    </button>
                    <button
                        @click="exportCSV"
                        class="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
                    >
                        <ArrowDownTrayIcon class="w-5 h-5" />
                        Export CSV
                    </button>
                </div>
            </div>

            <!-- Feedback Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Number</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nickname</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            <tr v-for="feedback in feedbacks.data" :key="feedback.id" class="hover:bg-gray-50">
                                <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {{ feedback.id_number || 'N/A' }}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {{ feedback.nickname || 'Guest' }}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {{ feedback.full_name || 'N/A' }}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {{ feedback.course || 'N/A' }}
                                </td>
                                <td class="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">
                                    {{ feedback.message }}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                    {{ feedback.marker?.label || 'Unknown' }}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                    {{ formatDate(feedback.created_at) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Empty State -->
                <div v-if="!feedbacks.data || feedbacks.data.length === 0" class="text-center py-12">
                    <p class="text-gray-500">No feedback found</p>
                </div>

                <!-- Pagination -->
                <div v-if="feedbacks.data && feedbacks.data.length > 0" class="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-700">
                            Showing {{ feedbacks.from }} to {{ feedbacks.to }} of {{ feedbacks.total }} results
                        </div>
                        <div class="flex gap-2">
                            <a
                                v-for="link in feedbacks.links"
                                :key="link.label"
                                :href="link.url"
                                v-html="link.label"
                                :class="[
                                    'px-3 py-1 rounded',
                                    link.active ? 'bg-green-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
                                    !link.url ? 'opacity-50 cursor-not-allowed' : ''
                                ]"
                            ></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
