## ADDED Requirements

### Requirement: 按成果类型分发到对应页面操作器
系统 SHALL 通过一个统一的值守执行器脚本登录数智大气，然后按任务成果列表中的 `type` 字段，将每个成果分发到对应的页面操作器执行。本次只实现 `onemap` 操作器，其他操作器以 stub 形式预留。

#### Scenario: 执行一张图截图
- **WHEN** 任务传入一条 `type=onemap` 的成果
- **THEN** 系统 SHALL 导航到写死的一张图直链，等待渲染完成，并截取整页图像

#### Scenario: 执行未实现的操作器
- **WHEN** 任务传入 `type=ranking`、`hourly` 或 `monitoring` 的成果
- **THEN** 系统 SHALL 分发到对应 stub 操作器，并抛出明确的 `NotImplementedError` 错误

#### Scenario: 忽略任务传入的参数
- **WHEN** 任务成果 config 中包含 theme / factor / leftPanel / city 等字段
- **THEN** 系统 SHALL 忽略这些字段，仍导航到写死的直链

### Requirement: 复用已验证的登录与设备清退
系统 SHALL 复用与浓度排名截图能力一致的登录流程与登录设备数上限清退逻辑，以支持无人值守运行。登录只执行一次，所有操作器共享同一个 Playwright page 实例。

#### Scenario: 登录时遇到设备数上限
- **WHEN** 登录出现"登录设备数量已达上限"
- **THEN** 系统 SHALL 自动清退旧设备直至可登录，清退失败时以明确错误终止

### Requirement: 保护运行凭证
系统 MUST 从 Envclaw 注入的运行时凭证读取数智大气用户名和密码，且不得将明文凭证写入脚本源码、任务配置、命令、日志或回复。

#### Scenario: 缺少凭证
- **WHEN** 运行时未注入 `MAPAIRS_USERNAME` 或 `MAPAIRS_PASSWORD`
- **THEN** 系统 SHALL 在启动登录流程前的预检阶段失败，并提示需要配置数智大气凭证

### Requirement: 产出可推送的图片路径
系统 SHALL 将整页截图写入任务输出目录，并以 `ARTIFACT:<绝对路径>` 输出图片路径供后续推送使用。推送本身不在本能力范围内。

#### Scenario: 截图成功
- **WHEN** 一张图截图生成成功
- **THEN** 系统 SHALL 打印 `ARTIFACT:<绝对图片路径>`，供定时任务的 agent 通过 `media://` 语法推送

#### Scenario: 截图失败
- **WHEN** 登录、导航或截图任一环节失败
- **THEN** 系统 SHALL 报告脚本错误，且不改用 agent 直接操作网页作为替代
