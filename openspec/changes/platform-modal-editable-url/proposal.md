## Why

新增数据源平台时，当前直接调用 `store.addPlatform()` 静默添加，缺少表单弹窗让用户填写平台名称、URL、账号和提示词。同时，已配置平台的 URL 字段在 UI 上只读，无法修改。

## What Changes

- 新增平台时使用弹窗表单（与新增账号一致），包含：平台名称、URL、账号（用户名/密码/别名）、平台提示词
- 将平台 URL 字段改为可编辑，支持在平台卡片中修改

## Capabilities

### New Capabilities

- `platform-form-modal`: 新增数据源平台的弹窗表单组件，包含平台基本信息和账号配置

### Modified Capabilities

- (无)

## Impact

- `packages/client/src/components/hermes/guard/DataSourcePlatformCard.vue` — 平台 URL 改为可编辑
- `packages/client/src/components/hermes/settings/DataSourcePlatformSettings.vue` — 新增平台按钮改为打开弹窗
- 新增 `packages/client/src/components/hermes/guard/DataSourcePlatformForm.vue` — 平台表单弹窗
- `packages/client/src/stores/hermes/dataSourcePlatforms.ts` — 接口不变，调用方改为弹窗组件