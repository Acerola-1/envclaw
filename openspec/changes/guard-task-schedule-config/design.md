## Context

当前 CreateGuardTaskModal 组件使用简单的 NSelect 实现调度频率选择（每小时/每日/自定义），仅支持基础的 cron 表达式生成。用户需要更灵活的调度配置能力，参照 workBuddy 中的执行频率设计。

**现有代码结构**：
- 使用 naive-ui 组件库
- Vue 3 Composition API + TypeScript
- 调度配置通过 `scheduleType` 和时间选择组合

## Goals / Non-Goals

**Goals:**
- 提供三种调度模式：周期、按间隔、单次
- 支持生效日期区间配置
- 保持与现有 naive-ui 设计风格一致
- 生成标准 cron 表达式供后端使用

**Non-Goals:**
- 不修改后端调度引擎
- 不支持复杂 cron 高级语法（如 `*/15 * * * *`）
- 不实现调度预览/日历视图

## Decisions

### 1. Tab 切换实现

**选择**: 使用 NTabs 组件实现三种调度模式切换

**理由**: naive-ui 原生 Tab 组件，样式统一，交互清晰

**替代方案**: 
- 自定义 Tab 实现：增加开发成本，样式一致性难保证
- Radio Group：空间利用率低，不适合复杂表单

### 2. 数据结构设计

```typescript
interface ScheduleConfig {
  // 周期模式
  periodType?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  periodTime?: string  // HH:mm 格式

  // 间隔模式
  intervalHours?: number
  intervalDays?: number[]  // [0-6] 代表周日到周六

  // 单次模式
  onceTime?: string  // HH:mm 格式
  onceDate?: string  // YYYY-MM-DD 格式

  // 生效区间（仅周期和间隔模式）
  effectiveDateRange?: [string, string]  // [startDate, endDate]
}
```

### 3. 技能选项传参规范

**复用 JobFormModal 的实现模式**，保持与 jobs 模块完全一致：

```typescript
// 导入（与 JobFormModal 一致）
import { fetchSkills } from '@/api/hermes/skills'
import type { SkillInfo } from '@/api/hermes/skills'

// 数据结构
const skillsLoading = ref(false)
const skillOptions = ref<Array<{ label: string; value: string }>>([])
const formData = ref({
  skills: [] as string[],  // 技能名称数组，与 CreateJobRequest.skills 一致
})

// buildSkillOptions 函数（从 JobFormModal 复制）
function buildSkillOptions(skills: SkillInfo[]): Array<{ label: string; value: string }> {
  const byName = new Map<string, SkillInfo>()
  for (const skill of skills) {
    if (skill.enabled === false) continue
    if (!byName.has(skill.name)) byName.set(skill.name, skill)
  }
  return [...byName.values()]
    .map(skill => ({ label: skill.name, value: skill.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

// loadSkillOptions 函数（从 JobFormModal 复制）
async function loadSkillOptions() {
  skillsLoading.value = true
  try {
    const data = await fetchSkills()
    skillOptions.value = buildSkillOptions(data.categories.flatMap(category => category.skills || []))
  } catch {
    skillOptions.value = []
  } finally {
    skillsLoading.value = false
  }
}

// 提交时传参（与 CreateJobRequest 一致）
const payload = {
  skills: formData.value.skills,  // string[] 类型
}
```

### 4. 技能选择器布局

**选择**: 技能选择器放在提示词输入框内部下方，作为输入框的附属组件

**理由**: 
- 技能是提示词的补充配置，放在输入框内更符合用户心智模型
- 减少表单纵向空间占用
- 与提示词形成视觉关联

**实现方式**: 使用 NInput 的 `#suffix` 插槽或在 textarea 下方叠加技能选择器

### 5. 生效日期区间条件渲染

**选择**: 生效日期区间仅在"周期"和"按间隔"模式下显示，单次模式隐藏

**理由**: 单次执行已有明确的执行日期，生效区间无意义；周期和间隔模式需要限制任务生效范围

### 3. 组件拆分策略

**选择**: 在现有组件内通过条件渲染实现，不拆分子组件

**理由**: 
- 功能集中在一个弹窗，拆分增加通信复杂度
- 三种模式共享状态（生效日期区间）
- 代码量可控，约 200 行增量

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Cron 表达式生成复杂度 | 中 | 仅支持基础表达式，复杂场景走自定义输入 |
| 用户配置错误 | 低 | 表单验证 + 示例提示 |
| 样式适配 | 低 | 使用 naive-ui 原生组件，风格自动统一 |

## Migration Plan

1. 前端组件修改，向后兼容
2. 旧任务数据自动适配新格式（默认周期模式）
3. 无需数据库迁移
