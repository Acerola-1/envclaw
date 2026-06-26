import { ref, onMounted, type Ref } from 'vue'
import { fetchSkills, type SkillInfo } from '@/api/hermes/skills'

/**
 * 技能列表 composable
 *
 * 从 GET /api/hermes/skills 加载所有技能（跨分类扁平化），
 * 供向导的"可选技能"字段消费。
 */
export function useSkillList() {
  const allSkills = ref<SkillInfo[]>([]) as Ref<SkillInfo[]>
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await fetchSkills()
      // 扁平化：从 categories 中提取所有 skill
      const skills: SkillInfo[] = []
      for (const cat of data.categories) {
        for (const skill of cat.skills) {
          skills.push(skill)
        }
      }
      // 追加 archived
      if (data.archived) {
        skills.push(...data.archived)
      }
      allSkills.value = skills
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  return { allSkills, loading, error, reload: load }
}
