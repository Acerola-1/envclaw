## 1. 数据结构与类型定义

- [x] 1.1 定义 ScheduleConfig 接口类型（包含周期、间隔、单次三种模式及生效日期区间）
- [x] 1.2 扩展 task 创建数据结构，添加 scheduleConfig 字段
- [x] 1.3 添加 skills 字段到表单数据结构

## 2. 执行频率 Tab 组件实现

- [x] 2.1 添加 NTabs 组件实现三种调度模式切换
- [x] 2.2 实现周期模式 UI：NSelect（每天/每周/每月/每年）+ 时间选择器
- [x] 2.3 实现按间隔模式 UI：数字输入框（间隔小时数）+ 周一至周日 NCheckboxGroup
- [x] 2.4 实现单次模式 UI：时间选择器 + NDatePicker 日期选择器

## 3. 生效日期区间实现

- [x] 3.1 添加 NDatePicker 日期范围选择器组件
- [x] 3.2 绑定 effectiveDateRange 数据
- [x] 3.3 实现条件渲染：仅在周期和按间隔模式下显示生效日期区间

## 4. 技能选项实现（与 JobFormModal 保持一致）

- [x] 4.1 导入 fetchSkills API 和 SkillInfo 类型（路径：`@/api/hermes/skills`）
- [x] 4.2 复制 buildSkillOptions 函数（从 JobFormModal，处理 enabled 过滤和去重）
- [x] 4.3 实现 loadSkillOptions 函数（加载、异常处理、loading 状态）
- [x] 4.4 添加 NSelect 技能选择器组件（multiple、filterable、clearable）
- [x] 4.5 将技能选择器嵌入提示词输入框内部下方（使用自定义容器包裹 textarea 和 NSelect）
- [x] 4.6 确保提交时 skills 参数为 string[] 类型（与 CreateJobRequest.skills 一致）

## 5. 表单验证与逻辑

- [x] 5.1 实现间隔小时数验证（1-24 范围）
- [x] 5.2 实现至少选择一天验证
- [x] 5.3 实现单次日期不能早于今天验证
- [x] 5.4 实现生效日期区间验证（结束日期晚于开始日期）

## 6. Cron 表达式生成与提交

- [x] 6.1 实现周期模式 cron 表达式生成逻辑
- [x] 6.2 实现间隔模式 cron 表达式生成逻辑
- [x] 6.3 集成调度配置和 skills 到 handleCreate 提交函数

## 7. 样式调整与测试

- [x] 7.1 调整表单布局样式，确保三种模式切换流畅
- [ ] 7.2 测试生效日期区间条件渲染（单次模式隐藏）
- [ ] 7.3 测试技能选择器功能（加载、多选、清除）
- [ ] 7.4 测试各种配置场景的表单验证
- [ ] 7.5 测试生成的调度数据格式正确性
