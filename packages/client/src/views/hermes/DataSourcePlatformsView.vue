<script setup lang="ts">
import DataSourcePlatformSettings from '@/components/hermes/settings/DataSourcePlatformSettings.vue'
</script>

<template>
  <div class="data-source-platforms-view">
    <DataSourcePlatformSettings />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.data-source-platforms-view {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}
</style>