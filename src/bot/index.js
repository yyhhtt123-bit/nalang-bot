// bot/index.js
const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const config = require('../config');
const database = require('../utils/database');

// 导入模块
const StateManager = require('./modules/state');
const CommandHandler = require('./handlers/command');
const CallbackHandler = require('./handlers/callback');
const MessageHandler = require('./handlers/message');
const DocumentHandler = require('./handlers/document');

class TelegramBotService {
    constructor() {
        // 初始化 bot
        this.bot = new TelegramBot(config.telegram.token, { 
            polling: {
                interval: 300,
                autoStart: true,
                params: { timeout: 10 }
            }
        });
        
        // 初始化状态管理器
        this.stateManager = new StateManager();
        
        // 初始化处理器
        this.handlers = {
            command: new CommandHandler(this.bot, this.stateManager),
            callback: new CallbackHandler(this.bot, this.stateManager),
            message: new MessageHandler(this.bot, this.stateManager),
            document: new DocumentHandler(this.bot, this.stateManager)
        };
        
        // 设置事件监听器
        this.setupEventListeners();
        
        logger.info('Telegram bot service initialized (refactored)');
    }
    
    setupEventListeners() {
        // 消息处理
        this.bot.on('message', async (msg) => {
            try {
                if (msg.document) {
                    await this.handlers.document.handle(msg);
                } else if (msg.text?.startsWith('/')) {
                    await this.handlers.command.handle(msg);
                } else if (msg.text) {
                    await this.handlers.message.handle(msg);
                }
            } catch (error) {
                logger.error('Message handling error', { error: error.message });
                await this.bot.sendMessage(msg.chat.id, '[错误] 处理消息时出错，请稍后重试。');
            }
        });
        
        // 文档处理
        this.bot.on('document', async (msg) => {
            try {
                await this.handlers.document.handle(msg);
            } catch (error) {
                logger.error('Document handling error', { error: error.message });
            }
        });
        
        // 回调查询处理
        this.bot.on('callback_query', async (query) => {
            try {
                await this.handlers.callback.handle(query);
            } catch (error) {
                logger.error('Callback query error', { error: error.message });
            }
        });
        
        // 错误处理
        this.bot.on('polling_error', (error) => {
            logger.error('Telegram polling error', { error: error.message });
        });
        
        // 定期清理
        setInterval(() => {
            database.cleanup(30);
        }, 24 * 60 * 60 * 1000);
    }
    
    async stop() {
        await this.bot.stopPolling();
        logger.info('Telegram bot stopped');
    }
}

module.exports = TelegramBotService;
