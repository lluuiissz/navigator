import './bootstrap'
import '../css/app.css'
import "vue-toastification/dist/index.css";

import { createApp, h } from 'vue'
import { createInertiaApp } from '@inertiajs/vue3'
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import 'mapbox-gl/dist/mapbox-gl.css'
import mapboxgl from 'mapbox-gl'

import '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css'
import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions'

window.mapboxgl = mapboxgl
window.MapboxDirections = MapboxDirections

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
})

// Load AR.js globally (includes A-Frame)
import '@ar-js-org/ar.js'

import { ZiggyVue } from 'ziggy-js'

createInertiaApp({
  resolve: (name) =>
    resolvePageComponent(`./pages/${name}.vue`, import.meta.glob('./pages/**/*.vue')),
  setup({ el, App, props, plugin }) {
    const vueApp = createApp({ render: () => h(App, props) })
    vueApp.use(plugin)
    vueApp.use(ZiggyVue)
    vueApp.use(Toast, {
      position: 'top-right',
      timeout: 3000,
      closeOnClick: true,
      pauseOnHover: true,
    })
    vueApp.use(createPinia())
    vueApp.mount(el)
  },
})
