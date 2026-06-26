<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return t('envclaw.home.greeting.night')
  if (hour < 12) return t('envclaw.home.greeting.morning')
  if (hour < 18) return t('envclaw.home.greeting.afternoon')
  return t('envclaw.home.greeting.evening')
})

const dateStr = computed(() => {
  const now = new Date()
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`
})
</script>

<template>
  <div class="overview">
    <div>
      <h1>{{ greeting }}</h1>
      <div class="sub">{{ dateStr }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.overview {
  display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px;
}
h1 { font-size: 21px; font-weight: 600; letter-spacing: 0.2px; }
.sub { color: var(--envclaw-text-secondary); font-size: 13px; margin-top: 5px; }
</style>
