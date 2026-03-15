/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
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
  Feather,
  Zap,
  RotateCcw,
  Target,
  History,
  Type as TypeIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown as TiptapMarkdown } from 'tiptap-markdown';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// Set worker for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

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

const DEFAULT_SERIAL_PLAN = "";

const INITIAL_ISSUES: Chapter[] = [];

// Tooltip Component
const Tooltip = ({ children, text, className = "" }: { children: React.ReactNode, text: string, className?: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative flex items-center ${className}`} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.9 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#141414] text-white text-[10px] rounded shadow-lg whitespace-nowrap pointer-events-none z-[60]"
          >
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#141414]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [issues, setIssues] = useState<Chapter[]>(INITIAL_ISSUES);
  const [activeId, setActiveId] = useState<number | 'plan'>('plan');
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
  const [showRawMd, setShowRawMd] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const publishMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const issueSelectorRef = useRef<HTMLDivElement>(null);
  const confirmAllRef = useRef<HTMLDivElement>(null);
  const versionMenuRef = useRef<HTMLDivElement>(null);

  const updateContentRef = useRef<(newContent: string, shouldCreateVersion?: boolean) => void>(() => {});
  const saveVersionRef = useRef<() => void>(() => {});

  // Tiptap Editor Setup
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapMarkdown,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: '在此输入内容...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const md = (editor.storage as any).markdown.getMarkdown();
      updateContentRef.current(md);
    },
    onBlur: () => {
      // Trigger save version on blur if there are changes
      saveVersionRef.current();
    },
    editorProps: {
      attributes: {
        class: 'prose prose-stone max-w-none focus:outline-none min-h-[500px] p-8',
      },
    },
  });

  // Floating AI Edit State
  const [floatingMenu, setFloatingMenu] = useState<{ visible: boolean, x: number, y: number }>({ visible: false, x: 0, y: 0 });
  const [selectionInfo, setSelectionInfo] = useState<{ text: string, start: number, end: number } | null>(null);
  const [floatingPrompt, setFloatingPrompt] = useState("");
  const [isFloatingLoading, setIsFloatingLoading] = useState(false);

  // Configuration State
  const [showConfig, setShowConfig] = useState(false);
  const [companyBusiness, setCompanyBusiness] = useState('');
  const [reportPurpose, setReportPurpose] = useState('');
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0].id);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [planApproved, setPlanApproved] = useState(false);
  const [serialPlan, setSerialPlan] = useState<string>(DEFAULT_SERIAL_PLAN);
  const [planVersions, setPlanVersions] = useState<Version[]>([]);
  
  // Resizable Sidebars State
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [chatPanelWidth, setChatPanelWidth] = useState(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [regenerateRequirements, setRegenerateRequirements] = useState('');
  const [activeQuickActionMenu, setActiveQuickActionMenu] = useState<string | null>(null);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      if (showPublishMenu && publishMenuRef.current && !publishMenuRef.current.contains(target)) {
        setShowPublishMenu(false);
      }
      if (showDownloadMenu && downloadMenuRef.current && !downloadMenuRef.current.contains(target)) {
        setShowDownloadMenu(false);
      }
      if (showIssueSelector && issueSelectorRef.current && !issueSelectorRef.current.contains(target)) {
        setShowIssueSelector(false);
      }
      if (showConfirmAll && confirmAllRef.current && !confirmAllRef.current.contains(target)) {
        setShowConfirmAll(false);
      }
      if (showVersionMenu && versionMenuRef.current && !versionMenuRef.current.contains(target)) {
        setShowVersionMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPublishMenu, showDownloadMenu, showIssueSelector, showConfirmAll, showVersionMenu]);

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
      setShowVersionMenu(false);
    };
    if (activeQuickActionMenu || showVersionMenu) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [activeQuickActionMenu, showVersionMenu]);

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
    : issues.find(i => i.id === activeId) || issues[0] || { id: -1, title: '', content: '', outline: '', status: 'pending' as const, versions: [] };

  // Sync editor content when active issue changes
  useEffect(() => {
    setIsDirty(false);
  }, [activeId]);

  useEffect(() => {
    if (editor && activeIssue) {
      const currentMd = (editor.storage as any).markdown.getMarkdown();
      if (currentMd !== activeIssue.content) {
        editor.commands.setContent(activeIssue.content);
      }
    }
  }, [activeId, editor, activeIssue.content]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setToast(null);
    setFileName(file.name);
    // Validation: Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("文件大小超过 10MB 限制");
      return;
    }

    setIsPdfLoading(true);
    setUploadError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      
      // Validation: Max 100 pages
      if (pdf.numPages > 100) {
        setUploadError("文件页数超过 100 页限制");
        setIsPdfLoading(false);
        return;
      }

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      const trimmedText = fullText.trim();
      if (!trimmedText) {
        setUploadError("未能从 PDF 中提取到文字内容，可能是扫描件或加密文件");
        setIsPdfLoading(false);
        return;
      }

      setReportText(trimmedText);
      setIsPdfLoading(false);
      
      // Give UI a chance to breathe
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Auto-process after upload
      await processReport(trimmedText);
    } catch (error) {
      console.error('PDF parsing error:', error);
      setIsPdfLoading(false);
      if (error instanceof Error && error.message.includes('Worker')) {
        setUploadError("PDF 解析引擎加载失败，请检查网络或刷新页面");
      } else {
        setUploadError("PDF 解析失败，请确保文件未加密且格式正确");
      }
    }
  };

  const processReport = async (text: string) => {
    if (!text || text.trim() === '') {
      showToast("请先上传报告文件");
      return;
    }
    if (!companyBusiness || companyBusiness.trim() === '') {
      showToast("请先配置公司基本业务介绍");
      setShowConfig(true);
      return;
    }
    if (!reportPurpose || reportPurpose.trim() === '') {
      showToast("请先设定报告分解策略（目的与要求）");
      setShowStrategyModal(true);
      return;
    }

    setIsGeneratingPlan(true);
    setUploadError(null);
    try {
      // Step 1: Generate Plan and extract business info if missing
      const planResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你是一个资深的公众号编辑。请根据以下报告内容，规划一个连载系列任务。
        报告内容摘要：${text.substring(0, 8000)}
        
        ${companyBusiness ? `公司背景：${companyBusiness}` : ''}
        ${reportPurpose ? `分解目的与要求：${reportPurpose}` : ''}
        ${selectedTone ? `整体调性：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}` : ''}
        
        请输出一个 JSON 格式的对象，包含：
        1. businessName: 从报告中识别的公司名称或业务方向
        2. plan: Markdown 格式的连载规划。必须严格包含以下三个部分，且风格专业、犀利：
           ## 1. 策划思路
           - **核心目标**：(例如：通过连载建立专业形象，吸引精准 B 端客户)
           - **调性定位**：(例如：专业、前瞻、实战、犀利)
           - **引流技巧**：(例如：抛出行业痛点问题，在关键处留白引导咨询)
           
           ## 2. 连载目录规划
           请使用 Markdown 表格形式，包含以下列：
           | 期数 | 主题方向 | 篇目标题 | 核心痛点 | 对应报告章节 |
           | :--- | :--- | :--- | :--- | :--- |
           (至少 6-8 期)
           
           ## 3. 引流模板
           使用 Markdown 引用块 (>) 格式，包含【福利预告】、报告简介、引导语及关键词回复建议。
           
        3. chapters: 篇目列表（与目录规划一致），每篇包含 id, title (对应主题方向), outline (结合核心痛点和章节)。
        
        请严格按照 JSON 格式输出。`,
        config: { responseMimeType: "application/json" }
      });

      if (!planResponse.text) {
        throw new Error("AI 未能返回有效的规划内容");
      }

      const data = JSON.parse(planResponse.text);
      if (data.businessName && !companyBusiness) {
        setCompanyBusiness(data.businessName);
      }
      
      const newPlan = data.plan || '';
      setSerialPlan(newPlan);
      setPlanVersions([{ version: "1.0", content: newPlan, timestamp: Date.now() }]);
      setIsPlanGenerated(true);
      
      if (data.chapters) {
        // Step 2: Populate chapters
        const chaptersWithContent = data.chapters.map((c: any) => ({
          ...c,
          content: "",
          status: 'pending',
          versions: []
        }));
        setIssues(chaptersWithContent);
        setPlanApproved(true);
        setActiveId('plan');
        setShowConfig(false);
        setIsDirty(false);
        
        // Focus editor after generation
        setTimeout(() => {
          editor?.commands.focus();
        }, 100);
      }
    } catch (error) {
      console.error('Process report error:', error);
      setUploadError("自动规划生成失败");
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

  const [toast, setToast] = useState<{ message: string, type: 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveVersion = () => {
    const currentContent = activeId === 'plan' ? serialPlan : activeIssue.content;
    if (!currentContent || currentContent.trim() === '') {
      showToast("内容为空，无法保存版本");
      return;
    }

    setIsDirty(false);
    if (activeId === 'plan') {
      const nextVer = getNextVersion(serialPlan, planVersions);
      if (!nextVer) return;

      const newVersion: Version = {
        version: nextVer,
        content: serialPlan,
        timestamp: Date.now()
      };
      setPlanVersions(prev => [...prev, newVersion]);
      syncTitlesFromPlan(serialPlan);
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
    if (!serialPlan.trim()) return;
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
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Approve plan error:', error);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const generateIssue = async (id: number, extraRequirements?: string) => {
    if (!companyBusiness || companyBusiness.trim() === '') {
      showToast("请先配置公司基本业务介绍");
      setShowConfig(true);
      return;
    }
    const chapter = issues.find(i => i.id === id);
    if (!chapter) return;

    setIsGeneratingSingle(true);
    setIsIssueLoading(true);
    setShowIssueSelector(false);
    setShowRegenerateModal(false);
    
    try {
      const prevChapters = issues.filter(i => i.id < id && i.content).map(i => i.content).join('\n\n');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `你正在撰写一个连载系列。
        公司业务：${companyBusiness}
        调性：${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}
        前序内容回顾：${prevChapters.substring(0, 3000)}
        当前篇目大纲：${chapter.outline}
        ${extraRequirements ? `用户额外要求：${extraRequirements}` : ''}
        
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
      setIsDirty(false);
    } catch (error) {
      console.error('Generate issue error:', error);
    } finally {
      setIsGeneratingSingle(false);
      setIsIssueLoading(false);
    }
  };

  const generateAll = async () => {
    if (!companyBusiness || companyBusiness.trim() === '') {
      showToast("请先配置公司基本业务介绍");
      setShowConfig(true);
      return;
    }
    setIsGeneratingAll(true);
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
        setIsDirty(false);
      }
    } catch (error) {
      console.error('Generate all error:', error);
    } finally {
      setIsGeneratingAll(false);
      setIsIssueLoading(false);
    }
  };

  const downloadMarkdown = async (type: 'current' | 'all') => {
    if (type === 'current') {
      if (!activeIssue.content || activeIssue.content.trim() === '') {
        showToast("内容为空，无法保存");
        return;
      }
      const element = document.createElement("a");
      const file = new Blob([activeIssue.content], {type: 'text/markdown'});
      element.href = URL.createObjectURL(file);
      element.download = `${activeIssue.title}.md`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showToast(`已保存：${activeIssue.title}`, 'success');
    } else {
      const contentIssues = issues.filter(i => i.content && i.content.trim() !== '');
      if (contentIssues.length === 0) {
        showToast("没有已生成内容的篇目，无法保存");
        return;
      }

      const zip = new JSZip();
      contentIssues.forEach(issue => {
        zip.file(`${issue.title}.md`, issue.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const element = document.createElement("a");
      element.href = URL.createObjectURL(blob);
      element.download = `连载系列_全部篇目.zip`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      
      const savedTitles = contentIssues.map(i => i.title).join('、');
      showToast(`已保存：${savedTitles}`, 'success');
    }
    setShowDownloadMenu(false);
  };

  const publishToDrafts = (type: 'current' | 'all') => {
    showToast("正在开发中...", 'error');
    setShowPublishMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (selectedText.trim()) {
      e.preventDefault();
      setSelectionInfo({ text: selectedText, start: from, end: to });
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
      
      if (editor) {
        editor.chain().focus().insertContentAt({ from: selectionInfo.start, to: selectionInfo.end }, newText).run();
      }

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
    const lastSavedContent = activeIssue.versions.length > 0 
      ? activeIssue.versions[activeIssue.versions.length - 1].content 
      : (activeId === 'plan' ? DEFAULT_SERIAL_PLAN : "");

    if (newContent === activeIssue.content && !shouldCreateVersion) return;
    
    setIsDirty(newContent !== lastSavedContent);

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

  useEffect(() => {
    updateContentRef.current = handleUpdateContent;
    saveVersionRef.current = saveVersion;
  }, [handleUpdateContent, saveVersion]);

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

  const syncTitlesFromPlan = (planContent: string) => {
    const lines = planContent.split('\n');
    const newTitles: string[] = [];
    let inChapters = false;
    
    for (const line of lines) {
      if (line.includes('篇目') || line.includes('目录') || line.includes('列表')) {
        inChapters = true;
        break;
      }
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = trimmed.match(/^(?:#+\s*)?\d+[\.\s、]+(.+)$/) || 
                    trimmed.match(/^(?:#+\s*)?第[一二三四五六七八九十]+篇[:：\s]*(.+)$/);
      
      if (match) {
        if (!inChapters || (inChapters && lines.indexOf(line) > lines.findIndex(l => l.includes('篇目') || l.includes('目录') || l.includes('列表')))) {
          newTitles.push(match[1].trim());
        }
      }
    }
    
    if (newTitles.length > 0) {
      setIssues(prev => prev.map((issue, idx) => {
        if (newTitles[idx]) {
          return { ...issue, title: `连载${idx + 1} - ${newTitles[idx]}` };
        }
        return issue;
      }));
    }
  };

  const restoreVersion = (version: Version) => {
    if (activeId === 'plan') {
      setSerialPlan(version.content);
      syncTitlesFromPlan(version.content);
      if (editor) editor.commands.setContent(version.content);
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId) {
          return { ...issue, content: version.content };
        }
        return issue;
      }));
      if (editor) editor.commands.setContent(version.content);
    }
    setShowVersionMenu(false);
    showToast(`已切换至版本 V${version.version}`, 'success');
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

          <div className="mb-6">
            <div className="grid grid-cols-3 gap-3">
              <Tooltip text="上传报告" className="w-full relative group">
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  disabled={isPdfLoading || isGeneratingPlan}
                />
                <div 
                  className={`flex items-center justify-center w-full h-10 rounded-2xl transition-all shadow-sm border ${
                    isPdfLoading || isGeneratingPlan 
                      ? 'bg-white/50 text-[#141414]/20 border-[#141414]/5' 
                      : 'bg-white border-[#141414]/10 text-[#141414]/60 group-hover:bg-gray-50 group-hover:border-[#141414]/20 group-hover:shadow-md'
                  }`}
                >
                  {isPdfLoading || isGeneratingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </div>
              </Tooltip>

              <Tooltip text="生成策略与调性" className="w-full">
                <button 
                  onClick={() => {
                    setShowStrategyModal(true);
                    setUploadError(null);
                  }}
                  className="flex items-center justify-center w-full h-10 rounded-2xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 hover:shadow-md shadow-sm"
                >
                  <Target className="w-4 h-4" />
                </button>
              </Tooltip>

              <Tooltip text="公司基本业务配置" className="w-full">
                <button 
                  onClick={() => {
                    setShowConfig(true);
                    setUploadError(null);
                  }}
                  className="flex items-center justify-center w-full h-10 rounded-2xl transition-all bg-white border border-[#141414]/10 text-[#141414]/60 hover:bg-gray-50 hover:border-[#141414]/20 hover:shadow-md shadow-sm"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
            {fileName && (
              <div className="mt-2 px-1 space-y-1">
                <p className="text-[#5A5A40] text-[9px] flex items-center gap-1 font-bold">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {fileName} 已上传
                </p>
                {isPlanGenerated && (
                  <p className="text-emerald-600 text-[9px] flex items-center gap-1 font-bold">
                    <Sparkles className="w-2.5 h-2.5" />
                    规划已完成
                  </p>
                )}
              </div>
            )}
            {uploadError && (
              <p className="text-red-500 text-[9px] mt-2 flex items-center gap-1 px-1">
                <AlertCircle className="w-2.5 h-2.5" />
                {uploadError}
              </p>
            )}
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
          {activeId === 'plan' && !planApproved && serialPlan.trim() !== '' && (
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
              <div className="relative" ref={issueSelectorRef}>
                <button 
                  onClick={() => setShowIssueSelector(!showIssueSelector)}
                  disabled={isGeneratingSingle || isGeneratingAll}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#141414] text-white rounded-full text-xs font-medium hover:bg-[#141414]/90 transition-colors disabled:opacity-50"
                >
                  {isGeneratingSingle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
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

              <div className="relative" ref={confirmAllRef}>
                <button 
                  onClick={() => setShowConfirmAll(!showConfirmAll)}
                  disabled={isGeneratingSingle || isGeneratingAll}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-[#141414] text-[#141414] rounded-full text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {isGeneratingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
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
            <div className="relative" ref={publishMenuRef}>
              <button 
                onClick={() => setShowPublishMenu(!showPublishMenu)}
                className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] transition-all border border-[#141414]/5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>发布草稿箱</span>
              </button>
              <AnimatePresence>
                {showPublishMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-2 w-32 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[60] overflow-hidden"
                  >
                    <button onClick={() => publishToDrafts('current')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">发布本篇</button>
                    <button onClick={() => publishToDrafts('all')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] transition-colors">发布全部</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={downloadMenuRef}>
              <button 
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] transition-all border border-[#141414]/5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>保存为MD</span>
              </button>
              <AnimatePresence>
                {showDownloadMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-2 w-32 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[60] overflow-hidden"
                  >
                    <button onClick={() => downloadMarkdown('current')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] transition-colors border-b border-[#141414]/5">保存本篇</button>
                    <button onClick={() => downloadMarkdown('all')} className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-[#F5F5F0] transition-colors">保存全部</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
                <div className="relative" ref={versionMenuRef}>
                  <button 
                    onClick={() => setShowVersionMenu(!showVersionMenu)}
                    className="ml-2 px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] rounded-full font-bold flex items-center gap-1 hover:bg-[#5A5A40]/20 transition-colors"
                  >
                    V{activeIssue.versions[activeIssue.versions.length - 1].version}
                    <History className="w-2.5 h-2.5" />
                  </button>
                  
                  <AnimatePresence>
                    {showVersionMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 mt-2 w-48 bg-white border border-[#141414]/10 rounded-xl shadow-xl z-[100] overflow-hidden"
                      >
                        <div className="p-2 border-b border-[#141414]/5 bg-[#F5F5F0]/30">
                          <span className="text-[9px] uppercase tracking-widest font-bold opacity-40">版本历史</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-1">
                          {[...activeIssue.versions].reverse().map((v, idx) => (
                            <button
                              key={idx}
                              onClick={() => restoreVersion(v)}
                              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#F5F5F0] transition-colors group"
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-[11px] font-bold text-[#5A5A40]">V{v.version}</span>
                                <span className="text-[9px] text-[#141414]/30">{new Date(v.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-[9px] text-[#141414]/50 line-clamp-1 italic">
                                {v.content.substring(0, 30).replace(/\n/g, ' ')}...
                              </p>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 ml-4">
              <motion.button 
                onClick={saveVersion}
                animate={isDirty ? { 
                  scale: [1, 1.05, 1],
                  backgroundColor: ['#5A5A40', '#8B8B60', '#5A5A40'],
                  boxShadow: [
                    '0 0 0px rgba(90, 90, 64, 0)',
                    '0 0 15px rgba(90, 90, 64, 0.5)',
                    '0 0 0px rgba(90, 90, 64, 0)'
                  ]
                } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#5A5A40] text-white rounded-full text-[10px] font-bold hover:bg-[#5A5A40]/90 transition-all shadow-sm relative overflow-hidden"
              >
                {isDirty && (
                  <motion.span 
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute inset-0 bg-white/20 skew-x-12"
                  />
                )}
                <Save className="w-3 h-3" />
                保存版本
              </motion.button>
              {isDirty && (
                <div className="flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-[#5A5A40] animate-pulse" />
                  <span className="text-[10px] text-[#5A5A40] font-medium">自动保存中</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center bg-[#F5F5F0] p-1 rounded-full border border-[#141414]/5">
            <div className="flex bg-[#E4E3E0] p-0.5 rounded-full mr-2">
              <button
                onClick={() => setShowRawMd(false)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  !showRawMd ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
                }`}
              >
                <Eye className="w-3 h-3" />
                预览
              </button>
              <button
                onClick={() => setShowRawMd(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                  showRawMd ? 'bg-white text-[#5A5A40] shadow-sm' : 'text-[#141414]/40 hover:text-[#141414]/60'
                }`}
              >
                <TypeIcon className="w-3 h-3" />
                源码
              </button>
            </div>
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
          <div className="flex-1 overflow-hidden flex relative">
            {/* Main Editor Area */}
            <div 
              className="flex-1 overflow-y-auto p-8 scroll-smooth bg-[#F5F5F0]/30 transition-all duration-300"
              onContextMenu={handleContextMenu}
            >
              <div className="max-w-3xl mx-auto bg-white p-12 rounded-2xl border border-[#141414]/10 shadow-sm min-h-full">
                {activeId === 'plan' && serialPlan.trim() === '' ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mb-6">
                      <Sparkles className="w-8 h-8 text-[#5A5A40]" />
                    </div>
                    <h3 className="text-xl font-serif italic font-bold mb-2">开启您的连载规划</h3>
                    <p className="text-sm text-[#141414]/50 max-w-sm mb-8">
                      上传深度报告，配置公司业务与分解策略，AI 将为您生成专业的连载目录与引流方案。
                    </p>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                      <button 
                        onClick={() => {
                          if (!reportText) {
                            showToast("请先上传报告文件");
                            return;
                          }
                          processReport(reportText);
                        }}
                        className="w-full py-3 bg-[#141414] text-white rounded-xl text-sm font-bold hover:bg-[#141414]/90 transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        生成连载规划
                      </button>
                      {!reportText && (
                        <div className="relative">
                          <input 
                            type="file" 
                            accept=".pdf" 
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <button className="w-full py-3 border border-[#141414]/10 text-[#141414]/60 rounded-xl text-sm font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2">
                            <Paperclip className="w-4 h-4" />
                            上传报告 PDF
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : showRawMd ? (
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#141414]/5">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[#141414]/40">Markdown 源码 (只读)</span>
                      <button onClick={() => setShowRawMd(false)} className="text-[#141414]/40 hover:text-[#141414]">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 font-mono text-sm leading-relaxed text-[#141414]/70 whitespace-pre-wrap selection:bg-[#5A5A40]/20">
                      {activeIssue.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {activeId !== 'plan' && (
                      <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            activeIssue.content ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          }`}>
                            {activeIssue.content ? '已生成' : '待生成'}
                          </div>
                          <span className="text-xs text-[#141414]/40 font-mono">
                            {getWordCount(activeIssue.content)} 字
                          </span>
                        </div>
                        
                        <button 
                          onClick={() => {
                            if (activeIssue.content) {
                              setRegenerateRequirements('');
                              setShowRegenerateModal(true);
                            } else {
                              generateIssue(activeIssue.id);
                            }
                          }}
                          disabled={isGeneratingSingle || isGeneratingAll}
                          className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#5A5A40]/90 transition-all disabled:opacity-50"
                        >
                          {isGeneratingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {activeIssue.content ? '再生成本篇' : '生成本篇内容'}
                        </button>
                      </div>
                    )}
                    
                    {!activeIssue.content && activeId !== 'plan' ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-[#141414]/5 rounded-3xl p-12">
                        <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mb-6">
                          <Feather className="w-8 h-8 text-[#5A5A40]/40" />
                        </div>
                        <h4 className="text-lg font-bold mb-2">本篇内容尚未生成</h4>
                        <p className="text-sm text-[#141414]/40 max-w-xs mb-8">
                          点击上方按钮，AI 将根据规划大纲、公司业务及前序内容，为您撰写本篇的初稿。
                        </p>
                      </div>
                    ) : (
                      <div className="markdown-body flex-1">
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
                          <EditorContent editor={editor} />
                        </article>
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                      <Tooltip text="修改长度">
                        <button 
                          onClick={() => setActiveQuickActionMenu(activeQuickActionMenu === 'length' ? null : 'length')}
                          disabled={activeId === 'plan'}
                          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                            activeId === 'plan' 
                              ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                              : activeQuickActionMenu === 'length' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                          }`}
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
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
                      <Tooltip text="调整语气">
                        <button 
                          onClick={() => setActiveQuickActionMenu(activeQuickActionMenu === 'tone' ? null : 'tone')}
                          disabled={activeId === 'plan'}
                          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                            activeId === 'plan' 
                              ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                              : activeQuickActionMenu === 'tone' ? 'bg-[#5A5A40] text-white' : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                          }`}
                        >
                          <Feather className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
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

                    <Tooltip text="智能建议">
                      <button 
                        onClick={() => handleQuickAction('suggest')}
                        disabled={activeId === 'plan'}
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                          activeId === 'plan' 
                            ? 'bg-[#F5F5F0] text-[#141414]/20 cursor-not-allowed' 
                            : 'bg-[#F5F5F0] hover:bg-[#E4E3E0] text-[#141414]/60'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
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

      {/* Configuration Modal - Business Only */}
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
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-[#141414]/5 flex items-center justify-between bg-[#F5F5F0]/30">
                <div>
                  <h2 className="text-xl font-serif italic font-bold">公司基本业务配置</h2>
                  <p className="text-xs text-[#141414]/50 mt-1">
                    设置您的公司业务描述
                  </p>
                </div>
                <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">公司业务描述</label>
                  <textarea 
                    value={companyBusiness}
                    onChange={(e) => {
                      setCompanyBusiness(e.target.value);
                      if (uploadError) setUploadError(null);
                    }}
                    placeholder="例如：我们是一家专注企业数字化转期的咨询公司，核心产品是数据治理平台..."
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[200px] transition-all"
                  />
                </section>
              </div>

              <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#141414]/5 flex justify-between items-center">
                {uploadError && (
                  <p className="text-red-500 text-[10px] flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {uploadError}
                  </p>
                )}
                <button 
                  onClick={() => setShowConfig(false)}
                  className="px-6 py-2 bg-[#141414] text-white rounded-xl text-xs font-bold hover:bg-[#141414]/90 transition-all"
                >
                  保存配置
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Strategy Modal - Purpose & Tone */}
      <AnimatePresence>
        {showStrategyModal && (
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
                  <h2 className="text-xl font-serif italic font-bold">报告分解策略与调性</h2>
                  <p className="text-xs text-[#141414]/50 mt-1">
                    设定报告分解的目的、要求及整体调性
                  </p>
                </div>
                <button onClick={() => setShowStrategyModal(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">1. 报告分解的目的和要求</label>
                  <textarea 
                    value={reportPurpose}
                    onChange={(e) => {
                      setReportPurpose(e.target.value);
                      if (uploadError) setUploadError(null);
                    }}
                    placeholder="例如：将报告分解为适合公众号连载的篇目，每篇字数在1500字左右，强调实战案例..."
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[120px] transition-all"
                  />
                </section>

                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">2. 整体调性设定</label>
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

              <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#141414]/5 flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-[#141414]/40 italic">设定将影响连载规划的生成逻辑</p>
                  {uploadError && (
                    <p className="text-red-500 text-[10px] flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {uploadError}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowStrategyModal(false)}
                    className="px-6 py-2 border border-[#141414]/10 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      if (!reportText) {
                        showToast("请先上传报告文件");
                        return;
                      }
                      if (!companyBusiness) {
                        showToast("请先配置公司基本业务介绍");
                        setShowStrategyModal(false);
                        setShowConfig(true);
                        return;
                      }
                      if (!reportPurpose) {
                        showToast("请先设定报告分解策略（目的与要求）");
                        return;
                      }
                      setShowStrategyModal(false);
                      processReport(reportText);
                    }}
                    disabled={isGeneratingPlan}
                    className="px-6 py-2 bg-[#141414] text-white rounded-xl text-xs font-bold hover:bg-[#141414]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isGeneratingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    更新连载规划
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRegenerateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#141414]/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#141414]/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-[#5A5A40]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">再生成本篇</h3>
                    <p className="text-[10px] text-[#141414]/40 uppercase tracking-widest font-bold">REGENERATE CHAPTER</p>
                  </div>
                </div>
                <button onClick={() => setShowRegenerateModal(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-900">注意：当前版本将被覆盖</p>
                    <p className="text-[11px] text-amber-800/70 leading-relaxed">
                      新生成的内容将覆盖编辑器中的当前内容。系统会自动为您保存当前版本到“版本历史”中，您可以随时回溯。
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#141414]/60 ml-1">针对本篇的特别要求 (可选)</label>
                  <textarea 
                    value={regenerateRequirements}
                    onChange={(e) => setRegenerateRequirements(e.target.value)}
                    placeholder="例如：增加一些实战案例、调性更犀利一点、字数控制在1500字以内..."
                    className="w-full h-32 p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20 focus:border-[#5A5A40] transition-all resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#141414]/5 flex justify-end gap-3">
                <button 
                  onClick={() => setShowRegenerateModal(false)}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    saveVersion(); // Save current before overwriting
                    generateIssue(activeIssue.id, regenerateRequirements);
                  }}
                  disabled={isGeneratingSingle}
                  className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#5A5A40]/90 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingSingle ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  确认并再生成
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

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'error' ? 'bg-red-500 text-white border-red-400' : 'bg-[#5A5A40] text-white border-[#5A5A40]/20'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span className="text-sm font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
