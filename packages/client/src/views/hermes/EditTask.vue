<script setup lang="ts">
import CreateTask from './CreateTask.vue'

const props = defineProps<{
  jobId: string
}>()

const emit = defineEmits<{
  close: []
  created: []
}>()
</script>

<template>
  <div class="edit-task-page">
    <CreateTask :job-id="jobId" @close="emit('close')" @created="emit('created')" />
  </div>
</template>

<style scoped lang="scss">
.edit-task-page {
  height: 100%;
  overflow: hidden;
}
</style>