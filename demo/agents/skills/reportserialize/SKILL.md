# 深度报告连载神器 (Report Serialize)

## Description
This skill transforms long-form professional PDFs into a multi-part, serialized Markdown article series (especially tailored for WeChat Official Accounts). It extracts the core insights and generates a structured content plan, then drafts each chapter sequentially with cohesive context and targeted business CTAs.

## Core Capabilities
1. **GUI Mode (Vite React App)**: An interactive editor and visual dashboard for parsing PDFs, reviewing AI-generated plans, editing chapters locally with multi-versioning, and generating interactive chat refinements (located in `D:\cc\Library\Tools\reportserialize`).
2. **CLI Mode (Python Script)**: A fast, headless terminal interface for batch-converting a PDF directly into an output folder of `.md` chapters.

## Commands

### 1. Launch GUI Mode
Run the Web UI for visual operations (Start the React Dev Server):
```powershell
d:\cc\.agents\skills\reportserialize\gui_mode.bat
```
*(The GUI will automatically start a local server at `http://localhost:3000` and open your browser.)*

### 2. Run CLI Mode
Use the python CLI script to generate the serialized chapters headless:
```powershell
python d:\cc\.agents\skills\reportserialize\cli_mode.py --pdf "path/to/report.pdf" --business "公司主营业务" --tone "professional" --output-dir "D:\cc\Projects\Translation_Project\output"
```
**CLI Parameters:**
- `--pdf`: (Required) Path to the source PDF report.
- `--business`: (Required) Brief description of the company/business (used for targeted soft-ads).
- `--tone`: (Optional) `professional` (default), `insightful`, `popular`, or `humorous`.
- `--output-dir`: (Optional) Folder to save output Markdowns (defaults to `./output`).

## Design Principles
- **Progressive Delivery**: Do not attempt to summarize a 50+ page PDF into a single article. The skill forces a serialized, multi-chapter structure.
- **Tone Adherence**: The `tone` parameter significantly alters vocabulary and reading difficulty (e.g. `professional` uses deep industry jargon, `popular` uses simplified metaphors).
