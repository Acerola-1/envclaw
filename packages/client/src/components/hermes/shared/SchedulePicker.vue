<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { NSelect, NTimePicker, NInput, NInputNumber } from 'naive-ui'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ==================== 模式切换 ====================
type Mode = 'preset' | 'cron'
const mode = ref<Mode>('preset')

// ==================== 预设模式数据 ====================
type PresetCategory = 'interval' | 'daily' | 'weekly' | 'monthly'

// 当前选中的预设类别
const presetCategory = ref<PresetCategory>('interval')

// 间隔模式
const intervalValue = ref(5)
const intervalUnit = ref<'minute' | 'hour'>('minute')

// 每天模式
const dailyTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))

// 每周模式
const weeklyDays = ref<number[]>([1])
const weeklyTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))

// 每月模式
const monthlyDay = ref(1)
const monthlyTime = ref<number | null>(new Date().setHours(9, 0, 0, 0))

// ==================== Cron 模式数据 ====================
const cronExpression = ref('')

// ==================== 预设选项 ====================
const intervalPresets = [
  { label: '1 分钟', value: 1, unit: 'minute' as const },
  { label: '5 分钟', value: 5, unit: 'minute' as const },
  { label: '10 分钟', value: 10, unit: 'minute' as const },
  { label: '15 分钟', value: 15, unit: 'minute' as const },
  { label: '30 分钟', value: 30, unit: 'minute' as const },
  { label: '1 小时', value: 1, unit: 'hour' as const },
  { label: '2 小时', value: 2, unit: 'hour' as const },
  { label: '3 小时', value: 3, unit: 'hour' as const },
  { label: '6 小时', value: 6, unit: 'hour' as const },
  { label: '12 小时', value: 12, unit: 'hour' as const },
  { label: '24 小时', value: 24, unit: 'hour' as const },
]

const categoryOptions = [
  { label: '按间隔', value: 'interval' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
]

const weekDayOptions = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 },
]

const monthDayOptions = computed(() => {
  const options = []
  for (let i = 1; i <= 31; i++) {
    options.push({ label: `${i} 号`, value: i })
  }
  return options
})

// ==================== 工具函数 ====================
function formatTime(timestamp: number | null): string {
  if (!timestamp) return '09:00'
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function parseTimeToTimestamp(hour: number, minute: number): number {
  return new Date().setHours(hour, minute, 0, 0)
}

// ==================== Cron 生成 ====================
function generateCron(): string {
  switch (presetCategory.value) {
    case 'interval': {
      if (intervalUnit.value === 'minute') {
        return `*/${intervalValue.value} * * * *`
      }
      return `0 */${intervalValue.value} * * *`
    }
    case 'daily': {
      const time = formatTime(dailyTime.value)
      const [hour, minute] = time.split(':').map(Number)
      return `${minute} ${hour} * * *`
    }
    case 'weekly': {
      const time = formatTime(weeklyTime.value)
      const [hour, minute] = time.split(':').map(Number)
      const days = weeklyDays.value.length > 0
        ? weeklyDays.value.sort((a, b) => a - b).join(',')
        : '1'
      return `${minute} ${hour} * * ${days}`
    }
    case 'monthly': {
      const time = formatTime(monthlyTime.value)
      const [hour, minute] = time.split(':').map(Number)
      return `${minute} ${hour} ${monthlyDay.value} * *`
    }
    default:
      return '0 9 * * *'
  }
}

// ==================== Cron 解析 ====================
function parseCron(cron: string) {
  if (!cron) return false
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return false

  const [minuteStr, hourStr, dom, month, dow] = parts
  const minute = parseInt(minuteStr)
  const hour = parseInt(hourStr)

  // 间隔模式: */N * * * * (分钟间隔)
  if (minuteStr.startsWith('*/') && hourStr === '*') {
    presetCategory.value = 'interval'
    intervalUnit.value = 'minute'
    intervalValue.value = parseInt(minuteStr.slice(2)) || 5
    return true
  }

  // 间隔模式: 0 */N * * * (小时间隔)
  if (minuteStr === '0' && hourStr.startsWith('*/')) {
    presetCategory.value = 'interval'
    intervalUnit.value = 'hour'
    intervalValue.value = parseInt(hourStr.slice(2)) || 1
    return true
  }

  // 每周模式: M H * * dow
  if (dow !== '*' && dom === '*' && month === '*') {
    presetCategory.value = 'weekly'
    weeklyTime.value = parseTimeToTimestamp(hour, minute)
    weeklyDays.value = dow.split(',').map(Number).filter(n => !isNaN(n))
    return true
  }

  // 每月模式: M H dom * *
  if (dom !== '*' && month === '*' && dow === '*') {
    presetCategory.value = 'monthly'
    monthlyDay.value = parseInt(dom) || 1
    monthlyTime.value = parseTimeToTimestamp(hour, minute)
    return true
  }

  // 每天模式: M H * * *
  if (dom === '*' && month === '*' && dow === '*') {
    presetCategory.value = 'daily'
    dailyTime.value = parseTimeToTimestamp(hour, minute)
    return true
  }

  return false
}

// ==================== 描述生成 ====================
const scheduleDescription = computed(() => {
  if (mode.value === 'cron') {
    return describeCron(cronExpression.value)
  }

  switch (presetCategory.value) {
    case 'interval': {
      const unit = intervalUnit.value === 'minute' ? '分钟' : '小时'
      return `每 ${intervalValue.value} ${unit} 执行一次`
    }
    case 'daily': {
      const time = formatTime(dailyTime.value)
      return `每天 ${time} 执行`
    }
    case 'weekly': {
      const time = formatTime(weeklyTime.value)
      const dayNames = weeklyDays.value
        .sort((a, b) => a - b)
        .map(d => weekDayOptions.find(w => w.value === d)?.label || '')
        .filter(Boolean)
        .join('、')
      return dayNames ? `每周${dayNames} ${time} 执行` : '请选择星期'
    }
    case 'monthly': {
      const time = formatTime(monthlyTime.value)
      return `每月 ${monthlyDay.value} 号 ${time} 执行`
    }
    default:
      return ''
  }
})

function describeCron(cron: string): string {
  if (!cron) return '请输入 cron 表达式'
  const parts = cron.trim().split(/\s+/)
  if (parts.length < 5) return '无效的 cron 表达式'

  const [minuteStr, hourStr, dom, , dow] = parts

  // 间隔
  if (minuteStr.startsWith('*/')) {
    return `每 ${minuteStr.slice(2)} 分钟执行一次`
  }
  if (hourStr.startsWith('*/')) {
    return `每 ${hourStr.slice(2)} 小时执行一次`
  }

  const time = `${hourStr.padStart(2, '0')}:${minuteStr.padStart(2, '0')}`

  if (dow !== '*') {
    const dayNames = dow.split(',').map(d => {
      const num = parseInt(d)
      return weekDayOptions.find(w => w.value === num)?.label || d
    }).join('、')
    return `每周${dayNames} ${time} 执行`
  }
  if (dom !== '*') {
    return `每月 ${dom} 号 ${time} 执行`
  }
  return `每天 ${time} 执行`
}

// ==================== 验证 ====================
const isIntervalValid = computed(() => {
  if (intervalUnit.value === 'minute') {
    return intervalValue.value >= 1 && intervalValue.value <= 60
  }
  return intervalValue.value >= 1 && intervalValue.value <= 24
})

const isWeeklyValid = computed(() => weeklyDays.value.length > 0)

const isCronValid = computed(() => {
  if (!cronExpression.value) return false
  const parts = cronExpression.value.trim().split(/\s+/)
  return parts.length === 5
})

// ==================== 同步到父组件 ====================
function syncToParent() {
  if (mode.value === 'cron') {
    if (isCronValid.value) {
      emit('update:modelValue', cronExpression.value)
    }
  } else {
    if (presetCategory.value === 'interval' && !isIntervalValid.value) return
    if (presetCategory.value === 'weekly' && !isWeeklyValid.value) return
    emit('update:modelValue', generateCron())
  }
}

// ==================== 监听变化 ====================
watch([presetCategory, intervalValue, intervalUnit, dailyTime, weeklyDays, weeklyTime, monthlyDay, monthlyTime], () => {
  if (mode.value === 'preset') syncToParent()
}, { deep: true })

watch(cronExpression, () => {
  if (mode.value === 'cron') syncToParent()
})

watch(mode, (newMode) => {
  if (newMode === 'preset') {
    syncToParent()
  } else {
    cronExpression.value = props.modelValue || generateCron()
  }
})

// ==================== 监听外部值变化 ====================
watch(() => props.modelValue, (newVal) => {
  if (!newVal) return
  // 尝试解析为预设模式
  if (parseCron(newVal)) {
    mode.value = 'preset'
  } else {
    mode.value = 'cron'
    cronExpression.value = newVal
  }
}, { immediate: true })

// ==================== 初始化 ====================
onMounted(() => {
  if (props.modelValue) {
    if (!parseCron(props.modelValue)) {
      mode.value = 'cron'
      cronExpression.value = props.modelValue
    }
  } else {
    syncToParent()
  }
})

// ==================== 间隔预设点击 ====================
function selectIntervalPreset(value: number, unit: 'minute' | 'hour') {
  intervalValue.value = value
  intervalUnit.value = unit
}

function toggleWeekDay(day: number) {
  const index = weeklyDays.value.indexOf(day)
  if (index === -1) {
    weeklyDays.value.push(day)
  } else {
    weeklyDays.value.splice(index, 1)
  }
}
</script>

<template>
  <div class="schedule-picker">
    <!-- 模式切换 -->
    <div class="mode-switch">
      <button
        :class="['mode-btn', { active: mode === 'preset' }]"
        @click="mode = 'preset'"
      >
        预设选择
      </button>
      <button
        :class="['mode-btn', { active: mode === 'cron' }]"
        @click="mode = 'cron'"
      >
        Cron 表达式
      </button>
    </div>

    <!-- 预设模式 -->
    <div v-if="mode === 'preset'" class="preset-mode">
      <!-- 类别选择 -->
      <div class="category-select">
        <NSelect
          v-model:value="presetCategory"
          :options="categoryOptions"
          style="width: 140px"
        />
      </div>

      <!-- 按间隔 -->
      <div v-if="presetCategory === 'interval'" class="section">
        <div class="interval-presets">
          <span class="section-label">常用间隔</span>
          <div class="preset-grid">
            <button
              v-for="preset in intervalPresets"
              :key="`${preset.value}-${preset.unit}`"
              :class="['preset-chip', { active: intervalValue === preset.value && intervalUnit === preset.unit }]"
              @click="selectIntervalPreset(preset.value, preset.unit)"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
        <div class="custom-row">
          <span class="custom-label">自定义</span>
          <div class="custom-inputs">
            <span>每</span>
            <NInputNumber
              v-model:value="intervalValue"
              :min="1"
              :max="intervalUnit === 'minute' ? 60 : 24"
              style="width: 80px"
              :status="!isIntervalValid ? 'error' : undefined"
            />
            <NSelect
              v-model:value="intervalUnit"
              :options="[
                { label: '分钟', value: 'minute' },
                { label: '小时', value: 'hour' }
              ]"
              style="width: 80px"
            />
          </div>
        </div>
        <div v-if="!isIntervalValid" class="error-tip">
          {{ intervalUnit === 'minute' ? '请输入 1-60 之间的数字' : '请输入 1-24 之间的数字' }}
        </div>
      </div>

      <!-- 每天 -->
      <div v-if="presetCategory === 'daily'" class="section">
        <div class="time-row">
          <span class="time-label">执行时间</span>
          <NTimePicker v-model:value="dailyTime" format="HH:mm" style="width: 120px" />
        </div>
      </div>

      <!-- 每周 -->
      <div v-if="presetCategory === 'weekly'" class="section">
        <div class="week-days-row">
          <span class="section-label">选择星期</span>
          <div class="day-chips">
            <button
              v-for="day in weekDayOptions"
              :key="day.value"
              :class="['day-chip', { active: weeklyDays.includes(day.value) }]"
              @click="toggleWeekDay(day.value)"
            >
              {{ day.label }}
            </button>
          </div>
        </div>
        <div v-if="!isWeeklyValid" class="error-tip">请至少选择一天</div>
        <div class="time-row">
          <span class="time-label">执行时间</span>
          <NTimePicker v-model:value="weeklyTime" format="HH:mm" style="width: 120px" />
        </div>
      </div>

      <!-- 每月 -->
      <div v-if="presetCategory === 'monthly'" class="section">
        <div class="monthly-row">
          <span class="monthly-label">每月</span>
          <NSelect
            v-model:value="monthlyDay"
            :options="monthDayOptions"
            style="width: 100px"
          />
          <span>号</span>
        </div>
        <div class="time-row">
          <span class="time-label">执行时间</span>
          <NTimePicker v-model:value="monthlyTime" format="HH:mm" style="width: 120px" />
        </div>
      </div>
    </div>

    <!-- Cron 模式 -->
    <div v-if="mode === 'cron'" class="cron-mode">
      <div class="cron-input-row">
        <NInput
          v-model:value="cronExpression"
          placeholder="* * * * * (分 时 日 月 周)"
          :status="!isCronValid ? 'error' : undefined"
        />
      </div>
      <div class="cron-hint">
        格式：<code>分 时 日 月 周</code>，例如 <code>0 9 * * 1-5</code> 表示工作日每天 9:00
      </div>
      <div v-if="!isCronValid && cronExpression" class="error-tip">
        请输入有效的 5 段 cron 表达式
      </div>
    </div>

    <!-- 描述预览 -->
    <div class="schedule-preview">
      <span class="preview-icon">⏰</span>
      <span class="preview-text">{{ scheduleDescription }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.schedule-picker {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// 模式切换
.mode-switch {
  display: flex;
  gap: 4px;
  background: $bg-secondary;
  border-radius: $radius-md;
  padding: 4px;
}

.mode-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: $text-secondary;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: $text-primary;
  }

  &.active {
    background: $bg-primary;
    color: $text-primary;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }
}

// 预设模式
.preset-mode {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-select {
  display: flex;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 4px;
}

// 间隔预设
.interval-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  padding: 6px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-primary;
  color: $text-secondary;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  &.active {
    border-color: var(--accent-primary);
    background: rgba(var(--accent-primary-rgb), 0.08);
    color: var(--accent-primary);
  }
}

// 自定义输入
.custom-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-label {
  font-size: 12px;
  color: $text-muted;
}

.custom-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $text-primary;
}

// 时间选择行
.time-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.time-label {
  font-size: 13px;
  color: $text-secondary;
  min-width: 60px;
}

// 星期选择
.week-days-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.day-chips {
  display: flex;
  gap: 6px;
}

.day-chip {
  width: 40px;
  height: 40px;
  border: 1px solid $border-color;
  border-radius: 50%;
  background: $bg-primary;
  color: $text-secondary;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  &.active {
    border-color: var(--accent-primary);
    background: var(--accent-primary);
    color: #fff;
  }
}

// 每月选择
.monthly-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $text-primary;
}

.monthly-label {
  font-size: 13px;
  color: $text-secondary;
}

// Cron 模式
.cron-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cron-input-row {
  width: 100%;
}

.cron-hint {
  font-size: 12px;
  color: $text-muted;

  code {
    padding: 2px 6px;
    background: $bg-secondary;
    border-radius: 4px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 11px;
  }
}

// 描述预览
.schedule-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: $bg-secondary;
  border-radius: $radius-sm;
}

.preview-icon {
  font-size: 14px;
}

.preview-text {
  font-size: 13px;
  color: $text-primary;
}

// 错误提示
.error-tip {
  font-size: 12px;
  color: var(--error-color, #e53e3e);
}
</style>
