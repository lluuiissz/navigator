import { defineStore } from "pinia";
import { ref } from "vue";

export const useReactiveStore = defineStore("reactive", () => {

    const lng = ref(0)
    const lat = ref(0)

    const privateRoutes = ref(null)
    const routeInfo = ref(null)
    const guestStep = ref(1)
    const userLocation = ref(null)
    const map = ref(null)
    const userMarker = ref(null)
    const destinationMarker = ref(null)
    const routePolyline = ref(null)
    const watchId = ref(null)
    const selectedMarker = ref(null)
    const markerNote = ref('')
    const feedback = ref('')
    const message = ref('');
    const dateFrom = ref('');
    const dateTo = ref('');
    const profile = ref('walking');
    const finder = ref(null);
    const grid = ref(null);
    const routingControl = ref(null);
    const userHeading = ref(0)
    const drawnRoute = ref(null)
    const routeToDelete = ref(null)
    const transportationMode = ref('walking')

    // Boolean
    const isLoading = ref(false)
    const isOpen = ref(false)
    const isEditMode = ref(false)
    const isConfirmationModalOpen = ref(false)
    const isLoaded = ref(false)
    const showInstructions = ref(false)
    const showGuestModal = ref(true)
    const showSearchResults = ref(false)
    const isSearching = ref(false)
    const showNoteModal = ref(false)
    const showNotesModal = ref(false)
    const isSavingNote = ref(false)
    const isSavingFeedback = ref(false)
    const isGuestInfoComplete = ref(false)
    const isReviewModalOpen = ref(false)
    const showMarkerModal = ref(false)
    const showRouteModal = ref(false)
    const clickAddModeEnabled = ref(false)
    const drawnRouteMode = ref(false)
    const isSubmitting = ref(false)
    const isDrawing = ref(false)
    const editRouteMode = ref(false)
    const showEditRouteModal = ref(false)
    const showDeleteConfirmModal = ref(false)
    const showPointEditModal = ref(false)
    const showMarkerDragModal = ref(false)



    // Selected
    const selected = ref(null)
    const selectedLocation = ref(null)
    const selectedRoute = ref(null)

    // Data Arrays
    const items = ref([])
    const markers = ref([])
    const navigationInstructions = ref([])
    const facilityMarkers = ref([])
    const geoJsonLayers = ref([])
    const filteredLocations = ref([])
    const routePoints = ref([])
    const editMarkers = ref([])

    // Data Object
    const editMarker = ref({
        id: null,
        latitude: '',
        longitude: '',
        label: '',
        type: ''
    })
    const newMarker = ref({
        latitude: '',
        longitude: '',
        label: '',
        type: ''
    })
    const editedPointData = ref({
        index: null,
        oldCoords: { lat: null, lng: null },
        newCoords: { lat: null, lng: null },
        routeId: null
    })
    const markerDragData = ref({
        id: null,
        oldCoords: { lat: null, lng: null },
        newCoords: { lat: null, lng: null },
        label: '',
        type: ''
    })



    // Pagination
    const paginated = ref({})

    // Form Data Objects
    const data = ref({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    })

    // Filters
    const searchQuery = ref('')
    const statusFilter = ref('all')

    return {
        // Coordinates
        lng,
        lat,

        //
        privateRoutes,
        routeInfo,
        guestStep,
        userLocation,
        map,
        userMarker,
        destinationMarker,
        routePolyline,
        watchId,
        selectedMarker,
        markerNote,
        feedback,
        message,
        dateFrom,
        dateTo,
        finder,
        grid,
        routingControl,
        profile,
        userHeading,
        drawnRoute,
        routeToDelete,
        transportationMode,

        // Boolean
        isLoading,
        isOpen,
        isEditMode,
        isConfirmationModalOpen,
        isLoaded,
        showInstructions,
        showGuestModal,
        isSearching,
        showSearchResults,
        showNoteModal,
        isSavingNote,
        isGuestInfoComplete,
        isReviewModalOpen,
        isSavingFeedback,
        showMarkerModal,
        showRouteModal,
        clickAddModeEnabled,
        drawnRouteMode,
        isSubmitting,
        isDrawing,
        editRouteMode,
        showEditRouteModal,
        showDeleteConfirmModal,
        showPointEditModal,
        showMarkerDragModal,
        showNotesModal,

        // Selected
        selected,
        selectedLocation,
        selectedRoute,

        // Data Arrays
        items,
        markers,
        navigationInstructions,
        facilityMarkers,
        geoJsonLayers,
        filteredLocations,
        routePoints,
        editMarkers,

        // Data Object
        editMarker,
        newMarker,
        editedPointData,
        markerDragData,

        // Pagination
        paginated,

        // Data Objects
        data,

        // Filters
        searchQuery,
        statusFilter,
    }
})
