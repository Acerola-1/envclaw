<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePlatformsStore } from '@/stores/envclaw/platforms'

const { t } = useI18n()
const platformsStore = usePlatformsStore()
</script>

<template>
  <div class="section">
    <div class="section-head">
      <div class="section-title">
        {{ t('envclaw.home.platforms.title') }}
        <span class="hint">{{ t('envclaw.home.platforms.hint') }}</span>
      </div>
      <router-link :to="{ name: 'envclaw.platforms' }" class="section-link">
        {{ t('envclaw.home.platforms.manage') }}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </router-link>
    </div>

    <div v-if="platformsStore.platforms.length === 0" class="platform-bar">
      <div class="pl-chip pl-add" @click="$router.push({ name: 'envclaw.platforms' })">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M5 12h14M12 5v14" />
        </svg>
        {{ t('envclaw.home.platforms.addPlatform') }}
      </div>
    </div>

    <div v-else class="platform-bar">
      <div v-for="p in platformsStore.platforms" :key="p.id" class="pl-chip">
        <span :class="['pl-status', p.accounts.some(a => a.status === 'connected') ? 'pl-on' : 'pl-off']" />
        {{ p.name }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
.hint { font-weight: 400; font-size: 12px; color: var(--envclaw-text-muted); }
.section-link { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--envclaw-text-secondary); text-decoration: none; &:hover { color: var(--envclaw-text-primary); } }

.platform-bar { display: flex; gap: 10px; flex-wrap: wrap; }
.pl-chip {
  display: flex; align-items: center; gap: 8px; padding: 9px 14px;
  background: var(--envclaw-bg-secondary); border: 1px solid var(--envclaw-border); border-radius: 8px;
  font-size: 12.5px; cursor: pointer; transition: 0.15s;
  &:hover { border-color: var(--envclaw-border-light); }
  &.pl-add { color: var(--envclaw-text-secondary); border-style: dashed; }
}
.pl-status { width: 7px; height: 7px; border-radius: 50%; }
.pl-on { background: var(--envclaw-success); }
.pl-off { background: var(--envclaw-text-muted); }
</style>
