// 简单的颜色输出（可选）
const colors = {
    error: '\x1b[31m',   // 红色
    warn: '\x1b[33m',    // 黄色
    info: '\x1b[36m',    // 青色
    debug: '\x1b[90m',   // 灰色
    reset: '\x1b[0m'     // 重置
};

// 格式化时间
function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

// 格式化日志消息
function formatMessage(level, message, meta) {
    const timestamp = getTimestamp();
    const color = colors[level] || '';
    const reset = colors.reset;
    
    let log = `${color}[${timestamp}] [${level.toUpperCase()}]${reset}: ${message}`;
    
    if (meta && Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
}

// 导出日志方法
module.exports = {
    error(message, meta) {
        console.error(formatMessage('error', message, meta));
    },
    
    warn(message, meta) {
        console.warn(formatMessage('warn', message, meta));
    },
    
    info(message, meta) {
        console.log(formatMessage('info', message, meta));
    },
    
    debug(message, meta) {
        // 只在开发模式下输出debug日志
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            console.log(formatMessage('debug', message, meta));
        }
    }
};
