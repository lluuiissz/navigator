import { defineStore } from "pinia";
import axios from "axios";
import { baseURL } from "../../url/baseUrl.js";
import { useReactiveStore } from "../reactives/reactive";

export const useAuthStore = defineStore("auth",() => {
    const reactive = useReactiveStore();
    const { isLoading } = reactive;

    const register = async (data) => {
        isLoading.value = true;
        try {
            const response = await axios.post(`${baseURL()}/register`, data);
            isLoading.value = false;
            return response.data;
        } catch (error) {
            isLoading.value = false;
            throw error;
        }
    };

    const login = async (data) => {
        isLoading.value = true;
        try {
            const response = await axios.post(`${baseURL()}/login`, data);
            isLoading.value = false;
            return response.data;
        } catch (error) {
            isLoading.value = false;
            throw error;
        }
    };

    return {
        register,
        login,
    };
});
