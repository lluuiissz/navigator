<script setup>
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { ref, computed } from 'vue';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    ArrowPathIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import { router } from '@inertiajs/vue3';

const props = defineProps({
    searchLogs: {
        type: Array,
        default: () => [],
    },
    pagination: {
        type: Object,
        default: () => ({
            current_page: 1,
            last_page: 1,
            total: 0,
            per_page: 15,
            from: 1,
            to: 1
        })
    }
});

const searchQuery = ref('');
const dateFrom = ref('');
const dateTo = ref('');
const loading = ref(false);
const showModal = ref(false);
const selectedLog = ref(null);
const exportFormat = ref('json'); // json or table

// Filter logs based on search query and dates (client-side for display)
const filteredLogs = computed(() => {
    let filtered = props.searchLogs;

    // Search filter
    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(log =>
            log.query?.toLowerCase().includes(query) ||
            log.guest?.name?.toLowerCase().includes(query)
        );
    }

    // Date filter
    if (dateFrom.value || dateTo.value) {
        filtered = filtered.filter(log => {
            const logDate = new Date(log.search_at);
            if (dateFrom.value) {
                if (logDate < new Date(dateFrom.value)) return false;
            }
            if (dateTo.value) {
                const endOfDay = new Date(dateTo.value);
                endOfDay.setHours(23, 59, 59, 999);
                if (logDate > endOfDay) return false;
            }
            return true;
        });
    }

    return filtered;
});

// Check if filters are active
const hasActiveFilters = computed(() => {
    return searchQuery.value || dateFrom.value || dateTo.value;
});

// Calculate statistics
const stats = computed(() => {
    return {
        total: filteredLogs.value.length,
        uniqueQueries: new Set(filteredLogs.value.map(l => l.query)).size,
        activeGuests: new Set(filteredLogs.value.map(l => l.guest_id)).size
    };
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

// Open modal
const openModal = (log) => {
    selectedLog.value = log;
    showModal.value = true;
};

// Close modal
const closeModal = () => {
    showModal.value = false;
    selectedLog.value = null;
};

// Export single log as JSON
const exportSingleJSON = () => {
    if (!selectedLog.value) return;

    const data = {
        id: selectedLog.value.id,
        guest: {
            id: selectedLog.value.guest_id,
            name: selectedLog.value.guest?.name || 'Unknown'
        },
        query: selectedLog.value.query,
        searchedAt: selectedLog.value.search_at,
        createdAt: selectedLog.value.created_at
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `search-log-${selectedLog.value.id}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
};

// Export single log as PDF
const exportSinglePDF = () => {
    if (!selectedLog.value) return;

    const data = {
        id: selectedLog.value.id,
        guest: {
            id: selectedLog.value.guest_id,
            name: selectedLog.value.guest?.name || 'Unknown'
        },
        query: selectedLog.value.query,
        searchedAt: selectedLog.value.search_at,
        createdAt: selectedLog.value.created_at
    };

    const jsonString = JSON.stringify(data, null, 2);

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
        <html>
            <head>
                <title>Search Log ${selectedLog.value.id}</title>
                <style>
                    body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
                    pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 4px; }
                    h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <h2>Search Log Details</h2>
                <pre>${jsonString}</pre>
            </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
};

// Export all/filtered logs as PDF
const exportAllAsPDF = (useFiltered = true) => {
    const logsToExport = useFiltered ? filteredLogs.value : props.searchLogs;

    if (logsToExport.length === 0) {
        alert('No logs to export');
        return;
    }

    const timestamp = new Date().toLocaleString();
    const filterInfo = useFiltered ? 'Filtered' : 'All';

    if (exportFormat.value === 'json') {
        // JSON format
        const data = logsToExport.map(log => ({
            id: log.id,
            guest: {
                id: log.guest_id,
                name: log.guest?.name || 'Unknown'
            },
            query: log.query,
            searchedAt: log.search_at,
            createdAt: log.created_at
        }));

        const jsonString = JSON.stringify(data, null, 2);

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Search Logs Export - ${filterInfo}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; color: #333; }
                        pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: 15px; border-radius: 4px; font-size: 11px; }
                        h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 10px; }
                        .info { font-size: 12px; color: #666; margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h2>Search Logs Export (${filterInfo})</h2>
                    <div class="info">
                        <p><strong>Total Records:</strong> ${logsToExport.length}</p>
                        <p><strong>Export Date:</strong> ${timestamp}</p>
                        ${useFiltered && hasActiveFilters.value ? `
                            <p><strong>Filters Applied:</strong> Yes</p>
                            ${searchQuery.value ? `<p><strong>Search Query:</strong> ${searchQuery.value}</p>` : ''}
                            ${dateFrom.value ? `<p><strong>Date From:</strong> ${dateFrom.value}</p>` : ''}
                            ${dateTo.value ? `<p><strong>Date To:</strong> ${dateTo.value}</p>` : ''}
                        ` : '<p><strong>Filters Applied:</strong> No (All logs)</p>'}
                    </div>
                    <pre>${jsonString}</pre>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    } else {
        // Table format
        const rows = logsToExport.map(log => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${log.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${log.guest?.name || 'Unknown'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${log.query}</td>
                <td style="padding: 10px; border-bottom: 1px solid #ddd;">${formatDate(log.search_at)}</td>
            </tr>
        `).join('');

        const printWindow = window.open('', '', 'height=600,width=900');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Search Logs Export - ${filterInfo}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                        h2 { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th { background-color: #f5f5f5; padding: 12px; text-align: left; font-weight: bold; border-bottom: 2px solid #333; }
                        td { padding: 10px; border-bottom: 1px solid #ddd; }
                        .info { font-size: 12px; color: #666; margin-bottom: 15px; }
                    </style>
                </head>
                <body>
                    <h2>Search Logs Export (${filterInfo})</h2>
                    <div class="info">
                        <p><strong>Total Records:</strong> ${logsToExport.length}</p>
                        <p><strong>Export Date:</strong> ${timestamp}</p>
                        ${useFiltered && hasActiveFilters.value ? `
                            <p><strong>Filters Applied:</strong> Yes</p>
                            ${searchQuery.value ? `<p><strong>Search Query:</strong> ${searchQuery.value}</p>` : ''}
                            ${dateFrom.value ? `<p><strong>Date From:</strong> ${dateFrom.value}</p>` : ''}
                            ${dateTo.value ? `<p><strong>Date To:</strong> ${dateTo.value}</p>` : ''}
                        ` : '<p><strong>Filters Applied:</strong> No (All logs)</p>'}
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Guest Name</th>
                                <th>Query</th>
                                <th>Search Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
};

// Refresh data
const refreshData = () => {
    loading.value = true;
    router.reload({
        preserveState: true,
        onFinish: () => { loading.value = false; }
    });
};

// Handle page change
const handlePageChange = (page) => {
    router.get('/search-logs', { page }, {
        preserveState: true,
        preserveScroll: true
    });
};

// Clear filters
const clearFilters = () => {
    searchQuery.value = '';
    dateFrom.value = '';
    dateTo.value = '';
};

// Compute page numbers for pagination
const pageNumbers = computed(() => {
    const current = props.pagination.current_page;
    const last = props.pagination.last_page;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= last; i++) {
        if (i === 1 || i === last || (i >= current - delta && i <= current + delta)) {
            range.push(i);
        }
    }

    let prev = 0;
    for (let i of range) {
        if (prev) {
            if (i - prev === 2) {
                rangeWithDots.push(prev + 1);
            } else if (i - prev !== 1) {
                rangeWithDots.push('...');
            }
        }
        rangeWithDots.push(i);
        prev = i;
    }

    return rangeWithDots;
});
</script>

<template>
    <AuthenticatedLayout>
        <div class="py-4 max-w-7xl mx-auto sm:px-4 bg-white min-h-screen">
            <!-- Header -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-green-900">Search Logs</h2>
                <p class="mt-1 text-sm text-green-700">Guest search activity</p>
            </div>

            <!-- Summaries -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                <div class="bg-white border border-green-200 rounded-lg p-4">
                    <p class="text-xs text-green-700 uppercase tracking-wide font-semibold mb-1">Total Searches</p>
                    <p class="text-3xl font-bold text-green-900">{{ stats.total }}</p>
                </div>
                <div class="bg-white border border-green-200 rounded-lg p-4">
                    <p class="text-xs text-green-700 uppercase tracking-wide font-semibold mb-1">Unique Queries</p>
                    <p class="text-3xl font-bold text-green-900">{{ stats.uniqueQueries }}</p>
                </div>
                <div class="bg-white border border-green-200 rounded-lg p-4">
                    <p class="text-xs text-green-700 uppercase tracking-wide font-semibold mb-1">Active Guests</p>
                    <p class="text-3xl font-bold text-green-900">{{ stats.activeGuests }}</p>
                </div>
            </div>

            <!-- Filters -->
            <div class="flex flex-col sm:flex-row gap-3 mb-6">
                <!-- Search -->
                <div class="relative flex-1 max-w-md">
                    <MagnifyingGlassIcon class="absolute left-3 top-2.5 h-4 w-4 text-green-600" />
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search query or guest..."
                        class="w-full pl-9 pr-8 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                    />
                    <button
                        v-if="searchQuery"
                        @click="searchQuery = ''"
                        type="button"
                        class="absolute right-3 top-2.5 text-green-600 hover:text-green-900 transition-colors"
                    >
                        <XMarkIcon class="w-4 h-4" />
                    </button>
                </div>

                <!-- Date Range -->
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

                <!-- Action Buttons -->
                <div class="flex gap-2 ml-auto">
                    <!-- Clear Filters -->
                    <button
                        v-if="hasActiveFilters"
                        @click="clearFilters"
                        class="px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                    >
                        Clear Filters
                    </button>

                    <!-- Export Filtered -->
                    <button
                        v-if="hasActiveFilters && filteredLogs.length > 0"
                        @click="exportAllAsPDF(true)"
                        class="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
                    >
                        Export Filtered
                    </button>

                    <!-- Export All -->
                    <button
                        v-if="props.searchLogs.length > 0"
                        @click="exportAllAsPDF(false)"
                        class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"
                    >
                        Export All
                    </button>

                    <!-- Refresh -->
                    <button
                        @click="refreshData"
                        :disabled="loading"
                        type="button"
                        class="p-2 text-green-700 hover:text-green-900 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                    >
                        <ArrowPathIcon :class="['h-4 w-4', loading ? 'animate-spin' : '']" />
                    </button>
                </div>
            </div>

            <!-- Export Format Selector -->
            <div class="mb-4 flex gap-2">
                <label class="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        v-model="exportFormat"
                        value="json"
                        class="cursor-pointer text-green-900 focus:ring-green-900"
                    />
                    <span class="text-green-800">JSON Format</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input
                        type="radio"
                        v-model="exportFormat"
                        value="table"
                        class="cursor-pointer text-green-900 focus:ring-green-900"
                    />
                    <span class="text-green-800">Table Format</span>
                </label>
            </div>

            <!-- Table -->
            <div class="bg-white border border-green-200 rounded-lg overflow-hidden">
                <!-- Loading State -->
                <div v-if="loading" class="text-center py-12">
                    <ArrowPathIcon class="h-6 w-6 animate-spin mx-auto text-green-600 mb-2" />
                    <p class="text-sm text-green-700">Loading...</p>
                </div>

                <!-- Empty State -->
                <div v-else-if="searchLogs.length === 0" class="text-center py-12">
                    <MagnifyingGlassIcon class="h-8 w-8 mx-auto text-green-300 mb-2" />
                    <h3 class="text-lg font-semibold text-green-900 mb-2">No search logs found</h3>
                    <p class="text-sm text-green-700">Search logs will appear here once guests start searching</p>
                </div>

                <!-- Compact Table -->
                <div v-else class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-green-200 text-sm">
                        <thead class="bg-green-50">
                            <tr>
                                <th class="px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase">Guest</th>
                                <th class="px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase">Query</th>
                                <th class="px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase">Date</th>
                                <th class="px-4 py-2 text-left text-xs font-semibold text-green-900 uppercase">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-green-100">
                            <tr v-for="log in searchLogs" :key="log.id" class="hover:bg-green-50 transition-colors">
                                <td class="px-4 py-2 text-green-900 font-medium">{{ log.guest?.name || 'Unknown' }}</td>
                                <td class="px-4 py-2 text-green-800">
                                    <span class="inline-flex px-2 py-1 bg-green-100 text-green-900 rounded text-xs font-medium truncate">
                                        {{ log.query }}
                                    </span>
                                </td>
                                <td class="px-4 py-2 text-green-700 text-xs">{{ formatDate(log.search_at) }}</td>
                                <td class="px-4 py-2">
                                    <button
                                        @click="openModal(log)"
                                        class="text-green-600 hover:text-green-800 font-medium text-xs transition-colors"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div v-if="pagination.last_page > 1" class="px-6 py-4 border-t border-green-200 bg-green-50">
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div class="text-sm text-green-700">
                            Showing {{ pagination.from }} to {{ pagination.to }} of {{ pagination.total }}
                        </div>
                        <div class="flex items-center gap-1">
                            <button
                                @click="handlePageChange(pagination.current_page - 1)"
                                :disabled="pagination.current_page === 1"
                                type="button"
                                class="p-2 text-green-700 hover:text-green-900 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronLeftIcon class="w-4 h-4" />
                            </button>

                            <div class="flex gap-1">
                                <button
                                    v-for="page in pageNumbers"
                                    :key="page"
                                    @click="typeof page === 'number' && handlePageChange(page)"
                                    :disabled="typeof page !== 'number'"
                                    type="button"
                                    :class="[
                                        'px-3 py-1 text-sm rounded-lg transition',
                                        page === pagination.current_page
                                            ? 'bg-green-900 text-white font-medium'
                                            : 'text-green-700 hover:text-green-900 hover:bg-white',
                                        typeof page !== 'number' ? 'cursor-default hover:bg-transparent' : ''
                                    ]"
                                >
                                    {{ page }}
                                </button>
                            </div>

                            <button
                                @click="handlePageChange(pagination.current_page + 1)"
                                :disabled="pagination.current_page === pagination.last_page"
                                type="button"
                                class="p-2 text-green-700 hover:text-green-900 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <ChevronRightIcon class="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Modal -->
        <Transition name="modal-fade">
            <div v-if="showModal" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="closeModal">
                <Transition name="modal-scale">
                    <div v-if="showModal" class="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[75vh] overflow-hidden" @click.stop>
                        <!-- Modal Header -->
                        <div class="p-5 border-b border-green-200 flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-green-900">Search Log Details</h3>
                            <button @click="closeModal" class="text-green-700 hover:text-green-900 transition-colors">
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>

                        <!-- Modal Body -->
                        <div class="p-5 overflow-y-auto max-h-[calc(75vh-140px)]">
                            <div class="bg-green-50 rounded-lg p-4 mb-4">
                                <pre class="text-xs text-green-800 overflow-auto max-h-80 font-mono">{{ JSON.stringify({
                                    id: selectedLog?.id,
                                    guest: {
                                        id: selectedLog?.guest_id,
                                        name: selectedLog?.guest?.name || 'Unknown'
                                    },
                                    query: selectedLog?.query,
                                    searchedAt: selectedLog?.search_at,
                                    createdAt: selectedLog?.created_at
                                }, null, 2) }}</pre>
                            </div>
                        </div>

                        <!-- Modal Footer -->
                        <div class="p-5 border-t border-green-200 flex gap-3 justify-end">
                            <button
                                @click="exportSingleJSON"
                                class="px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition-colors"
                            >
                                Export JSON
                            </button>
                            <button
                                @click="exportSinglePDF"
                                class="px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition-colors"
                            >
                                Export PDF
                            </button>
                            <button
                                @click="closeModal"
                                class="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 hover:bg-green-50 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </AuthenticatedLayout>
</template>

<style scoped>
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
