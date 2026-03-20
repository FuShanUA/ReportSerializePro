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
  Type as TypeIcon,
  FolderArchive,
  Lock,
  Unlock
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
import Highlight from '@tiptap/extension-highlight';
import {
  generatePlanPrompt,
  generateApprovePlanPrompt,
  generateArticlePrompt,
  generateChatPrompt,
  generateFloatingEditPrompt,
  CHAT_SYSTEM_INSTRUCTION
} from './prompts';

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
  issuesSnapshot?: Chapter[];
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

const cleanTitle = (rawTitle: string) => {
  if (!rawTitle) return '';
  let text = rawTitle.replace(/<[^>]+>/g, ' ');
  text = text.replace(/\*{2,}/g, '');
  text = text.replace(/#/g, '');
  text = text.replace(/《[^》]+》[\s\-\:]*/g, '');
  
  // 保底：去掉可能残留的连载前缀
  text = text.replace(/^(?:连载|第)\s*[一二三四五六七八九十\d]+\s*(?:期|篇|讲|章)?[\-\:：\s]*/g, '');
  
  // 只以破折号、波浪号作为主副标题的分隔符，保留主标题结尾的感叹号问号等
  text = text.split(/[-—~|]/)[0].trim();
  return text;
};

const cleanMarkdown = (text: string) => {
  if (!text) return '';
  return text
    .replace(/[#*`~_>\-]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
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
  const [savedZipPath, setSavedZipPath] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const publishMenuRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const issueSelectorRef = useRef<HTMLDivElement>(null);
  const confirmAllRef = useRef<HTMLDivElement>(null);
  const versionMenuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const updateContentRef = useRef<(newContent: string, shouldCreateVersion?: boolean) => void>(() => {});
  const saveVersionRef = useRef<() => void>(() => {});
  const printChapterRef = useRef<() => void>(() => {});
  const isUpdatingRef = useRef<boolean>(false);

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
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-[#5A5A40]/30 text-inherit',
        }
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (isUpdatingRef.current) return;
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
  const [currentHotspot, setCurrentHotspot] = useState('');
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0].id);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [fileName, setFileName] = useState('');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
  const [planApproved, setPlanApproved] = useState(false);
  const [serialPlan, setSerialPlan] = useState<string>(DEFAULT_SERIAL_PLAN);
  const [planVersions, setPlanVersions] = useState<Version[]>([]);
  const [ctaTemplate, setCtaTemplate] = useState('');
  const [episodeMode, setEpisodeMode] = useState<'auto' | 'fixed'>('auto');
  const [episodeCount, setEpisodeCount] = useState<number>(5);
  const [ctaMode, setCtaMode] = useState<'none' | 'generate' | 'exact'>('exact');
  const [exactCtaTemplate, setExactCtaTemplate] = useState('');
  const [generateCtaTemplate, setGenerateCtaTemplate] = useState('');
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [globalSkills, setGlobalSkills] = useState<{humanizer: string, writingStyle: string}>({ humanizer: '', writingStyle: '' });

  // Intercept global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed
      if (e.ctrlKey || e.metaKey) {
        // Allow Copy, Paste, Cut, Select All, Undo, Redo, Refresh, Bold, Italic, Underline
        const allowedKeys = ['c', 'v', 'x', 'a', 'z', 'b', 'i', 'u'];
        const key = e.key.toLowerCase();
        
        if (key === 'p') {
          e.preventDefault();
          printChapterRef.current();
          return;
        }

        // If it's a letter/key and not in our allowed list, prevent default browser behavior
        if (key.length === 1 && !allowedKeys.includes(key)) {
          e.preventDefault();
          
          if (key === 's') {
            // Trigger our own save
            saveVersionRef.current();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, []);

  // Load state and global skills on mount
  useEffect(() => {
    fetch('/api/skills')
      .then(res => res.json())
      .then(data => {
        if (data.humanizer || data.writingStyle) {
          setGlobalSkills(data);
        }
      })
      .catch(err => console.error("Failed to load skills:", err));

    fetch('/api/load-state')
      .then(res => {
        if (!res.ok) throw new Error('No state');
        return res.json();
      })
      .then(data => {
        if (data && typeof data === 'object') {
          if (data.issues) setIssues(data.issues);
          if (data.activeId) setActiveId(data.activeId);
          if (data.chatMessages) setChatMessages(data.chatMessages);
          if (data.companyBusiness) setCompanyBusiness(data.companyBusiness);
          if (data.reportPurpose) setReportPurpose(data.reportPurpose);
          if (data.currentHotspot) setCurrentHotspot(data.currentHotspot);
          if (data.selectedTone) setSelectedTone(data.selectedTone);
          if (data.reportText) setReportText(data.reportText);
          if (data.reportSummary) setReportSummary(data.reportSummary);
          if (data.fileName) setFileName(data.fileName);
          if (data.isPlanGenerated !== undefined) setIsPlanGenerated(data.isPlanGenerated);
          if (data.planApproved !== undefined) setPlanApproved(data.planApproved);
          if (data.serialPlan) setSerialPlan(data.serialPlan);
          if (data.planVersions) setPlanVersions(data.planVersions);
          if (data.exactCtaTemplate !== undefined) setExactCtaTemplate(data.exactCtaTemplate);
          if (data.generateCtaTemplate !== undefined) setGenerateCtaTemplate(data.generateCtaTemplate);
          // Fallback map
          if (data.ctaTemplate !== undefined) {
             if (data.ctaMode === 'generate') {
                setGenerateCtaTemplate(data.ctaTemplate);
             } else {
                setExactCtaTemplate(data.ctaTemplate);
             }
          }
          if (data.episodeMode) setEpisodeMode(data.episodeMode);
          if (data.episodeCount) setEpisodeCount(data.episodeCount);
          if (data.ctaMode) setCtaMode(data.ctaMode);
        }
        setIsStateLoaded(true);
      })
      .catch(err => {
         console.log('No prior state found', err);
         setIsStateLoaded(true);
      });
  }, []);

  // Save state slightly debounced
  useEffect(() => {
    if (!isStateLoaded) return;
    if (!fileName && issues.length === 0 && !serialPlan) return;
    
    const handler = setTimeout(() => {
      const state = {
        issues,
        activeId,
        chatMessages,
        companyBusiness,
        reportPurpose,
        currentHotspot,
        selectedTone,
        reportText,
        reportSummary,
        fileName,
        isPlanGenerated,
        planApproved,
        serialPlan,
        planVersions,
        exactCtaTemplate,
        generateCtaTemplate,
        episodeMode,
        episodeCount,
        ctaMode
      };
      fetch('/api/save-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      }).catch(err => console.error('Failed to save state', err));
    }, 1500);

    return () => clearTimeout(handler);
  }, [
    isStateLoaded, issues, activeId, chatMessages, companyBusiness, reportPurpose,
    currentHotspot, selectedTone, reportText, reportSummary, fileName, isPlanGenerated,
    planApproved, serialPlan, planVersions, exactCtaTemplate, generateCtaTemplate, episodeMode, episodeCount, ctaMode
  ]);
  
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

  // Click outside and Esc to close menus
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
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRegenerateModal(false);
        setShowStrategyModal(false);
        setShowSaveModal(false);
        setShowConfig(false);
        setFloatingMenu({ ...floatingMenu, visible: false });
        setShowTip(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showPublishMenu, showDownloadMenu, showIssueSelector, showConfirmAll, showVersionMenu]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

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
      title: "局部精修",
      content: "鼠标划选段落文本后，可以直接唤起隐形 AI 菜单，输入具体修改指令（如：换个更有趣的说法）。"
    },
    {
      title: "快捷动作",
      content: "点击右侧聊天浮窗的小图标菜单，可以快速一键对当前文章进行润色、扩写、精简，或调整风格调性。"
    },
    {
      title: "版本回溯",
      content: "每次让 AI 重写或生成新内容时，系统都会自动为您保存上一个版本。点击上方标题栏的 V 版本号即可随时找回并切换此前的草稿。"
    },
    {
      title: "防丢锦囊",
      content: "关闭软件前，可以通过左侧“保存为MD - 保存全部”将所有连载单篇以及系统状态打包为 ZIP 下载，下次直接全盘恢复进度。"
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
        isUpdatingRef.current = true;
        editor.commands.setContent(activeIssue.content);
        setTimeout(() => { isUpdatingRef.current = false; }, 10);
      }
    }
  }, [activeId, editor, activeIssue.content]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (issues.length > 0 || serialPlan) {
      await downloadMarkdown('all', true);
      setIssues([]);
      setActiveId('plan');
      setSerialPlan(DEFAULT_SERIAL_PLAN);
      setPlanVersions([]);
      setChatMessages([]);
      setReportSummary('');
      setIsPlanGenerated(false);
      setPlanApproved(false);
    }

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

      if (trimmedText.length > 500000) {
        setUploadError(`文件内容过长（约 ${Math.round(trimmedText.length / 10000)} 万字符），超出 50 万字符处理上限。请精简报告或分批上传。`);
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

  const handleLoadProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const zip = await JSZip.loadAsync(file);
      const stateFile = zip.file(".app_state.json");
      if (stateFile) {
        const stateStr = await stateFile.async("string");
        const data = JSON.parse(stateStr);
        if (data.issues) setIssues(data.issues);
        if (data.activeId !== undefined) setActiveId(data.activeId);
        if (data.chatMessages) setChatMessages(data.chatMessages);
        if (data.companyBusiness) setCompanyBusiness(data.companyBusiness);
        if (data.reportPurpose) setReportPurpose(data.reportPurpose);
        if (data.currentHotspot) setCurrentHotspot(data.currentHotspot);
        if (data.selectedTone) setSelectedTone(data.selectedTone);
        if (data.reportText) setReportText(data.reportText);
        if (data.reportSummary) setReportSummary(data.reportSummary);
        if (data.fileName) setFileName(data.fileName);
        if (data.isPlanGenerated !== undefined) setIsPlanGenerated(data.isPlanGenerated);
        if (data.planApproved !== undefined) setPlanApproved(data.planApproved);
        if (data.serialPlan) setSerialPlan(data.serialPlan);
        if (data.planVersions) setPlanVersions(data.planVersions);
        if (data.exactCtaTemplate !== undefined) setExactCtaTemplate(data.exactCtaTemplate);
        if (data.generateCtaTemplate !== undefined) setGenerateCtaTemplate(data.generateCtaTemplate);
        // Fallback map
        if (data.ctaTemplate !== undefined) {
           if (data.ctaMode === 'generate') {
              setGenerateCtaTemplate(data.ctaTemplate);
           } else {
              setExactCtaTemplate(data.ctaTemplate);
           }
        }
        if (data.episodeMode) setEpisodeMode(data.episodeMode);
        if (data.episodeCount) setEpisodeCount(data.episodeCount);
        if (data.ctaMode) setCtaMode(data.ctaMode);
      }
      
      // Override state from independent files if they exist
      const bizFile = zip.file("设定/01_公司业务.md");
      if (bizFile) setCompanyBusiness((await bizFile.async("string")).trim());

      const ctaFile = zip.file("设定/02_引流模板设定.md");
      if (ctaFile) {
        const text = await ctaFile.async("string");
        const match = text.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if (data.ctaMode) setCtaMode(data.ctaMode);
            if (data.exactCtaTemplate !== undefined) setExactCtaTemplate(data.exactCtaTemplate);
            if (data.generateCtaTemplate !== undefined) setGenerateCtaTemplate(data.generateCtaTemplate);
          } catch (e) {}
        }
      }

      const reqFile = zip.file("设定/03_报告分解要求.md");
      if (reqFile) setReportPurpose((await reqFile.async("string")).trim());

      const hotFile = zip.file("设定/04_热点.md");
      if (hotFile) setCurrentHotspot((await hotFile.async("string")).trim());

      const epFile = zip.file("设定/05_连载期数设定.md");
      if (epFile) {
        const text = await epFile.async("string");
        const match = text.match(/```json\n([\s\S]*?)\n```/);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if (data.episodeMode) setEpisodeMode(data.episodeMode);
            if (data.episodeCount !== undefined) setEpisodeCount(data.episodeCount);
          } catch (e) {}
        }
      }

      const toneFile = zip.file("设定/06_调性设定.md");
      if (toneFile) setSelectedTone((await toneFile.async("string")).trim());

      const planFile = zip.file("规划/最新版本.md");
      if (planFile) {
        const content = await planFile.async("string");
        // Remove the prepended headers we added during save
        const parts = content.split('## 规划详情\n');
        if (parts.length > 1) {
          setSerialPlan(parts[1]);
        }
      }

      // Async loading of issue contents:
      let hasOverriddenIssues = false;
      const parsedIssuesStr = stateFile ? await stateFile.async("string") : null;
      let finalIssues = parsedIssuesStr ? JSON.parse(parsedIssuesStr).issues || [] : [];
      
      for (let i = 0; i < finalIssues.length; i++) {
        const issueFile = zip.file(`篇目/${finalIssues[i].title}/最新版本.md`);
        if (issueFile) {
          hasOverriddenIssues = true;
          finalIssues[i].content = await issueFile.async("string");
        }
      }
      if (hasOverriddenIssues) {
        setIssues(finalIssues);
      }

      showToast("项目包已成功加载，恢复进度", "success");
    } catch (err) {
      console.error(err);
      showToast("项目包解析失败", "error");
    }
    
    e.target.value = '';
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
        model: "gemini-3.1-pro-preview",
        contents: generatePlanPrompt({
          text,
          companyBusiness,
          reportPurpose,
          currentHotspot,
          selectedTone,
          ctaTemplate: ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate,
          toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || '',
          episodeMode,
          episodeCount,
          globalSkills
        }),
        config: { responseMimeType: "application/json", temperature: 0.2 }
      });

      if (!planResponse.text) {
        throw new Error("AI 未能返回有效的规划内容");
      }

      const data = JSON.parse(planResponse.text);
      if (data.businessName && !companyBusiness) {
        setCompanyBusiness(data.businessName);
      }
      if (data.reportSummary) {
        setReportSummary(data.reportSummary);
      }

      const newPlan = data.plan || '';
      
      if (planVersions.length > 0) {
        setPlanVersions(prev => {
          const newPrev = [...prev];
          const activeIdx = newPrev.slice().reverse().findIndex(v => v.content === serialPlan);
          const targetIdx = activeIdx !== -1 ? (newPrev.length - 1 - activeIdx) : (newPrev.length - 1);
          if (targetIdx >= 0) {
            newPrev[targetIdx] = { ...newPrev[targetIdx], issuesSnapshot: issues };
          }
          const nextVer = getNextVersion(newPlan, newPrev) || `${newPrev.length + 1}.0`;
          return [...newPrev, { version: nextVer, content: newPlan, timestamp: Date.now() }];
        });
      } else {
        setPlanVersions([{ version: "1.0", content: newPlan, timestamp: Date.now() }]);
      }

      setSerialPlan(newPlan);
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

  // Keep tiptap event refs updated with the latest closure
  useEffect(() => {
    updateContentRef.current = (newContent: string) => {
      setIsDirty(true);
      if (activeId === 'plan') {
        setSerialPlan(newContent);
      } else {
        setIssues(prev => prev.map(issue => 
          issue.id === activeId ? { ...issue, content: newContent } : issue
        ));
      }
    };
    saveVersionRef.current = saveVersion;
  });


  const approvePlan = async () => {
    if (!serialPlan.trim()) return;
    setIsPlanLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: generateApprovePlanPrompt({
          serialPlan,
          toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || ''
        }),
        config: { responseMimeType: "application/json", temperature: 0.2 }
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
        model: "gemini-3.1-pro-preview",
        contents: generateArticlePrompt({
          companyBusiness,
          toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || '',
          reportSummary,
          reportText,
          prevChapters,
          chapterTitle: chapter.title,
          chapterOutline: chapter.outline,
          serialPlan,
          extraRequirements,
          ctaMode,
          ctaTemplate: ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate,
          globalSkills
        }),
        config: { temperature: 0.3 }
      });
      
      let newContent = response.text || '';
      
      // If ctaMode is 'exact', append the CTA template exactly as is
      if (ctaMode === 'exact') {
        const appliedCta = exactCtaTemplate.trim() || (serialPlan.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/)?.[1] || '').trim();
        if (appliedCta) {
          const strippedContent = newContent.replace(/\s/g, '');
          const strippedCta = appliedCta.replace(/\s/g, '');
          if (!strippedContent.includes(strippedCta)) {
            newContent += '\n\n---\n\n' + appliedCta;
          }
        }
      }

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
          model: "gemini-3.1-pro-preview",
          contents: generateArticlePrompt({
            companyBusiness,
            toneLabel: TONE_OPTIONS.find(t => t.id === selectedTone)?.label || '',
            reportSummary,
            reportText,
            prevChapters,
            chapterTitle: chapter.title,
            chapterOutline: chapter.outline,
            serialPlan,
            ctaMode,
            ctaTemplate: ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate
          }),
          config: { temperature: 0.3 }
        });
        
        let newContent = response.text || '';
        
        // If ctaMode is 'exact', append the CTA template exactly as is
        if (ctaMode === 'exact') {
          const appliedCta = exactCtaTemplate.trim() || (serialPlan.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/)?.[1] || '').trim();
          if (appliedCta) {
            const strippedContent = newContent.replace(/\s/g, '');
            const strippedCta = appliedCta.replace(/\s/g, '');
            if (!strippedContent.includes(strippedCta)) {
              newContent += '\n\n---\n\n' + appliedCta;
            }
          }
        }

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

  const downloadMarkdown = async (type: 'current' | 'all', isSilent: boolean = false) => {
    if (type === 'current') {
      if (!activeIssue.content || activeIssue.content.trim() === '') {
        showToast("内容为空，无法保存");
        return;
      }
      try {
        const response = await fetch('/api/save-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: `${activeIssue.title}.md`,
            content: activeIssue.content
          })
        });
        if (!response.ok) throw new Error("API Response not ok");
        const result = await response.json();
        if (result.path) {
          setSavedZipPath(result.path);
          setShowSaveModal(true);
        } else {
          showToast(`本地保存接口失败，未能获取路径`, 'error');
        }
      } catch (err) {
        console.error('Save file error:', err);
        showToast(`本地文件保存失败：网络或接口异常`, 'error');
      }
    } else {
      const contentIssues = issues.filter(i => i.content && i.content.trim() !== '');

      const zip = new JSZip();
      if (contentIssues.length > 0) {
        contentIssues.forEach(issue => {
          zip.file(`篇目/${issue.title}/最新版本.md`, issue.content);
          issue.versions.forEach(v => {
            zip.file(`篇目/${issue.title}/版本历史/V${v.version}.md`, v.content);
          });
        });
      }
      
      let planContent = `# 连载规划\n\n`;
      planContent += `## 业务背景\n${companyBusiness}\n\n`;
      planContent += `## 报告目的\n${reportPurpose}\n\n`;
      planContent += `## 整体调性\n${TONE_OPTIONS.find(t => t.id === selectedTone)?.label}\n\n`;
      planContent += `## 全篇提炼总结\n${reportSummary}\n\n`;
      planContent += `## 规划详情\n${serialPlan}\n`;
      zip.file(`规划/最新版本.md`, planContent);
      
      planVersions.forEach(v => {
        zip.file(`规划/版本历史/V${v.version}.md`, v.content);
      });

      // Export settings as independent files
      zip.file(`设定/01_公司业务.md`, companyBusiness);
      
      const ctaData = `\`\`\`json\n${JSON.stringify({ctaMode, exactCtaTemplate, generateCtaTemplate}, null, 2)}\n\`\`\``;
      zip.file(`设定/02_引流模板设定.md`, ctaData);
      
      zip.file(`设定/03_报告分解要求.md`, reportPurpose);
      zip.file(`设定/04_热点.md`, currentHotspot);
      
      const episodeData = `\`\`\`json\n${JSON.stringify({episodeMode, episodeCount}, null, 2)}\n\`\`\``;
      zip.file(`设定/05_连载期数设定.md`, episodeData);
      
      zip.file(`设定/06_调性设定.md`, selectedTone);

      let chatContent = `# AI助手对话记录\n\n`;
      chatMessages.forEach((msg, idx) => {
        chatContent += `### ${msg.role === 'user' ? '用户' : 'AI助手'} (${idx + 1})\n\n`;
        chatContent += `${msg.content}\n\n`;
      });
      zip.file(`00_AI助手对话记录.md`, chatContent);

      const state = {
        issues,
        activeId,
        chatMessages,
        companyBusiness,
        reportPurpose,
        selectedTone,
        reportText,
        reportSummary,
        fileName,
        isPlanGenerated,
        planApproved,
        serialPlan,
        planVersions,
        exactCtaTemplate,
        generateCtaTemplate,
        episodeMode,
        episodeCount,
        ctaMode
      };
      zip.file(`.app_state.json`, JSON.stringify(state));

      const blob = await zip.generateAsync({ type: 'blob' });
      
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const response = await fetch('/api/save-zip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream'
          },
          body: arrayBuffer
        });
        if (!response.ok) throw new Error("API Response not ok");
        const result = await response.json();
        if (result.path) {
          if (!isSilent) {
            setSavedZipPath(result.path);
            setShowSaveModal(true);
          }
        } else {
          showToast(`离线打包保存失败，未能获取路径`, 'error');
        }
      } catch (err) {
        console.error('Save failed entirely:', err);
        showToast(`离线保存接口异常：网络异常或服务未启动`, 'error');
      }
    }
    setShowDownloadMenu(false);
  };

  const publishToDrafts = (type: 'current' | 'all') => {
    showToast("正在开发中...", 'error');
    setShowPublishMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editor) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');

    if (selectedText.trim()) {
      // Mark text as highlighted so it remains visually selected when focus is lost
      editor.chain().setTextSelection({ from, to }).setHighlight().run();
      
      setSelectionInfo({ text: selectedText, start: from, end: to });
      setFloatingMenu({ visible: true, x: e.clientX, y: e.clientY });
    }
  };

  const handleFloatingEdit = async () => {
    if (!selectionInfo || !floatingPrompt.trim() || isFloatingLoading || !editor) return;

    // Save current version before modification so Undo works
    saveVersion();

    setIsFloatingLoading(true);
    setIsChatLoading(true);
    setFloatingMenu({ ...floatingMenu, visible: false });
    
    try {
      // Push the user instruction to the chat area immediately
      const userMessage = `针对选中文本：\n> ${selectionInfo.text}\n\n执行要求：${floatingPrompt}`;
      const newChatMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
      setChatMessages(newChatMessages);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: generateFloatingEditPrompt({
          selectionText: selectionInfo.text,
          prompt: floatingPrompt,
          serialPlan,
          reportSummary,
          reportText
        }),
      });

      const newText = response.text || '';
      
      // Update the editor: replace text AND remove the highlight mark
      // We explicitly select the text, unset the highlight first to prevent mark inheritance,
      // and then in a separate transaction we insert the newly generated content.
      editor.chain().focus().setTextSelection({ from: selectionInfo.start, to: selectionInfo.end }).unsetHighlight().run();
      editor.chain().focus().setTextSelection({ from: selectionInfo.start, to: selectionInfo.end }).insertContent(newText).run();

      // Push the AI response to the chat area and mark it as a modification to show the Undo button
      setChatMessages([...newChatMessages, { 
        role: 'assistant' as const, 
        content: `这是修改后的内容：\n\n${newText}\n\n*（已自动应用到左侧编辑器）*`,
        isModification: true 
      }]);

      setFloatingPrompt("");
      setSelectionInfo(null);
    } catch (error) {
      console.error('Floating edit error:', error);
    } finally {
      setIsFloatingLoading(false);
      setIsChatLoading(false);
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
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            role: "user",
            parts: [{
              text: generateChatPrompt({
                serialPlan,
                reportSummary,
                reportText,
                activeContent: activeIssue.content,
                userMessage,
                isSuggestionOnly,
                globalSkills
              })
            }]
          }
        ],
        config: {
          systemInstruction: CHAT_SYSTEM_INSTRUCTION,
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
      syncTitlesFromPlan(newContent);
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

  // Update callback refs whenever they change properly before other effects might use them
  useEffect(() => {
    updateContentRef.current = handleUpdateContent;
    saveVersionRef.current = saveVersion;
    printChapterRef.current = handlePrintCurrentChapter;
  });

  const handlePrintCurrentChapter = () => {
    if (!editor || !activeIssue) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const htmlContent = editor.getHTML();
      printWindow.document.write(`
        <html>
          <head>
            <title>${activeIssue.title || '当前篇目'}</title>
            <style>
              body { font-family: sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #141414; }
              img { max-width: 100%; height: auto; margin: 1rem 0; border-radius: 8px; }
              table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
              th, td { border: 1px solid #ddd; padding: 12px 8px; text-align: left; }
              th { background-color: #f5f5f0; }
              h1, h2, h3, h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
              p { margin-bottom: 1rem; }
            </style>
          </head>
          <body>
            <h1>${activeIssue.title || '当前篇目'}</h1>
            ${htmlContent}
            <script>
              window.onload = () => { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
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
      // 宽松匹配表格行，匹配被管道符包围且不全是连续分隔符(-)，且第一列包含数字或中文字符的形式
      const tableMatch = trimmed.match(/^\|\s*(?:连载|第)?\s*[0-9一二三四五六七八九十]+\s*(?:期|篇|讲)?\s*\|\s*[^|]+\s*\|\s*([^|]+)\s*\|/);
      if (tableMatch && !trimmed.includes('---')) {
        if (!inChapters || (inChapters && lines.indexOf(line) > lines.findIndex(l => l.includes('篇目') || l.includes('目录') || l.includes('列表')))) {
          let titleCandidate = tableMatch[1].trim();
          titleCandidate = titleCandidate.replace(/^(?:连载\s*[一二三四五六七八九十\d]+\s*[\-\:：\s]*)+/g, '');
          newTitles.push(titleCandidate);
          continue;
        }
      }

      const match = trimmed.match(/^(?:#+\s*)?\d+[\.\s、]+(.+)$/) || 
                    trimmed.match(/^(?:#+\s*)?第[一二三四五六七八九十]+[篇期][:：\s]*(.+)$/);
      
      if (match) {
        if (!inChapters || (inChapters && lines.indexOf(line) > lines.findIndex(l => l.includes('篇目') || l.includes('目录') || l.includes('列表')))) {
          let titleCandidate = match[1].trim();
          titleCandidate = titleCandidate.replace(/^(?:连载\s*[一二三四五六七八九十\d]+\s*[\-\:：\s]*)+/g, '');
          newTitles.push(titleCandidate);
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
      setPlanVersions(prev => {
        const newPrev = [...prev];
        const activeIdx = newPrev.slice().reverse().findIndex(v => v.content === serialPlan);
        const targetIdx = activeIdx !== -1 ? (newPrev.length - 1 - activeIdx) : (newPrev.length - 1);
        if (targetIdx >= 0) {
          newPrev[targetIdx] = { ...newPrev[targetIdx], issuesSnapshot: issues };
        }
        return newPrev;
      });

      setSerialPlan(version.content);
      if (version.issuesSnapshot) {
        setIssues(version.issuesSnapshot);
      } else {
        syncTitlesFromPlan(version.content);
      }
      if (editor) {
        isUpdatingRef.current = true;
        editor.commands.setContent(version.content);
        setTimeout(() => { isUpdatingRef.current = false; }, 10);
      }
    } else {
      setIssues(prev => prev.map(issue => {
        if (issue.id === activeId) {
          return { ...issue, content: version.content };
        }
        return issue;
      }));
      if (editor) {
        isUpdatingRef.current = true;
        editor.commands.setContent(version.content);
        setTimeout(() => { isUpdatingRef.current = false; }, 10);
      }
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
    <div 
      className="flex h-screen bg-[#F5F5F0] text-[#141414] font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Sidebar */}
      <aside 
        style={{ width: sidebarWidth }}
        className="bg-[#F5F5F0] border-r border-[#141414]/10 flex flex-col relative shrink-0"
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 shadow-sm rounded-xl flex items-center justify-center overflow-hidden shrink-0 border border-[#141414]/10 bg-white">
              <img src="/favicon_v2.png" alt="ReportSerialize Pro Logo" className="w-full h-full object-cover" />
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

              <Tooltip text="生成策略" className="w-full">
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

        {serialPlan && (
          <div className="px-4 pb-2 border-b border-[#141414]/5 mb-2 shrink-0">
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
          </div>
        )}

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto min-h-0">
          <div className="pt-2 pb-2 px-4">
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
              <span className={`text-[11px] font-bold ${activeId === issue.id ? 'text-white' : 'text-[#141414]/60'}`}>
                连载{issue.id}
              </span>
              <div className="flex-1 flex flex-col items-start min-w-0">
                <span className="text-sm font-bold truncate w-full text-left">
                  {cleanTitle(issue.title)}
                </span>
                <span className={`text-[9px] mt-0.5 ${activeId === issue.id ? 'text-white/60' : 'text-[#141414]/30'}`}>
                  {getWordCount(issue.content)} 字
                </span>
              </div>
              {issue.versions.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {issue.versions.length === 0 && issue.content && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
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
          
          {planApproved && (
            <div className={`grid gap-1 relative ${activeId === 'plan' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {activeId === 'plan' ? (
                <>
                  <div className="relative" ref={issueSelectorRef}>
                    <button 
                      onClick={() => setShowIssueSelector(!showIssueSelector)}
                      disabled={isGeneratingSingle || isGeneratingAll}
                      className="w-full flex items-center justify-center gap-1 py-3 bg-[#141414] text-white rounded-xl text-[10px] font-bold hover:bg-[#141414]/90 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
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
                                <span className="truncate mr-2">连载{issue.id} - {cleanTitle(issue.title)}</span>
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
                      className="w-full flex items-center justify-center gap-1 py-3 border border-[#141414] text-[#141414] rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
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
                </>
              ) : (
                <div className="relative">
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
                    className={`w-full flex items-center justify-center gap-1 py-3 rounded-xl text-[10px] font-bold transition-colors disabled:opacity-50 ${activeIssue.content ? 'border border-[#141414] text-[#141414] hover:bg-gray-50' : 'bg-[#141414] text-white hover:bg-[#141414]/90 border-0'}`}
                  >
                    {isGeneratingSingle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : activeIssue.content ? <RotateCcw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {activeIssue.content ? '重新生成' : '生成本篇'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
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

            <div className="relative">
              <input 
                type="file" 
                accept=".zip" 
                onChange={handleLoadProject}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-[60]"
                title="加载已保存的项目文档"
              />
              <div className="w-full flex flex-col items-center justify-center gap-1.5 py-3 bg-[#F5F5F0] text-[#141414]/70 rounded-2xl text-[10px] font-bold hover:bg-[#E4E3E0] transition-all border border-[#141414]/5 cursor-pointer pointer-events-none">
                <FolderArchive className="w-3.5 h-3.5" />
                <span>加载文档</span>
              </div>
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
        <header className="h-16 relative z-[100] border-b border-[#141414]/10 bg-white/80 backdrop-blur-md flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#141414]/60">
              <FileText className="w-4 h-4" />
              <span>{activeId === 'plan' ? activeIssue.title : cleanTitle(activeIssue.title)}</span>
              {activeIssue.versions && activeIssue.versions.length > 0 && (
                <div className="relative" ref={versionMenuRef}>
                  <button 
                    onClick={() => setShowVersionMenu(!showVersionMenu)}
                    className="ml-2 px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] rounded-full font-bold flex items-center gap-1 hover:bg-[#5A5A40]/20 transition-colors"
                  >
                    V{(() => {
                      const match = activeIssue.versions.slice().reverse().find(v => v.content === activeIssue.content);
                      return match ? match.version : (activeIssue.versions[activeIssue.versions.length - 1].version + ' (已编辑)');
                    })()}
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
              {activeId === 'plan' && (() => {
                const globalCta = (ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate).trim();
                const match = activeIssue.content.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/);
                const planCta = match ? match[1].trim() : '';
                const isCtaLocked = globalCta.length > 0 && planCta === globalCta;
                
                return (
                  <button
                    onClick={() => {
                      if (planCta) {
                        if (Array.from(cleanMarkdown(planCta)).length > 300) {
                          showToast("引流部分字数超300字（含图标），无法锁定，调整后保存", "error");
                          return;
                        }
                        if (ctaMode === 'generate') {
                           setGenerateCtaTemplate(planCta);
                        } else {
                           setExactCtaTemplate(planCta);
                        }
                        showToast("引流模板已提取并全局锁定", "success");
                      } else {
                        showToast("未找到内容，请确认在 '## 3. 引流模板' 的下方是否有内容", "error");
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 bg-white border rounded-full text-[10px] font-bold transition-all shadow-sm ${isCtaLocked ? 'border-emerald-200 text-emerald-600' : 'border-[#141414]/10 text-[#141414]/60 hover:bg-[#F5F5F0]'}`}
                    title={isCtaLocked ? "引流参数目前已完全同步" : "提取当前大纲中的引流模板并锁定为全局参数"}
                  >
                    {isCtaLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {isCtaLocked ? '引流已锁定' : '提取引流模板'}
                  </button>
                );
              })()}
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
                      </div>
                    )}
                    
                    <div 
                      className="flex-1 relative flex flex-col min-h-[500px] cursor-text"
                      onClick={() => editor?.commands.focus()}
                    >
                      {!activeIssue.content && activeId !== 'plan' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none z-0">
                          <div className="w-16 h-16 bg-[#F5F5F0] rounded-2xl flex items-center justify-center mb-6">
                            <Feather className="w-8 h-8 text-[#5A5A40]/30" />
                          </div>
                          <h4 className="text-lg font-bold mb-2 text-[#141414]/50">本篇内容尚未生成</h4>
                          <p className="text-sm text-[#141414]/40 max-w-xs mb-8 leading-relaxed">
                            点击侧边栏的生成按钮由 AI 撰写初稿。<br/><br/>
                            或者，您也可以直接在当前白板上手动输入或粘贴内容。
                          </p>
                        </div>
                      )}
                      
                      <div className="markdown-body flex-1 relative z-10 w-full h-full">
                        <article className="prose prose-stone max-w-none h-full 
                          prose-headings:font-serif prose-headings:italic prose-headings:text-[#141414] 
                          prose-p:text-[#141414]/80 prose-p:leading-relaxed
                          prose-strong:text-[#141414] 
                          prose-hr:border-[#141414]/10 
                          prose-blockquote:border-l-[#5A5A40] prose-blockquote:bg-[#F5F5F0]/50 prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:rounded-r-lg
                          prose-li:text-[#141414]/80
                          prose-img:rounded-xl prose-img:shadow-md
                          prose-code:text-[#5A5A40] prose-code:bg-[#5A5A40]/5 prose-code:px-1 prose-code:rounded
                          ">
                          <EditorContent editor={editor} className="h-full min-h-[500px]" />
                        </article>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Chat Panel */}
            <AnimatePresence>
              {isChatOpen && (
                <motion.aside
                  key="ai-assistant-panel"
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
                  <div ref={messagesEndRef} />
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
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[120px] transition-all"
                  />
                </section>

                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">引流与转化策略 (CTA)</label>
                  <div className="flex bg-[#F5F5F0] p-1 rounded-xl w-full mb-3">
                    <button
                      onClick={() => setCtaMode('exact')}
                      className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-lg ${
                        ctaMode === 'exact' ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50'
                      }`}
                    >
                      严格追加原话
                    </button>
                    <button
                      onClick={() => setCtaMode('generate')}
                      className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-lg ${
                        ctaMode === 'generate' ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50'
                      }`}
                    >
                      AI智能生成
                    </button>
                    <button
                      onClick={() => setCtaMode('none')}
                      className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-lg ${
                        ctaMode === 'none' ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50'
                      }`}
                    >
                      无引流
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {ctaMode !== 'none' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center justify-between mb-3 mt-3">
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-[#141414]/40">
                              {ctaMode === 'exact' ? '严格引流话术 (原样拼接到文末)' : 'AI 撰写参考要点 (供 AI 围绕生成)'}
                            </label>
                            <div title={(ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate).trim().length > 0 ? "已配置引流参数" : "填写此项即生效"}>
                              {(ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate).trim().length > 0 ? <Lock className="w-3 h-3 text-emerald-600" /> : <Unlock className="w-3 h-3 text-[#141414]/20" />}
                            </div>
                          </div>
                          <div className={`text-[10px] font-bold ${Array.from(cleanMarkdown(ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate)).length > 300 ? 'text-red-500' : 'text-[#141414]/40'}`}>
                            {Array.from(cleanMarkdown(ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate)).length} / 300 字
                          </div>
                        </div>
                        {ctaMode === 'exact' ? (
                          <textarea 
                            value={exactCtaTemplate}
                            onChange={(e) => setExactCtaTemplate(e.target.value)}
                            placeholder="请贴入完整的引流文案、链接或福利说明..."
                            className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm md:font-mono focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[140px] transition-all"
                          />
                        ) : (
                          <textarea 
                            value={generateCtaTemplate}
                            onChange={(e) => setGenerateCtaTemplate(e.target.value)}
                            placeholder="例如：吸引加微信领资料，结尾留悬念抛出企业微信二维码..."
                            className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-2xl text-sm md:font-mono focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[140px] transition-all"
                          />
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  onClick={() => {
                    const activeCta = ctaMode === 'generate' ? generateCtaTemplate : exactCtaTemplate;
                    if (ctaMode !== 'none' && Array.from(cleanMarkdown(activeCta)).length > 300) {
                      setUploadError("引流部分字数不可超过300字（含图标），请调整后再保存");
                      return;
                    }

                    setShowConfig(false);
                    // 同步修改逻辑：如果正在使用严格模式并且有规划，则同步替换 planning document 的 ## 3. 引流模板 后面内容。
                    if (ctaMode === 'exact' && exactCtaTemplate.trim() !== '' && serialPlan) {
                      const planMatch = serialPlan.match(/## 3\.?\s*引流模板\s*([\s\S]*?)(?=##|$)/);
                      if (planMatch) {
                        const newPlan = serialPlan.replace(
                          /(## 3\.?\s*引流模板\s*)([\s\S]*?)(?=##|$)/g, 
                          `$1\n${exactCtaTemplate.trim()}\n\n`
                        );
                        if (newPlan !== serialPlan) {
                          setSerialPlan(newPlan);
                        }
                      }
                    }
                  }}
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
                  <h2 className="text-xl font-serif italic font-bold">报告分解策略</h2>
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
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[100px] transition-all"
                  />
                </section>
                
                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">2. 绑定当前热点 (可选)</label>
                  <textarea 
                    value={currentHotspot}
                    onChange={(e) => {
                      setCurrentHotspot(e.target.value);
                      if (uploadError) setUploadError(null);
                    }}
                    placeholder="输入希望结合的近期热点事件或趋势，AI将尝试在系列策划中借势营销..."
                    className="w-full p-4 bg-[#F5F5F0]/50 border border-[#141414]/10 rounded-xl text-sm focus:ring-2 focus:ring-[#5A5A40]/20 outline-none min-h-[60px] transition-all"
                  />
                </section>

                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">3. 连载期数限制</label>
                  <div className="flex bg-[#F5F5F0] p-1 rounded-xl w-full max-w-xs mb-3">
                    <button
                      onClick={() => setEpisodeMode('auto')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        episodeMode === 'auto' ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50'
                      }`}
                    >
                      AI智能决策
                    </button>
                    <button
                      onClick={() => setEpisodeMode('fixed')}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        episodeMode === 'fixed' ? 'bg-white shadow-sm text-[#141414]' : 'text-[#141414]/50'
                      }`}
                    >
                      固定期数
                    </button>
                  </div>
                  
                  <AnimatePresence>
                    {episodeMode === 'fixed' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-4 overflow-hidden pt-2"
                      >
                        <span className="text-xs text-[#141414]/50">期望规划</span>
                        <input
                          type="range"
                          min="3"
                          max="20"
                          value={episodeCount}
                          onChange={(e) => setEpisodeCount(parseInt(e.target.value))}
                          className="flex-1 accent-[#5A5A40]"
                        />
                        <span className="text-sm font-bold w-12 text-center bg-[#F5F5F0] py-1 rounded-lg border border-[#141414]/5">
                          {episodeCount} 期
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                <section>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-[#141414]/40 mb-3">3. 整体调性设定</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTone(t.id)}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          selectedTone === t.id 
                            ? 'border-[#5A5A40] bg-[#5A5A40]/5 ring-1 ring-[#5A5A40]' 
                            : 'border-[#141414]/10 hover:border-[#141414]/20'
                        }`}
                      >
                        <p className="text-xs font-bold mb-0.5">{t.label}</p>
                        <p className="text-[9px] text-[#141414]/50 leading-relaxed max-h-12 overflow-hidden">{t.desc}</p>
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
                    <h3 className="text-lg font-bold">重新生成</h3>
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
        {showSaveModal && savedZipPath && (
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
              className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#141414]/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#5A5A40]/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">保存成功</h3>
                  </div>
                </div>
                <button onClick={() => setShowSaveModal(false)} className="p-2 hover:bg-[#141414]/5 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-center">
                <div className="w-full truncate text-xs text-[#141414]/60 bg-[#F5F5F0] rounded-xl p-3 border border-[#141414]/10" title={savedZipPath}>
                  {savedZipPath}
                </div>
              </div>

              <div className="p-6 bg-[#F5F5F0]/30 border-t border-[#141414]/5 flex justify-end gap-3">
                <button 
                  onClick={() => setShowSaveModal(false)}
                  className="px-6 py-2 border border-[#141414]/10 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex-1"
                >
                  关闭
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await fetch('/api/open-folder', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetPath: savedZipPath })
                      });
                    } catch (e) {}
                    setShowSaveModal(false);
                  }}
                  className="px-6 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-bold hover:bg-[#5A5A40]/90 transition-all flex-1"
                >
                  打开所在位置
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
              onClick={() => {
                if (editor && selectionInfo) {
                  editor.chain().setTextSelection({ from: selectionInfo.start, to: selectionInfo.end }).unsetHighlight().run();
                }
                setFloatingMenu({ ...floatingMenu, visible: false });
                setSelectionInfo(null);
              }}
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
