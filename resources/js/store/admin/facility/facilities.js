import { defineStore} from 'pinia';
import axios from 'axios';
import { useReactiveStore } from '../../reactives/reactive.js';
import { toRefs } from 'vue';

export const useFacilityStore = defineStore('facility', () => {

    const reactive = useReactiveStore();
    const { isLoading, items, paginated} = toRefs(reactive);

    const fetchFacilities = async () => {
        isLoading.value = true;
        try {
            const response = await axios.get('/facilities');
            items.value = response.data.facilities.data || [];
            paginated.value = {
                current_page: response.data.facilities.current_page,
                last_page: response.data.facilities.last_page,
                total: response.data.facilities.total,
            }
            console.log(items.value);
        } catch (err) {
            console.error(err);
        }finally {
            isLoading.value = false;
        }
    }

    const storeFacilities = async (data) => {
        isLoading.value = true;
        try {
            const response = await axios.post(`/facilities`, data);
            console.log(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            isLoading.value = false;
        }
    }

    return {
        fetchFacilities,
        storeFacilities,
    };
});

