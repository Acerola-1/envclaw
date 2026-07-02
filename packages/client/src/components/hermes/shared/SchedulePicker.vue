<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ==================== 预设模式数据 ====================
type PresetCategory = 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

const presetCategory = ref<PresetCategory>('interval')

// 间隔模式
const intervalValue = ref(5)
const intervalUnit = ref<'minute' | 'hour'>('minute')

// 每小时模式
const hourlyMinute = ref(0)

// 每天模式
const dailyHour = ref(9)
const dailyMinute = ref(0)

// 每周模式
const weeklyDays = ref<number[]>([1])
const weeklyHour = ref(9)
const weeklyMinute = ref(0)

// 每月模式
const monthlyDay = ref(1)
const monthlyHour = ref(9)
const monthlyMinute = ref(0)

// 自定义 Cron 模式
const customCron = ref('0 9 * * *')
const intervalPresets = [
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

const hourOptions = computed(() =>
  Array.from({ length: 24 }, (_, i) => ({ label: String(i).padStart(2, '0'), value: i }))
)

const minuteOptions = [
  { label: '00', value: 0 },
  { label: '05', value: 5 },
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '20', value: 20 },
  { label: '25', value: 25 },
  { label: '30', value: 30 },
  { label: '35', value: 35 },
  { label: '40', value: 40 },
  { label: '45', value: 45 },
  { label: '50', value: 50 },
  { label: '55', value: 55 },
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

const monthDayOptions = computed(() =>
  Array.from({ length: 31 }, (_, i) => ({ label: `${i + 1} 号`, value: i + 1 }))
)

// ==================== Cron 生成 ====================
function generateCron(): string {
  switch (presetCategory.value) {
    case 'interval': {
      if (intervalUnit.value === 'minute') {
        return `*/${intervalValue.value} * * * *`
      }
      return `0 */${intervalValue.value} * * *`
    }
    case 'hourly': {
      return `${hourlyMinute.value} * * * *`
    }
    case 'daily': {
      return `${dailyMinute.value} ${dailyHour.value} * * *`
    }
    case 'weekly': {
      const days = weeklyDays.value.length > 0
        ? weeklyDays.value.sort((a, b) => a - b).join(',')
        : '1'
      return `${weeklyMinute.value} ${weeklyHour.value} * * ${days}`
    }
    case 'monthly': {
      return `${monthlyMinute.value} ${monthlyHour.value} ${monthlyDay.value} * *`
    }
    case 'custom': {
      return customCron.value.trim() || '0 9 * * *'
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

  const [minuteStr, hourStr, dom, , dow] = parts
  const minute = parseInt(minuteStr)
  const hour = parseInt(hourStr)

  // 间隔模式: */N * * * * (分钟间隔)
  if (minuteStr.startsWith('*/') && hourStr === '*') {
    presetCategory.value = 'interval'
    intervalUnit.value = 'minute'
    intervalValue.value = parseInt(minuteStr.slice(2)) || 5
    return true
  }

  // 每小时模式: M * * * * (每小时 M 分执行)
  if (minuteStr !== '*' && hourStr === '*' && dom === '*' && dow === '*') {
    presetCategory.value = 'hourly'
    hourlyMinute.value = parseInt(minuteStr) || 0
    return true
  }

  // 间隔模式: 0 */N * * * (小时间隔)
  if (minuteStr === '0' && hourStr.startsWith('*/')) {
    presetCategory.value = 'interval'
    intervalUnit.value = 'hour'
    intervalValue.value = parseInt(hourStr.slice(2)) || 1
    return true
  }

  // 自定义模式: 其他复杂 cron 表达式

  // 每周模式: M H * * dow
  if (dow !== '*' && dom === '*' && dow !== '*') {
    presetCategory.value = 'weekly'
    weeklyHour.value = hour
    weeklyMinute.value = minute
    weeklyDays.value = dow.split(',').map(Number).filter(n => !isNaN(n))
    return true
  }

  // 每月模式: M H dom * *
  if (dom !== '*' && dow === '*') {
    presetCategory.value = 'monthly'
    monthlyDay.value = parseInt(dom) || 1
    monthlyHour.value = hour
    monthlyMinute.value = minute
    return true
  }

  // 每天模式: M H * * *
  if (dom === '*' && dow === '*') {
    presetCategory.value = 'daily'
    dailyHour.value = hour
    dailyMinute.value = minute
    return true
  }

  // 自定义模式: 其他复杂 cron 表达式
  presetCategory.value = 'custom'
  customCron.value = cron
  return true
}

// ==================== 描述生成 ====================
// TODO(i18n): weekDayLabels 及 scheduleDescription 中的中文描述需接入 i18n
const weekDayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const scheduleDescription = computed(() => {
  switch (presetCategory.value) {
    case 'interval': {
      if (intervalUnit.value === 'minute') {
        return `每 ${intervalValue.value} 分钟执行一次`
      }
      return `每 ${intervalValue.value} 小时执行一次`
    }
    case 'hourly': {
      const minStr = String(hourlyMinute.value).padStart(2, '0')
      return `每小时的 ${minStr} 分执行`
    }
    case 'daily': {
      const time = `${String(dailyHour.value).padStart(2, '0')}:${String(dailyMinute.value).padStart(2, '0')}`
      return `每天 ${time} 执行`
    }
    case 'weekly': {
      const time = `${String(weeklyHour.value).padStart(2, '0')}:${String(weeklyMinute.value).padStart(2, '0')}`
      const names = weeklyDays.value
        .sort((a, b) => a - b)
        .map(d => weekDayLabels[d])
        .filter(Boolean)
        .join('、')
      return names ? `每周${names} ${time} 执行` : '请选择星期'
    }
    case 'monthly': {
      const time = `${String(monthlyHour.value).padStart(2, '0')}:${String(monthlyMinute.value).padStart(2, '0')}`
      return `每月 ${monthlyDay.value} 号 ${time} 执行`
    }
    case 'custom': {
      return customCron.value.trim() || '未设置'
    }
    default:
      return ''
  }
})

// ==================== 同步到父组件 ====================
function syncToParent() {
  emit('update:modelValue', generateCron())
}

// ==================== 监听变化 ====================
watch([presetCategory, intervalValue, intervalUnit, hourlyMinute, dailyHour, dailyMinute, weeklyDays, weeklyHour, weeklyMinute, monthlyDay, monthlyHour, monthlyMinute, customCron], () => {
  syncToParent()
}, { deep: true })

// ==================== 监听外部值变化 ====================
watch(() => props.modelValue, (newVal) => {
  if (!newVal) return
  if (!parseCron(newVal)) {
    // 无法解析的 cron，保持当前状态
  }
}, { immediate: true })

// ==================== 初始化 ====================
onMounted(() => {
  if (!props.modelValue) {
    syncToParent()
  }
})

// ==================== 交互方法 ====================
function switchCategory(cat: PresetCategory) {
  presetCategory.value = cat
}

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
    <!-- 类别标签 -->
    <!-- TODO(i18n): 标签文字 "按间隔/每小时/每天/每周/每月/自定义" 需接入 i18n -->
    <div class="sched-cat-tabs">
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'interval' }"
        @click="switchCategory('interval')"
      >按间隔</button>
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'hourly' }"
        @click="switchCategory('hourly')"
      >每小时</button>
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'daily' }"
        @click="switchCategory('daily')"
      >每天</button>
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'weekly' }"
        @click="switchCategory('weekly')"
      >每周</button>
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'monthly' }"
        @click="switchCategory('monthly')"
      >每月</button>
      <button
        class="sched-cat-btn"
        :class="{ active: presetCategory === 'custom' }"
        @click="switchCategory('custom')"
      >自定义</button>
    </div>

    <!-- 按间隔 -->
    <!-- TODO(i18n): "常用间隔" "自定义" "分钟" "小时" "执行分钟" "分" 需接入 i18n -->
    <div v-if="presetCategory === 'interval'" class="sched-cat-panel">
      <div class="sched-sub-label">常用间隔</div>
      <div class="preset-chip-grid">
        <button
          v-for="preset in intervalPresets"
          :key="`${preset.value}-${preset.unit}`"
          class="preset-chip"
          :class="{ active: intervalValue === preset.value && intervalUnit === preset.unit }"
          @click="selectIntervalPreset(preset.value, preset.unit)"
        >
          {{ preset.label }}
        </button>
      </div>
      <div class="sched-custom-row">
        <span class="sched-custom-label">自定义</span>
        <div class="sched-custom-inputs">
          <span>每</span>
          <input
            type="number"
            class="sched-num-input"
            :value="intervalValue"
            :min="1"
            :max="intervalUnit === 'minute' ? 60 : 24"
            @input="intervalValue = parseInt(($event.target as HTMLInputElement).value) || 1"
          />
          <select
            class="sched-unit-select"
            :value="intervalUnit"
            @change="intervalUnit = ($event.target as HTMLSelectElement).value as 'minute' | 'hour'"
          >
            <option value="minute">分钟</option>
            <option value="hour">小时</option>
          </select>
        </div>
      </div>
      <div v-if="intervalUnit === 'hour'" class="sched-custom-row">
        <span class="sched-custom-label">执行分钟</span>
        <div class="sched-custom-inputs">
          <select
            class="sched-unit-select"
            :value="hourlyMinute"
            @change="hourlyMinute = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in minuteOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span>分</span>
        </div>
      </div>
    </div>

    <!-- 每小时 -->
    <!-- TODO(i18n): "执行分钟" "分" 需接入 i18n -->
    <div v-if="presetCategory === 'hourly'" class="sched-cat-panel">
      <div class="sched-time-row">
        <span class="sched-time-label">执行分钟</span>
        <div class="sched-time-inputs">
          <select
            class="sched-time-select"
            :value="hourlyMinute"
            @change="hourlyMinute = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in minuteOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span>分</span>
        </div>
      </div>
    </div>

    <!-- 每天 -->
    <!-- TODO(i18n): "执行时间" 需接入 i18n -->
    <div v-if="presetCategory === 'daily'" class="sched-cat-panel">
      <div class="sched-time-row">
        <span class="sched-time-label">执行时间</span>
        <div class="sched-time-inputs">
          <select
            class="sched-time-select"
            :value="dailyHour"
            @change="dailyHour = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in hourOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span>:</span>
          <select
            class="sched-time-select"
            :value="dailyMinute"
            @change="dailyMinute = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in minuteOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 每周 -->
    <!-- TODO(i18n): "选择星期" "执行时间" 需接入 i18n -->
    <div v-if="presetCategory === 'weekly'" class="sched-cat-panel">
      <div class="sched-sub-label">选择星期</div>
      <div class="sched-day-chips">
        <button
          v-for="day in weekDayOptions"
          :key="day.value"
          class="sched-day-chip"
          :class="{ active: weeklyDays.includes(day.value) }"
          @click="toggleWeekDay(day.value)"
        >
          {{ day.label }}
        </button>
      </div>
      <div class="sched-time-row" style="margin-top: 12px;">
        <span class="sched-time-label">执行时间</span>
        <div class="sched-time-inputs">
          <select
            class="sched-time-select"
            :value="weeklyHour"
            @change="weeklyHour = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in hourOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span>:</span>
          <select
            class="sched-time-select"
            :value="weeklyMinute"
            @change="weeklyMinute = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in minuteOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 每月 -->
    <!-- TODO(i18n): "每月" "执行时间" 需接入 i18n -->
    <div v-if="presetCategory === 'monthly'" class="sched-cat-panel">
      <div class="sched-monthly-row">
        <span class="sched-monthly-label">每月</span>
        <select
          class="sched-dom-select"
          :value="monthlyDay"
          @change="monthlyDay = parseInt(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="opt in monthDayOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
      </div>
      <div class="sched-time-row">
        <span class="sched-time-label">执行时间</span>
        <div class="sched-time-inputs">
          <select
            class="sched-time-select"
            :value="monthlyHour"
            @change="monthlyHour = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in hourOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span>:</span>
          <select
            class="sched-time-select"
            :value="monthlyMinute"
            @change="monthlyMinute = parseInt(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in minuteOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 自定义 -->
    <!-- TODO(i18n): "Cron 表达式" "格式: 分 时 日 月 周" 及示例说明需接入 i18n -->
    <div v-if="presetCategory === 'custom'" class="sched-cat-panel">
      <div class="sched-custom-cron-row">
        <span class="sched-custom-label">Cron 表达式</span>
        <input
          type="text"
          class="sched-cron-input"
          v-model="customCron"
          placeholder="例如: 0 9 * * *"
        />
      </div>
      <div class="sched-cron-help">
        <div class="sched-cron-help-title">格式: 分 时 日 月 周</div>
        <div class="sched-cron-help-examples">
          <div>每 5 分钟: <code>*/5 * * * *</code></div>
          <div>每天 9 点: <code>0 9 * * *</code></div>
          <div>每周一 9 点: <code>0 9 * * 1</code></div>
          <div>每月 1 日 9 点: <code>0 9 1 * *</code></div>
        </div>
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

// 类别标签
.sched-cat-tabs {
  display: flex;
  gap: 2px;
  border-bottom: 1px solid $border-color;
  padding-bottom: 0;
}

.sched-cat-btn {
  padding: 8px 18px;
  border: none;
  background: transparent;
  color: $text-secondary;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;

  &:hover {
    color: $text-primary;
  }

  &.active {
    color: var(--accent-primary);
    border-bottom-color: var(--accent-primary);
    font-weight: 600;
  }
}

.sched-cat-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sched-sub-label {
  font-size: 12px;
  color: $text-muted;
  margin-bottom: 4px;
}

// 间隔预设
.preset-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.preset-chip {
  padding: 6px 14px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  background: $bg-primary;
  color: $text-secondary;
  font-size: 12.5px;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent-primary);
    color: var(--accent-primary);
  }

  &.active {
    border-color: var(--accent-primary);
    background: rgba(26, 115, 232, 0.10);
    color: var(--accent-primary);
  }
}

// 自定义输入
.sched-custom-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sched-custom-label {
  font-size: 12px;
  color: $text-muted;
}

.sched-custom-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $text-primary;
}

.sched-num-input {
  width: 80px;
  padding: 8px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  font-family: inherit;
  text-align: center;
  outline: none;
  background: $bg-primary;
  color: $text-primary;

  &:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.10);
  }
}

.sched-unit-select {
  padding: 8px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  font-family: inherit;
  background: $bg-primary;
  cursor: pointer;
  outline: none;
  color: $text-primary;
}

// 时间选择行
.sched-time-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sched-time-label {
  font-size: 13px;
  color: $text-secondary;
  min-width: 60px;
}

.sched-time-inputs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sched-time-select {
  padding: 8px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  font-family: inherit;
  background: $bg-primary;
  cursor: pointer;
  outline: none;
  color: $text-primary;

  &:focus {
    border-color: var(--accent-primary);
  }
}

// 星期选择
.sched-day-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.sched-day-chip {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid $border-color;
  background: $bg-primary;
  color: $text-secondary;
  font-size: 12px;
  font-family: inherit;
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
.sched-monthly-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: $text-primary;
  margin-bottom: 12px;
}

.sched-monthly-label {
  font-size: 13px;
  color: $text-secondary;
}

.sched-dom-select {
  padding: 8px 10px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 13px;
  font-family: inherit;
  background: $bg-primary;
  cursor: pointer;
  outline: none;
  color: $text-primary;
}

// 自定义 Cron
.sched-custom-cron-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sched-cron-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 14px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  background: $bg-primary;
  color: $text-primary;
  outline: none;

  &:focus {
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.10);
  }
}

.sched-cron-help {
  padding: 12px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius-sm;
  font-size: 12px;
  color: $text-muted;
}

.sched-cron-help-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: $text-secondary;
}

.sched-cron-help-examples {
  display: flex;
  flex-direction: column;
  gap: 4px;

  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    background: rgba(26, 115, 232, 0.08);
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--accent-primary);
  }
}

// 描述预览
.schedule-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  border-radius: $radius;
}

.preview-icon {
  font-size: 14px;
}

.preview-text {
  font-size: 13px;
  color: $text-primary;
}
</style>