import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { i18n } from './i18n'
import { setApiKey, hasApiKey } from './api/client'
import { loginWithPassword } from './api/auth'
import App from './App.vue'
import './styles/global.scss'
import 'katex/dist/katex.min.css'

// Apply theme classes before mount to prevent FOUC (Flash of Unstyled Content)
const savedBrightness = localStorage.getItem('hermes_brightness') || 'system'
const savedStyle = localStorage.getItem('hermes_style') || 'ink'

// Resolve dark mode
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
const isDark = savedBrightness === 'dark' || (savedBrightness === 'system' && prefersDark)

// Resolve style
const isComic = savedStyle === 'comic'
const isDesktopShell =
  (window as typeof window & { hermesDesktop?: { isDesktop?: boolean } }).hermesDesktop?.isDesktop === true

// Apply classes to prevent FOUC
if (isDark) {
  document.documentElement.classList.add('dark')
}
if (isComic) {
  document.documentElement.classList.add('comic')
}
if (isDesktopShell) {
  document.documentElement.classList.add('hermes-desktop-shell')
}

// Auto-login: silently authenticate using default credentials so the user
// never sees a login page.  The desktop preload does the same thing, but
// this covers the web-UI path and any race where the preload hasn't finished
// by the time the Vue app boots.
async function ensureAuthenticated(): Promise<void> {
  if (hasApiKey()) return
  try {
    const token = await loginWithPassword('admin', '123456')
    if (token) setApiKey(token)
  } catch {
    // Server may not be ready yet (desktop splash screen); the preload
    // will handle auth in that case.  Ignore errors silently.
  }
}

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(router)

ensureAuthenticated().finally(() => {
  router.isReady().finally(() => {
    app.mount('#app')
  })
})
