<script setup lang="ts">
import { reactive, ref } from 'vue'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  save: [result: { name: string; group: string; description: string; tags: string[] }]
  cancel: []
}>()

const form = reactive({ name: '', group: '', description: '' })
const tagsText = ref('')

function handleSave() {
  if (!form.name.trim()) return
  emit('save', {
    name: form.name.trim(),
    group: form.group.trim(),
    description: form.description.trim(),
    tags: tagsText.value.split(/[,，]/).map(t => t.trim()).filter(Boolean),
  })
}

function handleCancel() {
  form.name = ''
  form.group = ''
  form.description = ''
  tagsText.value = ''
  emit('cancel')
}
</script>

<template>
  <div v-if="visible" class="tsv-form">
    <label class="tsv-label">保存为模板</label>
    <input v-model="form.name" class="tsv-input" placeholder="模板名称" />
    <input v-model="form.group" class="tsv-input" placeholder="分组（可选）" />
    <textarea v-model="form.description" class="tsv-input tsv-textarea" placeholder="描述（可选）" rows="2"></textarea>
    <input v-model="tagsText" class="tsv-input" placeholder="标签，用逗号分隔（可选）" />
    <div class="tsv-actions">
      <button class="tsv-btn" @click="handleCancel">取消</button>
      <button class="tsv-btn tsv-btn-primary" :disabled="!form.name.trim()" @click="handleSave">保存</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;
.tsv-form { display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid $border-color; border-radius: $radius-md; background: $bg-card; }
.tsv-label { font-size: 14px; font-weight: 600; color: $text-primary; }
.tsv-input { padding: 8px 10px; border: 1px solid $border-color; border-radius: $radius-sm; background: $bg-card; color: $text-primary; font-size: 13px; outline: none; &:focus { border-color: $accent-primary; } }
.tsv-textarea { resize: vertical; }
.tsv-actions { display: flex; justify-content: flex-end; gap: 8px; }
.tsv-btn { padding: 6px 16px; border: 1px solid $border-color; border-radius: $radius-sm; background: transparent; color: $text-secondary; font-size: 13px; cursor: pointer; &:hover { border-color: $accent-primary; color: $accent-primary; } }
.tsv-btn-primary { background: $accent-primary; border-color: $accent-primary; color: #fff; &:hover { background: $accent-hover; border-color: $accent-hover; color: #fff; } &:disabled { opacity: 0.5; cursor: not-allowed; } }
</style>
