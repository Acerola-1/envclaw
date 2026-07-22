export type RankingTarget = 'city' | 'station'
export type TimeKind = 'hourly' | 'daily_count' | 'daily' | 'month' | 'year' | 'other'
export type TimeIntent = 'latestPublished' | 'specified'

export interface RankingDutyDraft {
  target: RankingTarget
  region: string
  timeKind: TimeKind
  timeIntent: TimeIntent
  specifiedTime: string
  factors: string[]
  includeAnalysis: boolean
  includeScreenshot: boolean
  screenshotScope: 'tableOnly' | 'withFilters'
  theme: 'light' | 'dark'
}

export interface RankingDutyDefinition extends RankingDutyDraft {
  capability: 'mapairs.concentration-ranking'
  observedAt: string
  savedAt: string
}

export const defaultRankingDutyDraft = (): RankingDutyDraft => ({
  target: 'city',
  region: '河南省 / 平顶山市',
  timeKind: 'daily_count',
  timeIntent: 'latestPublished',
  specifiedTime: '2026-07-15 08:00',
  factors: ['AQI', 'PM₂.₅', 'O₃'],
  includeAnalysis: true,
  includeScreenshot: true,
  screenshotScope: 'tableOnly',
  theme: 'light',
})

export function captureRankingDuty(draft: RankingDutyDraft, observedAt: string): RankingDutyDefinition {
  return {
    ...draft,
    capability: 'mapairs.concentration-ranking',
    observedAt,
    savedAt: new Date().toISOString(),
  }
}
