# 创建部署脚本
cat > deploy.sh << 'EOF'
#!/bin/bash

echo "������ 开始部署 NalangAI Bot..."

# 1. 创建package.json
cat > package.json << 'PACKAGE'
{
  "name": "nalang-telegram-bot",
  "version": "1.0.0",
  "description": "NalangAI Telegram Bot",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "pm2": "pm2 start src/index.js --name nalang-bot"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.64.0",
    "node-fetch": "^2.7.0"
  }
}
PACKAGE

# 2. 创建主程序文件
cat > src/index.js << 'MAINCODE'
[[2]]
MAINCODE

# 3. 创建参考文件
cat > src/nalang-example.js << 'EXAMPLE'
[[1]]
EXAMPLE

# 4. 创建PM2配置
cat > ecosystem.config.js << 'PM2CONFIG'
module.exports = {
  apps: [{
    name: 'nalang-bot',
    script: './src/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
PM2CONFIG

# 5. 创建启动脚本
cat > start.sh << 'START'
#!/bin/bash
echo "启动 NalangAI Bot..."
pm2 start ecosystem.config.js
pm2 logs
START

# 6. 创建停止脚本
cat > stop.sh << 'STOP'
#!/bin/bash
echo "停止 NalangAI Bot..."
pm2 stop nalang-bot
pm2 delete nalang-bot
STOP

# 7. 创建重启脚本
cat > restart.sh << 'RESTART'
#!/bin/bash
echo "重启 NalangAI Bot..."
pm2 restart nalang-bot
pm2 logs --lines 50
RESTART

# 8. 创建日志查看脚本
cat > logs.sh << 'LOGS'
#!/bin/bash
pm2 logs nalang-bot --lines 100
LOGS

# 设置脚本权限
chmod +x *.sh

echo "✅ 文件创建完成！"
EOF

# 执行部署脚本
chmod +x deploy.sh
