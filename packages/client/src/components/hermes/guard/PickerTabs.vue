<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { fetchSkills } from '@/api/hermes/skills'
import { listPlatforms, type Platform } from '@/api/envclaw/platforms'
import { useTemplatesStore } from '@/stores/envclaw/templates'
import type { PickerSelection } from '@/stores/envclaw/duty'

// ==================== Props / Emits ====================
const props = defineProps<{
  activeTab: string
  selection: PickerSelection
}>()

const emit = defineEmits<{
  select: [result: PickerSelection]
  'update:selection': [result: PickerSelection]
}>()

// ==================== Tab 1 — 模板选择 ====================
const templatesStore = useTemplatesStore()
const tmplSubTab = ref<'all' | 'system' | 'mine' | 'external'>('all')

interface TemplateItem {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  available: boolean
  source: 'system' | 'mine' | 'external'
}

const allTemplates = computed<TemplateItem[]>(() =>
  templatesStore.templates.map((t) => ({
    ...t,
    source: 'system' as const,
  })),
)

const filteredTemplates = computed(() => {
  const list = allTemplates.value
  if (tmplSubTab.value === 'all') return list
  return list.filter((t) => t.source === tmplSubTab.value)
})

function selectTemplate(id: string) {
  const t = allTemplates.value.find((x) => x.id === id)
  if (!t || !t.available) return
  const next: PickerSelection = {
    ...props.selection,
    templateId: props.selection.templateId === id ? '' : id,
  }
  emit('update:selection', next)
  emit('select', next)
}

// ==================== Tab 2 — 技能选择（需配置 / 直接用） ====================
interface SkillEntry {
  id: string
  name: string
  description: string
  kind: 'config' | 'direct'
  source?: string
}

const skillList = ref<SkillEntry[]>([])
const skillsLoading = ref(false)
const MAX_SKILLS = 6

const selectedSkillIds = computed(() => new Set(props.selection.skillIds))

function toggleSkill(entry: SkillEntry) {
  const ids = [...props.selection.skillIds]
  const names = [...props.selection.skillNames]
  const idx = ids.indexOf(entry.id)
  if (idx >= 0) {
    ids.splice(idx, 1)
    names.splice(idx, 1)
  } else {
    if (ids.length >= MAX_SKILLS) return
    ids.push(entry.id)
    names.push(entry.name)
  }
  const next: PickerSelection = { ...props.selection, skillIds: ids, skillNames: names }
  emit('update:selection', next)
  emit('select', next)
}

async function loadSkills() {
  skillsLoading.value = true
  try {
    // 需配置的成果（capability）
    const configEntries: SkillEntry[] = [
      { id: 'mapPackage', name: '一张图', description: '生成数智大气一张图成果，设置地图范围、时间类型、监测图/插值图、因子、风场与图层', kind: 'config', source: '数智大气' },
      { id: 'concentrationRanking', name: '浓度排名', description: '城市/站点浓度排名查询，生成可视化排名截图并附数据文字总结后推送', kind: 'config', source: '数智大气' },
    ]

    // 直接用（hermes 技能系统）
    const data = await fetchSkills()
    const directEntries: SkillEntry[] = []
    for (const cat of data.categories) {
      for (const s of cat.skills) {
        if (!s.enabled) continue
        directEntries.push({
          id: s.name,
          name: s.name,
          description: s.description || '',
          kind: 'direct',
          source: cat.name,
        })
      }
    }

    skillList.value = [...configEntries, ...directEntries]
  } catch {
    // fallback: 至少保留需配置的成果
    skillList.value = [
      { id: 'mapPackage', name: '一张图', description: '生成数智大气一张图成果', kind: 'config', source: '数智大气' },
      { id: 'concentrationRanking', name: '浓度排名', description: '浓度排名查询', kind: 'config', source: '数智大气' },
    ]
  } finally {
    skillsLoading.value = false
  }
}

const configSkills = computed(() => skillList.value.filter((s) => s.kind === 'config'))
const directSkills = computed(() => skillList.value.filter((s) => s.kind === 'direct'))

// ==================== Tab 3 — 连接器选择 ====================
interface ConnectorEntry {
  id: string
  name: string
  type: string
  tools: number
}

const connectorList = ref<ConnectorEntry[]>([])
const connectorsLoading = ref(false)

const selectedMcpIds = computed(() => new Set(props.selection.mcpIds))

function toggleConnector(entry: ConnectorEntry) {
  const ids = [...props.selection.mcpIds]
  const names = [...props.selection.mcpNames]
  const idx = ids.indexOf(entry.id)
  if (idx >= 0) {
    ids.splice(idx, 1)
    names.splice(idx, 1)
  } else {
    ids.push(entry.id)
    names.push(entry.name)
  }
  const next: PickerSelection = { ...props.selection, mcpIds: ids, mcpNames: names }
  emit('update:selection', next)
  emit('select', next)
}

async function loadConnectors() {
  connectorsLoading.value = true
  try {
    const data = await listPlatforms()
    connectorList.value = data.map((p: Platform) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      tools: (p.functions || []).length,
    }))
  } catch {
    connectorList.value = []
  } finally {
    connectorsLoading.value = false
  }
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadSkills()
  loadConnectors()
})

watch(
  () => props.activeTab,
  (tab) => {
    if (tab === 'skills') loadSkills()
    else if (tab === 'mcps') loadConnectors()
  },
)
</script>

<template>
  <div class="picker-tabs-content">
    <!-- ========== Tab 1: 选模板 ========== -->
    <div v-if="activeTab === 'tmpl'" class="tab-tmpl">
      <div class="tmpl-subtabs">
        <button
          v-for="st in ['all', 'system', 'mine', 'external'] as const"
          :key="st"
          class="tmpl-subtab"
          :class="{ active: tmplSubTab === st }"
          @click="tmplSubTab = st"
        >
          {{ { all: '全部', system: '系统', mine: '我的', external: '外部导入' }[st] }}
        </button>
      </div>

      <div class="tmpl-grid">
        <div
          v-for="t in filteredTemplates"
          :key="t.id"
          class="tmpl-card"
          :class="{
            selected: selection.templateId === t.id,
            disabled: !t.available,
          }"
          @click="selectTemplate(t.id)"
        >
          <div class="tmpl-card-top">
            <span class="tmpl-card-name">{{ t.name }}</span>
            <span v-if="!t.available" class="tmpl-tag pending">即将上线</span>
          </div>
          <div class="tmpl-card-desc">{{ t.description }}</div>
          <div class="tmpl-card-tags">
            <span v-for="tag in t.tags" :key="tag" class="tmpl-tag">{{ tag }}</span>
          </div>
          <div class="tmpl-card-radio">
            <span class="radio-dot" :class="{ on: selection.templateId === t.id }" />
          </div>
        </div>

        <div v-if="filteredTemplates.length === 0" class="empty-hint">
          暂无{{ { all: '', system: '系统', mine: '我的', external: '外部导入' }[tmplSubTab] }}模板
        </div>
      </div>
    </div>

    <!-- ========== Tab 2: 选技能 ========== -->
    <div v-if="activeTab === 'skills'" class="tab-skills">
      <div v-if="skillsLoading" class="loading-hint">加载中...</div>
      <template v-else>
        <div v-if="configSkills.length" class="skill-group">
          <div class="skill-group-title">需配置</div>
          <div class="skill-items">
            <div
              v-for="s in configSkills"
              :key="s.id"
              class="skill-item"
              :class="{ selected: selectedSkillIds.has(s.id), full: selectedSkillIds.size >= MAX_SKILLS && !selectedSkillIds.has(s.id) }"
              @click="toggleSkill(s)"
            >
              <div class="skill-left">
                <span class="skill-badge badge-config">&#9881; 需配置</span>
                <span class="skill-name">{{ s.name }}</span>
                <span v-if="s.source" class="skill-source">{{ s.source }}</span>
              </div>
              <div class="skill-desc">{{ s.description }}</div>
              <div class="skill-check" :class="{ on: selectedSkillIds.has(s.id) }">&#10003;</div>
            </div>
          </div>
        </div>

        <div v-if="directSkills.length" class="skill-group">
          <div class="skill-group-title">可直接用</div>
          <div class="skill-items">
            <div
              v-for="s in directSkills"
              :key="s.id"
              class="skill-item"
              :class="{ selected: selectedSkillIds.has(s.id), full: selectedSkillIds.size >= MAX_SKILLS && !selectedSkillIds.has(s.id) }"
              @click="toggleSkill(s)"
            >
              <div class="skill-left">
                <span class="skill-badge badge-direct">&#9889; 直接用</span>
                <span class="skill-name">{{ s.name }}</span>
                <span v-if="s.source" class="skill-source">{{ s.source }}</span>
              </div>
              <div class="skill-desc">{{ s.description }}</div>
              <div class="skill-check" :class="{ on: selectedSkillIds.has(s.id) }">&#10003;</div>
            </div>
          </div>
        </div>

        <div class="skill-footer-hint">
          已选 <strong>{{ selectedSkillIds.size }}</strong> / {{ MAX_SKILLS }} 项技能
        </div>
      </template>
    </div>

    <!-- ========== Tab 3: 选连接器 ========== -->
    <div v-if="activeTab === 'mcps'" class="tab-mcps">
      <div v-if="connectorsLoading" class="loading-hint">加载中...</div>
      <div v-else-if="connectorList.length === 0" class="empty-hint">暂无连接器</div>
      <div v-else class="mcp-grid">
        <div
          v-for="mcp in connectorList"
          :key="mcp.id"
          class="mcp-card"
          :class="{ selected: selectedMcpIds.has(mcp.id) }"
          @click="toggleConnector(mcp)"
        >
          <div class="mcp-icon">{{ mcp.name.charAt(0) }}</div>
          <div class="mcp-info">
            <div class="mcp-name">{{ mcp.name }}</div>
            <div class="mcp-meta">{{ mcp.type }} · {{ mcp.tools }} 个工具</div>
          </div>
          <div class="mcp-check" :class="{ on: selectedMcpIds.has(mcp.id) }">&#10003;</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.picker-tabs-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px 28px;
}

// ========== Tab 1 — 模板 ==========
.tmpl-subtabs {
  display: flex;
  gap: 6px;
  margin-bottom: 18px;
}

.tmpl-subtab {
  padding: 6px 16px;
  border: 1px solid $border-color;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  background: transparent;
  color: $text-secondary;
  cursor: pointer;
  transition: 0.15s;

  &:hover {
    border-color: $accent-primary;
    color: $accent-primary;
  }

  &.active {
    background: $accent-primary;
    border-color: $accent-primary;
    color: #fff;
  }
}

.tmpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
}

.tmpl-card {
  position: relative;
  background: $bg-card;
  border: 2px solid $border-color;
  border-radius: $radius-lg;
  padding: 18px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &:hover:not(.disabled) {
    border-color: $accent-primary;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  &.selected {
    border-color: $accent-primary;
    box-shadow: 0 0 0 1px $accent-primary, 0 4px 16px rgba(var(--accent-primary-rgb), 0.12);
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.tmpl-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tmpl-card-name {
  font-size: 15px;
  font-weight: 600;
  color: $text-primary;
}

.tmpl-card-desc {
  font-size: 12.5px;
  color: $text-secondary;
  line-height: 1.5;
}

.tmpl-card-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.tmpl-tag {
  font-size: 10.5px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid $border-color;
  background: $bg-secondary;
  color: $text-secondary;
  font-weight: 500;

  &.pending {
    background: $badge-config;
    border-color: transparent;
    color: $accent-primary;
  }
}

.tmpl-card-radio {
  position: absolute;
  top: 14px;
  right: 14px;
}

.radio-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: 0.15s;
  flex-shrink: 0;

  &.on {
    border-color: $accent-primary;
    background: $accent-primary;
    box-shadow: inset 0 0 0 4px #fff;
  }
}

.tmpl-card.selected .radio-dot.on {
  box-shadow: inset 0 0 0 4px var(--bg-card);
}

// ========== Tab 2 — 技能 ==========
.skill-group {
  margin-bottom: 20px;
}

.skill-group-title {
  font-size: 13px;
  font-weight: 600;
  color: $text-secondary;
  margin-bottom: 10px;
  padding-left: 2px;
}

.skill-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  background: $bg-card;
  cursor: pointer;
  transition: 0.15s;

  &:hover:not(.full) {
    border-color: $accent-primary;
    background: var(--bg-card-hover, $bg-card);
  }

  &.selected {
    border-color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.04);
  }

  &.full {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.skill-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.skill-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;

  &.badge-config {
    background: $badge-config;
    color: $accent-primary;
  }

  &.badge-direct {
    background: $badge-direct;
    color: $success;
  }
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
  white-space: nowrap;
}

.skill-source {
  font-size: 11px;
  color: $text-muted;
  white-space: nowrap;
}

.skill-desc {
  font-size: 12px;
  color: $text-secondary;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-check {
  width: 20px;
  height: 20px;
  border-radius: $radius-sm;
  border: 2px solid $border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  transition: 0.15s;
  flex-shrink: 0;

  &.on {
    background: $accent-primary;
    border-color: $accent-primary;
  }
}

.skill-footer-hint {
  text-align: center;
  font-size: 12.5px;
  color: $text-muted;
  padding: 8px 0;

  strong {
    color: $accent-primary;
  }
}

// ========== Tab 3 — 连接器 ==========
.mcp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.mcp-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  cursor: pointer;
  background: $bg-card;
  transition: 0.15s;

  &:hover {
    border-color: $accent-primary;
  }

  &.selected {
    border-color: $accent-primary;
    background: rgba(var(--accent-primary-rgb), 0.04);
  }
}

.mcp-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: $bg-secondary;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: $accent-primary;
  flex-shrink: 0;
}

.mcp-info {
  flex: 1;
  min-width: 0;
}

.mcp-name {
  font-size: 14px;
  font-weight: 600;
  color: $text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-meta {
  font-size: 11.5px;
  color: $text-muted;
  margin-top: 2px;
}

.mcp-check {
  color: $accent-primary;
  font-size: 16px;
  font-weight: 700;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;

  &.on {
    opacity: 1;
  }
}

// ========== 通用 ==========
.loading-hint,
.empty-hint {
  text-align: center;
  padding: 40px 0;
  font-size: 13px;
  color: $text-muted;
}
</style>
