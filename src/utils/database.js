const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const config = require('../config');

// 确保数据目录存在
const dataDir = path.dirname(config.database.path);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

class BotDatabase {
    constructor() {
        this.db = new Database(config.database.path);
        this.db.pragma('journal_mode = WAL');
        this.initTables();
        this.prepareStatements();
        
        logger.info('Database initialized', { path: config.database.path });
    }
    
    initTables() {
        // 对话历史表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                messages TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(chat_id, mode)
            )
        `);
        
        // 用户设置表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_settings (
                chat_id TEXT PRIMARY KEY,
                settings TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 使用统计表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS usage_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                tokens_used INTEGER DEFAULT 0,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 人物存档表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS character_archives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                character_name TEXT NOT NULL,
                character_data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 故事存档表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS story_archives (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                story_title TEXT NOT NULL,
                character_id INTEGER,
                messages TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'roleplay',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (character_id) REFERENCES character_archives(id)
            )
        `);
        
        // Auto-memory 记忆表
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS auto_memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                memory_type TEXT NOT NULL,
                key_name TEXT NOT NULL,
                content TEXT NOT NULL,
                context TEXT,
                importance REAL DEFAULT 0.5,
                last_mentioned DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // ========== 新增：情绪历史表 ==========
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS emotion_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id TEXT NOT NULL,
                emotion TEXT NOT NULL,
                intensity REAL NOT NULL,
                timestamp INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // 创建索引
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(chat_id);
            CREATE INDEX IF NOT EXISTS idx_usage_stats_chat_id ON usage_stats(chat_id);
            CREATE INDEX IF NOT EXISTS idx_usage_stats_timestamp ON usage_stats(timestamp);
            CREATE INDEX IF NOT EXISTS idx_character_archives_chat_id ON character_archives(chat_id);
            CREATE INDEX IF NOT EXISTS idx_story_archives_chat_id ON story_archives(chat_id);
            CREATE INDEX IF NOT EXISTS idx_auto_memories_chat_id ON auto_memories(chat_id);
            CREATE INDEX IF NOT EXISTS idx_auto_memories_mode ON auto_memories(chat_id, mode);
            CREATE INDEX IF NOT EXISTS idx_auto_memories_key_name ON auto_memories(key_name);
            CREATE INDEX IF NOT EXISTS idx_emotion_history_chat_id ON emotion_history(chat_id);
            CREATE INDEX IF NOT EXISTS idx_emotion_history_timestamp ON emotion_history(timestamp);
        `);
    }
    
    prepareStatements() {
        this.statements = {
            // 原有的语句
            getConversation: this.db.prepare(`
                SELECT messages FROM conversations 
                WHERE chat_id = ? AND mode = ?
            `),
            
            saveConversation: this.db.prepare(`
                INSERT OR REPLACE INTO conversations (chat_id, mode, messages, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `),
            
            deleteConversation: this.db.prepare(`
                DELETE FROM conversations 
                WHERE chat_id = ? AND mode = ?
            `),
            
            getUserSettings: this.db.prepare(`
                SELECT settings FROM user_settings 
                WHERE chat_id = ?
            `),
            
            saveUserSettings: this.db.prepare(`
                INSERT OR REPLACE INTO user_settings (chat_id, settings, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `),
            
            recordUsage: this.db.prepare(`
                INSERT INTO usage_stats (chat_id, mode, tokens_used)
                VALUES (?, ?, ?)
            `),
            
            getUsageStats: this.db.prepare(`
                SELECT 
                    COUNT(*) as total_requests,
                    SUM(tokens_used) as total_tokens,
                    MAX(timestamp) as last_usage
                FROM usage_stats 
                WHERE chat_id = ? 
                    AND timestamp > datetime('now', '-30 days')
            `),
            
            // 人物存档相关
            getCharacterArchives: this.db.prepare(`
                SELECT * FROM character_archives 
                WHERE chat_id = ? 
                ORDER BY updated_at DESC 
                LIMIT 10
            `),
            
            getCharacterById: this.db.prepare(`
                SELECT * FROM character_archives 
                WHERE id = ? AND chat_id = ?
            `),
            
            saveCharacterArchive: this.db.prepare(`
                INSERT INTO character_archives (chat_id, character_name, character_data)
                VALUES (?, ?, ?)
            `),
            
            updateCharacterArchive: this.db.prepare(`
                UPDATE character_archives 
                SET character_data = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND chat_id = ?
            `),
            
            deleteCharacterArchive: this.db.prepare(`
                DELETE FROM character_archives 
                WHERE id = ? AND chat_id = ?
            `),
            
            deleteOldestCharacter: this.db.prepare(`
                DELETE FROM character_archives 
                WHERE chat_id = ? AND id = (
                    SELECT id FROM character_archives 
                    WHERE chat_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT 1
                )
            `),
            
            countCharacters: this.db.prepare(`
                SELECT COUNT(*) as count FROM character_archives WHERE chat_id = ?
            `),
            
            // 故事存档相关
            getStoryArchives: this.db.prepare(`
                SELECT s.*, c.character_name 
                FROM story_archives s
                LEFT JOIN character_archives c ON s.character_id = c.id
                WHERE s.chat_id = ? 
                ORDER BY s.updated_at DESC 
                LIMIT 10
            `),
            
            getStoryById: this.db.prepare(`
                SELECT * FROM story_archives 
                WHERE id = ? AND chat_id = ?
            `),
            
            saveStoryArchive: this.db.prepare(`
                INSERT INTO story_archives (chat_id, story_title, character_id, messages, mode)
                VALUES (?, ?, ?, ?, ?)
            `),
            
            updateStoryArchive: this.db.prepare(`
                UPDATE story_archives 
                SET messages = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND chat_id = ?
            `),
            
            deleteStoryArchive: this.db.prepare(`
                DELETE FROM story_archives 
                WHERE id = ? AND chat_id = ?
            `),
            
            deleteOldestStory: this.db.prepare(`
                DELETE FROM story_archives 
                WHERE chat_id = ? AND id = (
                    SELECT id FROM story_archives 
                    WHERE chat_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT 1
                )
            `),
            
            countStories: this.db.prepare(`
                SELECT COUNT(*) as count FROM story_archives WHERE chat_id = ?
            `),
            
            // Auto-memory 相关语句
            saveMemory: this.db.prepare(`
                INSERT INTO auto_memories (chat_id, mode, memory_type, key_name, content, context, importance)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `),
            
            getAllMemories: this.db.prepare(`
                SELECT * FROM auto_memories 
                WHERE chat_id = ? AND mode = ?
                ORDER BY importance DESC, last_mentioned DESC
            `),
            
            getRelevantMemories: this.db.prepare(`
                SELECT * FROM auto_memories 
                WHERE chat_id = ? AND mode = ? AND (key_name LIKE ? OR content LIKE ?)
                ORDER BY importance DESC
                LIMIT ?
            `),
            
            deleteMemory: this.db.prepare(`
                DELETE FROM auto_memories 
                WHERE id = ?
            `),
            
            deleteAllMemories: this.db.prepare(`
                DELETE FROM auto_memories 
                WHERE chat_id = ? AND mode = ?
            `),
            
            getMemoryCount: this.db.prepare(`
                SELECT COUNT(*) as count FROM auto_memories 
                WHERE chat_id = ? AND mode = ?
            `),
            
            // ========== 新增：情绪历史相关语句 ==========
            saveEmotionHistory: this.db.prepare(`
                INSERT INTO emotion_history (chat_id, emotion, intensity, timestamp)
                VALUES (?, ?, ?, ?)
            `),
            
            getEmotionHistory: this.db.prepare(`
                SELECT * FROM emotion_history 
                WHERE chat_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `),
            
            getLatestEmotion: this.db.prepare(`
                SELECT * FROM emotion_history 
                WHERE chat_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            `),
            
            deleteOldEmotions: this.db.prepare(`
                DELETE FROM emotion_history 
                WHERE timestamp < ?
            `),
            
            getEmotionStats: this.db.prepare(`
                SELECT 
                    emotion,
                    COUNT(*) as count,
                    AVG(intensity) as avg_intensity
                FROM emotion_history 
                WHERE chat_id = ? AND timestamp > ?
                GROUP BY emotion
                ORDER BY count DESC
            `)
        };
    }
    
    // 对话管理 - 统一chatId类型
    getConversation(chatId, mode) {
        try {
            const row = this.statements.getConversation.get(String(chatId), mode);
            if (row) {
                return JSON.parse(row.messages);
            }
            return null;
        } catch (error) {
            logger.error('Failed to get conversation', { chatId: String(chatId), mode, error: error.message });
            return null;
        }
    }
    
    saveConversation(chatId, mode, messages) {
        try {
            const messagesJson = JSON.stringify(messages);
            this.statements.saveConversation.run(String(chatId), mode, messagesJson);
            logger.debug('Conversation saved', { chatId: String(chatId), mode, messageCount: messages.length });
        } catch (error) {
            logger.error('Failed to save conversation', { chatId: String(chatId), mode, error: error.message });
        }
    }
    
    deleteConversation(chatId, mode) {
        try {
            this.statements.deleteConversation.run(String(chatId), mode);
            logger.debug('Conversation deleted', { chatId: String(chatId), mode });
        } catch (error) {
            logger.error('Failed to delete conversation', { chatId: String(chatId), mode, error: error.message });
        }
    }
    
    // 用户设置管理 - 统一chatId类型
    getUserSettings(chatId) {
        try {
            const row = this.statements.getUserSettings.get(String(chatId));
            if (row) {
                return JSON.parse(row.settings);
            }
            // 返回默认设置
            return {
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
        } catch (error) {
            logger.error('Failed to get user settings', { chatId: String(chatId), error: error.message });
            return {
                contextWindow: 4096,
                maxTokens: 1500,
                temperature: 0.7
            };
        }
    }
    
    saveUserSettings(chatId, settings) {
        try {
            const settingsJson = JSON.stringify(settings);
            this.statements.saveUserSettings.run(String(chatId), settingsJson);
            logger.debug('User settings saved', { chatId: String(chatId) });
        } catch (error) {
            logger.error('Failed to save user settings', { chatId: String(chatId), error: error.message });
        }
    }
    
    // 使用统计 - 统一chatId类型
    recordUsage(chatId, mode, tokensUsed = 0) {
        try {
            this.statements.recordUsage.run(String(chatId), mode, tokensUsed);
        } catch (error) {
            logger.error('Failed to record usage', { chatId: String(chatId), mode, error: error.message });
        }
    }
    
    getUsageStats(chatId) {
        try {
            return this.statements.getUsageStats.get(String(chatId));
        } catch (error) {
            logger.error('Failed to get usage stats', { chatId: String(chatId), error: error.message });
            return null;
        }
    }
    
    // 人物存档管理 - 统一chatId类型
    saveCharacter(chatId, characterName, characterData) {
        try {
            // 检查数量
            const count = this.statements.countCharacters.get(String(chatId)).count;
            if (count >= 10) {
                // 删除最旧的
                this.statements.deleteOldestCharacter.run(String(chatId), String(chatId));
            }
            
            const result = this.statements.saveCharacterArchive.run(
                String(chatId), 
                characterName, 
                JSON.stringify(characterData)
            );
            
            logger.debug('Character saved', { chatId: String(chatId), characterName, id: result.lastInsertRowid });
            return result.lastInsertRowid;
        } catch (error) {
            logger.error('Failed to save character', { error: error.message });
            return null;
        }
    }
    
    getCharacters(chatId) {
        try {
            const rows = this.statements.getCharacterArchives.all(String(chatId));
            return rows.map(row => ({
                ...row,
                character_data: JSON.parse(row.character_data)
            }));
        } catch (error) {
            logger.error('Failed to get characters', { error: error.message });
            return [];
        }
    }
    
    getCharacter(chatId, characterId) {
        try {
            const row = this.statements.getCharacterById.get(characterId, String(chatId));
            if (row) {
                return {
                    ...row,
                    character_data: JSON.parse(row.character_data)
                };
            }
            return null;
        } catch (error) {
            logger.error('Failed to get character', { error: error.message });
            return null;
        }
    }
    
    updateCharacter(chatId, characterId, characterData) {
        try {
            const result = this.statements.updateCharacterArchive.run(
                JSON.stringify(characterData),
                characterId,
                String(chatId)
            );
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to update character', { error: error.message });
            return false;
        }
    }
    
    deleteCharacter(chatId, characterId) {
        try {
            const result = this.statements.deleteCharacterArchive.run(characterId, String(chatId));
            logger.debug('Character deleted', { chatId: String(chatId), characterId, deleted: result.changes > 0 });
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to delete character', { error: error.message });
            return false;
        }
    }
    
    // 故事存档管理 - 统一chatId类型
    saveStory(chatId, storyTitle, characterId, messages, mode = 'roleplay') {
        try {
            const count = this.statements.countStories.get(String(chatId)).count;
            if (count >= 10) {
                this.statements.deleteOldestStory.run(String(chatId), String(chatId));
            }
            
            const result = this.statements.saveStoryArchive.run(
                String(chatId),
                storyTitle,
                characterId,
                JSON.stringify(messages),
                mode
            );
            
            logger.debug('Story saved', { chatId: String(chatId), storyTitle, id: result.lastInsertRowid });
            return result.lastInsertRowid;
        } catch (error) {
            logger.error('Failed to save story', { error: error.message });
            return null;
        }
    }
    
    getStories(chatId) {
        try {
            const rows = this.statements.getStoryArchives.all(String(chatId));
            return rows.map(row => ({
                ...row,
                messages: JSON.parse(row.messages)
            }));
        } catch (error) {
            logger.error('Failed to get stories', { error: error.message });
            return [];
        }
    }
    
    getStory(chatId, storyId) {
        try {
            const row = this.statements.getStoryById.get(storyId, String(chatId));
            if (row) {
                return {
                    ...row,
                    messages: JSON.parse(row.messages)
                };
            }
            return null;
        } catch (error) {
            logger.error('Failed to get story', { error: error.message });
            return null;
        }
    }
    
    updateStory(chatId, storyId, messages) {
        try {
            const result = this.statements.updateStoryArchive.run(
                JSON.stringify(messages),
                storyId,
                String(chatId)
            );
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to update story', { error: error.message });
            return false;
        }
    }
    
    deleteStory(chatId, storyId) {
        try {
            const result = this.statements.deleteStoryArchive.run(storyId, String(chatId));
            logger.debug('Story deleted', { chatId: String(chatId), storyId, deleted: result.changes > 0 });
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to delete story', { error: error.message });
            return false;
        }
    }
    
    // Auto-memory 管理方法 - 统一chatId类型
    
    // 保存用户手动补充的记忆
    saveUserMemory(chatId, mode, memoryData) {
        try {
            const result = this.statements.saveMemory.run(
                String(chatId),  // 确保是字符串
                mode,
                memoryData.memory_type || 'user_info',
                memoryData.key_name,
                memoryData.content,
                memoryData.context || '用户手动补充的记忆',
                memoryData.importance || 1.0  // 用户手动补充的记忆重要性最高
            );
            logger.debug('User memory saved', { chatId: String(chatId), mode, memoryId: result.lastInsertRowid });
            return result.lastInsertRowid;
        } catch (error) {
            logger.error('Failed to save user memory', { error: error.message });
            return null;
        }
    }
    
    // 保存自动提取的记忆（供memoryExtractor使用）
    saveAutoMemory(chatId, mode, memory) {
        try {
            const result = this.statements.saveMemory.run(
                String(chatId),  // 确保是字符串
                mode,
                memory.memory_type,
                memory.key_name,
                memory.content,
                memory.context || '',
                memory.importance || 0.5
            );
            return result.lastInsertRowid;
        } catch (error) {
            logger.error('Failed to save auto memory', { error: error.message });
            return null;
        }
    }
    
    // 获取所有记忆
    getAllMemories(chatId, mode) {
        try {
            return this.statements.getAllMemories.all(String(chatId), mode);
        } catch (error) {
            logger.error('Failed to get all memories', { error: error.message });
            return [];
        }
    }
    
    // 获取相关记忆
    getRelevantMemories(chatId, mode, keyword, limit = 10) {
        try {
            const searchPattern = `%${keyword}%`;
            return this.statements.getRelevantMemories.all(String(chatId), mode, searchPattern, searchPattern, limit);
        } catch (error) {
            logger.error('Failed to get relevant memories', { error: error.message });
            return [];
        }
    }
    
    // 删除单个记忆
    deleteMemory(chatId, memoryId) {
        try {
            const result = this.statements.deleteMemory.run(memoryId);
            return result.changes > 0;
        } catch (error) {
            logger.error('Failed to delete memory', { error: error.message });
            return false;
        }
    }
    
    // 删除所有记忆 - 修复的关键方法
    deleteAllMemories(chatId, mode) {
        try {
            // 先查询看看有多少条记忆
            const countBefore = this.getMemoryCount(chatId, mode);
            logger.info('Before delete - memory count', { 
                chatId: String(chatId), 
                mode, 
                count: countBefore 
            });
            
            // 执行删除 - 确保chatId是字符串
            const result = this.statements.deleteAllMemories.run(String(chatId), mode);
            
            // 再查询确认
            const countAfter = this.getMemoryCount(chatId, mode);
            logger.info('After delete - memory count', { 
                chatId: String(chatId), 
                mode, 
                countBefore,
                countAfter,
                deletedCount: result.changes 
            });
            
            return result.changes;
        } catch (error) {
            logger.error('Failed to delete all memories', { 
                chatId: String(chatId),
                mode,
                error: error.message 
            });
            return 0;
        }
    }
    
    // 获取记忆数量
    getMemoryCount(chatId, mode) {
        try {
            const result = this.statements.getMemoryCount.get(String(chatId), mode);
            return result ? result.count : 0;
        } catch (error) {
            logger.error('Failed to get memory count', { error: error.message });
            return 0;
        }
    }
    
    // ========== 新增：情绪历史管理方法 ==========
    
    // 保存情绪历史
    saveEmotionHistory(chatId, emotion, intensity) {
        try {
            const result = this.statements.saveEmotionHistory.run(String(chatId), emotion, intensity, Date.now());
            logger.debug('Emotion history saved', { chatId: String(chatId), emotion, intensity, id: result.lastInsertRowid });
            return result.lastInsertRowid;
        } catch (error) {
            logger.error('Failed to save emotion history', { error: error.message });
            return null;
        }
    }
    
    // 获取情绪历史
    getEmotionHistory(chatId, limit = 10) {
        try {
            return this.statements.getEmotionHistory.all(String(chatId), limit);
        } catch (error) {
            logger.error('Failed to get emotion history', { error: error.message });
            return [];
        }
    }
    
    // 获取最新的情绪
    getLatestEmotion(chatId) {
        try {
            return this.statements.getLatestEmotion.get(String(chatId));
        } catch (error) {
            logger.error('Failed to get latest emotion', { error: error.message });
            return null;
        }
    }
    
    // 获取情绪统计
    getEmotionStats(chatId, daysBack = 7) {
        try {
            const timestamp = Date.now() - (daysBack * 24 * 60 * 60 * 1000);
            return this.statements.getEmotionStats.all(String(chatId), timestamp);
        } catch (error) {
            logger.error('Failed to get emotion stats', { error: error.message });
            return [];
        }
    }
    
    // 清理旧的情绪历史
    cleanupEmotionHistory(daysToKeep = 30) {
        try {
            const timestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
            const result = this.statements.deleteOldEmotions.run(timestamp);
            logger.info('Emotion history cleanup completed', {
                deletedRows: result.changes,
                daysKept: daysToKeep
            });
            return result.changes;
        } catch (error) {
            logger.error('Failed to cleanup emotion history', { error: error.message });
            return 0;
        }
    }
    
    // 清理旧数据
    cleanup(daysToKeep = 30) {
        try {
            const result = this.db.prepare(`
                DELETE FROM usage_stats 
                WHERE timestamp < datetime('now', '-${daysToKeep} days')
            `).run();
            
            // 同时清理情绪历史
            this.cleanupEmotionHistory(daysToKeep);
            
            logger.info('Database cleanup completed', { 
                deletedRows: result.changes,
                daysKept: daysToKeep 
            });
        } catch (error) {
            logger.error('Failed to cleanup database', { error: error.message });
        }
    }
    
    close() {
        this.db.close();
        logger.info('Database connection closed');
    }
}

module.exports = new BotDatabase();
