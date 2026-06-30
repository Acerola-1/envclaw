<script setup lang="ts">
import { useChatStore } from '@/stores/hermes/chat';

const chatStore = useChatStore();

interface QuestionBubble {
  icon: string;
  text: string;
}

const questions: QuestionBubble[] = [
  { icon: '🌫️', text: '今天平顶山市空气质量怎么样？' },
  { icon: '📊', text: '分析一下本周空气质量变化趋势，有哪些异常波动？' },
  { icon: '🏭', text: '昨日郑州市PM2.5全省排名情况' },
  { icon: '🌿', text: '给出几条改善区域空气质量的可行建议' },
  { icon: '☀️', text: '夏季臭氧污染高发，帮我分析成因和防控要点' },
  { icon: '⚠️', text: '今天北京市能避免重污染天吗？' },
  { icon: '🏗️', text: '工地扬尘对空气质量的影响有多大？如何管控？' },
  { icon: '🔬', text: '对比一下本月和上月各污染物的浓度变化' },
];

function handleSend(question: string) {
  chatStore.sendMessage(question);
}
</script>

<template>
  <div class="question-bubbles">
    <div class="bubbles-title">
      <span class="bubbles-title-icon">💬</span>
      <span class="bubbles-title-text">试试问我这些问题</span>
    </div>
    <div class="bubbles-row">
      <div
        v-for="(q, index) in questions"
        :key="index"
        class="bubble-chip"
        @click="handleSend(q.text)"
      >
        <!-- <span class="bubble-icon">{{ q.icon }}</span> -->
        <span class="bubble-text">{{ q.text }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.question-bubbles {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 32px;
  gap: 28px;
}

.bubbles-title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: $text-secondary;
  font-size: 25px;
  font-weight: 600;

  .bubbles-title-icon {
    font-size: 22px;
  }
}

.bubbles-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  width: 100%;
  max-width: 920px;
  justify-content: center;
}

.bubble-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: 999px;
  cursor: pointer;
  transition: all $transition-normal;
  white-space: nowrap;

  &:hover {
    border-color: $accent-primary;
    background: $bg-card-hover;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.08);
  }

  &:active {
    transform: translateY(0);
  }

  .bubble-icon {
    font-size: 16px;
    line-height: 1;
  }

  .bubble-text {
    font-size: 13px;
    line-height: 1;
    color: $text-primary;
  }
}

@media (max-width: $breakpoint-mobile) {
  .question-bubbles {
    padding: 16px 16px;
  }
}
</style>