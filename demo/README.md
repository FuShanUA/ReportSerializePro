# 报告连载助手 (Report Serialization Assistant)

这是一个基于 AI 的报告连载策划与撰写神器，旨在帮助专业人士高效地将深度报告转化为吸引人的连载内容。

## 本地运行指南

如果你想在自己的电脑上运行这个应用，请按照以下步骤操作：

### 1. 环境准备

确保你的电脑上已安装 **Node.js** (建议版本 v18 或更高)。你可以从 [nodejs.org](https://nodejs.org/) 下载安装。

### 2. 获取源代码

在 Google AI Studio Build 中，点击右上角的 **Settings (设置)** 菜单，选择 **Export to ZIP (导出为 ZIP)** 或 **Export to GitHub (导出到 GitHub)**。

### 3. 安装依赖

解压导出的文件（如果是 ZIP），打开终端（或命令提示符），进入项目根目录，运行：

```bash
npm install
```

### 4. 配置环境变量

在项目根目录下创建一个名为 `.env` 的文件，并添加你的 Gemini API 密钥：

```env
GEMINI_API_KEY=你的_GEMINI_API_密钥
```

> 你可以从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取免费的 API 密钥。

### 5. 启动应用

在终端中运行：

```bash
npm run dev
```

启动后，在浏览器中访问终端显示的地址（通常是 `http://localhost:3000`）。

## 主要功能

- **PDF 解析**：上传行业报告 PDF，自动提取核心内容。
- **智能策划**：基于报告内容自动生成 5-7 期连载规划。
- **AI 撰写**：一键生成各期连载初稿，支持多种文案风格。
- **双模运行**：
  - **GUI 模式**：React 交互式编辑器。
  - **CLI 模式**：基于 Python 的桌面端批量生成工具。
- **Antigravity Skill 集成**：原生支持作为 AI Agent 的扩展技能。

---

## 运行模式

### 1. GUI 模式 (React + Vite)
按上述“本地运行指南”安装依赖后运行 `npm run dev`。

### 2. CLI 模式 (Python)
安装 `google-generativeai` 和 `pymupdf` 后：
```bash
python agents/skills/reportserialize/cli_mode.py --pdf "报告.pdf" --business "业务描述"
```

### 3. Antigravity Skill
直接将本仓库中 `agents/skills/reportserialize` 目录挂载到你的 Agent 技能链中。

---

由 Google AI Studio Build 强力驱动。
