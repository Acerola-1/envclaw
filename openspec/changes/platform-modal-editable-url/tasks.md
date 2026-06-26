## 1. 新增平台表单弹窗组件

- [x] 1.1 创建 `DataSourcePlatformForm.vue` 组件，使用 NModal + NForm 结构
- [x] 1.2 实现平台名称输入（必填校验）
- [x] 1.3 实现 URL 输入
- [x] 1.4 实现账号输入（用户名、密码、别名）
- [x] 1.5 实现平台提示词输入
- [x] 1.6 实现保存/取消按钮，提交时调用 store.addPlatform()

## 2. 集成到平台设置页面

- [x] 2.1 修改 `DataSourcePlatformSettings.vue`，"+ 新增平台" 按钮改为打开弹窗
- [x] 2.2 移除 `DataSourcePlatformsView.vue` 中的 `handleAddPlatform` 函数（迁移到弹窗组件）

## 3. URL 可编辑

- [x] 3.1 在 `DataSourcePlatformCard.vue` 中将 URL 从只读 `NEllipsis` 改为可编辑输入
- [x] 3.2 实现 URL 编辑模式切换（双击或编辑按钮）
- [x] 3.3 实现 URL 保存逻辑，调用 store 更新平台 URL