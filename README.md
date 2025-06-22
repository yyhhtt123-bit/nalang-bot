# NaLang Telegram Bot
一个功能强大的多模型 AI Telegram Bot，支持 NaLang、Gemini、DeepSeek 等多种 
AI 模型。
## ✨ 功能特点
### 🤖 多模型支持
- **NaLang 系列**：NaLang-XL（推荐）、NaLang-Turbo - **Google Gemini 
系列**：Gemini 2.0/2.5 Flash、Gemini Thinking、Gemma 27B - **DeepSeek 
系列**：DeepSeek V3、DeepSeek R1
### 💬 五种对话模式
- **通用模式**：标准 AI 助手，适合日常对话 - 
**成人模式**：更开放的内容创作（仅限成年人） - **角色扮演**：AI 扮演所有 
NPC，沉浸式体验 - **忏悔室**：特殊的角色扮演场景 - 
**召唤大师**：通过描述创造独特的 AI 角色
### 🧠 智能记忆系统
- 自动提取并记住重要信息 - 15 种记忆分类管理 - 手动添加永久记忆 - 
记忆搜索和导出功能
### 📚 档案管理系统
- 保存召唤的角色（最多 10 个） - 保存角色扮演故事 - 支持故事续写 - 
角色卡导入导出（支持 JSON、TXT、PNG 格式）
### ⚙️ 个性化设置
- 上下文窗口：2048/4096/8192 tokens - 输出长度：500-2000 tokens - 
Temperature：0.5-0.9 - 实时切换 AI 模型
## 🚀 快速开始
### 环境要求
- Node.js 18.x 或更高版本 - npm 或 yarn - SQLite3
### 安装步骤
1. 克隆项目 ```bash git clone https://github.com/你的用户名/nalang-bot.git 
cd nalang-bot 安装依赖 bash npm install 配置环境变量 bash cp .env.example 
.env nano .env # 编辑并填入你的配置 创建必要目录 bash mkdir -p data logs 
启动机器人 bash npm start 使用 PM2 管理（推荐） bash npm install -g pm2 pm2 
start src/index.js --name nalang-bot pm2 save pm2 startup 📖 使用指南 
基本命令 /start - 开始使用机器人 /menu - 显示主菜单 /reset - 重置当前对话 
/summon <描述> - 召唤角色 /memory <内容> - 添加记忆 /memories - 查看 AI 
的记忆 /forget <关键词> - 删除特定记忆 /stats - 查看使用统计 /help - 
获取帮助信息 使用流程 使用 /start 启动机器人 使用 /menu 选择对话模式 开始与 
AI 对话 可随时切换模型或调整设置 🔧 配置说明 必需的环境变量 
TELEGRAM_TOKEN：Telegram Bot Token 至少配置一个 AI 服务的 API Key AI 
服务配置 NALANG_API_KEYS：NaLang API 密钥（多个用逗号分隔） 
GEMINI_API_KEYS：Gemini API 密钥（多个用逗号分隔） 
CHUTES_API_TOKEN：DeepSeek API Token 其他配置 ADMIN_IDS：管理员 Telegram 
ID（多个用逗号分隔） DATABASE_PATH：数据库路径（默认 ./data/bot.db） 
LOG_LEVEL：日志级别（默认 info） 📁 项目结构 javascript nalang-bot/ ├── 
src/ │ ├── bot/ # Telegram Bot 核心逻辑 │ ├── services/ # AI 服务接口 │ ├── 
utils/ # 工具函数 │ ├── config/ # 配置管理 │ ├── prompts/ # AI 提示词 │ └── 
index.js # 程序入口 ├── data/ # 数据库文件 ├── logs/ # 日志文件 ├── 
.env.example # 环境变量示例 ├── package.json # 项目依赖 └── README.md # 
项目说明 🛡️ 安全说明 对话历史保存 30 天后自动删除 每个用户的数据完全隔离 
支持多种内容过滤模式 请勿分享你的 API 密钥 🤝 贡献指南 欢迎提交 Issue 和 
Pull Request！ 📄 许可证 MIT License 🙏 致谢
感谢所有 AI 服务提供商和开源社区的支持。
