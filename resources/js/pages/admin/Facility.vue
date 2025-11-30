<script setup>
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout.vue';
import { ref, computed, watch } from 'vue';
import {
    XMarkIcon,
    ArrowPathIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    EyeIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    BuildingOffice2Icon,
    ExclamationTriangleIcon,
    PhotoIcon
} from '@heroicons/vue/24/outline';
import { router } from '@inertiajs/vue3';
import Modal from '../../Components/Modal.vue';
import TextInput from '../../Components/TextInput.vue';
import { useToast } from 'vue-toastification';
import axios from 'axios';

const props = defineProps({
    markers: {
        type: Array,
        default: () => []
    },
    facilities: {
        type: Array,
        default: () => []
    },
    pagination: {
        type: Object,
        default: () => ({ current_page: 1, last_page: 1, total: 0, per_page: 10, from: 1, to: 1 })
    }
});

const toast = useToast();

const searchQuery = ref('');
const statusFilter = ref('all');
const isOpen = ref(false);
const isConfirmationModalOpen = ref(false);

const data = ref({
    name: '',
    category: '',
    department: '',
    floor_number: '',
    description: '',
    hours: '',
    status: 'active',
    marker_id: null
});

const isEditMode = ref(false);
const selectedFacility = ref(null);
const viewModalOpen = ref(false);
const viewedFacility = ref(null);
const isSaving = ref(false);
const isDeleting = ref(false);

// Photo upload states
const selectedPhotos = ref([]);
const photoPreviews = ref([]);
const existingPhotos = ref([]);
const photosToDelete = ref([]);
const isUploadingPhotos = ref(false);
const showAllPhotos = ref(false);
const isDraggingPhotos = ref(false);
// Optimized filtered facilities
const filteredFacilities = computed(() => {
    let filtered = props.facilities;

    if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(facility => {
            const name = facility.name?.toLowerCase() || '';
            const category = facility.category?.toLowerCase() || '';
            const department = facility.department?.toLowerCase() || '';
            return name.includes(query) || category.includes(query) || department.includes(query);
        });
    }

    if (statusFilter.value && statusFilter.value !== 'all') {
        const filterStatus = statusFilter.value.toLowerCase();
        filtered = filtered.filter(facility =>
            facility.status?.toLowerCase() === filterStatus
        );
    }

    return filtered;
});

// Check if any filters are active
const hasActiveFilters = computed(() => {
    return searchQuery.value || statusFilter.value !== 'all';
});

const loading = ref(false);

const refreshData = () => {
    loading.value = true;
    router.reload({
        preserveState: true,
        onFinish: () => { loading.value = false; }
    });
};

const openAddModal = () => {
    selectedFacility.value = null;
    isEditMode.value = false;
    data.value = {
        name: '',
        category: '',
        department: '',
        description: '',
        hours: '',
        status: 'active',
        marker_id: null
    };
    selectedPhotos.value = [];
    photoPreviews.value = [];
    existingPhotos.value = [];
    photosToDelete.value = [];
    showAllPhotos.value = false;
    isOpen.value = true;
};

const handleEdit = (facility) => {
    selectedFacility.value = facility;
    isEditMode.value = true;
    data.value = {
        name: facility.name,
        category: facility.category,
        department: facility.department,
        description: facility.description,
        floor_number: facility.floor_number,
        hours: facility.hours,
        status: facility.status,
        marker_id: facility.marker_id || null
    };
    selectedPhotos.value = [];
    photoPreviews.value = [];
    existingPhotos.value = facility.photos || [];
    photosToDelete.value = [];
    showAllPhotos.value = false;
    isOpen.value = true;
};

const handleDelete = (facility) => {
    selectedFacility.value = facility;
    isConfirmationModalOpen.value = true;
};

const confirmDelete = async () => {
    if (!selectedFacility.value || isDeleting.value) return;

    isDeleting.value = true;

    try {
        const response = await axios.delete(`/facilities/${selectedFacility.value.id}/destroy`);
        isConfirmationModalOpen.value = false;
        selectedFacility.value = null;
        toast.success(response.data.message || 'Facility deleted successfully!');
        refreshData();
    } catch (error) {
        console.error('Delete error:', error.response?.data);
        toast.error(error.response?.data?.message || 'Failed to delete facility.');
    } finally {
        isDeleting.value = false;
    }
};

const cancelDelete = () => {
    if (isDeleting.value) return;
    isConfirmationModalOpen.value = false;
    selectedFacility.value = null;
};

const handleView = (facility) => {
    viewedFacility.value = facility;
    viewModalOpen.value = true;
};

const closeViewModal = () => {
    viewModalOpen.value = false;
    viewedFacility.value = null;
};

const handlePageChange = (page) => {
    router.get('/facilities', { page }, {
        preserveState: true,
        preserveScroll: true
    });
};

// Photo handling functions - single photo at a time
const handlePhotoSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreviews.value.push({
                url: e.target.result,
                file: file,
                isNew: true
            });
            selectedPhotos.value.push(file);
        };
        reader.readAsDataURL(file);
    }
    event.target.value = '';
};

const handlePhotoDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingPhotos.value = false;

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            photoPreviews.value.push({
                url: e.target.result,
                file: file,
                isNew: true
            });
            selectedPhotos.value.push(file);
        };
        reader.readAsDataURL(file);
    }
};

const handlePhotoDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingPhotos.value = true;
};

const handlePhotoDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    isDraggingPhotos.value = false;
};

const removeNewPhoto = (index) => {
    photoPreviews.value.splice(index, 1);
    selectedPhotos.value.splice(index, 1);
};

const markExistingPhotoForDeletion = (photoId) => {
    const index = existingPhotos.value.findIndex(p => p.id === photoId);
    if (index !== -1) {
        photosToDelete.value.push(photoId);
        existingPhotos.value.splice(index, 1);
    }
};

const saveFacility = async () => {
    if (isSaving.value) return;

    isSaving.value = true;

    try {
        let facilityId;

        if (isEditMode.value && selectedFacility.value) {
            await axios.put(`/facilities/${selectedFacility.value.id}`, data.value);
            facilityId = selectedFacility.value.id;
            toast.success('Facility updated successfully!');
        } else {
            const response = await axios.post('/facilities', data.value);
            facilityId = response.data.facility.id;
            toast.success('Facility created successfully!');
        }

        // Upload photos if any
        if (selectedPhotos.value.length > 0 && facilityId) {
            isUploadingPhotos.value = true;
            const formData = new FormData();
            selectedPhotos.value.forEach((photo, index) => {
                formData.append(`photos[${index}]`, photo);
            });

            try {
                await axios.post(`/facilities/${facilityId}/photos/bulk`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Photos uploaded successfully!');
            } catch (photoError) {
                console.error('Photo upload error:', photoError);
                toast.error('Facility saved but some photos failed to upload');
            } finally {
                isUploadingPhotos.value = false;
            }
        }

        // Delete marked photos
        if (photosToDelete.value.length > 0 && facilityId) {
            try {
                await axios.post(`/facilities/${facilityId}/photos/delete`, {
                    photo_ids: photosToDelete.value
                });
            } catch (deleteError) {
                console.error('Photo deletion error:', deleteError);
            }
        }

        isOpen.value = false;
        refreshData();
    } catch (error) {
        console.error('Save errors:', error.response?.data);

        if (error.response?.data?.errors) {
            const errors = error.response.data.errors;
            const firstError = Object.values(errors)[0][0];
            toast.error(firstError);
        } else {
            toast.error(error.response?.data?.message || `Failed to ${isEditMode.value ? 'update' : 'create'} facility.`);
        }
    } finally {
        isSaving.value = false;
    }
};

const closeModal = () => {
    if (isSaving.value) return;
    isOpen.value = false;
    selectedFacility.value = null;
    isEditMode.value = false;
};

const clearFilters = () => {
    searchQuery.value = '';
    statusFilter.value = 'all';
};

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
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
                <h2 class="text-2xl font-bold text-green-900">Facilities</h2>
                <p class="mt-1 text-sm text-green-700">Manage campus facilities and locations</p>
            </div>
            <div class="mt-4 sm:mt-0">
                <span class="text-sm text-green-700 font-medium">
                    {{ filteredFacilities.length }} {{ filteredFacilities.length === 1 ? 'facility' : 'facilities' }}
                </span>
            </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-col sm:flex-row gap-3 mb-6">
            <!-- Search -->
            <div class="relative flex-1 max-w-md">
                <MagnifyingGlassIcon class="absolute left-3 top-2.5 h-4 w-4 text-green-700" />
                <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="Search facilities, category, or department..."
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

            <!-- Status Filter -->
            <select
                v-model="statusFilter"
                class="px-3 py-2 border border-green-300 rounded-lg text-sm focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
            >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>

            <!-- Clear Filters Button -->
            <button
                v-if="hasActiveFilters"
                @click="clearFilters"
                class="px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
            >
                Clear Filters
            </button>

            <!-- Action Buttons -->
            <div class="flex gap-2 ml-auto">
                <button
                    @click="refreshData"
                    :disabled="loading"
                    type="button"
                    class="p-2 text-green-700 hover:text-green-900 hover:bg-green-50 rounded-lg transition disabled:opacity-50"
                >
                    <ArrowPathIcon :class="['h-4 w-4', loading ? 'animate-spin' : '']" />
                </button>
                <button
                    @click="openAddModal"
                    type="button"
                    class="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-900 hover:bg-green-800 rounded-lg transition"
                >
                    <PlusIcon class="h-4 w-4" />
                    <span>Create Facility</span>
                </button>
            </div>
        </div>

        <!-- Table Container -->
        <div class="bg-white border border-green-200 rounded-lg overflow-hidden">
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-12">
                <ArrowPathIcon class="h-6 w-6 animate-spin mx-auto text-green-600 mb-2" />
                <p class="text-sm text-green-700">Loading...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredFacilities.length === 0" class="text-center py-12">
                <BuildingOffice2Icon class="h-8 w-8 mx-auto text-green-300 mb-2" />
                <h3 class="text-lg font-semibold text-green-900 mb-2">No facilities found</h3>
                <p class="text-sm text-gray-600">Try adjusting your filters or create a new facility</p>
            </div>

            <!-- Card Grid Layout - Masonry -->
            <div v-else class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 p-6 space-y-4">
                <div
                    v-for="facility in filteredFacilities"
                    :key="facility.id"
                    class="break-inside-avoid bg-white border border-green-200 rounded-lg p-4 hover:shadow-lg hover:border-green-300 transition-all duration-200 cursor-pointer group"
                >
                    <!-- Header with Status -->
                    <div class="flex items-start justify-between mb-3">
                        <div>
                            <h3 class="text-sm font-semibold text-green-900">{{ facility.name }}</h3>
                            <p class="text-xs text-green-700 mt-1">{{ facility.category }}</p>
                        </div>
                        <button @click.stop="handleView(facility)" class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-green-50 rounded">
                            <EyeIcon class="w-4 h-4 text-green-900" />
                        </button>
                    </div>

                    <!-- Department & Location -->
                    <div class="mb-3 space-y-2">
                        <div>
                            <p class="text-xs font-semibold text-green-900">Department</p>
                            <p class="text-sm text-gray-700">{{ facility.department }}</p>
                        </div>
                        <div>
                            <p class="text-xs font-semibold text-green-900">📍 Location</p>
                            <p class="text-sm text-gray-700">{{ facility.marker ? facility.marker.label : 'N/A' }}</p>
                        </div>
                    </div>

                    <!-- Photos Section -->
                    <div class="mb-3">
                        <p class="text-xs font-semibold text-green-900 mb-2">Photos</p>
                        <div v-if="facility.photos && facility.photos.length > 0" class="grid grid-cols-2 gap-2">
                            <!-- Show first 2 photos -->
                            <div v-for="(photo, index) in facility.photos.slice(0, 2)" :key="photo.id" class="relative">
                                <img :src="photo.url" :alt="'Photo ' + (index + 1)" class="w-full h-20 object-cover rounded border border-green-200" />
                            </div>
                            <!-- Show "more" if there are more than 2 photos -->
                            <div v-if="facility.photos.length > 2" class="relative">
                                <img :src="facility.photos[2].url" :alt="'Photo 3'" class="w-full h-20 object-cover rounded border border-green-200 opacity-40" />
                                <button
                                    @click.stop="viewedFacility = facility; viewModalOpen = true; showAllPhotos = true"
                                    class="absolute inset-0 w-full h-full flex items-center justify-center bg-green-900/40 hover:bg-green-900/60 transition rounded text-white font-medium text-sm"
                                >
                                    +{{ facility.photos.length - 2 }} More
                                </button>
                            </div>
                        </div>
                        <!-- Placeholder when no photos -->
                        <div v-else class="flex items-center justify-center py-4 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
                            <div class="text-center">
                                <PhotoIcon class="w-6 h-6 text-green-700 mx-auto mb-1" />
                                <p class="text-xs text-green-700">No photos added</p>
                            </div>
                        </div>
                    </div>

                    <!-- Hours & Status -->
                    <div class="mb-3 flex items-center justify-between text-xs">
                        <div>
                            <p class="text-gray-600">{{ facility.hours || 'N/A' }}</p>
                        </div>
                        <span
                            :class="[
                                'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                                facility.status === 'active'
                                    ? 'bg-green-50 text-green-900'
                                    : 'bg-gray-200 text-gray-700'
                            ]"
                        >
                            {{ facility.status }}
                        </span>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex gap-2 pt-3 border-t border-green-100">
                        <button
                            @click.stop="handleEdit(facility)"
                            class="flex-1 px-3 py-2 text-xs font-medium text-green-900 bg-green-50 hover:bg-green-100 rounded transition"
                            type="button"
                        >
                            Edit
                        </button>
                        <button
                            @click.stop="handleDelete(facility)"
                            class="flex-1 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition"
                            type="button"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- View Modal -->
    <Transition name="modal-fade">
        <div v-if="viewModalOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="closeViewModal">
            <Transition name="modal-scale">
                <div v-if="viewModalOpen" class="bg-white rounded-lg shadow-lg w-full max-w-xl max-h-[75vh] overflow-hidden" @click.stop>
                    <!-- Modal Header -->
                    <div class="p-5 border-b border-green-200 bg-green-50">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-green-900">{{ viewedFacility?.name }}</h3>
                            <button @click="closeViewModal" type="button" class="text-green-700 hover:text-green-900 transition-colors">
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-5 overflow-y-auto max-h-[calc(75vh-140px)] space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <h4 class="text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Category</h4>
                                <p class="text-sm text-gray-700">{{ viewedFacility?.category }}</p>
                            </div>
                            <div>
                                <h4 class="text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Department</h4>
                                <p class="text-sm text-gray-700">{{ viewedFacility?.department }}</p>
                            </div>
                            <div>
                                <h4 class="text-xs font-semibold text-green-900 mb-1 uppercase tracking-wide">Hours</h4>
                                <p class="text-sm text-gray-700">{{ viewedFacility?.hours || 'N/A' }}</p>
                            </div>
                            <div>
                                <h4 class="text-xs font-semibold text-gray-900 mb-1 uppercase tracking-wide">Status</h4>
                                <span
                                    :class="[
                                        'inline-flex px-2 py-0.5 text-xs font-semibold rounded',
                                        selectedFacility?.status === 'active'
                                            ? 'bg-green-50 text-green-900'
                                            : 'bg-gray-200 text-gray-700'
                                    ]"
                                >
                                    {{ selectedFacility?.status }}
                                </span>
                            </div>
                        </div>

                        <!-- Photos Section -->
                        <div v-if="viewedFacility?.photos && viewedFacility?.photos.length > 0">
                            <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Photos ({{ viewedFacility.photos.length }})</h4>
                            <div class="grid grid-cols-3 gap-2">
                                <div v-for="(photo, index) in viewedFacility.photos" :key="photo.id" class="relative group">
                                    <img :src="photo.url" :alt="'Photo ' + (index + 1)" class="w-full h-24 object-cover rounded border border-green-200" />
                                    <button
                                        @click.stop="markExistingPhotoForDeletion(photo.id); viewedFacility.photos.splice(index, 1);"
                                        type="button"
                                        class="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition opacity-0 group-hover:opacity-100"
                                        title="Remove photo"
                                    >
                                        <XMarkIcon class="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-if="viewedFacility?.marker">
                            <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Location</h4>
                            <div class="p-3 bg-green-50 rounded-lg border border-green-200">
                                <p class="font-medium text-green-900 text-sm">{{ viewedFacility.marker.label }}</p>
                                <p class="text-xs text-green-700 mt-1">{{ viewedFacility.marker.type }}</p>
                                <p class="text-xs text-gray-600 mt-2">Lat: {{ viewedFacility.marker.latitude }}, Lng: {{ viewedFacility.marker.longitude }}</p>
                            </div>
                        </div>

                        <div v-if="viewedFacility?.description">
                            <h4 class="text-xs font-semibold text-green-900 mb-2 uppercase tracking-wide">Description</h4>
                            <div class="p-3 bg-green-50 rounded-lg border border-green-200">
                                <p class="text-sm text-gray-700 whitespace-pre-wrap">{{ viewedFacility.description }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Modal Footer -->
                    <div class="p-5 border-t border-green-200">
                        <button
                            @click="closeViewModal"
                            class="w-full px-4 py-2 bg-green-900 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Transition>
        </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="modal-fade">
        <div v-if="isConfirmationModalOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="cancelDelete">
            <Transition name="modal-scale">
                <div v-if="isConfirmationModalOpen" class="bg-white rounded-lg shadow-lg w-full max-w-md" @click.stop>
                    <div class="p-6">
                        <!-- Warning Icon -->
                        <div class="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                            <ExclamationTriangleIcon class="w-6 h-6 text-red-600" />
                        </div>

                        <!-- Title -->
                        <h3 class="text-lg font-semibold text-gray-900 text-center mb-2">Delete Facility</h3>

                        <!-- Message -->
                        <p class="text-sm text-gray-600 text-center mb-4">
                            Are you sure you want to delete <span class="font-semibold text-gray-900">{{ selectedFacility?.name }}</span>?
                        </p>

                        <!-- Details -->
                        <div class="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                            <div class="flex justify-between">
                                <span class="text-gray-600">Category:</span>
                                <span class="font-medium text-gray-900">{{ selectedFacility?.category }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Department:</span>
                                <span class="font-medium text-gray-900">{{ selectedFacility?.department }}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-600">Status:</span>
                                <span
                                    :class="[
                                        'inline-flex px-2 py-0.5 text-xs font-semibold rounded',
                                        selectedFacility?.status === 'active'
                                            ? 'bg-gray-100 text-gray-900'
                                            : 'bg-gray-200 text-gray-700'
                                    ]"
                                >
                                    {{ selectedFacility?.status }}
                                </span>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="flex gap-3">
                            <button
                                @click="cancelDelete"
                                :disabled="isDeleting"
                                type="button"
                                class="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                @click="confirmDelete"
                                :disabled="isDeleting"
                                type="button"
                                class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <ArrowPathIcon v-if="isDeleting" class="w-4 h-4 animate-spin" />
                                <span>{{ isDeleting ? 'Deleting...' : 'Delete' }}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </div>
    </Transition>

    <!-- Add/Edit Modal -->
    <Transition name="modal-fade">
        <div v-if="isOpen" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" @click="closeModal">
            <Transition name="modal-scale">
                <div v-if="isOpen" class="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden" @click.stop>
                    <!-- Modal Header -->
                    <div class="p-5 border-b border-green-200 bg-green-50">
                        <div class="flex items-center justify-between">
                            <h3 class="text-lg font-semibold text-green-900">
                                {{ isEditMode ? 'Edit Facility' : 'Add Facility' }}
                            </h3>
                            <button @click="closeModal" :disabled="isSaving" type="button" class="text-green-700 hover:text-green-900 transition-colors disabled:opacity-50">
                                <XMarkIcon class="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <!-- Modal Body -->
                    <form @submit.prevent="saveFacility" class="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Name</label>
                                <TextInput
                                    v-model="data.name"
                                    type="text"
                                    placeholder="Facility name"
                                    required
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Category</label>
                                <TextInput
                                    v-model="data.category"
                                    type="text"
                                    placeholder="Category"
                                    required
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Department</label>
                                <TextInput
                                    v-model="data.department"
                                    type="text"
                                    placeholder="Department"
                                    required
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Floor Number</label>
                                <TextInput
                                    v-model="data.floor_number"
                                    type="text"
                                    placeholder="Floor Number"
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Hours</label>
                                <TextInput
                                    v-model="data.hours"
                                    type="text"
                                    placeholder="9:00 AM - 5:00 PM"
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Status</label>
                                <select
                                    v-model="data.status"
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-medium text-green-900 mb-1">Marker</label>
                                <select
                                    v-model="data.marker_id"
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900"
                                >
                                    <option :value="null">Select a marker</option>
                                    <option
                                        v-for="marker in markers"
                                        :key="marker.id"
                                        :value="marker.id"
                                    >
                                        {{ marker.label }} - {{ marker.type }}
                                    </option>
                                </select>
                            </div>

                            <!-- Photo Upload Section -->
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-green-900 mb-2">Photos</label>

                                <!-- Drag & Drop Upload Area -->
                                <div
                                    @drop="handlePhotoDrop"
                                    @dragover="handlePhotoDragOver"
                                    @dragleave="handlePhotoDragLeave"
                                    :class="[
                                        'mb-3 p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer',
                                        isDraggingPhotos.value
                                            ? 'border-green-500 bg-green-50'
                                            : 'border-green-300 hover:border-green-400'
                                    ]"
                                >
                                    <label class="flex flex-col items-center justify-center cursor-pointer">
                                        <PhotoIcon class="w-8 h-8 text-green-700 mb-2" />
                                        <span class="text-sm font-medium text-green-900">Drag & drop photo or</span>
                                        <span class="text-sm text-green-700 hover:text-green-900">browse</span>
                                        <p class="text-xs text-green-700 mt-1">Add one photo at a time (PNG, JPG, GIF)</p>
                                        <input
                                            type="file"
                                            @change="handlePhotoSelect"
                                            accept="image/*"
                                            class="hidden"
                                        />
                                    </label>
                                </div>

                                <!-- Photo Preview Card - Like Facility Card -->
                                <div v-if="photoPreviews.length > 0 || existingPhotos.length > 0" class="bg-white border border-green-200 rounded-lg p-3 space-y-3">
                                    <!-- Show first 2 photos in 2-column grid (smaller) -->
                                    <div v-if="(photoPreviews.length > 0 || existingPhotos.filter(p => !photosToDelete.includes(p.id)).length > 0)" class="grid grid-cols-2 gap-2">
                                        <!-- Existing Photos (smaller) -->
                                        <div
                                            v-for="(photo, index) in existingPhotos.filter(p => !photosToDelete.includes(p.id)).slice(0, 2)"
                                            :key="'existing-' + photo.id"
                                            class="relative group"
                                        >
                                            <img :src="photo.url" :alt="'Photo ' + (index + 1)" class="w-full h-16 object-cover rounded border border-green-200" />
                                            <button
                                                @click="markExistingPhotoForDeletion(photo.id)"
                                                type="button"
                                                class="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition opacity-0 group-hover:opacity-100"
                                                title="Remove photo"
                                            >
                                                <XMarkIcon class="w-3 h-3" />
                                            </button>
                                        </div>

                                        <!-- New Photos (smaller) -->
                                        <div
                                            v-for="(preview, index) in photoPreviews.slice(0, 2 - Math.min(2, existingPhotos.filter(p => !photosToDelete.includes(p.id)).length))"
                                            :key="'preview-' + index"
                                            class="relative group"
                                        >
                                            <img :src="preview.url" :alt="'New photo ' + (index + 1)" class="w-full h-16 object-cover rounded border border-green-200" />
                                            <button
                                                @click="removeNewPhoto(index)"
                                                type="button"
                                                class="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 transition opacity-0 group-hover:opacity-100"
                                                title="Remove photo"
                                            >
                                                <XMarkIcon class="w-3 h-3" />
                                            </button>
                                            <div class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-600 text-white text-xs font-medium rounded">
                                                New
                                            </div>
                                        </div>

                                        <!-- Show "more" if there are more than 2 photos total -->
                                        <div v-if="(existingPhotos.filter(p => !photosToDelete.includes(p.id)).length + photoPreviews.length) > 2" class="relative group">
                                            <img :src="(existingPhotos.filter(p => !photosToDelete.includes(p.id))[2] || photoPreviews[2])?.url || photoPreviews[0]?.url" :alt="'Photo 3'" class="w-full h-16 object-cover rounded border border-green-200 opacity-40" />
                                            <div class="absolute inset-0 w-full h-full flex items-center justify-center bg-green-900/40 rounded text-white font-medium text-sm">
                                                +{{ (existingPhotos.filter(p => !photosToDelete.includes(p.id)).length + photoPreviews.length) - 2 }}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Empty State -->
                                <div v-else class="flex flex-col items-center justify-center py-6 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
                                    <PhotoIcon class="w-8 h-8 text-green-700 mb-2" />
                                    <p class="text-sm text-green-700">No photos added yet</p>
                                </div>
                            </div>

                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-green-900 mb-1">Description</label>
                                <textarea
                                    v-model="data.description"
                                    rows="4"
                                    placeholder="Facility description"
                                    class="w-full px-4 py-2 text-sm border border-green-300 rounded-lg focus:border-green-900 focus:outline-none focus:ring-1 focus:ring-green-900 resize-none"
                                ></textarea>
                            </div>
                        </div>
                    </form>

                    <!-- Modal Footer -->
                    <div class="p-5 border-t border-green-200 flex gap-3 justify-end">
                        <button
                            @click="closeModal"
                            :disabled="isSaving"
                            type="button"
                            class="px-4 py-2 text-sm font-medium text-green-900 bg-white border border-green-300 hover:bg-green-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            @click="saveFacility"
                            :disabled="isSaving"
                            type="button"
                            class="px-4 py-2 text-sm font-medium text-white bg-green-900 hover:bg-green-800 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <ArrowPathIcon v-if="isSaving" class="h-4 w-4 animate-spin" />
                            <span>{{ isSaving ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update' : 'Create') }}</span>
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
