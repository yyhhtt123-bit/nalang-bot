const logger = require('./utils/logger');
const database = require('./utils/database');
const TelegramBotService = require('./bot'); // 使用重构后的版本

async function main() {
    try {
        // 数据库已经在 require 时自动初始化了，不需要调用 init
        logger.info('Database ready', { 
            path: database.db?.name || './data/bot.db' 
        });
        
        // 启动 Telegram Bot
        const bot = new TelegramBotService();
        logger.info('Bot started successfully (refactored version)');
        
        // 优雅关闭
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await bot.stop();
            database.close(); // database.js 有 close 方法
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.info('Shutting down...');
            await bot.stop();
            database.close(); // database.js 有 close 方法
            process.exit(0);
        });
        
        // 处理未捕获的异常
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });
        
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', { reason, promise });
            process.exit(1);
        });
        
    } catch (error) {
        logger.error('Failed to start application', { error: error.message });
        process.exit(1);
    }
}

// 启动应用
main();
