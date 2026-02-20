<script setup>
import { ref } from 'vue';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { router } from '@inertiajs/vue3';
import { ArrowUpTrayIcon, MagnifyingGlassIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
    allowedIds: Object,
    stats: Object,
    filters: Object
});

const searchQuery  = ref(props.filters?.search  || '');
const statusFilter = ref(props.filters?.status  || 'all');
const roleFilter   = ref(props.filters?.role    || 'all');

const uploadFile   = ref(null);
const uploadRoleHint = ref('student');   // 'student' | 'faculty'
const isUploading  = ref(false);
const uploadResult = ref(null);

const handleFileSelect = (event) => {
    uploadFile.value = event.target.files[0];
};

const uploadCSV = async () => {
    if (!uploadFile.value) {
        alert('Please select a CSV file');
        return;
    }

    const formData = new FormData();
    formData.append('csv_file',   uploadFile.value);
    formData.append('role_hint',  uploadRoleHint.value);

    isUploading.value  = true;
    uploadResult.value = null;

    try {
        const response = await fetch('/admin/allowlist/upload', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            }
        });

        const data = await response.json();

        if (response.ok) {
            uploadResult.value = { success: true, ...data };
            uploadFile.value   = null;
            router.reload();
        } else {
            uploadResult.value = {
                success: false,
                error: data.error || 'Upload failed',
                details: data.details || null
            };
        }
    } catch (error) {
        uploadResult.value = { success: false, error: 'Network error: ' + error.message };
    } finally {
        isUploading.value = false;
    }
};

const applyFilters = () => {
    router.get('/admin/allowlist', {
        search: searchQuery.value   || null,
        status: statusFilter.value !== 'all' ? statusFilter.value : null,
        role:   roleFilter.value   !== 'all' ? roleFilter.value   : null,
    }, { preserveState: true });
};

const deleteId = async (id) => {
    if (!confirm('Are you sure you want to remove this ID from the allowlist?')) return;

    try {
        const response = await fetch(`/admin/allowlist/${id}`, {
            method: 'DELETE',
            headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content }
        });
        const data = await response.json();
        if (response.ok) { router.reload(); }
        else { alert(data.error || 'Failed to delete'); }
    } catch (error) {
        alert('Network error: ' + error.message);
    }
};

const roleBadgeClass = (role) =>
    role === 'faculty'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-green-100 text-green-800';
</script>

<template>
    <AuthenticatedLayout>
        <div class="py-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <!-- Header -->
            <div class="mb-6">
                <h2 class="text-2xl font-bold text-green-900">ID Allowlist Management</h2>
                <p class="mt-1 text-sm text-green-700">Upload and manage authorized student and faculty IDs</p>
            </div>

            <!-- Statistics Cards -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                    <p class="text-sm text-gray-600">Total</p>
                    <p class="text-2xl font-bold text-green-900">{{ stats.total }}</p>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                    <p class="text-sm text-gray-600">Used</p>
                    <p class="text-2xl font-bold text-blue-900">{{ stats.used }}</p>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
                    <p class="text-sm text-gray-600">Available</p>
                    <p class="text-2xl font-bold text-gray-900">{{ stats.unused }}</p>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-500">
                    <p class="text-sm text-gray-600">🎓 Students</p>
                    <p class="text-2xl font-bold text-emerald-900">{{ stats.students }}</p>
                </div>
                <div class="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
                    <p class="text-sm text-gray-600">👨‍🏫 Faculty</p>
                    <p class="text-2xl font-bold text-indigo-900">{{ stats.faculty }}</p>
                </div>
            </div>

            <!-- CSV Upload Section -->
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h3 class="text-lg font-semibold text-green-900 mb-1">Upload CSV File</h3>
                <p class="text-sm text-gray-500 mb-4">
                    All rows in the file will be treated as the selected role. You can also include a
                    <code class="bg-gray-100 px-1 rounded">role</code> column in the CSV to set per-row roles.
                </p>

                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <!-- Role picker -->
                    <div class="flex rounded-lg overflow-hidden border border-gray-300 shrink-0">
                        <button
                            @click="uploadRoleHint = 'student'"
                            :class="[
                                'px-4 py-2 text-sm font-medium transition',
                                uploadRoleHint === 'student'
                                    ? 'bg-green-900 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            ]"
                        >
                            🎓 Student
                        </button>
                        <button
                            @click="uploadRoleHint = 'faculty'"
                            :class="[
                                'px-4 py-2 text-sm font-medium transition border-l border-gray-300',
                                uploadRoleHint === 'faculty'
                                    ? 'bg-indigo-700 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            ]"
                        >
                            👨‍🏫 Faculty
                        </button>
                    </div>

                    <!-- File input -->
                    <input
                        type="file"
                        accept=".csv"
                        @change="handleFileSelect"
                        class="block w-full text-sm text-gray-500
                               file:mr-4 file:py-2 file:px-4 file:rounded-lg
                               file:border-0 file:text-sm file:font-semibold
                               file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />

                    <!-- Upload btn -->
                    <button
                        @click="uploadCSV"
                        :disabled="!uploadFile || isUploading"
                        class="px-4 py-2 bg-green-900 text-white rounded-lg font-medium hover:bg-green-800
                               disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                    >
                        <ArrowUpTrayIcon class="w-5 h-5" />
                        {{ isUploading ? 'Uploading…' : 'Upload' }}
                    </button>
                </div>

                <!-- Upload Result -->
                <div v-if="uploadResult" class="mt-4">
                    <div v-if="uploadResult.success" class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p class="text-green-900 font-medium">✓ Upload successful!</p>
                        <p class="text-sm text-green-700 mt-1">
                            Imported: {{ uploadResult.imported }} | Skipped: {{ uploadResult.skipped }}
                        </p>
                        <div v-if="uploadResult.errors && uploadResult.errors.length" class="mt-2">
                            <p class="text-sm text-green-800 font-medium">Errors:</p>
                            <ul class="text-xs text-green-700 list-disc list-inside">
                                <li v-for="(err, i) in uploadResult.errors.slice(0, 5)" :key="i">{{ err }}</li>
                            </ul>
                        </div>
                    </div>
                    <div v-else class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-900 font-medium">✗ Upload failed</p>
                        <p class="text-sm text-red-700 mt-1">{{ uploadResult.error }}</p>
                        <pre v-if="uploadResult.details" class="text-xs text-red-700 mt-2">{{ JSON.stringify(uploadResult.details, null, 2) }}</pre>
                    </div>
                </div>

                <p class="text-xs text-gray-400 mt-3">
                    Expected columns:
                    <code class="bg-gray-100 px-1 rounded">ID_Number, Full_name, course [, role]</code>
                    — the <code class="bg-gray-100 px-1 rounded">role</code> column is optional; it defaults to whichever role button you selected above.
                </p>
            </div>

            <!-- Filters -->
            <div class="bg-white rounded-lg shadow p-4 mb-4">
                <div class="flex flex-col sm:flex-row gap-3">
                    <div class="flex-1">
                        <input
                            v-model="searchQuery"
                            type="text"
                            placeholder="Search by ID, name, or course…"
                            @keyup.enter="applyFilters"
                            class="w-full px-4 py-2 border border-gray-300 rounded-lg
                                   focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                    </div>

                    <!-- Role filter -->
                    <select
                        v-model="roleFilter"
                        @change="applyFilters"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="all">All Roles</option>
                        <option value="student">🎓 Students</option>
                        <option value="faculty">👨‍🏫 Faculty</option>
                    </select>

                    <!-- Status filter -->
                    <select
                        v-model="statusFilter"
                        @change="applyFilters"
                        class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                        <option value="all">All Status</option>
                        <option value="unused">Available</option>
                        <option value="used">Used</option>
                    </select>

                    <button
                        @click="applyFilters"
                        class="px-4 py-2 bg-green-900 text-white rounded-lg font-medium hover:bg-green-800 flex items-center gap-2"
                    >
                        <MagnifyingGlassIcon class="w-5 h-5" />
                        Search
                    </button>
                </div>
            </div>

            <!-- Allowlist Table -->
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Number</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course / Dept.</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used By</th>
                            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <tr v-for="item in allowedIds.data" :key="item.id">
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ item.id_number }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ item.full_name }}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ item.course || '–' }}</td>

                            <!-- Role badge -->
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold', roleBadgeClass(item.role)]">
                                    {{ item.role === 'faculty' ? '👨‍🏫 Faculty' : '🎓 Student' }}
                                </span>
                            </td>

                            <!-- Status badge -->
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span v-if="item.is_used" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <CheckCircleIcon class="w-4 h-4 mr-1" /> Used
                                </span>
                                <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    <XCircleIcon class="w-4 h-4 mr-1" /> Available
                                </span>
                            </td>

                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{{ item.user?.name || '–' }}</td>

                            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    v-if="!item.is_used"
                                    @click="deleteId(item.id)"
                                    class="text-red-600 hover:text-red-900"
                                    title="Remove from allowlist"
                                >
                                    <TrashIcon class="w-5 h-5" />
                                </button>
                                <span v-else class="text-gray-400">–</span>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <!-- Empty State -->
                <div v-if="!allowedIds.data || allowedIds.data.length === 0" class="text-center py-12">
                    <p class="text-gray-500">No IDs found. Upload a CSV to get started.</p>
                </div>

                <!-- Pagination -->
                <div v-if="allowedIds.data && allowedIds.data.length > 0" class="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <div class="flex items-center justify-between">
                        <div class="text-sm text-gray-700">
                            Showing {{ allowedIds.from }} to {{ allowedIds.to }} of {{ allowedIds.total }} results
                        </div>
                        <div class="flex gap-2">
                            <a
                                v-for="link in allowedIds.links"
                                :key="link.label"
                                :href="link.url"
                                v-html="link.label"
                                :class="[
                                    'px-3 py-1 rounded',
                                    link.active ? 'bg-green-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
                                    !link.url ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                                ]"
                            ></a>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    </AuthenticatedLayout>
</template>
