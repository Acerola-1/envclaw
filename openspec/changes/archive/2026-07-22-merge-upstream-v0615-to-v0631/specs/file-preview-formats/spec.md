## ADDED Requirements

### Requirement: Document file preview
系统 SHALL 支持在浏览器中预览生成的文档文件，包括 DOCX、HTML、PDF、PPTX 格式。

#### Scenario: Preview a DOCX file
- **WHEN** 用户点击工作区中的 .docx 文件
- **THEN** 系统 SHALL 在文件预览面板中渲染 DOCX 内容

#### Scenario: Preview a PDF file
- **WHEN** 用户点击工作区中的 .pdf 文件
- **THEN** 系统 SHALL 在文件预览面板中渲染 PDF 内容

#### Scenario: Preview a PPTX file
- **WHEN** 用户点击工作区中的 .pptx 文件
- **THEN** 系统 SHALL 在文件预览面板中渲染 PPTX 幻灯片内容

#### Scenario: Preview an HTML file
- **WHEN** 用户点击工作区中的 .html 文件
- **THEN** 系统 SHALL 在文件预览面板中安全渲染 HTML 内容

### Requirement: Spreadsheet file preview
系统 SHALL 支持预览电子表格文件（XLSX/CSV），使用 Web Worker 解析。

#### Scenario: Preview a spreadsheet file
- **WHEN** 用户点击工作区中的 .xlsx 或 .csv 文件
- **THEN** 系统 SHALL 在文件预览面板中以表格形式渲染数据

### Requirement: Workspace diff preview
系统 SHALL 支持预览工作区变更差异（workspace diff），显示文件增删改。

#### Scenario: View workspace diff
- **WHEN** 用户查看 coding agent 的工作区变更
- **THEN** 系统 SHALL 显示变更文件的列表和差异内容

### Requirement: Group chat workspace binding
群聊 SHALL 支持绑定工作区文件，成员可查看和预览共享文件。

#### Scenario: Group chat shows workspace files
- **WHEN** 群聊中有共享的工作区文件
- **THEN** 群聊面板 SHALL 显示文件列表，用户可点击预览
