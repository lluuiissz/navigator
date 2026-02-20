<script setup>
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout.vue';
import MapBox from '../../Components/map/MapBox.vue';
import AdminMapNew from '../../Components/map/AdminMapNew.vue';
</script>
<template>
    <AuthenticatedLayout>
        <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
                    <!-- <MapComponent /> -->
                    <AdminMapNew :isAdmin="true" />
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
