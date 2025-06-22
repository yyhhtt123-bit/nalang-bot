const logger = require('./utils/logger');
const TelegramBotService = require('./services/telegram');
const database = require('./utils/database');

// 全局错误处理
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason, promise });
});

// 优雅关闭
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

let bot;

async function shutdown() {
    logger.info('Shutting down...');
    
    try {
        if (bot) {
            await bot.stop();
        }
        database.close();
        logger.info('Shutdown complete');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
    }
}

// 启动应用
async function start() {
    try {
        logger.info('Starting NalangAI Telegram Bot...');
        
        // 创建并启动bot
        bot = new TelegramBotService();
        
        logger.info('Bot started successfully');
        
        // 显示启动信息
        console.log(`
╔════════════════════════════════════════╗
║      NalangAI Telegram Bot v2.0                                               ║
║                                                                                                    ║
║  Status: ✅ Running                                                                  ║
║  Mode: ${process.env.NODE_ENV || 'production'}                  ║
║  Log Level: ${process.env.LOG_LEVEL || 'info'}                         ║
║                                                                                                    ║
║  Press Ctrl+C to stop                                                                 ║
╚════════════════════════════════════════╝
        `);
        
    } catch (error) {
        logger.error('Failed to start bot', { error: error.message });
        process.exit(1);
    }
}

// 启动
start();
