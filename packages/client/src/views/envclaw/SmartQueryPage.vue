<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
  <div class="page">
    <h1>{{ t('envclaw.smartQuery.title') }}</h1>
  </div>
</template>

<style scoped lang="scss">
.page { max-width: 1080px; margin: 0 auto; padding: 28px 32px; }
h1 { font-size: 20px; font-weight: 600; }
</style>
