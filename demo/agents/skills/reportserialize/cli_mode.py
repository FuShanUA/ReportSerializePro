import argparse
import fitz
import google.generativeai as genai
import os
import json
import time

# Ensure API Key is loaded
# Try reading from D:\cc\.env
from dotenv import load_dotenv
load_dotenv("D:/cc/.env")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # Try finding it in the React app's .env
    load_dotenv("D:/cc/Library/Tools/reportserialize/.env")
    api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY missing! Set it in D:/cc/.env")
    exit(1)

genai.configure(api_key=api_key)

TONE_MAPPING = {
    'professional': '专业严谨，适合深度行业报告，用词考究，逻辑严密',
    'insightful': '犀利洞察，观点鲜明，直击痛点，适合评论或深度解析',
    'popular': '通俗易懂，化繁为简，多用比喻，适合大众科普或初学者',
    'humorous': '幽默风趣，金句频出，轻松活泼，适合社交媒体传播'
}

def parse_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def generate_plan(report_text, business, tone):
    # Match the React app model (using gemini-2.5-flash which is standard)
    model = genai.GenerativeModel('gemini-2.5-flash')
    prompt = f"""你是一个资深的公众号编辑。请根据以下报告内容，为公司“{business}”规划一个连载系列任务。
    调性要求：{TONE_MAPPING.get(tone, TONE_MAPPING['professional'])}。
    报告内容摘要：{report_text[:15000]}
    
    请输出一个Markdown格式的连载规划，包含：
    1. 连载总名称
    2. 连载目标与受众
    3. 篇目列表（至少6篇），每篇包含标题和核心要点。
    
    请严格按照Markdown格式输出。"""
    
    response = model.generate_content(prompt)
    return response.text

def approve_plan_and_generate_outline(serial_plan, tone):
    model = genai.GenerativeModel('gemini-2.5-flash')
    prompt = f"""根据以下连载规划，生成各篇目的大纲。
    规划内容：{serial_plan}
    调性要求：{TONE_MAPPING.get(tone, TONE_MAPPING['professional'])}
    
    请以JSON格式返回，结构如下：
    {{
      "chapters": [
        {{ "id": 1, "title": "标题", "outline": "大纲内容" }},
        {{ "id": 2, "title": "标题", "outline": "大纲内容" }}
      ]
    }}"""
    response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
    return json.loads(response.text)

def generate_chapter(business, tone, prev_content, outline, title):
    model = genai.GenerativeModel('gemini-2.5-flash')
    prompt = f"""你正在撰写一个连载系列。
    公司业务：{business}
    调性：{TONE_MAPPING.get(tone, TONE_MAPPING['professional'])}
    前序内容回顾：{prev_content[-6000:]}
    当前篇目大纲：{outline}
    
    请撰写本篇（{title}）的完整Markdown内容。"""
    response = model.generate_content(prompt)
    return response.text

def clean_filename(name):
    invalid_chars = '<>:"/\\|?*'
    for char in invalid_chars:
        name = name.replace(char, '_')
    return name

def main():
    parser = argparse.ArgumentParser(description="Report Serialization CLI")
    parser.add_argument("--pdf", required=True, help="Path to PDF")
    parser.add_argument("--business", required=True, help="Company business description")
    parser.add_argument("--tone", choices=list(TONE_MAPPING.keys()), default="professional", help="Writing Tone")
    parser.add_argument("--output-dir", default="./output", help="Output directory")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"[*] Parsing PDF: {args.pdf}")
    text = parse_pdf(args.pdf)

    print("[*] Generating Serizalization Plan...")
    plan = generate_plan(text, args.business, args.tone)
    with open(os.path.join(args.output_dir, "planning.md"), "w", encoding="utf-8") as f:
        f.write(plan)
    print("  -> Saved planning.md")

    print("[*] Expanding Plan into JSON Outlines...")
    outlines = approve_plan_and_generate_outline(plan, args.tone)
    
    prev_content = ""
    for ch in outlines.get("chapters", []):
        print(f"[*] Drafting Chapter {ch.get('id', '?')}: {ch.get('title', 'Unknown')}...")
        try:
            content = generate_chapter(args.business, args.tone, prev_content, ch.get("outline", ""), ch.get("title", ""))
            safe_title = clean_filename(ch.get('title', 'Chap'))
            filename = f"Chapter_{ch.get('id', 'X')}_{safe_title}.md"
            out_path = os.path.join(args.output_dir, filename)
            
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  -> Saved {filename}")
            
            prev_content += content + "\n\n"
        except Exception as e:
            print(f"  [!] Failed to generate chapter {ch.get('id')}: {str(e)}")
            
        # Optional delay to avoid ratelimits
        time.sleep(2)
        
    print(f"\n[+] Success! All files saved to {args.output_dir}")

if __name__ == "__main__":
    main()
