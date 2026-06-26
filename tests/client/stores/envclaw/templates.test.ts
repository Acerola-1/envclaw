import { describe, it, expect } from 'vitest'
import { TEMPLATE_LIST, type ScenarioTemplate } from '@/stores/envclaw/templates'

describe('ScenarioTemplate constants', () => {
  it('has exactly 4 templates', () => {
    expect(TEMPLATE_LIST).toHaveLength(4)
  })

  it('only data-broadcast is available', () => {
    const available = TEMPLATE_LIST.filter((t) => t.available)
    expect(available).toHaveLength(1)
    expect(available[0].id).toBe('data-broadcast')
  })

  it('data-broadcast has non-empty roleBasePrompt', () => {
    const broadcast = TEMPLATE_LIST.find((t) => t.id === 'data-broadcast')!
    expect(broadcast.roleBasePrompt.length).toBeGreaterThan(10)
  })

  it('unavailable templates have empty roleBasePrompt', () => {
    const unavailable = TEMPLATE_LIST.filter((t) => !t.available)
    for (const t of unavailable) {
      expect(t.roleBasePrompt).toBe('')
    }
  })

  it('each template has required fields', () => {
    for (const t of TEMPLATE_LIST) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.icon).toBeTruthy()
      expect(Array.isArray(t.tags)).toBe(true)
      expect(typeof t.available).toBe('boolean')
    }
  })
})
