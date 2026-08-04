<script setup lang="ts">
import { useDutyStore } from '@/stores/envclaw/duty'

const dutyStore = useDutyStore()
const emit = defineEmits<{ (e: 'fill-prompt', text: string): void }>()

const examplePrompts: Record<string, string> = {
  query: '每天早上 8 点把平顶山市的实时浓度排名发到我邮箱',
  duty: '每周一早上生成郑州市上一周空气质量周报',
}
</script>

<template>
  <div class="hero">
    <h1>UniEcoClaw，我帮你</h1>
    <div class="hero-sub">直接提问，或选一个能力开始 —— 也可以让我把它变成定时运行的值守任务</div>

    <div class="scene-tabs">
      <button class="scene-tab" :class="{ active: dutyStore.scene === 'query' }" @click="dutyStore.setScene('query')">查数据</button>
      <button class="scene-tab" :class="{ active: dutyStore.scene === 'duty' }" @click="dutyStore.setScene('duty')">建值守</button>
    </div>

    <div class="hero-example">
      试试：<button @click="emit('fill-prompt', dutyStore.scene === 'query' ? examplePrompts.query : examplePrompts.duty)">{{ dutyStore.scene === 'query' ? examplePrompts.query : examplePrompts.duty }}</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.hero {
  text-align: center; padding: 60px 20px 20px; max-width: 800px; margin: 0 auto;
  margin-bottom: 5%;
  h1 { font-size: 28px; font-weight: 700; color: $text-primary; margin: 0 0 8px; letter-spacing: -.3px; }
}
.hero-sub { font-size: 14px; color: $text-secondary; margin: 0 0 8px; line-height: 1.6; }

.scene-tabs {
  display: inline-flex; background: $bg-secondary; border: 1px solid $border-color;
  border-radius: 24px; padding: 4px; gap: 2px; margin-top: 26px;
}
.scene-tab {
  border: none; background: transparent; color: $text-secondary;
  font-size: 13px; font-weight: 500; padding: 8px 20px; border-radius: 20px;
  cursor: pointer; transition: .15s; font-family: inherit;
  &:hover { color: $text-primary; }
  &.active { background: $accent-primary; color: #fff; font-weight: 600; }
}

.hero-example {
  margin-top: 18px; font-size: 13px; color: $text-muted;
  button {
    border: none; background: none; color: $accent-primary; font-size: 13px;
    cursor: pointer; text-decoration: underline; text-underline-offset: 2px; font-family: inherit;
    &:hover { color: $accent-hover; }
  }
}
</style>
