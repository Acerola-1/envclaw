## Why

当前创建值守任务弹窗仅支持简单的"每小时/每日/自定义"调度配置，无法满足用户对灵活执行频率的需求。用户需要更精细的调度控制，包括周期性执行（每天/每周/每月/每年）、固定间隔执行、单次定时执行，以及生效日期区间配置。

## What Changes

- 在 CreateGuardTaskModal 弹窗中新增"执行频率"配置区域
- 执行频率支持三种模式通过 Tab 切换：
  - **周期模式**：Select 切换器（每天/每周/每月/每年）+ 时间选择器
  - **按间隔模式**：数字输入框（间隔小时数）+ 周一至周日多选复选按钮
  - **单次模式**：时间选择器 + 日期选择器
- 新增"生效日期区间"配置：日期范围选择器

## Capabilities

### New Capabilities
- `guard-task-schedule-config`: 值守任务执行频率配置能力，包含周期调度、间隔调度、单次调度三种模式及生效日期区间设置

### Modified Capabilities

## Impact

- **前端组件**：修改 `packages/client/src/components/hermes/guard/CreateGuardTaskModal.vue`
- **UI 依赖**：需要使用 naive-ui 的 NTabs、NDatePicker、NCheckboxGroup 等组件
- **数据结构**：任务创建接口需要支持新的调度参数格式
