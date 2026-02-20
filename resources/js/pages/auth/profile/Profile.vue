<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import AuthenticatedLayout from '../../../Layouts/AuthenticatedLayout.vue'
import TextInput from '../../../Components/TextInput.vue'
import InputLabel from '../../../Components/InputLabel.vue'
import InputError from '../../../Components/InputError.vue'
import PrimaryButton from '../../../Components/PrimaryButton.vue'
import { useToast } from 'vue-toastification'

const props = defineProps({
    user: Object,
    status: String,
})

const toast = useToast()

// States
const user = ref({ ...props.user })
const editingProfile = ref(false)
const editingPassword = ref(false)
const profileStatus = ref('')
const message = ref('')

// Profile Form
const profileForm = ref({
    name: user.value.name,
    email: user.value.email,
})
const profileErrors = ref({})
const profileProcessing = ref(false)

// Password Form
const passwordForm = ref({
    current_password: '',
    new_password: '',
    new_password_confirmation: '',
})
const passwordErrors = ref({})
const passwordProcessing = ref(false)

// Update Profile via Axios
const updateProfile = async () => {
    profileProcessing.value = true
    profileErrors.value = {}
    profileStatus.value = ''

    try {
        const response = await axios.put('/profile/update', profileForm.value)
        message.value = response.data.message || 'Profile updated successfully.'
        editingProfile.value = false
        toast.success(message.value)

        // update local user data immediately
        user.value.name = profileForm.value.name
        user.value.email = profileForm.value.email
    } catch (error) {
        if (error.response?.data?.errors) {
            profileErrors.value = error.response.data.errors
        } else {
            profileStatus.value = 'Error updating profile.'
        }
    } finally {
        profileProcessing.value = false
    }
}

// Update Password via Axios
const updatePassword = async () => {
    passwordProcessing.value = true
    passwordErrors.value = {}
    message.value = ''

    try {
        const response = await axios.patch('/profile/change-password', passwordForm.value)
        message.value = response.data.message || 'Password updated successfully.'
        toast.success(message.value)

        editingPassword.value = false
        passwordForm.value = {
            current_password: '',
            new_password: '',
            new_password_confirmation: '',
        }
    } catch (error) {
        if (error.response?.data?.errors) {
            passwordErrors.value = error.response.data.errors
        } else {
            message.value = 'Error updating password.'
            toast.error(message.value)
        }
    } finally {
        passwordProcessing.value = false
    }
}

// Cancel Edit
const cancelEdit = () => {
    editingProfile.value = false
    profileForm.value = {
        name: user.value.name,
        email: user.value.email,
    }
    profileErrors.value = {}
}

const cancelPasswordEdit = () => {
    editingPassword.value = false
    passwordForm.value = {
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    }
    passwordErrors.value = {}
}

// Real-time profile update via Laravel Echo
onMounted(() => {
    if (!window.Echo) {
        console.error('Laravel Echo not found. Initialize it in your app.js.')
        return
    }

    window.Echo.channel('main-channel')
        .listen('.MainEvent', (e) => {
            if (e.type === 'user' && e.action === 'update') {
                // if current logged-in user matches updated user, update live
                if (e.data.id === user.value.id) {
                    user.value.name = e.data.name
                    user.value.email = e.data.email
                    profileForm.value.name = e.data.name
                    profileForm.value.email = e.data.email
                    toast.info('Your profile has been updated in real-time.')
                }
            }
        })
})

onBeforeUnmount(() => {
    if (window.Echo) {
        window.Echo.leave('main-channel')
    }
})
</script>

<template>
    <AuthenticatedLayout>
        <template #header>
            <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">Profile</h2>
        </template>

        <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8 space-y-6">

                <!-- Update Profile Information -->
                <div class="p-4 sm:p-8 bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                    <div class="max-w-xl">
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Profile Information</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Update your account's profile information and email address.</p>
                        </div>

                        <form v-if="editingProfile" @submit.prevent="updateProfile" class="mt-6 space-y-6">
                            <div>
                                <InputLabel for="name" value="Name" />
                                <TextInput id="name" v-model="profileForm.name" type="text" class="mt-1 block w-full" required autofocus />
                                <InputError :message="profileErrors.name?.[0]" class="mt-2" />
                            </div>

                            <div>
                                <InputLabel for="email" value="Email" />
                                <TextInput id="email" v-model="profileForm.email" type="email" class="mt-1 block w-full" required />
                                <InputError :message="profileErrors.email?.[0]" class="mt-2" />
                            </div>

                            <div class="flex items-center gap-4">
                                <PrimaryButton :disabled="profileProcessing">Save</PrimaryButton>
                                <button type="button" @click="cancelEdit" class="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition ease-in-out duration-150">
                                    Cancel
                                </button>
                            </div>
                        </form>

                        <div v-else class="mt-6">
                            <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                <div>
                                    <InputLabel value="Name" />
                                    <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ user.name }}</p>
                                </div>
                                <div>
                                    <InputLabel value="Email" />
                                    <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">{{ user.email }}</p>
                                </div>
                            </div>
                            <button @click="editingProfile = true" class="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-indigo-700 active:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150">
                                Edit Profile
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Update Password -->
                <div class="p-4 sm:p-8 bg-white dark:bg-gray-800 shadow sm:rounded-lg">
                    <div class="max-w-xl">
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Password</h3>
                            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Ensure your account is using a long, random password to stay secure.</p>
                        </div>

                        <form v-if="editingPassword" @submit.prevent="updatePassword" class="mt-6 space-y-6">
                            <div>
                                <InputLabel for="current_password" value="Current Password" />
                                <TextInput id="current_password" v-model="passwordForm.current_password" type="password" class="mt-1 block w-full" required />
                                <InputError :message="passwordErrors.current_password?.[0]" class="mt-2" />
                            </div>

                            <div>
                                <InputLabel for="new_password" value="New Password" />
                                <TextInput id="new_password" v-model="passwordForm.new_password" type="password" class="mt-1 block w-full" required />
                                <InputError :message="passwordErrors.new_password?.[0]" class="mt-2" />
                            </div>

                            <div>
                                <InputLabel for="new_password_confirmation" value="Confirm Password" />
                                <TextInput id="new_password_confirmation" v-model="passwordForm.new_password_confirmation" type="password" class="mt-1 block w-full" required />
                                <InputError :message="passwordErrors.new_password_confirmation?.[0]" class="mt-2" />
                            </div>

                            <div class="flex items-center gap-4">
                                <PrimaryButton :disabled="passwordProcessing">Update Password</PrimaryButton>
                                <button type="button" @click="cancelPasswordEdit" class="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-500 rounded-md font-semibold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition ease-in-out duration-150">
                                    Cancel
                                </button>
                            </div>
                        </form>

                        <div v-else>
                            <p class="text-sm text-gray-600 dark:text-gray-400 mt-6">
                                Update your password to keep your account secure.
                            </p>
                            <button @click="editingPassword = true" class="mt-6 inline-flex items-center px-4 py-2 bg-indigo-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:bg-indigo-700 active:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition ease-in-out duration-150">
                                Change Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </AuthenticatedLayout>
</template>
