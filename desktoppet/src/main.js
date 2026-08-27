import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import PetPage from './pages/PetPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
const router = createRouter({ history: createWebHashHistory(), routes: [{ path: '/', component: PetPage }, { path: '/settings', component: SettingsPage }] })
const app = createApp(App)
app.use(router)
app.mount('#app')
router.afterEach((to) => { document.documentElement.classList.toggle('pet-window', to.path === '/') })
document.documentElement.classList.toggle('pet-window', window.location.hash === '' || window.location.hash === '#/')
