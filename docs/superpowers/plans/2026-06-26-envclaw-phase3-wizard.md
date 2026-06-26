# 环保管家差异化改造 — Phase 3: 创建向导

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现创建向导——核心差异化功能，让用户通过"选平台 → 选功能 → 自动组装提示词与技能"完成值守任务创建，消除手写提示词摩擦。

**Architecture:** 向导为右侧滑出面板（非弹窗），左侧任务列表保持可见。面板内含模式切换（模板向导 / AI 引导占位），模板向导为单页表单，7 个字段自上而下排列。提示词组装逻辑抽为 composable（`usePromptAssembly`），随勾选实时计算。最终调用 `useJobsStore().createJob()` 走 `POST /api/hermes/jobs` 真实接口创建任务。

**Tech Stack:** Vue 3.5 + TypeScript + Composition API + Pinia 3 (setup stores) + Naive UI 2.44 + vue-i18n | 复用 SchedulePicker / useJobsStore / usePlatformsStore / useTemplatesStore / fetchSkills

## Global Constraints

- Vue 组件必须用 `<script setup lang="ts">` + Composition API
- Pinia store 用 setup store 语法（`defineStore('name', () => {...})`）
- 每个新用户可见字符串必须加到 `packages/client/src/i18n/locales/en.ts` 和 `zh.ts` 的 `envclaw` 命名空间
- 使用 `import { request } from '@/api/client'` 发请求，不引入 axios
- 图标用 Lucide 风格 SVG（stroke-width 1.6），不使用 emoji
- 向导最终调用 `useJobsStore().createJob()` 创建任务，走 `POST /api/hermes/jobs` 真实接口
- 技能列表走 `GET /api/hermes/skills` 真实接口（`fetchSkills`）
- 推送平台列表复用现有 `platformList` 数据（从 `CreateGuardTaskModal.vue` 提取为共享常量）
- 本期只落地"数据播报"模板向导，AI 引导只做入口占位
- 不要 commit 步骤——用户要求完成前 4 个 Phase 后再统一 commit

---

## File Structure

### 新建文件

| 文件 | 职责 |
|---|---|
| `packages/client/src/composables/envclaw/usePromptAssembly.ts` | 提示词组装 composable |
| `packages/client/src/composables/envclaw/useSkillList.ts` | 技能列表加载 composable |
| `packages/client/src/constants/envclaw/deliverPlatforms.ts` | 推送平台常量（从 CreateGuardTaskModal 提取） |
| `packages/client/src/components/envclaw/wizard/TaskWizard.vue` | 向导面板主组件（右侧滑出面板壳 + 模式切换） |
| `packages/client/src/components/envclaw/wizard/TemplateWizard.vue` | 模板向导表单（7 个字段） |
| `packages/client/src/components/envclaw/wizard/AiGuidePlaceholder.vue` | AI 引导占位组件 |
| `packages/client/src/components/envclaw/wizard/PromptPreview.vue` | 提示词组装预览（只读 + 补充说明） |
| `packages/client/src/components/envclaw/wizard/FunctionSelector.vue` | 平台功能选择器（多选卡片） |
| `packages/client/src/components/envclaw/wizard/SkillSelector.vue` | 技能选择器（多选 chip） |
| `packages/client/src/components/envclaw/wizard/DeliverSelector.vue` | 推送平台选择器（多选 chip） |
| `tests/client/composables/envclaw/usePromptAssembly.test.ts` | 提示词组装单元测试 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `packages/client/src/views/envclaw/WorkstationHome.vue` | 集成向导面板，场景卡片点击打开向导 |
| `packages/client/src/components/envclaw/workstation/ScenarioGrid.vue` | 点击可用卡片 emit `select` 事件，不再跳路由 |
| `packages/client/src/i18n/locales/zh.ts` | 新增 `envclaw.wizard` 命名空间 |
| `packages/client/src/i18n/locales/en.ts` | 新增 `envclaw.wizard` 命名空间 |

---

## Task 1: 提示词组装逻辑（composable: usePromptAssembly）

**Files:**
- Create: `packages/client/src/composables/envclaw/usePromptAssembly.ts`
- Create: `tests/client/composables/envclaw/usePromptAssembly.test.ts`

**Interfaces:**
- Consumes:
  - `ScenarioTemplate.roleBasePrompt: string` — 模板角色基底
  - `Platform.operationPrompt: string` — 平台操作提示词
  - `PlatformFunction[]` — 每个有 `id/name/prompt`
  - `string` — 用户补充说明
- Produces:
  - `usePromptAssembly()` composable，返回 `assembledPrompt: ComputedRef<string>` 和 `promptSegments: ComputedRef<PromptSegment[]>`

- [ ] **Step 1: 创建 composable**

```ts
// packages/client/src/composables/envclaw/usePromptAssembly.ts
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
  selectedPlatform: Ref<{ name: string; operationPrompt: string } | null>
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
      segments.push({
        tag: `平台 · ${selectedPlatform.value.name}`,
        kind: 'platform',
        text: selectedPlatform.value.operationPrompt,
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
```

- [ ] **Step 2: 写单元测试**

```ts
// tests/client/composables/envclaw/usePromptAssembly.test.ts
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
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npm run test -- tests/client/composables/envclaw/usePromptAssembly.test.ts`
Expected: PASS (5 tests)

---

## Task 2: 共享常量与技能列表 composable

**Files:**
- Create: `packages/client/src/constants/envclaw/deliverPlatforms.ts`
- Create: `packages/client/src/composables/envclaw/useSkillList.ts`

**Interfaces:**
- Consumes:
  - `fetchSkills` from `@/api/hermes/skills` — `GET /api/hermes/skills`
  - 现有 `CreateGuardTaskModal.vue` 中的 `platformList` 数据
- Produces:
  - `DELIVER_PLATFORMS` 常量 — 12 个推送平台选项
  - `useSkillList()` composable — 加载技能列表，返回 `allSkills: Ref<SkillInfo[]>`

- [ ] **Step 1: 提取推送平台常量**

```ts
// packages/client/src/constants/envclaw/deliverPlatforms.ts

/** 推送平台选项——复用自 CreateGuardTaskModal 的 platformList */
export interface DeliverPlatform {
  key: string
  name: string
  icon: string
}

export const DELIVER_PLATFORMS: DeliverPlatform[] = [
  { key: 'origin', name: '原始会话', icon: '💬' },
  { key: 'local', name: '本地', icon: '🖥️' },
  { key: 'telegram', name: 'Telegram', icon: '✈️' },
  { key: 'discord', name: 'Discord', icon: '💬' },
  { key: 'slack', name: 'Slack', icon: '💼' },
  { key: 'whatsapp', name: 'WhatsApp', icon: '📱' },
  { key: 'matrix', name: 'Matrix', icon: '🔗' },
  { key: 'feishu', name: '飞书', icon: '🐦' },
  { key: 'dingtalk', name: '钉钉', icon: '🔷' },
  { key: 'qqbot', name: 'QQBot', icon: '🐧' },
  { key: 'weixin', name: '微信', icon: '💚' },
  { key: 'wecom', name: '企业微信', icon: '🏢' },
]
```

- [ ] **Step 2: 创建技能列表 composable**

```ts
// packages/client/src/composables/envclaw/useSkillList.ts
import { ref, onMounted, type Ref } from 'vue'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'

/**
 * 技能列表 composable
 *
 * 从 GET /api/hermes/skills 加载所有技能（跨分类扁平化），
 * 供向导的"可选技能"字段消费。
 */
export function useSkillList() {
  const allSkills = ref<SkillInfo[]>([]) as Ref<SkillInfo[]>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await fetchSkills()
      // 扁平化：从 categories 中提取所有 skill
      const skills: SkillInfo[] = []
      for (const cat of data.categories) {
        for (const skill of cat.skills) {
          skills.push(skill)
        }
      }
      // 追加 archived
      if (data.archived) {
        skills.push(...data.archived)
      }
      allSkills.value = skills
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  return { allSkills, loading, error, reload: load }
}
```

---

## Task 3: 向导子组件（PromptPreview / FunctionSelector / SkillSelector / DeliverSelector）

**Files:**
- Create: `packages/client/src/components/envclaw/wizard/PromptPreview.vue`
- Create: `packages/client/src/components/envclaw/wizard/FunctionSelector.vue`
- Create: `packages/client/src/components/envclaw/wizard/SkillSelector.vue`
- Create: `packages/client/src/components/envclaw/wizard/DeliverSelector.vue`

**Interfaces:**
- Consumes:
  - `PromptSegment[]` from `usePromptAssembly`
  - `PlatformFunction[]` from `usePlatformsStore`
  - `SkillInfo[]` from `useSkillList`
  - `DeliverPlatform[]` from `DELIVER_PLATFORMS`
- Produces: 4 个可复用子组件，供 `TemplateWizard.vue` 组合使用

- [ ] **Step 1: 创建 PromptPreview 组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/PromptPreview.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PromptSegment } from '@/composables/envclaw/usePromptAssembly'

const { t } = useI18n()

const props = defineProps<{
  segments: PromptSegment[]
  supplement: string
}>()

const emit = defineEmits<{
  'update:supplement': [value: string]
}>()
</script>

<template>
  <div class="prompt-section">
    <!-- 已组装提示词（只读预览） -->
    <div class="prompt-assembled">
      <div
        v-for="(seg, i) in segments"
        :key="i"
        class="pa-seg"
      >
        <span :class="['pa-tag', seg.kind]">{{ seg.tag }}</span>
        <div class="pa-text">{{ seg.text }}</div>
      </div>
      <div v-if="segments.length === 0" class="pa-empty">
        {{ t('envclaw.wizard.promptEmpty') }}
      </div>
    </div>

    <!-- 补充说明（可编辑） -->
    <textarea
      class="prompt-supplement"
      :value="supplement"
      :placeholder="t('envclaw.wizard.supplementPlaceholder')"
      @input="emit('update:supplement', ($event.target as HTMLTextAreaElement).value)"
    />
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      {{ t('envclaw.wizard.promptHint') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.prompt-section { display: flex; flex-direction: column; gap: 8px; }

.prompt-assembled {
  background: #161616; border: 1px solid #3a3a3a; border-radius: 8px;
  padding: 12px 13px; font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, monospace;
  font-size: 12px; line-height: 1.7; color: #a0a0a0;
  max-height: 220px; overflow-y: auto;
  &::-webkit-scrollbar { width: 7px; }
  &::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 6px; }
}

.pa-seg {
  margin-bottom: 11px; padding-left: 10px; border-left: 2px solid #555;
  &:last-child { margin-bottom: 0; }
}

.pa-tag {
  display: inline-block; font-family: 'Inter', system-ui, sans-serif;
  font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 8px; margin-bottom: 5px;
  &.base { background: rgba(106,159,217,0.14); color: #6a9fd9; }
  &.platform { background: rgba(224,164,88,0.14); color: #e0a458; }
  &.function { background: rgba(102,187,106,0.14); color: #66bb6a; }
}

.pa-text { color: #a0a0a0; white-space: pre-wrap; }

.pa-empty { color: #666; font-family: 'Inter', system-ui, sans-serif; font-size: 12px; text-align: center; padding: 14px; }

.prompt-supplement {
  width: 100%; padding: 10px 12px; background: #252525; border: 1px solid #3a3a3a;
  border-radius: 8px; color: #e0e0e0; font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
  resize: vertical; min-height: 64px; line-height: 1.5;
  &:focus { outline: none; border-color: #555; }
}

.field-hint {
  font-size: 11px; color: #666; display: flex; align-items: center; gap: 5px;
}
</style>
```

- [ ] **Step 2: 创建 FunctionSelector 组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/FunctionSelector.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

export interface FunctionItem {
  id: string
  name: string
  prompt: string
}

const props = defineProps<{
  functions: FunctionItem[]
  modelValue: string[] /** 已选功能 ID 列表 */
}>()

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

function toggle(id: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(id)
  }
  emit('update:modelValue', current)
}

function isSelected(id: string): boolean {
  return props.modelValue.includes(id)
}
</script>

<template>
  <div class="function-selector">
    <div v-if="functions.length === 0" class="func-empty">
      {{ t('envclaw.wizard.selectPlatformFirst') }}
    </div>
    <div
      v-for="fn in functions"
      :key="fn.id"
      :class="['func-card', { sel: isSelected(fn.id) }]"
      @click="toggle(fn.id)"
    >
      <div class="func-check">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <div class="func-info">
        <h5>{{ fn.name }}</h5>
        <p>{{ fn.prompt }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.func-empty {
  padding: 14px; border: 1px dashed #3a3a3a; border-radius: 8px;
  font-size: 12px; color: #666; text-align: center;
}

.func-card {
  display: flex; align-items: flex-start; gap: 11px;
  padding: 12px 13px; background: #252525; border: 1px solid #3a3a3a;
  border-radius: 8px; cursor: pointer; margin-bottom: 8px; transition: 0.15s;
  &:hover { border-color: #555; }
  &.sel { border-color: #66bb6a; background: rgba(102,187,106,0.14); }
}

.func-check {
  width: 18px; height: 18px; border-radius: 5px;
  border: 1.5px solid #555; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; margin-top: 1px; color: transparent; transition: 0.15s;
  .func-card.sel & { background: #66bb6a; border-color: #66bb6a; color: #1a1a1a; }
}

.func-info {
  h5 { font-size: 13px; font-weight: 600; }
  p { font-size: 11.5px; color: #666; margin-top: 3px; line-height: 1.5; }
}
</style>
```

- [ ] **Step 3: 创建 SkillSelector 组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/SkillSelector.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SkillInfo } from '@/api/hermes/skills'

const { t } = useI18n()

const props = defineProps<{
  /** 全部可选技能 */
  allSkills: SkillInfo[]
  /** 已选技能 name 列表（v-model） */
  modelValue: string[]
  /** 平台自动带入的技能 name 列表（这些预填且标记） */
  platformSkills: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [names: string[]]
}>()

function toggle(name: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(name)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(name)
  }
  emit('update:modelValue', current)
}

function isSelected(name: string): boolean {
  return props.modelValue.includes(name)
}

function isFromPlatform(name: string): boolean {
  return props.platformSkills.includes(name)
}
</script>

<template>
  <div class="skill-selector">
    <div v-if="loading" class="skill-loading">{{ t('envclaw.wizard.loadingSkills') }}</div>
    <div v-else-if="allSkills.length === 0" class="skill-empty">{{ t('envclaw.wizard.noSkills') }}</div>
    <div v-else class="chips">
      <div
        v-for="skill in allSkills"
        :key="skill.name"
        :class="['chip', { sel: isSelected(skill.name) }]"
        @click="toggle(skill.name)"
      >
        <span class="chk">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        {{ skill.name }}
        <span v-if="isFromPlatform(skill.name)" class="chip-badge">{{ t('envclaw.wizard.fromPlatform') }}</span>
      </div>
    </div>
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
      {{ t('envclaw.wizard.skillHint') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.chips { display: flex; gap: 7px; flex-wrap: wrap; }

.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 13px; border-radius: 14px; background: #252525;
  border: 1px solid #3a3a3a; font-size: 12.5px; color: #a0a0a0;
  cursor: pointer; transition: 0.15s; user-select: none;
  &:hover { border-color: #555; color: #e0e0e0; }
  &.sel { background: rgba(255,255,255,0.1); border-color: #a0a0a0; color: #e0e0e0; }
  &.sel .chk { color: #66bb6a; }
}

.chk { display: none; }
.chip.sel .chk { display: inline-flex; }

.chip-badge {
  font-size: 9px; padding: 0 5px; border-radius: 6px;
  background: rgba(224,164,88,0.14); color: #e0a458; font-weight: 600;
}

.skill-loading, .skill-empty {
  font-size: 12px; color: #666; padding: 8px 0;
}

.field-hint {
  font-size: 11px; color: #666; margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}
</style>
```

- [ ] **Step 4: 创建 DeliverSelector 组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/DeliverSelector.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DELIVER_PLATFORMS, type DeliverPlatform } from '@/constants/envclaw/deliverPlatforms'

const { t } = useI18n()

const props = defineProps<{
  /** 已选推送平台 key 列表（v-model） */
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [keys: string[]]
}>()

function toggle(key: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(key)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(key)
  }
  emit('update:modelValue', current)
}

function isSelected(key: string): boolean {
  return props.modelValue.includes(key)
}
</script>

<template>
  <div class="deliver-selector">
    <div class="chips">
      <div
        v-for="plat in DELIVER_PLATFORMS"
        :key="plat.key"
        :class="['chip', { sel: isSelected(plat.key) }]"
        @click="toggle(plat.key)"
      >
        <span class="chk">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        {{ plat.name }}
      </div>
    </div>
    <div class="field-hint">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
      </svg>
      {{ t('envclaw.wizard.deliverHint') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.chips { display: flex; gap: 7px; flex-wrap: wrap; }

.chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 13px; border-radius: 14px; background: #252525;
  border: 1px solid #3a3a3a; font-size: 12.5px; color: #a0a0a0;
  cursor: pointer; transition: 0.15s; user-select: none;
  &:hover { border-color: #555; color: #e0e0e0; }
  &.sel { background: rgba(255,255,255,0.1); border-color: #a0a0a0; color: #e0e0e0; }
  &.sel .chk { color: #66bb6a; }
}

.chk { display: none; }
.chip.sel .chk { display: inline-flex; }

.field-hint {
  font-size: 11px; color: #666; margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}
</style>
```

---

## Task 4: 模板向导表单（TemplateWizard.vue）

**Files:**
- Create: `packages/client/src/components/envclaw/wizard/TemplateWizard.vue`

**Interfaces:**
- Consumes:
  - `useTemplatesStore` — 获取模板 `roleBasePrompt`
  - `usePlatformsStore` — 获取平台列表（含 `functions/skills/operationPrompt`）
  - `useSkillList` — 获取全部技能
  - `usePromptAssembly` — 组装提示词
  - `SchedulePicker` — 执行频率
  - `PromptPreview` / `FunctionSelector` / `SkillSelector` / `DeliverSelector` — 子组件
  - `useJobsStore().createJob()` — 最终创建任务
- Produces: 完整的 7 字段单页表单，提交后调用 `createJob` 创建任务

- [ ] **Step 1: 创建 TemplateWizard 组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/TemplateWizard.vue -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import { useTemplatesStore } from '@/stores/envclaw/templates'
import { usePlatformsStore } from '@/stores/envclaw/platforms'
import { useJobsStore } from '@/stores/hermes/jobs'
import { usePromptAssembly } from '@/composables/envclaw/usePromptAssembly'
import { useSkillList } from '@/composables/envclaw/useSkillList'
import SchedulePicker from '@/components/hermes/shared/SchedulePicker.vue'
import PromptPreview from './PromptPreview.vue'
import FunctionSelector from './FunctionSelector.vue'
import SkillSelector from './SkillSelector.vue'
import DeliverSelector from './DeliverSelector.vue'

const { t } = useI18n()
const message = useMessage()
const templatesStore = useTemplatesStore()
const platformsStore = usePlatformsStore()
const jobsStore = useJobsStore()
const { allSkills, loading: skillsLoading } = useSkillList()

const props = defineProps<{
  templateId: string
}>()

const emit = defineEmits<{
  created: []
  cancel: []
}>()

// ── 1. 任务名称 ──
const taskName = ref('')

// ── 2. 数据平台 ──
const selectedPlatformId = ref<string | null>(null)

const selectedPlatform = computed(() => {
  if (!selectedPlatformId.value) return null
  return platformsStore.platforms.find((p) => p.id === selectedPlatformId.value) ?? null
})

// ── 3. 功能（多选） ──
const selectedFunctionIds = ref<string[]>([])

const platformFunctions = computed(() => {
  if (!selectedPlatform.value) return []
  return selectedPlatform.value.functions ?? []
})

const selectedFunctionObjects = computed(() => {
  return platformFunctions.value.filter((fn) => selectedFunctionIds.value.includes(fn.id))
})

// ── 4. 执行提示词 ──
const template = computed(() => templatesStore.getById(props.templateId))
const roleBasePrompt = computed(() => template.value?.roleBasePrompt ?? '')
const supplement = ref('')

const { promptSegments, assembledPrompt } = usePromptAssembly({
  roleBasePrompt,
  selectedPlatform: computed(() =>
    selectedPlatform.value
      ? { name: selectedPlatform.value.name, operationPrompt: selectedPlatform.value.operationPrompt }
      : null,
  ),
  selectedFunctions: selectedFunctionObjects,
  supplement,
})

// ── 5. 执行频率 ──
const schedule = ref('0 8 * * *')

// ── 6. 推送平台 ──
const selectedDeliverKeys = ref<string[]>([])

// ── 7. 可选技能 ──
/** 平台自动带入的技能 */
const platformSkillNames = computed(() => {
  if (!selectedPlatform.value) return []
  return selectedPlatform.value.skills ?? []
})

/** 已选技能 = 平台技能 + 用户手动增删 */
const selectedSkillNames = ref<string[]>([])

// 当平台切换时，重置功能选择，并将平台技能预填到已选技能
watch(selectedPlatformId, (newId) => {
  selectedFunctionIds.value = []
  if (newId) {
    const plat = platformsStore.platforms.find((p) => p.id === newId)
    if (plat) {
      selectedSkillNames.value = [...(plat.skills ?? [])]
    }
  } else {
    selectedSkillNames.value = []
  }
})

// ── 提交 ──
const submitting = ref(false)

async function handleSubmit() {
  // 校验
  if (!taskName.value.trim()) {
    message.warning(t('envclaw.wizard.nameRequired'))
    return
  }
  if (!selectedPlatformId.value) {
    message.warning(t('envclaw.wizard.platformRequired'))
    return
  }
  if (!schedule.value) {
    message.warning(t('envclaw.wizard.scheduleRequired'))
    return
  }

  submitting.value = true
  try {
    // 组装 deliver 字符串：逗号分隔的 key
    const deliverStr = selectedDeliverKeys.value.length > 0
      ? selectedDeliverKeys.value.join(',')
      : undefined

    await jobsStore.createJob({
      name: taskName.value.trim(),
      schedule: schedule.value,
      prompt: assembledPrompt.value || undefined,
      deliver: deliverStr,
      skills: selectedSkillNames.value.length > 0 ? selectedSkillNames.value : undefined,
    })

    message.success(t('envclaw.wizard.createSuccess'))
    emit('created')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    message.error(t('envclaw.wizard.createFailed', { error: msg }))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="template-wizard">
    <div class="wiz-body">
      <!-- 1 任务名称 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">1</span>
          {{ t('envclaw.wizard.taskName') }}
          <span class="req">*</span>
        </div>
        <input
          v-model="taskName"
          class="input"
          :placeholder="t('envclaw.wizard.taskNamePlaceholder')"
        />
      </div>

      <!-- 2 数据平台 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">2</span>
          {{ t('envclaw.wizard.dataPlatform') }}
          <span class="req">*</span>
        </div>
        <select v-model="selectedPlatformId" class="select">
          <option :value="null">{{ t('envclaw.wizard.selectPlatformPlaceholder') }}</option>
          <option
            v-for="plat in platformsStore.platforms"
            :key="plat.id"
            :value="plat.id"
          >
            {{ plat.name }}
          </option>
        </select>
        <div class="field-hint">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
          </svg>
          {{ t('envclaw.wizard.platformHint') }}
        </div>
      </div>

      <!-- 3 功能（选平台后出现） -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">3</span>
          {{ t('envclaw.wizard.platformFunctions') }}
          <span class="opt">{{ t('envclaw.wizard.multiSelectFromPlatform') }}</span>
        </div>
        <FunctionSelector
          :functions="platformFunctions"
          v-model="selectedFunctionIds"
        />
      </div>

      <!-- 4 执行提示词 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">4</span>
          {{ t('envclaw.wizard.executionPrompt') }}
        </div>
        <PromptPreview
          :segments="promptSegments"
          :supplement="supplement"
          @update:supplement="supplement = $event"
        />
      </div>

      <!-- 5 执行频率 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">5</span>
          {{ t('envclaw.wizard.executionFrequency') }}
          <span class="req">*</span>
        </div>
        <SchedulePicker v-model="schedule" />
      </div>

      <!-- 6 推送平台 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">6</span>
          {{ t('envclaw.wizard.deliverPlatform') }}
          <span class="opt">{{ t('envclaw.wizard.deliverOptional') }}</span>
        </div>
        <DeliverSelector v-model="selectedDeliverKeys" />
      </div>

      <!-- 7 可选技能 -->
      <div class="field">
        <div class="field-label">
          <span class="field-num">7</span>
          {{ t('envclaw.wizard.optionalSkills') }}
          <span class="opt">{{ t('envclaw.wizard.skillOptional') }}</span>
        </div>
        <SkillSelector
          :all-skills="allSkills"
          v-model="selectedSkillNames"
          :platform-skills="platformSkillNames"
          :loading="skillsLoading"
        />
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div class="wiz-foot">
      <button class="btn btn-ghost" @click="emit('cancel')">
        {{ t('envclaw.wizard.cancel') }}
      </button>
      <button
        class="btn btn-primary"
        :disabled="submitting"
        @click="handleSubmit"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {{ submitting ? t('envclaw.wizard.creating') : t('envclaw.wizard.createTask') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-wizard {
  display: flex; flex-direction: column; flex: 1; overflow: hidden;
}

.wiz-body {
  flex: 1; overflow-y: auto; padding: 18px 22px;
  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 6px; }
}

.field { margin-bottom: 20px; }

.field-label {
  font-size: 12.5px; color: #a0a0a0; margin-bottom: 8px; font-weight: 500;
  display: flex; align-items: center; gap: 6px;
}

.field-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 5px;
  background: #252525; border: 1px solid #3a3a3a;
  font-size: 10.5px; color: #a0a0a0; font-weight: 600;
}

.req { color: #d96a6a; }
.opt { color: #666; font-weight: 400; }

.input, .select {
  width: 100%; padding: 10px 12px; background: #252525;
  border: 1px solid #3a3a3a; border-radius: 8px;
  color: #e0e0e0; font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
  &:focus { outline: none; border-color: #555; }
}

.select {
  cursor: pointer; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 12px center;
}

.field-hint {
  font-size: 11px; color: #666; margin-top: 6px;
  display: flex; align-items: center; gap: 5px;
}

.wiz-foot {
  padding: 14px 22px; border-top: 1px solid #3a3a3a;
  display: flex; justify-content: flex-end; gap: 10px;
}

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  cursor: pointer; border: 1px solid transparent; transition: 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.btn-primary {
  background: #e0e0e0; color: #1a1a1a;
  &:hover:not(:disabled) { background: #fff; }
}

.btn-ghost {
  background: transparent; color: #e0e0e0; border-color: #555;
  &:hover { background: #252525; }
}
</style>
```

---

## Task 5: 向导面板主组件（TaskWizard.vue）+ AI 引导占位

**Files:**
- Create: `packages/client/src/components/envclaw/wizard/TaskWizard.vue`
- Create: `packages/client/src/components/envclaw/wizard/AiGuidePlaceholder.vue`

**Interfaces:**
- Consumes:
  - `TemplateWizard` — 模板向导子组件
  - `AiGuidePlaceholder` — AI 引导占位子组件
  - `ScenarioTemplate` — 当前模板
- Produces: 右侧滑出面板壳，含模式切换（模板向导 / AI 引导），emit `close` / `created` 事件

- [ ] **Step 1: 创建 AI 引导占位组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/AiGuidePlaceholder.vue -->
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="ai-placeholder">
    <div class="ai-avatar">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </svg>
    </div>
    <h3>{{ t('envclaw.wizard.aiGuideTitle') }}</h3>
    <p>{{ t('envclaw.wizard.aiGuideDesc') }}</p>
    <div class="ai-badge">{{ t('envclaw.wizard.comingSoon') }}</div>
  </div>
</template>

<style scoped lang="scss">
.ai-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 22px; text-align: center;
}

.ai-avatar {
  width: 56px; height: 56px; border-radius: 14px;
  background: rgba(106,159,217,0.14); color: #6a9fd9;
  display: flex; align-items: center; justify-content: center; margin-bottom: 18px;
}

h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
p { font-size: 13px; color: #a0a0a0; line-height: 1.6; max-width: 280px; }

.ai-badge {
  margin-top: 16px; padding: 4px 14px; border-radius: 12px;
  background: #252525; border: 1px dashed #555; color: #666; font-size: 12px;
}
</style>
```

- [ ] **Step 2: 创建 TaskWizard 主组件**

```vue
<!-- packages/client/src/components/envclaw/wizard/TaskWizard.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScenarioTemplate } from '@/stores/envclaw/templates'
import TemplateWizard from './TemplateWizard.vue'
import AiGuidePlaceholder from './AiGuidePlaceholder.vue'

const { t } = useI18n()

const props = defineProps<{
  template: ScenarioTemplate | null
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()

type WizardMode = 'template' | 'ai'
const mode = ref<WizardMode>('template')

const templateName = computed(() => props.template?.name ?? '')
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && template" class="task-wizard">
      <!-- 头部 -->
      <div class="wiz-head">
        <div class="wiz-head-top">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M3 11v2a1 1 0 0 0 1 1h3l4 4V6L7 10H4a1 1 0 0 0-1 1Z" />
              <path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" />
            </svg>
            {{ t('envclaw.wizard.newTask', { name: templateName }) }}
          </h3>
          <div class="wiz-close" @click="emit('close')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </div>
        </div>

        <!-- 模式切换 -->
        <div class="wiz-modes">
          <button
            :class="['wiz-mode', { active: mode === 'template' }]"
            @click="mode = 'template'"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            {{ t('envclaw.wizard.modeTemplate') }}
          </button>
          <button
            :class="['wiz-mode', { active: mode === 'ai' }]"
            @click="mode = 'ai'"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M12 8V4H8M4 8h16v12H4z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" />
            </svg>
            {{ t('envclaw.wizard.modeAi') }}
          </button>
        </div>
      </div>

      <!-- 模板向导 -->
      <TemplateWizard
        v-if="mode === 'template'"
        :template-id="template.id"
        @created="emit('created')"
        @cancel="emit('close')"
      />

      <!-- AI 引导占位 -->
      <AiGuidePlaceholder v-else />
    </div>
  </Transition>
</template>

<style scoped lang="scss>
.task-wizard {
  width: 560px; background: #2a2a2a; border-left: 1px solid #3a3a3a;
  display: flex; flex-direction: column; flex-shrink: 0;
}

.wiz-head { padding: 16px 22px 0; }

.wiz-head-top {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  h3 {
    font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 8px;
  }
}

.wiz-close {
  width: 28px; height: 28px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  color: #666; cursor: pointer;
  &:hover { background: #252525; color: #e0e0e0; }
}

.wiz-modes {
  display: flex; background: #252525; border: 1px solid #3a3a3a;
  border-radius: 8px; padding: 3px; gap: 2px;
}

.wiz-mode {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px; border-radius: 6px; font-size: 12.5px; font-weight: 500;
  color: #a0a0a0; background: transparent; border: none; cursor: pointer; transition: 0.15s;
  &:hover { color: #e0e0e0; }
  &.active { background: #e0e0e0; color: #1a1a1a; }
}

/* 滑入动画 */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-enter-from { transform: translateX(100%); opacity: 0; }
.slide-leave-to { transform: translateX(100%); opacity: 0; }
</style>
```

---

## Task 6: 集成到工作台首页

**Files:**
- Modify: `packages/client/src/views/envclaw/WorkstationHome.vue`
- Modify: `packages/client/src/components/envclaw/workstation/ScenarioGrid.vue`
- Modify: `packages/client/src/i18n/locales/zh.ts`
- Modify: `packages/client/src/i18n/locales/en.ts`

**Interfaces:**
- Consumes:
  - `TaskWizard` — 向导面板组件
  - `ScenarioGrid` — 场景卡片（emit `select` 事件）
  - `useJobsStore` — 活跃任务列表
- Produces: 工作台首页集成向导面板，场景卡片点击打开向导

- [ ] **Step 1: 修改 ScenarioGrid——点击可用卡片 emit select 事件**

修改 `packages/client/src/components/envclaw/workstation/ScenarioGrid.vue` 的 `handleClick` 函数，去掉路由跳转，只 emit 事件：

```ts
// 修改前（Phase 1 代码）:
function handleClick(tpl: ScenarioTemplate) {
  if (!tpl.available) return
  emit('select', tpl)
  // Phase 3 将改为打开向导面板,目前跳转占位
  router.push({ name: 'envclaw.jobs' })
}

// 修改后:
function handleClick(tpl: ScenarioTemplate) {
  if (!tpl.available) return
  emit('select', tpl)
}
```

同时移除 `import { useRouter } from 'vue-router'` 和 `const router = useRouter()` 这两行（如果不再需要）。

- [ ] **Step 2: 修改 WorkstationHome——集成向导面板**

修改 `packages/client/src/views/envclaw/WorkstationHome.vue`：

```vue
<!-- packages/client/src/views/envclaw/WorkstationHome.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useJobsStore } from '@/stores/hermes/jobs'
import type { Job } from '@/api/hermes/jobs'
import type { ScenarioTemplate } from '@/stores/envclaw/templates'
import OverviewBanner from '@/components/envclaw/workstation/OverviewBanner.vue'
import StatCards from '@/components/envclaw/workstation/StatCards.vue'
import ScenarioGrid from '@/components/envclaw/workstation/ScenarioGrid.vue'
import ActiveTasks from '@/components/envclaw/workstation/ActiveTasks.vue'
import PlatformBar from '@/components/envclaw/workstation/PlatformBar.vue'
import TaskWizard from '@/components/envclaw/wizard/TaskWizard.vue'

const jobsStore = useJobsStore()

// 向导状态
const wizardVisible = ref(false)
const wizardTemplate = ref<ScenarioTemplate | null>(null)

function openWizard(tpl: ScenarioTemplate) {
  wizardTemplate.value = tpl
  wizardVisible.value = true
}

function closeWizard() {
  wizardVisible.value = false
  wizardTemplate.value = null
}

async function onWizardCreated() {
  closeWizard()
  // 刷新任务列表
  await jobsStore.fetchJobs()
}

function onSelectJob(_job: Job) {
  // Phase 4: 打开任务详情
}

onMounted(() => {
  void jobsStore.fetchJobs()
})
</script>

<template>
  <div class="workstation-home">
    <div class="main-area">
      <OverviewBanner />
      <StatCards />
      <ScenarioGrid @select="openWizard" />
      <ActiveTasks @select-job="onSelectJob" />
      <PlatformBar />
    </div>

    <!-- 右侧向导面板 -->
    <TaskWizard
      :template="wizardTemplate"
      :visible="wizardVisible"
      @close="closeWizard"
      @created="onWizardCreated"
    />
  </div>
</template>

<style scoped lang="scss">
.workstation-home {
  display: flex; height: 100%;
}

.main-area {
  flex: 1; max-width: 1080px; margin: 0 auto;
  padding: 28px 32px 48px; overflow-y: auto;
}
</style>
```

- [ ] **Step 3: 添加 i18n 条目（zh.ts）**

在 `packages/client/src/i18n/locales/zh.ts` 的 `envclaw` 命名空间中新增 `wizard` 子对象：

```ts
wizard: {
  newTask: '新建{name}任务',
  modeTemplate: '模板向导',
  modeAi: 'AI 引导',
  taskName: '任务名称',
  taskNamePlaceholder: '给任务起个名字',
  dataPlatform: '数据平台',
  selectPlatformPlaceholder: '请选择平台…',
  platformHint: '任务运行时自动使用该平台已保存的账号登录，平台技能将自动加入本任务',
  platformFunctions: '平台功能',
  multiSelectFromPlatform: '（可多选，来自平台配置）',
  selectPlatformFirst: '请先选择一个数据平台，平台已配置的功能会列在这里',
  executionPrompt: '执行提示词',
  promptEmpty: '选择平台和功能后，提示词将自动组装在此处',
  supplementPlaceholder: '补充说明（可选）：在此追加你的自定义要求，会拼接到上面已组装的提示词之后…',
  promptHint: '上方为系统按「角色基底 + 平台 + 功能」自动组装（只读），下方补充框为你的自定义内容',
  executionFrequency: '执行频率',
  deliverPlatform: '推送平台',
  deliverOptional: '（标记任务归属，不保证实际投递）',
  deliverHint: '选择推送渠道，任务运行结果将尝试推送到所选平台',
  optionalSkills: '可选技能',
  skillOptional: '（单/多选，来自技能管理）',
  skillHint: '带标记的为所选平台自动带入的技能，可增删',
  fromPlatform: '平台',
  loadingSkills: '加载技能列表…',
  noSkills: '暂无可用技能',
  nameRequired: '请输入任务名称',
  platformRequired: '请选择数据平台',
  scheduleRequired: '请设置执行频率',
  createTask: '创建任务',
  creating: '创建中…',
  createSuccess: '任务创建成功',
  createFailed: '创建失败：{error}',
  cancel: '取消',
  aiGuideTitle: 'AI 引导创建',
  aiGuideDesc: 'AI 将逐步引导你配置任务，适合需求不在模板内或不确定如何配置时使用。',
  comingSoon: '即将推出',
},
```

- [ ] **Step 4: 添加 i18n 条目（en.ts）**

在 `packages/client/src/i18n/locales/en.ts` 的 `envclaw` 命名空间中新增 `wizard` 子对象：

```ts
wizard: {
  newTask: 'New {name} Task',
  modeTemplate: 'Template Wizard',
  modeAi: 'AI Guide',
  taskName: 'Task Name',
  taskNamePlaceholder: 'Give the task a name',
  dataPlatform: 'Data Platform',
  selectPlatformPlaceholder: 'Select a platform…',
  platformHint: 'The task will automatically use the saved account to log in, and platform skills will be added automatically',
  platformFunctions: 'Platform Functions',
  multiSelectFromPlatform: '(multi-select, from platform config)',
  selectPlatformFirst: 'Select a data platform first, its configured functions will appear here',
  executionPrompt: 'Execution Prompt',
  promptEmpty: 'Prompt will be assembled here after selecting platform and functions',
  supplementPlaceholder: 'Supplement (optional): Add your custom requirements here, appended after the assembled prompt…',
  promptHint: 'Above is auto-assembled from "role base + platform + functions" (read-only), below is your custom content',
  executionFrequency: 'Execution Frequency',
  deliverPlatform: 'Deliver Platform',
  deliverOptional: '(marks task ownership, delivery not guaranteed)',
  deliverHint: 'Select delivery channels, task results will be pushed to selected platforms',
  optionalSkills: 'Optional Skills',
  skillOptional: '(single/multi-select, from skill management)',
  skillHint: 'Marked skills are auto-included from the platform, you can add or remove',
  fromPlatform: 'Platform',
  loadingSkills: 'Loading skills…',
  noSkills: 'No skills available',
  nameRequired: 'Please enter a task name',
  platformRequired: 'Please select a data platform',
  scheduleRequired: 'Please set execution frequency',
  createTask: 'Create Task',
  creating: 'Creating…',
  createSuccess: 'Task created successfully',
  createFailed: 'Creation failed: {error}',
  cancel: 'Cancel',
  aiGuideTitle: 'AI-Guided Creation',
  aiGuideDesc: 'AI will guide you step by step to configure a task, useful when your needs are not covered by templates.',
  comingSoon: 'Coming Soon',
},
```

- [ ] **Step 5: 运行构建确认无编译错误**

Run: `npm run build`
Expected: 成功（无 TypeScript 编译错误）

---

## Task 7: 验证——创建任务后能在值守任务列表看到

**Files:** 无新文件，仅验证操作

**Interfaces:**
- Consumes: Task 1-6 产出的全部组件和 composable
- Produces: 端到端验证确认

- [ ] **Step 1: 运行 dev 环境**

Run: `npm run dev`

- [ ] **Step 2: 验证向导面板打开**

1. 访问 `http://localhost:8649/#/envclaw`
2. 点击"数据播报"场景卡片
3. 预期：右侧滑出向导面板，标题"新建数据播报任务"
4. 预期：面板顶部有"模板向导"和"AI 引导"两个模式切换按钮
5. 点击"AI 引导"——预期显示占位页面（"即将推出"）
6. 切回"模板向导"——预期显示 7 个字段的表单

- [ ] **Step 3: 验证提示词组装**

1. 在"数据平台"下拉框选择一个已配置的平台（需先在平台管理中配置至少一个平台）
2. 预期：功能列表出现（来自该平台的 functions）
3. 勾选一个功能
4. 预期：提示词预览区实时更新，显示"角色基底"段 + "平台 · xxx"段 + "功能 · xxx"段
5. 再勾选另一个功能
6. 预期：提示词预览区新增一个"功能"段
7. 取消勾选
8. 预期：对应段消失
9. 在补充说明框输入自定义内容
10. 预期：最终 assembledPrompt 包含补充说明

- [ ] **Step 4: 验证技能预填**

1. 选择平台后
2. 预期：技能选择区中，该平台配置的技能自动预填（带"平台"标记）
3. 可以手动增删技能

- [ ] **Step 5: 验证创建任务**

1. 填写任务名称（如"测试播报任务"）
2. 选择数据平台
3. 勾选功能
4. 设置执行频率
5. 点击"创建任务"
6. 预期：提示"任务创建成功"，向导面板关闭
7. 预期：活跃任务列表刷新，新任务出现在列表中

- [ ] **Step 6: 验证值守任务列表页**

1. 点击左侧导航"值守任务"
2. 预期：刚创建的任务出现在任务列表中
3. 预期：任务名称、频率、推送渠道等信息正确

- [ ] **Step 7: 运行单元测试**

Run: `npm run test -- tests/client/composables/envclaw/usePromptAssembly.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 8: 运行完整测试套件**

Run: `npm run test`
Expected: 全部通过（无回归）

---

## 依赖关系图

```
Task 1 (usePromptAssembly) ─────────────────┐
                                             │
Task 2 (deliverPlatforms + useSkillList) ───┤
                                             │
Task 3 (子组件) ────────────────────────────┤  Task 5 (TaskWizard + AiGuide)
  PromptPreview ←── usePromptAssembly       │       │
  FunctionSelector                          │       │
  SkillSelector ←── useSkillList            │       │
  DeliverSelector ←── deliverPlatforms      │       │
                                             │       │
Task 4 (TemplateWizard) ←───────────────────┤───────┘
  组合 Task 1+2+3 的全部产出                │
                                             │
Task 6 (集成到工作台) ←─────────────────────┘
  修改 WorkstationHome + ScenarioGrid + i18n
                                             │
Task 7 (验证) ←─────────────────────────────┘
```

**执行顺序**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7

Task 1 和 Task 2 可并行执行（无依赖）。Task 3 依赖 Task 1 和 Task 2。Task 4 依赖 Task 1+2+3。Task 5 依赖 Task 4。Task 6 依赖 Task 5。Task 7 依赖 Task 6。

---

## 关键设计决策

1. **提示词组装为 composable 而非 store** — 组装逻辑是纯计算（无副作用、无异步），composable 更轻量且可测试。`usePromptAssembly` 接收 Ref 参数，天然响应式。

2. **推送平台常量提取为共享文件** — `CreateGuardTaskModal.vue` 和 `JobFormModal.vue` 各自重复定义了 `platformList`。提取为 `constants/envclaw/deliverPlatforms.ts` 消除重复，且向导和未来其他组件可复用。

3. **技能列表用 composable 而非 store** — 技能数据来自 Hermes 已有的 `GET /api/hermes/skills`，不需要额外的 Pinia store。`useSkillList` composable 在组件挂载时加载，生命周期跟随组件。

4. **向导为右侧滑出面板而非弹窗** — 遵循设计文档 §3.2 的明确要求。左侧任务列表保持可见，便于对照。用 CSS Transition 实现滑入动画。

5. **AI 引导只做占位** — 设计文档明确"本期不实现，只做入口占位"。占位组件显示"即将推出"，模式切换按钮可点击但内容为空态。

6. **平台切换时重置功能选择并预填技能** — 切换平台意味着数据源变了，之前选的功能不再适用。同时新平台的技能应自动预填到技能选择器。
