<script setup>
import { ref, computed } from 'vue';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import {
    DocumentChartBarIcon,
    PlusIcon,
    TrashIcon,
    EyeIcon,
    XMarkIcon,
    ArrowPathIcon,
    CalendarIcon,
    ChartBarIcon,
    ChartPieIcon,
    HomeModernIcon,
    ChatBubbleLeftEllipsisIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon
} from '@heroicons/vue/24/outline';
import { router } from '@inertiajs/vue3';
import { useToast } from 'vue-toastification';
import axios from 'axios';


const props = defineProps({
    reports: {
        type: Object,
        default: () => ({})
    }
});

const toast = useToast();
const showModal = ref(false);
const showDeleteModal = ref(false);
const reportToDelete = ref(null);
const reportType = ref('usage');
const periodFrom = ref('');
const periodTo = ref('');
const customTitle = ref('');
const isGenerating = ref(false);
const isDeleting = ref(false);

const reportTypes = [
    { value: 'usage', label: 'Usage Report', description: 'System usage statistics and trends' },
    { value: 'feedback', label: 'Feedback Report', description: 'Guest feedback analysis' },
    { value: 'facility', label: 'Facility Report', description: 'Campus facilities inventory' },
    { value: 'search', label: 'Search Trends', description: 'Search behavior analysis' }
];

// Get current report type details
const currentReportType = computed(() => {
    return reportTypes.find(rt => rt.value === reportType.value);
});

// Get type badge styles
const getTypeBadgeStyles = (type) => {
    const styles = {
        usage: { bg: 'bg-green-50', text: 'text-green-900', icon: 'text-green-700' },
        feedback: { bg: 'bg-green-50', text: 'text-green-900', icon: 'text-green-700' },
        facility: { bg: 'bg-green-50', text: 'text-green-900', icon: 'text-green-700' },
        search: { bg: 'bg-green-50', text: 'text-green-900', icon: 'text-green-700' }
    };
    return styles[type] || styles.usage;
};

// Get type icon component
const getTypeIcon = (type) => {
  const icons = {
    usage: ChartPieIcon,
    feedback: ChatBubbleLeftEllipsisIcon,
    facility: HomeModernIcon,
    search: MagnifyingGlassIcon
  };
  return icons[type] || DocumentChartBarIcon;
};

// Format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// Format time
const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Generate report
const generateReport = async () => {
    if (!periodFrom.value || !periodTo.value) {
        if (reportType.value === 'facility') {
            // Facility report doesn't need dates
        } else {
            toast.error('Please select both start and end dates');
            return;
        }
    }

    isGenerating.value = true;

    try {
        const endpointMap = {
            'usage': '/reports/usage',
            'feedback': '/reports/feedback',
            'facility': '/reports/facility',
            'search': '/reports/search-trends'
        };

        const endpoint = endpointMap[reportType.value];

        const payload = {
            title: customTitle.value || undefined
        };

        if (reportType.value !== 'facility') {
            payload.period_from = periodFrom.value;
            payload.period_to = periodTo.value;
        }

        const response = await axios.post(endpoint, payload);
        toast.success(response.data.message);

        showModal.value = false;
        periodFrom.value = '';
        periodTo.value = '';
        customTitle.value = '';
        reportType.value = 'usage';

        // Reload reports
        router.reload();
    } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to generate report');
    } finally {
        isGenerating.value = false;
    }
};

// Open delete confirmation modal
const confirmDelete = (report) => {
    reportToDelete.value = report;
    showDeleteModal.value = true;
};

// Delete report
const deleteReport = async () => {
    if (!reportToDelete.value) return;

    isDeleting.value = true;

    try {
        await axios.delete(`/reports/${reportToDelete.value.id}`);
        toast.success('Report deleted successfully');
        showDeleteModal.value = false;
        reportToDelete.value = null;
        router.reload();
    } catch (error) {
        toast.error('Failed to delete report');
    } finally {
        isDeleting.value = false;
    }
};

// Cancel delete
const cancelDelete = () => {
    showDeleteModal.value = false;
    reportToDelete.value = null;
};

// Open report
const openReport = (reportId) => {
    router.visit(`/reports/${reportId}`);
};
</script>

<template>
    <AuthenticatedLayout>
        <div class="py-4 max-w-7xl mx-auto sm:px-4 bg-white min-h-screen">
            <!-- Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-green-900">Reports</h2>
                    <p class="mt-1 text-sm text-green-700">Generate and manage system reports</p>
                </div>
                <button
                    @click="showModal = true"
                    class="mt-4 sm:mt-0 flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-900 hover:bg-green-800 rounded-lg transition"
                >
                    <PlusIcon class="h-4 w-4" />
                    <span>Generate Report</span>
                </button>
            </div>

            <!-- Reports Grid -->
            <div v-if="reports.data?.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                    v-for="report in reports.data"
                    :key="report.id"
                    class="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-300 flex flex-col group"
                >
                    <!-- Card Header with Type Badge -->
                    <div class="p-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-white">
                        <div class="flex items-start justify-between gap-3 mb-3">
                            <component
                                :is="getTypeIcon(report.type)"
                                class="w-8 h-8"
                                :class="getTypeBadgeStyles(report.type).icon"
                            />
                            <span
                                :class="[
                                    'inline-flex px-2.5 py-1 text-xs font-semibold rounded-full capitalize',
                                    getTypeBadgeStyles(report.type).bg,
                                    getTypeBadgeStyles(report.type).text
                                ]"
                            >
                                {{ report.type }}
                            </span>
                        </div>
                        <h3 class="text-sm font-semibold text-green-900 line-clamp-2 group-hover:text-green-700">
                            {{ report.title }}
                        </h3>
                    </div>

                    <!-- Card Body -->
                    <div class="flex-1 p-4">
                        <p class="text-xs text-green-700 line-clamp-2 mb-4">
                            {{ report.description }}
                        </p>

                        <!-- Date Info -->
                        <div class="space-y-2 mb-4">
                            <div v-if="report.period_from" class="flex items-center gap-2 text-xs text-green-700">
                                <CalendarIcon class="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                                <span class="truncate">
                                    {{ formatDate(report.period_from) }} to {{ formatDate(report.period_to) }}
                                </span>
                            </div>
                            <div class="flex items-center gap-2 text-xs text-green-600">
                                <CalendarIcon class="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                                <span class="truncate">{{ formatDate(report.created_at) }} {{ formatTime(report.created_at) }}</span>
                            </div>
                        </div>

                        <!-- Status Badge -->
                        <div class="mb-4">
                            <span
                                class="inline-flex px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-700 capitalize"
                            >
                                {{ report.status }}
                            </span>
                        </div>
                    </div>

                    <!-- Card Footer with Actions -->
                    <div class="p-4 border-t border-green-100 bg-green-50 flex gap-2">
                        <button
                            @click="openReport(report.id)"
                            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition"
                        >
                            <EyeIcon class="h-4 w-4" />
                            <span>View</span>
                        </button>
                        <button
                            @click="confirmDelete(report)"
                            class="px-3 py-2 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                        >
                            <TrashIcon class="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Empty State -->
            <div v-else class="flex flex-col items-center justify-center py-16">
                <DocumentChartBarIcon class="h-12 w-12 text-green-300 mb-4" />
                <h3 class="text-lg font-semibold text-green-900 mb-2">No reports yet</h3>
                <p class="text-sm text-green-700 mb-6">Generate your first report to get started</p>
                <button
                    @click="showModal = true"
                    class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition"
                >
                    <PlusIcon class="h-4 w-4" />
                    Generate Report
                </button>
            </div>
        </div>

        <!-- Generate Report Modal -->
        <Transition name="modal-fade">
            <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="showModal = false">
                <Transition name="modal-scale">
                    <div v-if="showModal" class="bg-white rounded-lg shadow-lg w-full max-w-md" @click.stop>
                        <!-- Modal Header -->
                        <div class="p-5 border-b border-green-200 flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-green-900">Generate Report</h3>
                            <button @click="showModal = false" class="text-green-700 hover:text-green-900">
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Modal Body -->
                        <form @submit.prevent="generateReport" class="p-5 space-y-4">
                            <!-- Report Type Selection -->
                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-2">Report Type</label>
                                <select
                                    v-model="reportType"
                                    class="w-full px-4 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                >
                                    <option v-for="type in reportTypes" :key="type.value" :value="type.value">
                                        {{ type.label }}
                                    </option>
                                </select>
                                <p class="text-xs text-green-700 mt-1">{{ currentReportType?.description }}</p>
                            </div>

                            <!-- Date Range (if not facility) -->
                            <div v-if="reportType !== 'facility'" class="space-y-2">
                                <label class="block text-sm font-medium text-green-900">Period</label>
                                <div class="flex gap-2">
                                    <input
                                        v-model="periodFrom"
                                        type="date"
                                        class="flex-1 px-4 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                    />
                                    <input
                                        v-model="periodTo"
                                        type="date"
                                        class="flex-1 px-4 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                    />
                                </div>
                            </div>

                            <!-- Custom Title -->
                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-2">Title (Optional)</label>
                                <input
                                    v-model="customTitle"
                                    type="text"
                                    placeholder="Custom report title"
                                    class="w-full px-4 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>
                        </form>

                        <!-- Modal Footer -->
                        <div class="p-5 border-t border-green-200 flex gap-3 justify-end">
                            <button
                                @click="showModal = false"
                                class="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 hover:bg-green-50 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                @click="generateReport"
                                :disabled="isGenerating"
                                class="px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                <ArrowPathIcon v-if="isGenerating" class="h-4 w-4 animate-spin" />
                                <span>{{ isGenerating ? 'Generating...' : 'Generate' }}</span>
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>

        <!-- Delete Confirmation Modal -->
        <Transition name="modal-fade">
            <div v-if="showDeleteModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="cancelDelete">
                <Transition name="modal-scale">
                    <div v-if="showDeleteModal" class="bg-white rounded-lg shadow-lg w-full max-w-md" @click.stop>
                        <!-- Modal Header -->
                        <div class="p-6">
                            <div class="flex items-center gap-4 mb-4">
                                <div class="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                                    <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 class="text-lg font-semibold text-green-900">Delete Report</h3>
                                    <p class="text-sm text-green-700 mt-1">This action cannot be undone</p>
                                </div>
                            </div>

                            <!-- Report Details -->
                            <div v-if="reportToDelete" class="bg-green-50 rounded-lg p-4 mb-4">
                                <p class="text-sm font-medium text-green-900 mb-1">{{ reportToDelete.title }}</p>
                                <p class="text-xs text-green-700">{{ reportToDelete.description }}</p>
                            </div>

                            <p class="text-sm text-green-800">
                                Are you sure you want to delete this report? All data associated with this report will be permanently removed.
                            </p>
                        </div>

                        <!-- Modal Footer -->
                        <div class="p-6 border-t border-green-200 flex gap-3 justify-end">
                            <button
                                @click="cancelDelete"
                                :disabled="isDeleting"
                                class="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                @click="deleteReport"
                                :disabled="isDeleting"
                                class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                <ArrowPathIcon v-if="isDeleting" class="h-4 w-4 animate-spin" />
                                <span>{{ isDeleting ? 'Deleting...' : 'Delete Report' }}</span>
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </AuthenticatedLayout>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
}

.modal-scale-enter-from,
.modal-scale-leave-to {
    transform: scale(0.95) translateY(-20px);
    opacity: 0;
}

.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
