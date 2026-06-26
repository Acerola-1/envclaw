## 1. 后端 API 实现

- [ ] 1.1 在 `packages/server/src/controllers/hermes/` 创建 `data-source-platforms.ts` 控制器，实现 `getDataSourcePlatforms` 和 `updateDataSourcePlatforms` 方法
- [ ] 1.2 在 `packages/server/src/routes/hermes/` 创建 `data-source-platforms.ts` 路由文件，注册 `GET/PUT /api/hermes/data-source-platforms`
- [ ] 1.3 将新路由注册到 Hermes 路由入口（参考 `channel-contacts.ts` 的注册方式）

## 2. 前端 API 层

- [ ] 2.1 在 `packages/client/src/api/hermes/` 创建 `data-source-platforms.ts`，定义 `fetchDataSourcePlatforms` 和 `updateDataSourcePlatforms` API 函数

## 3. 前端 Store 改造

- [ ] 3.1 修改 `packages/client/src/stores/hermes/dataSourcePlatforms.ts`，添加 `loadPlatforms()` 异步方法从 API 加载配置
- [ ] 3.2 修改 store 的 `addPlatform`、`deletePlatform`、`addAccount`、`editAccount`、`deleteAccount`、`setDefaultAccount`、`updatePrompt`、`toggleEnabled` 方法，每次修改后调用 `savePlatforms()` 保存到 API
- [ ] 3.3 添加 API 不可用时的回退逻辑：捕获错误后回退到内存模式，在控制台输出警告
- [ ] 3.4 在 store 初始化时调用 `loadPlatforms()` 加载配置（可在组件 mounted 时触发）

## 4. 前端视图适配

- [ ] 4.1 修改 `DataSourcePlatformsView.vue`，在 mounted 时触发 store 的 `loadPlatforms()`
- [ ] 4.2 修改 `DataSourcePlatformSettings.vue`，确保操作后触发保存

## 5. 验证

- [ ] 5.1 验证页面刷新后数据源平台配置不丢失
- [ ] 5.2 验证 API 不可用时前端仍可正常使用（回退到内存模式）
- [ ] 5.3 验证预置平台在首次加载时正确写入服务端