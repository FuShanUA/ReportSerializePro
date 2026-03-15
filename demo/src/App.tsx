/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BookOpen, 
  Edit3, 
  Eye, 
  ChevronRight, 
  ChevronLeft, 
  LayoutDashboard, 
  FileText, 
  Send,
  Save,
  AlertCircle,
  MessageSquare,
  Sparkles,
  X,
  Loader2,
  Lightbulb,
  Upload,
  Settings,
  CheckCircle2,
  Plus,
  ArrowRight,
  Paperclip,
  Download,
  Maximize2,
  Minimize2,
  Smile,
  Zap,
  RotateCcw,
  Type as TypeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';

// Set worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Chapter {
  id: number;
  title: string;
  outline: string;
  content: string;
  status: 'pending' | 'draft' | 'completed';
  versions: Version[];
}

interface Version {
  version: string;
  content: string;
  timestamp: number;
}

const TONE_OPTIONS = [
  { id: 'professional', label: '专业严谨', desc: '适合深度行业报告，用词考究，逻辑严密' },
  { id: 'insightful', label: '犀利洞察', desc: '观点鲜明，直击痛点，适合评论或深度解析' },
  { id: 'popular', label: '通俗易懂', desc: '化繁为简，多用比喻，适合大众科普或初学者' },
  { id: 'humorous', label: '幽默风趣', desc: '金句频出，轻松活泼，适合社交媒体传播' },
];

const DEFAULT_SERIAL_PLAN = `## 1. 策划思路
- **核心目标**：通过连载建立专业形象，吸引对数据治理、DCMM、数字化转型感兴趣的精准 B 端客户，最终引导至后台咨询。
- **调性定位**：专业、前瞻、实战、犀利（直击痛点）。
- **引流技巧**：每期抛出一个行业普遍存在的“扎心”问题，给出报告中的部分核心逻辑，但在关键的“操作手册”和“完整矩阵”处留白。

## 2. 连载目录规划
| 期数 | 主题方向 | 核心痛点 | 对应报告章节 |
| :--- | :--- | :--- | :--- |
| 连载一 | 总体综述与趋势 | 制度写在纸上，业务跑在圈外 | 总序、执行摘要 |
| 连载二 | 现状剖析与痛点 | 谁该为数据质量“背锅”？ | 第二章 2.1 & 2.3 |
| 连载三 | 核心原则与路径 | 为什么 IT 部门理不清业务数据？ | 第三章 3.1 & 3.2 |
| 连载四 | 角色定义与权责 | 数据主人 vs 数据管家：拒绝踢皮球 | 第一章 1.3、第三章 3.4 |
| 连载五 | 行业实战案例 | 金融与电信行业的“优等生”作业 | 第四章 案例一 & 二 |
| 连载六 | AI 时代的演进 | 大模型喂了“脏数据”怎么办？ | 第五章 趋势展望 |
| 连载七 | 总结与生态构建 | 从“人治”到“智治”的跨越 | 结语 |

## 3. 软广话术模板
> **【福利预告】**
> 本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
> **报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**`;

const INITIAL_ISSUES: Chapter[] = [
  {
    id: 1,
    title: "连载一-从“纸上制度”到“业务日常”",
    outline: "探讨数据治理从合规驱动向实效驱动的转变。",
    status: 'completed',
    content: `# 《数据认责体系建设报告》 连载一-从“纸上制度”到“业务日常”：十五五数据治理的“深水区”突破

**【导读】**
当全国万家企业完成 DCMM 贯标，当数据资产开始入表，我们是否真正解决了“数据谁来管、出事谁负责、价值怎么定”的终极难题？“十四五”收官在即，“十五五”大幕将启，数据治理正从“合规驱动”全面转向“实效驱动”。

### 1. 站在“十五五”门口的回望：贯标之后，实效几何？
在过去的五年里，我国数据管理能力（DCMM）取得了瞩目进展。截至 2025 年底，全国参评企业已超万家。然而，在繁荣的“贯标”热潮背后，一个尴尬的现实正浮出水面：

**许多企业拿到了等级证书，数据却依然“不好用”、“不敢用”、“找不到人管”。**

数据治理正步入“深水区”。如果说过去是建立框架的“圈地时代”，那么未来五年，将是精耕细作的“实效时代”。

### 2. 三大演进趋势：数据治理的“范式转移”
根据最新发布的《DCMM 专项报告 - 数据认责体系建设》，未来数据管理将呈现三大核心转变：
*   **从“纸上制度”到“业务日常”**：告别厚厚的文档，让治理逻辑嵌入每一行业务代码和每一个操作流程。
*   **从“专家人工”到“AI 智能体”**：在 DeepSeek 等大模型兴起的背景下，依靠人工梳理千万级字段的时代已经结束，智能化治理成为必选项。
*   **从“静态报表”到“决策智能”**：数据不再只是为了应付监管报送，而是要成为驱动业务增长的“燃料”。

### 3. 扎心的真相：为什么“认责”是那块最难啃的骨头？
报告执行摘要中犀利地指出：**数据认责往往是政企机构数据治理中最易被忽视的短板。**

很多企业误以为“设立了岗位、写清了职责”就是完成了认责。结果呢？
*   **责任“真空”**：跨部门流转的数据，出了错谁也不认。
*   **责任“重叠”**：多头管理，业务部门觉得是 IT 的事，IT 觉得业务才懂数据。
*   **“摊派”心态**：业务部门感知度低，觉得数据治理是数据中心的“KPI 摊派”，参与意愿极低。

**数据认责体系建设力度，已成为衡量一家企业数字化转型是否“玩真格”的试金石。**

### 4. 预告：如何破解“责任不清”的死循环？
本专项报告从**内涵定义、落地现状、工作方法、优秀实践及未来展望**五个维度，系统性地回答了如何构建一套“转得动、有价值、可持续”的认责体系。

在接下来的连载中，我们将深度拆解：
*   为什么 IT 部门永远理不清业务数据的“账”？
*   “数据主人（Data Owner）”和“数据管家（Data Steward）”到底怎么分工？
*   金融、电信、能源等行业的领头羊是如何做“认责矩阵”的？

---

**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**

---
*下一期预告：《谁该为数据质量“背锅”？揭秘政企数据治理的四大深坑》*`,
    versions: [{ version: "1.0", content: `# 《数据认责体系建设报告》 连载一-从“纸上制度”到“业务日常”：十五五数据治理的“深水区”突破

**【导读】**
当全国万家企业完成 DCMM 贯标，当数据资产开始入表，我们是否真正解决了“数据谁来管、出事谁负责、价值怎么定”的终极难题？“十四五”收官在即，“十五五”大幕将启，数据治理正从“合规驱动”全面转向“实效驱动”。

### 1. 站在“十五五”门口的回望：贯标之后，实效几何？
在过去的五年里，我国数据管理能力（DCMM）取得了瞩目进展。截至 2025 年底，全国参评企业已超万家。然而，在繁荣的“贯标”热潮背后，一个尴尬的现实正浮出水面：

**许多企业拿到了等级证书，数据却依然“不好用”、“不敢用”、“找不到人管”。**

数据治理正步入“深水区”。如果说过去是建立框架的“圈地时代”，那么未来五年，将是精耕细作的“实效时代”。

### 2. 三大演进趋势：数据治理的“范式转移”
根据最新发布的《DCMM 专项报告 - 数据认责体系建设》，未来数据管理将呈现三大核心转变：
*   **从“纸上制度”到“业务日常”**：告别厚厚的文档，让治理逻辑嵌入每一行业务代码和每一个操作流程。
*   **从“专家人工”到“AI 智能体”**：在 DeepSeek 等大模型兴起的背景下，依靠人工梳理千万级字段的时代已经结束，智能化治理成为必选项。
*   **从“静态报表”到“决策智能”**：数据不再只是为了应付监管报送，而是要成为驱动业务增长的“燃料”。

### 3. 扎心的真相：为什么“认责”是那块最难啃的骨头？
报告执行摘要中犀利地指出：**数据认责往往是政企机构数据治理中最易被忽视的短板。**

很多企业误以为“设立了岗位、写清了职责”就是完成了认责。结果呢？
*   **责任“真空”**：跨部门流转的数据，出了错谁也不认。
*   **责任“重叠”**：多头管理，业务部门觉得是 IT 的事，IT 觉得业务才懂数据。
*   **“摊派”心态**：业务部门感知度低，觉得数据治理是数据中心的“KPI 摊派”，参与意愿极低。

**数据认责体系建设力度，已成为衡量一家企业数字化转型是否“玩真格”的试金石。**

### 4. 预告：如何破解“责任不清”的死循环？
本专项报告从**内涵定义、落地现状、工作方法、优秀实践及未来展望**五个维度，系统性地回答了如何构建一套“转得动、有价值、可持续”的认责体系。

在接下来的连载中，我们将深度拆解：
*   为什么 IT 部门永远理不清业务数据的“账”？
*   “数据主人（Data Owner）”和“数据管家（Data Steward）”到底怎么分工？
*   金融、电信、能源等行业的领头羊是如何做“认责矩阵”的？

---

**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**

---
*下一期预告：《谁该为数据质量“背锅”？揭秘政企数据治理的四大深坑》*`, timestamp: Date.now() }]
  },
  {
    id: 2,
    title: "连载二-谁该为数据质量“背锅”？",
    outline: "分析数据认责落地的四大痛点：设计脱节、权责不对等、粒度失衡、业务参与感不足。",
    status: 'completed',
    content: `# 《数据认责体系建设报告》 连载二-谁该为数据质量“背锅”？揭秘政企数据治理中最易被忽视的短板

**【导读】**
DCMM 贯标中常见的怪象：设立了岗位、明确了职责，但数据出问题时，依然是“责任真空”与“责任重叠”并存。

**【痛点剖析】**
在调研了数百家政企机构后，我们发现了数据认责落地的四大“深坑”：
1. **设计与实践脱节**：直接套用理论框架，结果“水土不服”，角色有名无实。许多组织未能根据自身组织架构、人员能力进行必要裁剪。
2. **权责利不对等**：只给责任不给权，只罚不奖，认责成了业务部门的“额外负担”。“有责无权”导致责任人难以推动实质性改进。
3. **范围与粒度失衡**：要么“贪大求全”搞全量认责导致崩盘，要么“碎片化”治理导致责任链条断档。粒度过粗无法定位到人，过细则工作量激增。
4. **业务参与感不足**：IT 部门自嗨，业务部门冷眼旁观。治理动作偏离实际痛点，业务部门视其为“成本项”而非“投资项”。

**【报告精华露出】**
报告提出，数据认责不只是“定义职责”，更是一套**横向治理权**的重构。它需要解决的是资产在跨部门业务链条中的“水平”流动问题。

数据认责机制的本质是一种叠加在行政架构之上的“横向治理权”和管理矩阵，通过定义、授予、认领等机制构建超越部门墙的治理协作网络。

那么，如何精准把握认责的“粒度”？如何让业务部门从“被动执行”转向“主动共建”？

---
**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**`,
    versions: [{ version: "1.0", content: `# 《数据认责体系建设报告》 连载二-谁该为数据质量“背锅”？揭秘政企数据治理中最易被忽视的短板

**【导读】**
DCMM 贯标中常见的怪象：设立了岗位、明确了职责，但数据出问题时，依然是“责任真空”与“责任重叠”并存。

**【痛点剖析】**
在调研了数百家政企机构后，我们发现了数据认责落地的四大“深坑”：
1. **设计与实践脱节**：直接套用理论框架，结果“水土不服”，角色有名无实。许多组织未能根据自身组织架构、人员能力进行必要裁剪。
2. **权责利不对等**：只给责任不给权，只罚不奖，认责成了业务部门的“额外负担”。“有责无权”导致责任人难以推动实质性改进。
3. **范围与粒度失衡**：要么“贪大求全”搞全量认责导致崩盘，要么“碎片化”治理导致责任链条断档。粒度过粗无法定位到人，过细则工作量激增。
4. **业务参与感不足**：IT 部门自嗨，业务部门冷眼旁观。治理动作偏离实际痛点，业务部门视其为“成本项”而非“投资项”。

**【报告精华露出】**
报告提出，数据认责不只是“定义职责”，更是一套**横向治理权**的重构。它需要解决的是资产在跨部门业务链条中的“水平”流动问题。

数据认责机制的本质是一种叠加在行政架构之上的“横向治理权”和管理矩阵，通过定义、授予、认领等机制构建超越部门墙的治理协作网络。

那么，如何精准把握认责的“粒度”？如何让业务部门从“被动执行”转向“主动共建”？

---
**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**`, timestamp: Date.now() }]
  },
  {
    id: 3,
    title: "连载三-拒绝“运动式”治理",
    outline: "提出数据认责建设的四大核心原则及四步走建设路径。",
    status: 'draft',
    content: `# 《数据认责体系建设报告》 连载三-拒绝“运动式”治理：如何构建一套“转得动”的数据认责闭环？

**【导读】**
数据认责不是一蹴而就的工程，而是一个持续迭代的闭环。面对落地过程中的诸多挑战，构建一套切实可行的实操体系显得尤为紧迫。

**【实战逻辑】**
很多企业在做认责时，容易陷入“全量认责”的误区。报告建议遵循**“二八原则”**，优先识别**关键数据要素（CDE）**。关键数据要素的识别与定义，为认责工作明确了“靶心”。

**【认责建设的四大核心原则】**
1. **业务主导、问题导向**：鉴于 IT 部门无法定义业务规则，主责必须落在业务归口管理部门。
2. **人人有责、人人尽责**：从录入员、开发人员到决策者，每一环节参与者都应承担相应责任。
3. **滚动开展、价值驱动**：避免试图一次性解决所有问题，应优先选取对经营分析、监管报送等影响大的核心数据。
4. **权责利对等**：赋予管理权的同时，必须给予使用便利权及绩效收益。

**【报告精华露出】**
报告详细勾勒了数据认责的**四步走建设路径**：
1. **策略确立**：识别关键数据要素，界定认责范围。
2. **矩阵编制**：梳理角色映射，明确“谁负责什么”。
3. **落地实施**：流程设计与运营动作，从“纸面”转向“行动”。
4. **常态运营**：建立量化监控指标，驱动持续改进。

在“矩阵编制”环节，如何运用 RACI 模型进行本土化改造？如何通过“认责树”确保责任纵向贯通？

---
**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**`,
    versions: [{ version: "1.0", content: `# 《数据认责体系建设报告》 连载三-拒绝“运动式”治理：如何构建一套“转得动”的数据认责闭环？

**【导读】**
数据认责不是一蹴而就的工程，而是一个持续迭代的闭环。面对落地过程中的诸多挑战，构建一套切实可行的实操体系显得尤为紧迫。

**【实战逻辑】**
很多企业在做认责时，容易陷入“全量认责”的误区。报告建议遵循**“二八原则”**，优先识别**关键数据要素（CDE）**。关键数据要素的识别与定义，为认责工作明确了“靶心”。

**【认责建设的四大核心原则】**
1. **业务主导、问题导向**：鉴于 IT 部门无法定义业务规则，主责必须落在业务归口管理部门。
2. **人人有责、人人尽责**：从录入员、开发人员到决策者，每一环节参与者都应承担相应责任。
3. **滚动开展、价值驱动**：避免试图一次性解决所有问题，应优先选取对经营分析、监管报送等影响大的核心数据。
4. **权责利对等**：赋予管理权的同时，必须给予使用便利权及绩效收益。

**【报告精华露出】**
报告详细勾勒了数据认责的**四步走建设路径**：
1. **策略确立**：识别关键数据要素，界定认责范围。
2. **矩阵编制**：梳理角色映射，明确“谁负责什么”。
3. **落地实施**：流程设计与运营动作，从“纸面”转向“行动”。
4. **常态运营**：建立量化监控指标，驱动持续改进。

在“矩阵编制”环节，如何运用 RACI 模型进行本土化改造？如何通过“认责树”确保责任纵向贯通？

---
**【福利预告】**
本文内容节选自《DCMM 专项报告 - 数据认责体系建设》。该报告全文共 50+ 页，涵盖 5 大行业实践、3 套落地模板及 AI 时代认责新范式。
**报告全文即将正式发布，如需获取预发布版或进行业务咨询，请联系公众号后台，回复“数据认责”获取联系方式。**`, timestamp: Date.now() }]
  },
  {
    id: 4,
    title: "连载四-数据主人 vs 数据管家",
    outline: "辨析数据主人、数据管家等核心角色，明确问责与职责的区别。",
    status: 'pending',
    content: "",
    versions: []
  },
  {
    id: 5,
    title: "连载五-金融与电信行业的“优等生”作业",
    outline: "分享金融与电信行业的优秀实践案例，探讨如何将数据认责从成本项转为投资项。",
    status: 'pending',
    content: "",
    versions: []
  },
  {
    id: 6,
    title: "连载六-AI 时代的演进",
    outline: "探讨 AI 时代下数据认责的范式转移，提出 AI 增强型认责概念。",
    status: 'pending',
    content: "",
    versions: []
  },
  {
    id: 7,
    title: "连载七-总结与生态构建",
    outline: "总结全系列内容，为企业管理者提供落地建议。",
    status: 'pending',
    content: "",
    versions: []
  }
];

export default function App() {
  const [issues, setIssues] = useState<Chapter[]>(INITIAL_ISSUES);
  const [activeId, setActiveId] = useState<number | 'plan'>('plan');
  const [isEditMode, setIsEditMode] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string, isModification?: boolean }[]>([]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isPlanLoading, setIsPlanLoading] = useState(false);
  const [isIssueLoading, setIsIssueLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showIssueSelector, setShowIssueSelector] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Floating AI Edit State
  const [floatingMenu, setFloatingMenu] = useState<{ visible: boolean, x: number, y: number }>({ visible: false, x: 0, y: 0 });
  const [selectionInfo, setSelectionInfo] = useState<{ text: string, start: number, end: number } | null>(null);
  const [floatingPrompt, setFloatingPrompt] = useState("");
  const [isFloatingLoading, setIsFloatingLoading] = useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Configuration State
  const [showConfig, setShowConfig] = useState(false);
  const [companyBusiness, setCompanyBusiness] = useState('');
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0].id);
  const [reportText, setReportText] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planApproved, setPlanApproved] = useState(true);
  const [serialPlan, setSerialPlan] = useState<string>(DEFAULT_SERIAL_PLAN);
  const [planVersions, setPlanVersions] = useState<Version[]>([{ version: "1.0", content: DEFAULT_SERIAL_PLAN, timestamp: Date.now() }]);
  
  // Resizable Sidebars State
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [chatPanelWidth, setChatPanelWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [activeQuickActionMenu, setActiveQuickActionMenu] = useState<string | null>(null);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  const startResizingChat = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingChat(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizingSidebar(false);
    setIsResizingChat(false);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveQuickActionMenu(null);
    };
    if (activeQuickActionMenu) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeQuickActionMenu]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 200 && newWidth < 450) {
        setSidebarWidth(newWidth);
      }
    }
    if (isResizingChat) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 600) {
        setChatPanelWidth(newWidth);
      }
    }
  }, [isResizingSidebar, isResizingChat]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const tips = [
    {
      title: "引流技巧",
      content: "别忘了在结尾保留“软广”话术！这是引导读者联系后台、转化潜在客户的关键。"
    },
    {
      title: "排版建议",
      content: "使用加粗和引用块来突出重点，让长文在手机端更易于扫描阅读。"
    },
    {
      title: "互动技巧",
      content: "在文末抛出一个开放性问题，引导读者在评论区留言，增加账号权重。"
    },
    {
      title: "内容策略",
      content: "连载内容建议保持风格统一，建立读者的阅读预期，提高留存率。"
    }
  ];

  const handleNextTip = () => {
    setCurrentTipIndex((prev) => (prev + 1) % tips.length);
  };

  const activeIssue = activeId === 'plan' 
    ? { id: 0, title: '连载规划', content: serialPlan, outline: '', status: 'completed' as const, versions: planVersions }
    : issues.find(i => i.id === activeId) || issues[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      setReportText(fullText);
    } catch (error) {
      console.error('PDF parsing error:', error);
    } finally {
      setIsPdfLoading(false);
    }
  };

  const generatePlan = async () => {
    if (!reportText || !companyBusiness) return;
    setIsGeneratingPlan(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你是一个资深的公众号编辑。请根据以下报告内容，为公司“${companyBusiness}”规划一个连载系列任务。
        调性要求：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}。
        报告内容摘要：${reportText.substring(0, 5000)}
        
        请输出一个Markdown格式的连载规划，包含：
        1. 连载总名称
        2. 连载目标与受众
        3. 篇目列表（至少6篇），每篇包含标题和核心要点。
        
        请严格按照Markdown格式输出。`,
      });
      const newContent = response.text || '';
      setSerialPlan(newContent);
      setPlanVersions([{ version: "1.0", content: newContent, timestamp: Date.now() }]);
      setActiveId('plan');
      setShowConfig(false);
    } catch (error) {
      console.error('Plan generation error:', error);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const getWordCount = (text: string) => {
    if (!text) return 0;
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.replace(/[\u4e00-\u9fa5]/g, ' ').match(/\b\w+\b/g) || []).length;
    return chineseChars + englishWords;
  };

  const getNextVersion = (current: string, versions: Version[]) => {
    if (versions.length === 0) return "1.0";
    const last = versions[versions.length - 1];
    
    // If content is exactly the same, don't save
    if (last.content === current) return null;

    const [major, minor] = last.version.split('.').map(Number);
    
    // Heuristic: Major change if > 200 chars diff or > 15% change
    const charDiff = Math.abs(current.length - last.content.length);
    const changeRatio = charDiff / (last.content.length || 1);

    if (charDiff > 200 || changeRatio > 0.15) {
      return `${major + 1}.0`;
    } else {
      return `${major}.${minor + 1}`;
    }
  };

  const saveVersion = () => {
    if (activeId === 'plan') {
      const nextVer = getNextVersion(serialPlan, planVersions);
      if (!nextVer) return;

      const newVersion: Version = {
        version: nextVer,
        content: serialPlan,
        timestamp: Date.now()
      };
      setPlanVersions(prev => [...prev, newVersion]);
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId) {
          const nextVer = getNextVersion(issue.content, issue.versions);
          if (!nextVer) return issue;

          const newVersion: Version = {
            version: nextVer,
            content: issue.content,
            timestamp: Date.now()
          };
          return {
            ...issue,
            versions: [...issue.versions, newVersion]
          };
        }
        return issue;
      }));
    }
  };

  const approvePlan = async () => {
    setIsPlanLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `根据以下连载规划，生成各篇目的大纲，并撰写第一篇的完整内容任务。
        规划内容：${serialPlan}
        调性要求：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}
        
        请以JSON格式返回，结构如下：
        {
          "chapters": [
            { "id": 1, "title": "标题", "outline": "大纲内容", "content": "第一篇的完整Markdown内容", "status": "draft", "versions": [{ "version": "1.0", "content": "第一篇的完整Markdown内容", "timestamp": 123456789 }] },
            { "id": 2, "title": "标题", "outline": "大纲内容", "content": "", "status": "pending", "versions": [] },
            ...
          ]
        }`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '{}');
      if (data.chapters) {
        setIssues(data.chapters);
        setPlanApproved(true);
        setActiveId(1);
      }
    } catch (error) {
      console.error('Approve plan error:', error);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const generateIssue = async (id: number) => {
    const chapter = issues.find(i => i.id === id);
    if (!chapter) return;

    setIsIssueLoading(true);
    setShowIssueSelector(false);
    try {
      const prevChapters = issues.filter(i => i.id < id && i.content).map(i => i.content).join('\n\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你正在撰写一个连载系列。
        公司业务：${companyBusiness}
        调性：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}
        前序内容回顾：${prevChapters.substring(0, 3000)}
        当前篇目大纲：${chapter.outline}
        
        请撰写本篇（${chapter.title}）的完整Markdown内容。`,
      });
      
      const newContent = response.text || '';
      setIssues(prev => prev.map(i => {
        if (i.id === id) {
          const hasOldContent = !!i.content;
          const nextVer = getNextVersion(newContent, i.versions);
          const newVersion: Version = {
            version: nextVer || (hasOldContent ? i.versions[i.versions.length-1].version : "1.0"),
            content: newContent,
            timestamp: Date.now()
          };
          
          return {
            ...i,
            content: newContent,
            status: 'draft' as const,
            versions: hasOldContent && nextVer ? [...i.versions, newVersion] : (i.versions.length === 0 ? [newVersion] : i.versions)
          };
        }
        return i;
      }));
      setActiveId(id);
    } catch (error) {
      console.error('Generate issue error:', error);
    } finally {
      setIsIssueLoading(false);
    }
  };

  const generateAll = async () => {
    setIsIssueLoading(true);
    setShowConfirmAll(false);
    try {
      let currentIssues = [...issues];
      
      for (const chapter of currentIssues) {
        const prevChapters = currentIssues
          .filter(i => i.id < chapter.id && i.content)
          .map(i => i.content)
          .join('\n\n');
          
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `你正在撰写一个连载系列。
          公司业务：${companyBusiness}
          调性：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}
          前序内容回顾：${prevChapters.substring(0, 3000)}
          当前篇目大纲：${chapter.outline}
          
          请撰写本篇（${chapter.title}）的完整Markdown内容。`,
        });
        
        const newContent = response.text || '';
        currentIssues = currentIssues.map(i => {
          if (i.id === chapter.id) {
            const hasOldContent = !!i.content;
            const nextVer = getNextVersion(newContent, i.versions);
            const newVersion: Version = {
              version: nextVer || (hasOldContent ? i.versions[i.versions.length-1].version : "1.0"),
              content: newContent,
              timestamp: Date.now()
            };
            return {
              ...i,
              content: newContent,
              status: 'draft' as const,
              versions: hasOldContent && nextVer ? [...i.versions, newVersion] : (i.versions.length === 0 ? [newVersion] : i.versions)
            };
          }
          return i;
        });
        setIssues(currentIssues);
      }
    } catch (error) {
      console.error('Generate all error:', error);
    } finally {
      setIsIssueLoading(false);
    }
  };

  const downloadMarkdown = () => {
    const element = document.createElement("a");
    const file = new Blob([activeIssue.content], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = `${activeIssue.title}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (selectedText.trim()) {
      e.preventDefault();
      setSelectionInfo({ text: selectedText, start, end });
      setFloatingMenu({ visible: true, x: e.clientX, y: e.clientY });
    }
  };

  const handleFloatingEdit = async () => {
    if (!selectionInfo || !floatingPrompt.trim() || isFloatingLoading) return;

    setIsFloatingLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你是一个专业的文案编辑。请根据用户的要求修改选中的文本。
        
        选中的文本：
        ${selectionInfo.text}
        
        修改要求：
        ${floatingPrompt}
        
        请仅返回修改后的文本内容，不要包含任何解释或Markdown代码块标记。`,
      });

      const newText = response.text || '';
      const oldContent = activeIssue.content;
      const updatedContent = 
        oldContent.substring(0, selectionInfo.start) + 
        newText + 
        oldContent.substring(selectionInfo.end);

      handleUpdateContent(updatedContent);
      setFloatingMenu({ ...floatingMenu, visible: false });
      setFloatingPrompt("");
      setSelectionInfo(null);
    } catch (error) {
      console.error('Floating edit error:', error);
    } finally {
      setIsFloatingLoading(false);
    }
  };

  const handleQuickAction = async (action: string, subAction?: string) => {
    if (isChatLoading) return;
    
    let prompt = "";
    let isModification = true;

    if (action === 'length') {
      if (subAction === 'polish') prompt = "请对当前文章进行润色，优化表达，使其更加流畅自然。";
      else if (subAction === 'shorten') prompt = "请精简当前文章的内容，保留核心观点，使其更加简洁有力。";
      else if (subAction === 'expand') prompt = "请扩充当前文章的内容，增加更多细节和深度，使其篇幅更长。";
    } else if (action === 'tone') {
      if (subAction === 'professional') prompt = "请调整当前文章的语气，使其更加专业、严谨且具有前瞻性。";
      else if (subAction === 'friendly') prompt = "请调整当前文章的语气，使其更加亲和、通俗易懂，拉近与读者的距离。";
      else if (subAction === 'sharp') prompt = "请调整当前文章的语气，使其更加犀利、独到，具有强烈的观点冲击力。";
    } else if (action === 'suggest') {
      prompt = "请对当前文章提出整体修改建议，包括逻辑结构、案例丰富度或表达方式。请注意，仅提供建议，不要修改原文。请使用纯文本格式输出建议，不要使用 Markdown。";
      isModification = false;
    }
    
    if (prompt) {
      handleSendMessage(prompt, !isModification);
    }
    setActiveQuickActionMenu(null);
  };

  const handleSendMessage = async (overridePrompt?: string, isSuggestionOnly: boolean = false) => {
    const message = overridePrompt || chatInput;
    if (!message.trim() || isChatLoading) return;

    const userMessage = message.trim();
    
    // Auto-save current content as a version before AI modification
    if (!isSuggestionOnly) {
      saveVersion();
    }

    if (!overridePrompt) {
      setChatInput("");
      setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    }
    
    setIsChatLoading(true);

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [{
              text: `你是一个专业的文案编辑助手。请根据用户的要求修改或建议当前文章。
        
        当前文章内容：
        ${activeIssue.content}
        
        用户要求：
        ${userMessage}
        
        ${isSuggestionOnly ? "请仅提供具体的改进建议点，不要返回修改后的全文内容。请务必使用纯文本格式，不要使用 Markdown 标记（如 #, *, - 等）。" : "如果用户要求修改内容，请直接返回修改后的全文 Markdown。如果用户要求建议，请提供具体的改进点。"}`
            }]
          }
        ],
        config: {
          systemInstruction: `You are an expert editor assistant for a "Data Accountability System Construction" report serialization tool. 
          Your goal is to help the editor refine the content based on their requests.
          
          When the user asks for a change:
          1. Analyze the request.
          2. Modify the markdown content accordingly.
          3. Return a JSON response with two fields:
             - "chatResponse": A brief, professional message to the editor explaining what you changed or providing suggestions. For suggestions, use plain text only.
             - "newContent": The full, updated markdown content of the article. If no changes were needed or if only suggestions were requested, omit this field.
          
          Maintain the professional, pain-point-driven, and lead-generation-focused tone of the original serialization plan.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chatResponse: { type: Type.STRING },
              newContent: { type: Type.STRING }
            },
            required: ["chatResponse"]
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      const isMod = !!(result.newContent && !isSuggestionOnly);
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.chatResponse,
        isModification: isMod
      }]);
      
      if (result.newContent && !isSuggestionOnly) {
        handleUpdateContent(result.newContent, true);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "抱歉，处理您的请求时出现了错误。请稍后再试。" }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUpdateContent = (newContent: string, shouldCreateVersion: boolean = false) => {
    if (activeId === 'plan') {
      if (shouldCreateVersion) {
        const nextVer = getNextVersion(newContent, planVersions);
        if (nextVer) {
          setPlanVersions(prev => [...prev, { version: nextVer, content: newContent, timestamp: Date.now() }]);
        }
      }
      setSerialPlan(newContent);
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId) {
          if (shouldCreateVersion) {
            const nextVer = getNextVersion(newContent, issue.versions);
            const updatedVersions = nextVer 
              ? [...issue.versions, { version: nextVer, content: newContent, timestamp: Date.now() }]
              : issue.versions;
            return { 
              ...issue, 
              content: newContent,
              versions: updatedVersions
            };
          } else {
            return { 
              ...issue, 
              content: newContent
            };
          }
        }
        return issue;
      }));
    }
  };

  const handleRollback = (msgIndex?: number) => {
    if (activeId === 'plan') {
      if (planVersions.length > 1) {
        const newVersions = planVersions.slice(0, -1);
        const prevVer = newVersions[newVersions.length - 1];
        setSerialPlan(prevVer.content);
        setPlanVersions(newVersions);
      }
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId && issue.versions.length > 1) {
          const newVersions = issue.versions.slice(0, -1);
          const prevVer = newVersions[newVersions.length - 1];
          return {
            ...issue,
            content: prevVer.content,
            versions: newVersions
          };
        }
        return issue;
      }));
    }

    if (msgIndex !== undefined) {
      setChatMessages(prev => prev.map((msg, i) => 
        i === msgIndex ? { ...msg, isModification: false } : msg
      ));
    }
  };

  const handleNext = () => {
    if (activeId === 'plan') {
      if (issues.length > 0) setActiveId(1);
    } else if (typeof activeId === 'number' && activeId < issues.length) {
      setActiveId(activeId + 1);
    }
  };

  const handlePrev = () => {
    if (typeof activeId === 'number') {
      if (activeId > 1) {
        setActiveId(activeId - 1);
      } else if (activeId === 1 && serialPlan) {
        setActiveId('plan');
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] text-[#141414] font-sans">
      {/* Sidebar */}
      <aside 
        style={{ width: sidebarWidth }}
        className="bg-[#F5F5F0] border-r border-[#141414]/10 flex flex-col relative shrink-0"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#141414] rounded-xl flex items-center justify-center text-white">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-serif italic font-bold leading-tight">深度报告连载神器</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Serial Editor Pro</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                title="上传报告"
              />
              <button 
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-xs font-medium transition-all ${reportText ? 'bg-emerald-50 border-emerald-500/30 text-emerald-600' : 'bg-white border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50'}`}
              >
                {isPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                {reportText ? '报告已加载' : '上传报告'}
              </button>
            </div>
            <button 
              onClick={() => setShowConfig(true)}
              className="p-2 bg-white border border-[#141414]/10 rounded-xl text-[#141414]/40 hover:bg-gray-50 transition-colors"
              title="配置调性"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {serialPlan && (
            <button
              onClick={() => setActiveId('plan')}
              className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeId === 'plan' 
                  ? 'bg-[#5A5A40] text-white shadow-md' 
                  : 'text-[#141414]/60 hover:bg-[#141414]/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="text-sm font-bold truncate flex-1 text-left">连载规划</span>
            </button>
          )}

          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-30">连载篇目</p>
          </div>

          {issues.map((issue) => (
            <button
              key={issue.id}
              onClick={() => setActiveId(issue.id)}
              className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeId === issue.id 
                  ? 'bg-[#5A5A40] text-white shadow-md' 
                  : 'text-[#141414]/60 hover:bg-[#141414]/5'
              }`}
            >
              <span className={`text-xs font-mono opacity-50 ${activeId === issue.id ? 'text-white' : ''}`}>
                0{issue.id}
              </span>
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className="text-sm font-bold truncate w-full text-left">{issue.title}</span>
                <span className={`text-[9px] mt-0.5 ${activeId === issue.id ? 'text-white/60' : 'text-[#141414]/30'}`}>
                  {getWordCount(issue.content)} 字
                </span>
              </div>
              {issue.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {issue.status === 'draft' && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
              {issue.status === 'pending' && <div className="w-3 h-3 rounded-full border-2 border-[#141414]/10" />}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-[#141414]/10 space-y-2 relative">
          {activeId === 'plan' && !planApproved && (
            <button 
              onClick={approvePlan}
              disabled={isPlanLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#5A5A40] text-white rounded-full text-sm font-medium hover:bg-[#5A5A40]/90 transition-colors disabled:opacity-50"
            >
              {isPlanLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              批准并生成大纲
            </button>
          )}
          
          {activeId === 'plan' && planApproved && (
            <div className="grid grid-cols-2 gap-2 relative">
              <div className="relative">
                <button 
                  onClick={() => setShowIssueSelector(!showIssueSelector)}
                  disabled={isIssueLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#141414] text-white rounded-full text-xs font-medium hover:bg-[#141414]/90 transition-colors disabled:opacity-50"
                >
                  {isIssueLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  生成一期
                </button>
                
                <AnimatePresence>
                  {showIssueSelector && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-[#141414]/10 rounded-2xl shadow-xl overflow-hidden z-[60]"
                    >
                      <div className="p-2 max-h-60 overflow-y-auto">
                        {issues.map((issue) => (
                          <button
                            key={issue.id}
                            onClick={() => generateIssue(issue.id)}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-[#F5F5F0] transition-colors flex items-center justify-between group"
                          >
                            <span className="truncate mr-2">0{issue.id} {issue.title}</span>
                            {issue.status !== 'pending' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative">
                <button 
                  onClick={() => setShowConfirmAll(!showConfirmAll)}
                  disabled={isIssueLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-[#141414] text-[#141414] rounded-full text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isIssueLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  全部生成
                </button>

                <AnimatePresence>
                  {showConfirmAll && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-56 bg-white border border-[#141414]/10 rounded-2xl shadow-xl p-4 z-[60]"
                    >
                      <div className="text-center">
                        <AlertCircle className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                        <p className="text-[10px] text-[#141414]/60 leading-relaxed mb-3">
                          确认全部生成？耗时约 2-3 分钟，系统将自动保存旧版本。
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={generateAll}
                            className="flex-1 py-1.5 bg-[#141414] text-white rounded-full text-[10px] font-bold hover:bg-[#141414]/90 transition-colors"
                          >
                            确认
                          </button>
                          <button 
                            onClick={() => setShowConfirmAll(false)}
                            className="flex-1 py-1.5 border border-[#141414]/10 text-[#141414]/60 rounded-full text-[10px] font-bold hover:bg-gray-50 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button className="flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] transition-all border border-[#141414]/5">
              <Send className="w-3.5 h-3.5" />
              <span>发布草稿箱</span>
            </button>
            <button 
              onClick={downloadMarkdown}
              className="flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] transition-all border border-[#141414]/5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>保存为MD</span>
            </button>
          </div>
        </div>

        {/* Sidebar Resizer */}
        <div 
          onMouseDown={startResizingSidebar}
          className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#5A5A40]/30 transition-colors z-50"
        />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-[#141414]/10 bg-white/80 backdrop-blur-md flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#141414]/60">
              <FileText className="w-4 h-4" />
              <span>{activeIssue.title}</span>
              {activeIssue.versions && activeIssue.versions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] rounded-full font-bold">
                  V{activeIssue.versions[activeIssue.versions.length - 1].version}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 ml-4">
              <button 
                onClick={saveVersion}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#5A5A40] text-white rounded-full text-[10px] font-bold hover:bg-[#5A5A40]/90 transition-all shadow-sm"
              >
                <Save className="w-3 h-3" />
                保存版本
              </button>
              <div className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span className="text-[10px] text-[#5A5A40] font-medium">自动保存中</span>
              </div>
            </div>
          </div>

          <div className="flex items-center bg-[#F5F5F0] p-1 rounded-full border border-[#141414]/5">
            <button
              onClick={() => {
                setIsEditMode(false);
                setIsChatOpen(false);
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all mr-2 ${
                !isEditMode ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50 hover:text-[#141414]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              预览
            </button>
            <button
              onClick={() => {
                setIsEditMode(true);
                setIsChatOpen(true);
              }}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all mr-2 ${
                isEditMode ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50 hover:text-[#141414]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              编辑
            </button>
            <button
              onClick={() => setShowTip(!showTip)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                showTip ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-[#141414]/50 hover:text-[#141414]'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              技巧
            </button>
          </div>
        </header>

        {/* Editor/Preview Container */}
        <div className="flex-1 overflow-hidden relative flex">
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {isEditMode ? (
                <motion.div
                  key="editor"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full p-8"
                >
                  <div className="h-full bg-white rounded-2xl border border-[#141414]/10 shadow-sm flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-[#141414]/5 bg-[#F5F5F0]/30">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[#141414]/40">Markdown Editor</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={activeIssue.content}
                      onChange={(e) => handleUpdateContent(e.target.value)}
                      onContextMenu={handleContextMenu}
                      className="flex-1 p-8 outline-none resize-none font-mono text-sm leading-relaxed text-[#141414]/80"
                      placeholder="在此输入 Markdown 内容... (选中文字右键唤起 AI 编辑)"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full overflow-y-auto p-8 scroll-smooth bg-[#F5F5F0]/30"
                >
                  <div className="max-w-3xl mx-auto bg-white p-12 rounded-2xl border border-[#141414]/10 shadow-sm min-h-full">
                    <div className="markdown-body">
                      <article className="prose prose-stone max-w-none 
                        prose-headings:font-serif prose-headings:italic prose-headings:text-[#141414] 
                        prose-p:text-[#141414]/80 prose-p:leading-relaxed
                        prose-strong:text-[#141414] 
                        prose-hr:border-[#141414]/10 
                        prose-blockquote:border-l-[#5A5A40] prose-blockquote:bg-[#F5F5F0]/50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg
                        prose-li:text-[#141414]/80
                        prose-img:rounded-xl prose-img:shadow-md
                        prose-code:text-[#5A5A40] prose-code:bg-[#5A5A40]/5 prose-code:px-1 prose-code:rounded
                        ">
                        <Markdown remarkPlugins={[remarkGfm]}>{activeIssue.content}</Markdown>
                      </article>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI Chat Panel */}
          <AnimatePresence>
            {isChatOpen && (
              <motion.aside
                initial={{ x: chatPanelWidth }}
                animate={{ x: 0 }}
                exit={{ x: chatPanelWidth }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                style={{ width: chatPanelWidth }}
                className="border-l border-[#141414]/10 bg-white flex flex-col shadow-2xl relative shrink-0"
              >
                {/* Chat Resizer */}
                <div 
                  onMouseDown={startResizingChat}
                  className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-[#5A5A40]/30 transition-colors z-50"
                />
                <div className="p-4 border-b border-[#141414]/10 flex items-center justify-between bg-[#F5F5F0]/30">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#5A5A40]" />
                    <span className="text-sm font-bold uppercase tracking-wider">AI 编辑助手</span>
                  </div>
                  <button 
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 hover:bg-[#141414]/5 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F5F0]/10">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 text-[#5A5A40]" />
                      </div>
                      <p className="text-xs text-[#141414]/50 px-6">
                        您可以要求我修改文章内容，例如：“帮我把第二段改得更通俗易懂”或“增加一些关于数据资产入表的最新热点”。
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-[#5A5A40] text-white rounded-tr-none' 
                          : 'bg-white border border-[#141414]/10 text-[#141414] rounded-tl-none shadow-sm'
                      }`}>
                        {msg.content}
                      </div>
                      {msg.isModification && (
                        <button 
                          onClick={() => handleRollback(idx)}
                          className="mt-1 flex items-center gap-1 text-[10px] text-[#5A5A40] hover:underline px-1"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          撤销此修改
                        </button>
                      )}
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-[#141414]/10 p-3 rounded-2xl rounded-tl-none shadow-sm">
                        <Loader2 className="w-4 h-4 animate-spin text-[#5A5A40]" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-[#141414]/10 bg-white">
                  <div className="flex flex-wrap items-center gap-2 mb-3 relative">
                    {/* Length Menu */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveQuickActionMenu(activeQuickActionMenu === 'length' ? null : 'length')}
                        disabled={activeId === 'plan'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                          activeId === 'plan' 
                            ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                            : activeQuickActionMenu === 'length' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                        }`}
                      >
                        <Maximize2 className="w-3 h-3" />
                        修改长度
                      </button>
                      <AnimatePresence>
                        {activeQuickActionMenu === 'length' && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-24 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            <button onClick={() => handleQuickAction('length', 'polish')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">润色</button>
                            <button onClick={() => handleQuickAction('length', 'shorten')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">精简</button>
                            <button onClick={() => handleQuickAction('length', 'expand')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors">扩充</button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Tone Menu */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveQuickActionMenu(activeQuickActionMenu === 'tone' ? null : 'tone')}
                        disabled={activeId === 'plan'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                          activeId === 'plan' 
                            ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                            : activeQuickActionMenu === 'tone' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                        }`}
                      >
                        <Smile className="w-3 h-3" />
                        调整语气
                      </button>
                      <AnimatePresence>
                        {activeQuickActionMenu === 'tone' && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-24 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-50 overflow-hidden"
                          >
                            <button onClick={() => handleQuickAction('tone', 'professional')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">专业</button>
                            <button onClick={() => handleQuickAction('tone', 'friendly')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">亲和</button>
                            <button onClick={() => handleQuickAction('tone', 'sharp')} className="w-full text-left px-3 py-2 text-[10px] hover:bg-[#F5F5F0] transition-colors">锐评</button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button 
                      onClick={() => handleQuickAction('suggest')}
                      disabled={activeId === 'plan'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                        activeId === 'plan' 
                          ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                          : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      智能建议
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="输入修改指令..."
                      className="w-full p-3 pr-12 bg-[#F5F5F0] rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A40]/20 transition-all resize-none h-20"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="absolute bottom-3 right-3 p-2 bg-[#5A5A40] text-white rounded-lg hover:bg-[#5A5A40]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#141414]/40 mt-2 text-center">
                    AI 可能会产生错误，请在发布前仔细核对修改内容。
                  </p>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <footer className="h-16 border-t border-[#141414]/10 bg-white flex items-center justify-between px-8">
          <button
            onClick={handlePrev}
            disabled={activeId === 'plan' || (activeId === 1 && !serialPlan)}
            className="flex items-center gap-2 text-sm font-medium text-[#141414]/60 hover:text-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            上一期
          </button>
          
          <div className="flex items-center gap-1.5">
            {issues.map(i => (
              <div 
                key={i.id} 
                className={`w-1.5 h-1.5 rounded-full transition-all ${activeId === i.id ? 'bg-[#5A5A40] w-4' : 'bg-[#141414]/10'}`} 
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={activeId === issues.length}
            className="flex items-center gap-2 text-sm font-medium text-[#141414]/60 hover:text-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            下一期
            <ChevronRight className="w-4 h-4" />
          </button>
        </footer>
      </main>

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#141414]/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#141414]/5 flex items-center justify-between bg-[#F5F5F0]/30">
                <div>
                  <h2 className="text-xl font-serif italic font-bold">配置连载生成器</h2>
                  <p className="text-xs text-[#141414]/50 mt-1">
                    设置您的业务描述与品牌调性
                  </p>
                </div>
                <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Business & Tone */}
                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">1. 公司业务描述</label>
                  <textarea 
                    value={companyBusiness}
                    onChange={(e) => setCompanyBusiness(e.target.value)}
                    placeholder="例如：我们是一家专注企业数字化转期的咨询公司，核心产品是数据治理平台..."
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[120px] transition-all"
                  />
                </section>

                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">2. 设定内容调性</label>
                  <div className="grid grid-cols-2 gap-3">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTone(t.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          selectedTone === t.id 
                            ? 'border-[#5A5A40] bg-[#5A5A40]/5 ring-1 ring-[#5A5A40]' 
                            : 'border-[#141414]/10 hover:border-[#141414]/20'
                        }`}
                      >
                        <p className="text-sm font-bold mb-1">{t.label}</p>
                        <p className="text-[10px] text-[#141414]/50 leading-relaxed">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-8 bg-[#F5F5F0]/30 border-t border-[#141414]/5">
                <button 
                  onClick={generatePlan}
                  disabled={!reportText || !companyBusiness || isGeneratingPlan}
                  className="w-full py-4 bg-[#141414] text-white rounded-full font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#141414]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#141414]/20"
                >
                  {isGeneratingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      正在分析报告并生成规划...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      生成连载规划
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showTip && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setShowTip(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 right-8 max-w-xs bg-[#5A5A40] text-white p-4 rounded-2xl shadow-xl border border-white/10 z-50"
            >
            <button 
              onClick={() => setShowTip(false)}
              className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-start gap-3 pr-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-1">{tips[currentTipIndex].title}</p>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {tips[currentTipIndex].content}
                </p>
                <button 
                  onClick={handleNextTip}
                  className="mt-2 text-[10px] font-bold underline underline-offset-4 hover:opacity-80 transition-opacity"
                >
                  查看下一个技巧
                </button>
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating AI Edit Menu */}
      <AnimatePresence>
        {floatingMenu.visible && (
          <>
            <div 
              className="fixed inset-0 z-[110]" 
              onClick={() => setFloatingMenu({ ...floatingMenu, visible: false })}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              style={{ left: floatingMenu.x, top: floatingMenu.y }}
              className="fixed z-[120] w-72 bg-white border border-[#141414]/10 rounded-2xl shadow-2xl p-4 overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#141414]/40">AI 局部编辑</span>
              </div>
              <div className="mb-3 p-2 bg-[#F5F5F0] rounded-lg border border-[#141414]/5">
                <p className="text-[10px] text-[#141414]/40 line-clamp-2 italic">"{selectionInfo?.text}"</p>
              </div>
              <div className="relative">
                <textarea
                  autoFocus
                  value={floatingPrompt}
                  onChange={(e) => setFloatingPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleFloatingEdit();
                    }
                  }}
                  placeholder="输入修改指令 (如: 扩充细节, 语气更幽默...)"
                  className="w-full h-20 p-3 bg-white border border-[#141414]/10 rounded-xl text-xs outline-none focus:border-[#5A5A40] transition-colors resize-none"
                />
                <button
                  onClick={handleFloatingEdit}
                  disabled={isFloatingLoading || !floatingPrompt.trim()}
                  className="absolute bottom-2 right-2 p-1.5 bg-[#5A5A40] text-white rounded-lg hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                >
                  {isFloatingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
