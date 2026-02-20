<script setup>
import { ref, computed } from 'vue';
import GuestLayout from '../../Layouts/GuestLayout.vue';
import { router } from '@inertiajs/vue3';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/vue/24/outline';

const step = ref(1); // 1 = ID Verification, 2 = Account Creation
const idNumber = ref('');
const verificationResult = ref(null);
const isVerifying = ref(false);

// Registration form
const form = ref({
    id_number: '',
    full_name: '',
    course: '',
    email: '',
    password: '',
    password_confirmation: ''
});

const errors = ref({});

// Verify ID Number
const verifyId = async () => {
    if (!idNumber.value.trim()) {
        errors.value.id_number = 'Please enter your ID number';
        return;
    }

    isVerifying.value = true;
    errors.value = {};

    try {
        const response = await fetch('/auth/verify-id', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({ id_number: idNumber.value })
        });

        const data = await response.json();

        if (response.ok && data.available) {
            verificationResult.value = {
                success: true,
                ...data
            };
            
            // Pre-fill registration form
            form.value.id_number = idNumber.value;
            form.value.full_name = data.full_name;
            form.value.course = data.course || '';
            form.value.email = `${idNumber.value}@campus.edu`;
            
            // Move to step 2
            step.value = 2;
        } else {
            verificationResult.value = {
                success: false,
                message: data.message || 'ID verification failed'
            };
        }
    } catch (error) {
        verificationResult.value = {
            success: false,
            message: 'Network error: ' + error.message
        };
    } finally {
        isVerifying.value = false;
    }
};

// Submit Registration
const submitRegistration = () => {
    errors.value = {};

    // Validation
    if (!form.value.password) {
        errors.value.password = 'Password is required';
        return;
    }
    if (form.value.password.length < 8) {
        errors.value.password = 'Password must be at least 8 characters';
        return;
    }
    if (form.value.password !== form.value.password_confirmation) {
        errors.value.password_confirmation = 'Passwords do not match';
        return;
    }

    // Submit via Inertia
    router.post('/register', {
        name: form.value.full_name,
        email: form.value.email,
        password: form.value.password,
        password_confirmation: form.value.password_confirmation,
        id_number: form.value.id_number
    });
};

// Go back to ID verification
const goBack = () => {
    step.value = 1;
    verificationResult.value = null;
};
</script>

<template>
    <GuestLayout>
        <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div class="max-w-md w-full space-y-8">
                <!-- Header -->
                <div>
                    <h2 class="mt-6 text-center text-3xl font-extrabold text-green-900">
                        Student Registration
                    </h2>
                    <p class="mt-2 text-center text-sm text-gray-600">
                        Verify your student ID to create an account
                    </p>
                </div>

                <!-- Step Indicator -->
                <div class="flex items-center justify-center space-x-4">
                    <div :class="['flex items-center', step >= 1 ? 'text-green-900' : 'text-gray-400']">
                        <div :class="['w-8 h-8 rounded-full flex items-center justify-center', step >= 1 ? 'bg-green-900 text-white' : 'bg-gray-300']">
                            1
                        </div>
                        <span class="ml-2 text-sm font-medium">Verify ID</span>
                    </div>
                    <div class="w-12 h-0.5 bg-gray-300"></div>
                    <div :class="['flex items-center', step >= 2 ? 'text-green-900' : 'text-gray-400']">
                        <div :class="['w-8 h-8 rounded-full flex items-center justify-center', step >= 2 ? 'bg-green-900 text-white' : 'bg-gray-300']">
                            2
                        </div>
                        <span class="ml-2 text-sm font-medium">Create Account</span>
                    </div>
                </div>

                <!-- Step 1: ID Verification -->
                <div v-if="step === 1" class="bg-white rounded-lg shadow-md p-8">
                    <div class="space-y-4">
                        <div>
                            <label for="id_number" class="block text-sm font-medium text-gray-700">
                                Student ID Number
                            </label>
                            <input
                                id="id_number"
                                v-model="idNumber"
                                type="text"
                                placeholder="e.g., 2021-1234"
                                @keyup.enter="verifyId"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            />
                            <p v-if="errors.id_number" class="mt-1 text-sm text-red-600">{{ errors.id_number }}</p>
                        </div>

                        <button
                            @click="verifyId"
                            :disabled="isVerifying"
                            class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-900 hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                            {{ isVerifying ? 'Verifying...' : 'Verify ID' }}
                        </button>

                        <!-- Verification Result -->
                        <div v-if="verificationResult && !verificationResult.success" class="mt-4 p-4 rounded-md" :class="verificationResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                            <div class="flex">
                                <XCircleIcon class="h-5 w-5 text-red-400" />
                                <div class="ml-3">
                                    <p class="text-sm font-medium text-red-800">
                                        {{ verificationResult.message }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 text-center">
                        <p class="text-sm text-gray-600">
                            Already have an account? 
                            <a href="/login" class="font-medium text-green-900 hover:text-green-800">
                                Login here
                            </a>
                        </p>
                    </div>
                </div>

                <!-- Step 2: Account Creation -->
                <div v-if="step === 2" class="bg-white rounded-lg shadow-md p-8">
                    <!-- Verification Success Message -->
                    <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                        <div class="flex">
                            <CheckCircleIcon class="h-5 w-5 text-green-400" />
                            <div class="ml-3">
                                <p class="text-sm font-medium text-green-800">✓ ID Verified!</p>
                                <p class="text-sm text-green-700 mt-1">{{ form.full_name }}</p>
                                <p class="text-xs text-green-600">{{ form.course }}</p>
                            </div>
                        </div>
                    </div>

                    <form @submit.prevent="submitRegistration" class="space-y-4">
                        <!-- Full Name (Read-only) -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                v-model="form.full_name"
                                type="text"
                                readonly
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                            />
                        </div>

                        <!-- ID Number (Read-only) -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">ID Number</label>
                            <input
                                v-model="form.id_number"
                                type="text"
                                readonly
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                            />
                        </div>

                        <!-- Course (Read-only) -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Course</label>
                            <input
                                v-model="form.course"
                                type="text"
                                readonly
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                            />
                        </div>

                        <!-- Email -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Email</label>
                            <input
                                v-model="form.email"
                                type="email"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <!-- Password -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input
                                v-model="form.password"
                                type="password"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            />
                            <p v-if="errors.password" class="mt-1 text-sm text-red-600">{{ errors.password }}</p>
                        </div>

                        <!-- Confirm Password -->
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Confirm Password</label>
                            <input
                                v-model="form.password_confirmation"
                                type="password"
                                class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                            />
                            <p v-if="errors.password_confirmation" class="mt-1 text-sm text-red-600">{{ errors.password_confirmation }}</p>
                        </div>

                        <!-- Buttons -->
                        <div class="flex gap-3">
                            <button
                                type="button"
                                @click="goBack"
                                class="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Back
                            </button>
                            <button
                                type="submit"
                                class="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-900 hover:bg-green-800"
                            >
                                Create Account
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </GuestLayout>
</template>
