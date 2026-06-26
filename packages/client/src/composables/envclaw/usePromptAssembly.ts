import { computed, type Ref } from 'vue'

/** 提示词段——用于预览区渲染 */
export interface PromptSegment {
  /** 段标签，如"角色基底"、"平台 · 数智大气"、"功能 · 小时播报" */
  tag: string
  /** 段类型，控制标签颜色 */
  kind: 'base' | 'platform' | 'function'
  /** 段内容 */
  text: string
}

export interface UsePromptAssemblyOptions {
  /** 模板角色基底 */
  roleBasePrompt: Ref<string>
  /** 当前选中的平台（null = 未选） */
  selectedPlatform: Ref<{ name: string; url?: string; operationPrompt: string } | null>
  /** 当前选中的功能列表 */
  selectedFunctions: Ref<Array<{ name: string; prompt: string }>>
  /** 用户补充说明 */
  supplement: Ref<string>
}

/**
 * 提示词组装 composable
 *
 * 组装公式:
 * 最终 prompt = 模板角色基底 + 平台操作提示词 + Σ 已选功能提示词 + 用户补充说明
 */
export function usePromptAssembly(options: UsePromptAssemblyOptions) {
  const { roleBasePrompt, selectedPlatform, selectedFunctions, supplement } = options

  /** 结构化段——供 PromptPreview 组件渲染带标签的预览 */
  const promptSegments = computed<PromptSegment[]>(() => {
    const segments: PromptSegment[] = []

    // 1. 角色基底
    if (roleBasePrompt.value) {
      segments.push({
        tag: '角色基底',
        kind: 'base',
        text: roleBasePrompt.value,
      })
    }

    // 2. 平台操作提示词
    if (selectedPlatform.value) {
      const platformText = selectedPlatform.value.url
        ? `网址: ${selectedPlatform.value.url}\n${selectedPlatform.value.operationPrompt}`
        : selectedPlatform.value.operationPrompt
      segments.push({
        tag: `平台 · ${selectedPlatform.value.name}`,
        kind: 'platform',
        text: platformText,
      })
    }

    // 3. 已选功能提示词
    for (const fn of selectedFunctions.value) {
      segments.push({
        tag: `功能 · ${fn.name}`,
        kind: 'function',
        text: fn.prompt,
      })
    }

    return segments
  })

  /** 最终拼装的完整提示词文本 */
  const assembledPrompt = computed(() => {
    const parts: string[] = []

    for (const seg of promptSegments.value) {
      if (seg.text) {
        parts.push(seg.text)
      }
    }

    // 4. 用户补充说明
    if (supplement.value.trim()) {
      parts.push(supplement.value.trim())
    }

    return parts.join('\n\n')
  })

  return { promptSegments, assembledPrompt }
}
