import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { t } from './desktop-i18n'

const DEFAULT_UPDATE_BASE_URL = 'https://www.mapairs.com/datacenter/claw/updates'

function updateBaseUrl(): string {
  const override = process.env.HERMES_DESKTOP_UPDATE_URL?.trim()
  return override || DEFAULT_UPDATE_BASE_URL
}

function platformUpdateDir(): string {
  if (process.platform === 'darwin') return 'mac'
  if (process.platform === 'win32') return 'win'
  return 'linux'
}

function configureAutoUpdater(): void {
  const baseUrl = updateBaseUrl()
  const platformDir = platformUpdateDir()
  const feedURL = `${baseUrl.replace(/\/$/, '')}/${platformDir}`

  autoUpdater.setFeedURL({ provider: 'generic', url: feedURL })
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  console.log(`[updater] feedURL: ${feedURL}`)
}

let updateAvailable = false
let downloadedInfo: UpdateInfo | null = null

function setupUpdateListeners(): void {
  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for update...')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[updater] update available: ${info.version}`)
    updateAvailable = true
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] up to date')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[updater] downloading: ${progress.percent.toFixed(1)}%`)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[updater] update downloaded: ${info.version}`)
    downloadedInfo = info
    promptRestart()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err.message)
  })
}

function promptRestart(): void {
  if (!downloadedInfo) return

  const buttons = [t('update.restartNow'), t('update.later')]
  dialog.showMessageBox({
    type: 'info',
    title: t('update.readyTitle'),
    message: t('update.readyMessage', { version: downloadedInfo.version }),
    detail: t('update.readyDetail'),
    buttons,
    defaultId: 0,
    noLink: true,
  }).then(({ response }) => {
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall())
    }
  })
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log('[updater] skipped in dev mode')
    return
  }

  configureAutoUpdater()
  setupUpdateListeners()

  // Check for updates after 30 seconds, then every 4 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] initial check failed:', err.message)
    })
  }, 30_000)

  const FOUR_HOURS = 4 * 60 * 60 * 1000
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(err => {
      console.error('[updater] periodic check failed:', err.message)
    })
  }, FOUR_HOURS)
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    dialog.showMessageBox({
      type: 'info',
      title: t('update.packagedOnlyTitle'),
      message: t('update.packagedOnlyMessage'),
    })
    return
  }

  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      dialog.showMessageBox({
        type: 'info',
        title: t('update.upToDateTitle'),
        message: t('update.upToDateMessage'),
      })
    }
  } catch (err) {
    dialog.showMessageBox({
      type: 'error',
      title: t('update.failedTitle'),
      message: t('update.failedMessage'),
    })
  }
}

export function isUpdateDownloaded(): boolean {
  return !!downloadedInfo
}
