<script setup lang="ts">
import { computed } from 'vue'
import { useDutyStore } from '@/stores/envclaw/duty'
import { useRouter } from 'vue-router'

const props = defineProps<{
  prompt: string
  capNames: { id: string; name: string }[]
  skillNames: { id: string; name: string; kind: 'config' | 'direct' }[]
}>()
const emit = defineEmits<{
  (e: 'update:prompt', v: string): void
  (e: 'removeCap', id: string): void
  (e: 'removeSkill', id: string): void
}>()

const dutyStore = useDutyStore()
const router = useRouter()

const capNeedsConfig = computed(() => props.capNames.length)
const skillDirect = computed(() => props.skillNames.filter(s => s.kind === 'direct').length)

function openSkillPicker() { router.push('/hermes/duty/picker#tab=skills') }
</script>

<template>
  <div class="fused-editor">
    <label class="fe-label">提示词 <span class="fe-hint">描述任务目标，AI 将按目标调用下方技能、连接器与工具</span></label>
    <textarea class="fe-textarea" :value="prompt" @input="emit('update:prompt', ($event.target as HTMLTextAreaElement).value)" rows="8" placeholder="描述你的任务目标，比如：针对平顶山市早高峰 7:00-9:00 汇总浓度排名并推送到飞书..." />

    <div class="fe-toolbar">
      <span class="fe-model">模型：{{ dutyStore.selectedModel }}</span>
      <button class="fe-skill-btn" @click="openSkillPicker">
        技能
        <span class="fe-count blue">{{ capNeedsConfig }} 需</span>
        <span class="fe-count green">{{ skillDirect }} 直</span>
      </button>
      <span class="perm-badge">完全访问权限</span>
    </div>

    <div class="fe-chips" v-if="capNames.length || skillNames.length">
      <span v-for="c in capNames" :key="c.id" class="fe-chip blue">&#9881; {{ c.name }} <button class="chip-x" @click="emit('removeCap', c.id)">&times;</button></span>
      <span v-for="s in skillNames" :key="s.id" class="fe-chip green">&#9889; {{ s.name }} <button class="chip-x" @click="emit('removeSkill', s.id)">&times;</button></span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.fused-editor { border: 1px solid $border-color; border-radius: $radius-lg; background: $bg-card; padding: 20px; }
.fe-label { font-size: 14px; font-weight: 600; color: $text-primary; display: block; margin-bottom: 4px; }
.fe-hint { font-weight: 400; font-size: 12px; color: $text-muted; }
.fe-textarea {
  width: 100%; border: 1px solid $border-color; border-radius: $radius-md; padding: 14px; font-size: 14px; line-height: 1.7;
  resize: vertical; font-family: inherit; margin-top: 12px;
  &:focus { outline: none; border-color: $accent-primary; }
}
.fe-toolbar { display: flex; align-items: center; gap: 12px; margin-top: 12px; font-size: 13px; }
.fe-skill-btn {
  display: flex; align-items: center; gap: 6px; padding: 4px 12px; border: 1px solid $border-color; border-radius: 999px;
  background: $bg-card; cursor: pointer; font-size: 12px;
  &:hover { border-color: $accent-primary; }
}
.fe-count { padding: 1px 6px; border-radius: 999px; font-size: 11px; &.blue { background: var(--badge-config); color: #1d4ed8; } &.green { background: var(--badge-direct); color: #15803d; } }
.fe-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.fe-chip {
  display: flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 12px;
  &.blue { background: var(--badge-config); color: #1d4ed8; }
  &.green { background: var(--badge-direct); color: #15803d; }
  .chip-x { background: none; border: none; cursor: pointer; font-size: 14px; padding: 0; color: inherit; }
}
</style>
