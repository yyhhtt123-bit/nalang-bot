require('dotenv').config();

// 简单直接的配置
const config = {
    telegram: {
        token: process.env.TELEGRAM_TOKEN
    },
    nalang: {
        apiKeys: process.env.NALANG_API_KEYS?.split(',').filter(k => k.trim()) || [],
        apiUrl: process.env.NALANG_API_URL || 'https://www.gpt4novel.com/api/xiaoshuoai/ext/v1/chat/completions'
    },
    gemini: {
        apiKeys: process.env.GEMINI_API_KEYS?.split(',').filter(k => k.trim()) || [],
        apiUrl: process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com'
    },
    chutes: {
        apiToken: process.env.CHUTES_API_TOKEN,
        apiUrl: process.env.CHUTES_API_URL || 'https://llm.chutes.ai/v1/chat/completions'
    },
    admin: {
        ids: process.env.ADMIN_IDS?.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) || []
    },
    database: {
        path: process.env.DATABASE_PATH || './data/bot.db'
    }
};

// 简单的必需配置检查
if (!config.telegram.token) {
    console.error('[错误] 未设置 TELEGRAM_TOKEN');
    process.exit(1);
}

// 至少要有一个AI服务可用
const hasAnyAI = (config.nalang.apiKeys.length > 0) || 
                 (config.gemini.apiKeys.length > 0) || 
                 (config.chutes.apiToken);

if (!hasAnyAI) {
    console.error('[错误] 至少需要配置一个AI服务（NaLang、Gemini或Chutes/DeepSeek）');
    process.exit(1);
}

module.exports = config;
