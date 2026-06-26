import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { usePromptAssembly } from '@/composables/envclaw/usePromptAssembly'

describe('usePromptAssembly', () => {
  it('assembles prompt from base + platform + functions + supplement', () => {
    const { assembledPrompt, promptSegments } = usePromptAssembly({
      roleBasePrompt: ref('你是数据播报助手'),
      selectedPlatform: ref({
        name: '数智大气',
        operationPrompt: '登录 mapairs.com，进入空气质量监测模块。',
      }),
      selectedFunctions: ref([
        { name: '小时播报', prompt: '读取最近一小时 PM2.5 数据。' },
        { name: '城市排名', prompt: '读取河南省 18 地市排名。' },
      ]),
      supplement: ref('只播报平顶山数据'),
    })

    expect(assembledPrompt.value).toBe(
      '你是数据播报助手\n\n登录 mapairs.com，进入空气质量监测模块。\n\n读取最近一小时 PM2.5 数据。\n\n读取河南省 18 地市排名。\n\n只播报平顶山数据',
    )

    expect(promptSegments.value).toHaveLength(4)
    expect(promptSegments.value[0]).toEqual({
      tag: '角色基底',
      kind: 'base',
      text: '你是数据播报助手',
    })
    expect(promptSegments.value[1].kind).toBe('platform')
    expect(promptSegments.value[2].kind).toBe('function')
    expect(promptSegments.value[3].kind).toBe('function')
  })

  it('returns empty string when nothing is set', () => {
    const { assembledPrompt } = usePromptAssembly({
      roleBasePrompt: ref(''),
      selectedPlatform: ref(null),
      selectedFunctions: ref([]),
      supplement: ref(''),
    })

    expect(assembledPrompt.value).toBe('')
  })

  it('skips supplement when empty or whitespace-only', () => {
    const { assembledPrompt } = usePromptAssembly({
      roleBasePrompt: ref('你是助手'),
      selectedPlatform: ref(null),
      selectedFunctions: ref([]),
      supplement: ref('   '),
    })

    expect(assembledPrompt.value).toBe('你是助手')
  })

  it('updates reactively when selectedFunctions change', () => {
    const fns = ref<Array<{ name: string; prompt: string }>>([])
    const { assembledPrompt } = usePromptAssembly({
      roleBasePrompt: ref('你是助手'),
      selectedPlatform: ref(null),
      selectedFunctions: fns,
      supplement: ref(''),
    })

    expect(assembledPrompt.value).toBe('你是助手')

    fns.value = [{ name: '小时播报', prompt: '读取数据。' }]
    expect(assembledPrompt.value).toBe('你是助手\n\n读取数据。')
  })

  it('works with only base prompt', () => {
    const { assembledPrompt, promptSegments } = usePromptAssembly({
      roleBasePrompt: ref('你是数据播报助手'),
      selectedPlatform: ref(null),
      selectedFunctions: ref([]),
      supplement: ref(''),
    })

    expect(assembledPrompt.value).toBe('你是数据播报助手')
    expect(promptSegments.value).toHaveLength(1)
    expect(promptSegments.value[0].kind).toBe('base')
  })
})
