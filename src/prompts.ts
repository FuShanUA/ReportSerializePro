export interface ProcessReportParams {
  text: string;
  companyBusiness: string;
  reportPurpose: string;
  selectedTone: string;
  ctaTemplate: string;
  toneLabel: string;
  currentHotspot?: string;
  episodeMode: 'auto' | 'fixed';
  episodeCount?: number;
  globalSkills?: { humanizer: string; writingStyle: string };
}

export function generatePlanPrompt(params: ProcessReportParams): string {
  return `你是一个由 Master Agent 和多个专业 Worker Agent 组成的智能协作团队，负责为一个长篇报告生成高质量的连载规划。
        
        【原始素材】
        报告内容摘要：${params.text.substring(0, 500000)}
        ${params.companyBusiness ? `公司背景：${params.companyBusiness}` : ''}
        ${params.reportPurpose ? `分解目的与要求：${params.reportPurpose}` : ''}
        ${params.selectedTone ? `整体调性：${params.toneLabel}` : ''}
        ${params.currentHotspot ? `【当前热点】：${params.currentHotspot}` : ''}
        ${params.ctaTemplate ? `【引流内容要求】：\n${params.ctaTemplate}` : ''}
        
        【工作流程】
        请按照以下 Worker 分工，按顺序组织内容并输出：

        ---

        ### 1. 策划 Worker (负责构思大纲和撰写标题)
        根据原文和业务背景提取核心总结，并构建连载大纲及其章节标题。
        - **标题格式顺从原则**：如果前文的【分解目的与要求】中明确说明了标题的形式和/或格式，必须绝对以该要求为准进行工作。
        - **常规标题结构（若无约束）**：期数、主题方向、主标题、副标题、对应报告原章节。主标题要尽量简练，能够构建场景、图景或共鸣。副标题是对主标题及文章内容的具体说明。
        - ${params.currentHotspot ? `**热点结合**：必须优先考虑如何将【当前热点】（${params.currentHotspot}）与报告内容结合，体现在期数标题和策划思路上。` : '**总思路**：确立整个系列的拆解思路。'}

        ### 2. 格式化 Worker (负责将策划输出为最终展现的规划表格)
        将策划思路转化为具体的 Markdown 表文案，严格遵循以下结构：
        
        ## 1. 策划思路
        - **核心目标**：基于生成策略设置中的内容编写。
        - **调性定位**：根据生成策略设置中的调性选择编写。
        - **引流目标**：默认根据公司业务配置中的内容编写。
        - **引流要求**：结合生成策略中的要求和报告内容编写。

        ## 2. 连载目录规划
        输出 Markdown 表格（${params.episodeMode === 'fixed' ? `必须严格规划为 ${params.episodeCount} 期` : '建议 6-8 期'}），包含四列：
        | 期数 | 主题方向 | 篇目标题 | 对应报告章节 |
        | :---: | :--- | :--- | :--- |

        **表格细则**：
        - “期数”列居中，其余左对齐；
        - “期数”列使用**阿拉伯数字**（1、2、3）；
        - “篇目标题”必须严格遵循格式：\`《报告名称》连载X：主标题 副标题\`（这里的 X 使用**中文数字**一、二、三，且中间无加号。例如：《数据资产图谱》连载一：唤醒沉睡的金矿！ 数据资产入表的政策与风口）；

        ### 3. 引流 Worker
        ${params.ctaTemplate ? '根据前文提供的【引流内容要求】，撰写一段引流文案（如是强制要求请原样输出）。' : '设计一段标准的文末引流模块，包含【福利预告】、咨询引导词。'}
        在 Markdown 规划部分的最后，以如下标题输出：
        ## 3. 引流模板
        (引流模板内容...)

        【全局写作约束 (Global Settings)】
        ${params.globalSkills?.writingStyle ? `\n\n【WritingStyle 写作指南】\n${params.globalSkills.writingStyle}\n\n` : ''}
        ${params.globalSkills?.humanizer ? `\n\n【Humanizer 去除AI味守则】\n${params.globalSkills.humanizer}\n\n` : ''}
        请在此大纲策划中，确保标题与后续定调符合上述核心原则。

        ### 4. 目录 Worker (负责输出结构化的 JSON 给系统解析)
        提取所有的格式化信息并强制按照以下 JSON 数据格式进行组装，**此 JSON 是你的唯一最终输出**，外部工具才能读取。不要输出除 JSON 之外的冗余解释文本：

        \`\`\`json
        {
          "businessName": "提取或生成的业务背景与人设",
          "reportSummary": "对全篇报告的精华提炼总结",
          "plan": "包含 1. 策划思路、2. 连载目录规划表格、3. 引流模板 的所有完整 Markdown 文本。请将上面格式化Worker和引流Worker产出的全部内容放在这里。",
          "chapters": [
            {
              "id": 1, 
              "title": "[只选取标题中主要部分进行显示，不要期数等一致性前缀。如果有主副标题的设置则只显示主标题，没有的话则显示全标题。例如：唤醒沉睡的金矿！]",
              "outline": "结合报告内容列举的大致提纲要点"
            },
            {
              "id": 2, 
              "title": "[独立的主标题或全标题，不要带“连载X”]",
              "outline": "大纲要点..."
            }
          ]
        }
        \`\`\`
        **JSON chapters 极度关键强调**：
        - \`id\` **必须绝对是纯整数数字** (例如：\`1\`)，绝不可用字符串或 "chapter_1"！
        - \`title\` **只选取主要部分**，绝对不要期数（如“连载X”或“第X期”）等一致性前缀。如果有主副标题则仅保留主标题。
        `;
}

export interface ApprovePlanParams {
  serialPlan: string;
  toneLabel: string;
}

export function generateApprovePlanPrompt(params: ApprovePlanParams): string {
  return `根据以下连载规划，生成各篇目的大纲，并撰写第一篇的完整内容任务。
        规划内容：${params.serialPlan}
        调性要求：${params.toneLabel}
        
        请以JSON格式返回，结构如下：
        {
          "chapters": [
            { "id": 1, "title": "连载1 - 篇目小标题", "outline": "大纲内容", "content": "第一篇的完整Markdown内容", "status": "draft", "versions": [{ "version": "1.0", "content": "第一篇的完整Markdown内容", "timestamp": 123456789 }] },
            { "id": 2, "title": "连载2 - 篇目小标题", "outline": "大纲内容", "content": "", "status": "pending", "versions": [] }
          ]
        }`;
}

export interface GenerateArticleParams {
  companyBusiness: string;
  toneLabel: string;
  reportSummary: string;
  reportText: string;
  prevChapters: string;
  chapterTitle: string;
  chapterOutline: string;
  serialPlan?: string;
  extraRequirements?: string;
  ctaMode: 'none' | 'generate' | 'exact';
  ctaTemplate: string;
  globalSkills?: { humanizer: string; writingStyle: string };
}

export function generateArticlePrompt(params: GenerateArticleParams): string {
  return `你正在撰写一个连载系列。
        公司业务：${params.companyBusiness}
        调性：${params.toneLabel}
        
        【全篇提炼总结】
        ${params.reportSummary.substring(0, 10000)}
        
        【全篇连载大纲规划 (用于准确预告后续内容)】
        ${params.serialPlan ? params.serialPlan : '无'}
        
        【原文完整资料 caching】
        （请根据大纲需要，从以下完整报告中智能调取所需细节及章节，作为素材基础）
        ${params.reportText.substring(0, 500000)}
        
        前序内容回顾：${params.prevChapters.length > 0 ? params.prevChapters.substring(0, 3000) : '无'}
        当前篇目大纲：${params.chapterOutline}
        ${params.extraRequirements ? `用户额外要求：${params.extraRequirements}` : ''}
        
        【核心写作约束 (Hard Constraints)】
        ${params.globalSkills?.writingStyle ? `\n\n【WritingStyle 写作指南】\n${params.globalSkills.writingStyle}\n\n` : ''}
        ${params.globalSkills?.humanizer ? `\n\n【Humanizer 去除AI味守则】\n${params.globalSkills.humanizer}\n\n` : ''}
        1. **拒绝浮夸与破折号滥用**：禁用网梗及假大空黑话(赋能、闭环、抓手、卷上天、手搓等)，用正常的行业词汇取代；**绝对禁止使用破折号（—— 或 -）来解释名词或强行转折**，这也是典型的AI翻译腔痕迹！
        2. **读者视角**：少讲大道理，多讲具体的业务场景和真实案例。像人一样面对面讲业务，具备情绪价值和启发性。主张“言之有物，不讲废话”。
        ${params.ctaMode === 'generate' && params.ctaTemplate ? `5. **引流要求**：在文章结尾（使用 Markdown 引用块 '> '），必须根据以下要点自然地撰写一段引流提示：\n${params.ctaTemplate}\n\n**【极度重要警告：下期预告】**：如果引流要求中涉及到“预告下一期”，你**必须必须**从上文的【全篇连载大纲规划】中寻找严格对应的**下一篇真实标题和提纲**来写预告！**绝对禁止**自己凭空发散和编造任何不存在的标题与环节！` : ''}
        ${params.ctaMode !== 'generate' ? `5. **引流要求**：本文不需要任何附带引流、领福利或关注公众号的引导语。系统会在外部统一处理引流文案，请你绝对不要在正文中输出任何结语类的营销话术，保持结尾清爽。` : ''}
        
        请强执行以上约束，并基于原始报告内容，撰写本篇（${params.chapterTitle}）的完整Markdown内容。`;
}

export interface FloatingEditParams {
  selectionText: string;
  prompt: string;
  serialPlan?: string;
  reportSummary?: string;
  reportText?: string;
}

export function generateFloatingEditPrompt(params: FloatingEditParams): string {
  return `你是一个专业的文案编辑。请根据用户的要求修改或解答选中的文本。
        
        【全篇提炼总结】
        ${params.reportSummary ? params.reportSummary.substring(0, 10000) : '未提供'}

        【连载大纲规划】
        ${params.serialPlan ? params.serialPlan : '未提供'}

        【原文参考资料 caching】
        ${params.reportText ? params.reportText.substring(0, 500000) : '未提供'}

        选中的文本：
        ${params.selectionText}
        
        修改要求：
        ${params.prompt}
        
        【核心约束】：绝对禁止在输出的新内容中使用破折号（—— 或 -）来进行名词解释或语句转折，杜绝任何AI味！
        
        请仅返回修改后的文本内容，不要包含任何解释或Markdown代码块标记。`;
}

export interface ChatAssistantParams {
  serialPlan: string;
  reportSummary: string;
  reportText: string;
  activeContent: string;
  userMessage: string;
  isSuggestionOnly: boolean;
  globalSkills?: { humanizer: string; writingStyle: string };
}

export function generateChatPrompt(params: ChatAssistantParams): string {
  return `你是一个专业的文案编辑助手。请根据用户的要求修改、建议当前文章，或回答关于源报告的问题。
        
        【全篇提炼总结】
        ${params.reportSummary.length > 0 ? params.reportSummary.substring(0, 10000) : '未提供'}

        【连载规划大纲】
        ${params.serialPlan.length > 0 ? params.serialPlan : '未提供'}

        【原文参考资料】
        (此处为长文本缓存，包含了文章所需的全部基础信息，如果用户提问原报告相关内容，请直接从中查找准确回答，不要胡编乱造)
        ${params.reportText.length > 0 ? params.reportText.substring(0, 500000) : '未提供'}
        
        【当前文章内容】
        ${params.activeContent}
        
        【用户要求】
        ${params.userMessage}
        
        【核心写作约束 (Hard Constraints)】 - 适用于一切修改、扩写、缩写或语气调整：
        ${params.globalSkills?.writingStyle ? `\n\n【WritingStyle 写作指南】\n${params.globalSkills.writingStyle}\n\n` : ''}
        ${params.globalSkills?.humanizer ? `\n\n【Humanizer 去除AI味守则】\n${params.globalSkills.humanizer}\n\n` : ''}
        1. **拒绝浮夸与破折号滥用**：禁用网梗及假大空黑话(赋能、闭环、抓手、卷上天、手搓等)，用正常的行业词汇取代；**绝对禁止使用破折号（—— 或 -）来解释名词或强行转折**，这也是典型的AI翻译腔痕迹！

        ${params.isSuggestionOnly ? "请仅提供具体的改进建议点。如果用户提问关于原报告的问题（比如'第四章讲了什么'），请基于【原文参考资料】给出详细回答。请务必使用纯文本格式，不要使用 Markdown 标记（如 #, *, - 等）。" : "如果用户要求修改内容，请直接返回修改后的全文 Markdown。\n\n【极度重要】：在进行任何长度、语气或其他文章内容的修改润色时，你必须**绝对保持**文章正文最开头的「标题（如 '# 连载X - ...'）」和最后方的「引流部分（即结尾含有福利、联系方式、引导语等内容，通常由 '---' 分隔或在引用块中）」的**每个字都原封不动**，不允许做任何删改！如果用户纯粹是提问（比如'第四章讲了什么'），请在 chatResponse 中基于【原文参考资料】给出回答，并保持 newContent 为空或原样返回。"}`;
}

export const CHAT_SYSTEM_INSTRUCTION = `You are an expert editor assistant for a "Data Accountability System Construction" report serialization tool. 
          Your goal is to help the editor refine the content based on their requests, or answer questions based on the original report material.
          
          When the user asks for a change or asks a question:
          1. Analyze the request. Use the original report text if they ask about it.
          2. Modify the markdown content accordingly if it is an editing request.
          3. Return a JSON response with two fields:
             - "chatResponse": A brief, professional message to the editor explaining what you changed, providing suggestions, OR answering their question accurately based on the original report text. For suggestions, use plain text only.
             - "newContent": The full, updated markdown content of the article. If no changes were needed or if only a question was asked without requesting edits, omit this field.
          
          Maintain the professional, pain-point-driven, and lead-generation-focused tone of the original serialization plan.`;
