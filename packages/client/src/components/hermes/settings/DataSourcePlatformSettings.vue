<script setup lang="ts">
import { ref } from 'vue'
import { NSpin, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useDataSourcePlatformsStore } from '@/stores/hermes/dataSourcePlatforms'
import DataSourcePlatformCard from '@/components/hermes/guard/DataSourcePlatformCard.vue'
import DataSourcePlatformForm from '@/components/hermes/guard/DataSourcePlatformForm.vue'

const { t } = useI18n()
const store = useDataSourcePlatformsStore()
const showAddForm = ref(false)

function handleAddPlatform() {
  showAddForm.value = true
}
</script>

<template>
  <div class="data-source-platform-settings">
    <header class="page-header">
      <h2 class="header-title">{{ t('sidebar.dataSourcePlatforms') }}</h2>
      <NButton type="primary" @click="handleAddPlatform">+ 新增平台</NButton>
    </header>

    <div class="platforms-content">
      <NSpin :show="store.loading" size="large" :description="t('common.loading')">
        <div v-if="store.platforms.length > 0" class="platforms-list">
          <DataSourcePlatformCard
            v-for="platform in store.platforms"
            :key="platform.id"
            :platform="platform"
          />
        </div>
        <div v-else class="empty-state">
          <span>暂无数据源平台</span>
        </div>
      </NSpin>
    </div>

    <DataSourcePlatformForm
      v-if="showAddForm"
      @close="showAddForm = false"
    />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.data-source-platform-settings {
  height: calc(100 * var(--vh));
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.platforms-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  position: relative;
}

.platforms-list {
  max-width: 800px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
  font-size: 14px;
}
</style>