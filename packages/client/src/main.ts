import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import { i18nReady } from './i18n'
import { hasApiKey } from './api/client'
import App from './App.vue'
import './styles/global.scss'

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

// Ensure the user is authenticated before mounting the app.
// Desktop and web both require explicit login via LoginView.
async function ensureAuthenticated(): Promise<void> {
  if (hasApiKey()) return
  // User explicitly logged out — skip silent auto-login
  if (sessionStorage.getItem('hermes_manual_logout') === '1') return
}

async function mountApp(): Promise<void> {
  const i18n = await i18nReady
  const app = createApp(App)
  app.use(createPinia())
  app.use(i18n)
  app.use(router)

  await ensureAuthenticated().catch(() => undefined)
  await router.isReady().catch(() => undefined)
  app.mount('#app')
}

void mountApp()
