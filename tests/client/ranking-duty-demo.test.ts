import { describe, expect, it } from 'vitest'
import { captureRankingDuty, defaultRankingDutyDraft } from '@/features/envclaw/ranking-duty-demo'

describe('ranking duty demo preset', () => {
  it('starts from the concentration-ranking business defaults', () => {
    expect(defaultRankingDutyDraft()).toMatchObject({
      target: 'city',
      region: '河南省 / 平顶山市',
      timeKind: 'dayAccumulated',
      timeIntent: 'latestPublished',
      includeScreenshot: true,
      includeAnalysis: true,
      screenshotScope: 'tableOnly',
      theme: 'light',
    })
  })

  it('captures latest-published time intent without fixing the observed page time', () => {
    const definition = captureRankingDuty(defaultRankingDutyDraft(), '2026-07-15 08:00（模拟平台页面数据）')

    expect(definition.capability).toBe('mapairs.concentration-ranking')
    expect(definition.timeIntent).toBe('latestPublished')
    expect(definition.observedAt).toContain('08:00')
  })
})
