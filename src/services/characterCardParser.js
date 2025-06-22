const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');

class CharacterCardParser {
    constructor() {
        // 统一的角色卡格式
        this.standardFormat = {
            name: '',
            description: '',
            personality: '',
            scenario: '',
            first_mes: '',
            mes_example: '',
            creator: '',
            version: '1.0',
            tags: [],
            // 扩展字段（用于成人内容）
            nsfw: false,
            fetishes: [],
            body_features: '',
            clothing: '',
            relationships: ''
        };
    }

    /**
     * 解析任意格式的角色卡
     * @param {Buffer} fileBuffer - 文件缓冲区
     * @param {string} fileName - 文件名（用于判断类型）
     * @returns {Object} 解析后的角色数据
     */
    async parseCharacterCard(fileBuffer, fileName) {
        const ext = path.extname(fileName).toLowerCase();
        
        try {
            switch (ext) {
                case '.json':
                    return await this.parseJSON(fileBuffer);
                case '.txt':
                    return await this.parseTXT(fileBuffer);
                case '.png':
                    return await this.parsePNG(fileBuffer);
                default:
                    throw new Error(`不支持的文件格式: ${ext}`);
            }
        } catch (error) {
            logger.error('Character card parsing error', { fileName, error: error.message });
            throw error;
        }
    }

    /**
     * 解析JSON格式
     */
    async parseJSON(buffer) {
        try {
            const jsonStr = buffer.toString('utf8');
            const data = JSON.parse(jsonStr);
            
            // 支持多种JSON格式
            return this.normalizeCharacterData(data);
        } catch (error) {
            throw new Error('JSON解析失败: ' + error.message);
        }
    }

    /**
     * 解析TXT格式
     */
    async parseTXT(buffer) {
        const text = buffer.toString('utf8');
        const lines = text.split('\n');
        const character = { ...this.standardFormat };
        
        let currentSection = '';
        let multilineContent = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // 跳过空行
            if (!trimmed) continue;
            
            // 检查是否是新的字段
            if (trimmed.includes('：') || trimmed.includes(':')) {
                // 保存之前的多行内容
                if (currentSection && multilineContent.length > 0) {
                    character[this.mapTxtField(currentSection)] = multilineContent.join('\n').trim();
                    multilineContent = [];
                }
                
                const [field, ...valueParts] = trimmed.split(/[:：]/);
                currentSection = field.trim();
                const value = valueParts.join(':').trim();
                
                if (value) {
                    character[this.mapTxtField(currentSection)] = value;
                    currentSection = '';
                }
            } else if (currentSection) {
                // 多行内容
                multilineContent.push(trimmed);
            }
        }
        
        // 处理最后的多行内容
        if (currentSection && multilineContent.length > 0) {
            character[this.mapTxtField(currentSection)] = multilineContent.join('\n').trim();
        }
        
        return this.normalizeCharacterData(character);
    }

    /**
     * 解析PNG格式（SillyTavern兼容）
     */
    async parsePNG(buffer) {
        try {
            // 使用sharp读取PNG元数据
            const metadata = await sharp(buffer).metadata();
            
            // 获取文本块
            const image = sharp(buffer);
            const { info } = await image.toBuffer({ resolveWithObject: true });
            
            // SillyTavern将角色数据存储在tEXt块中
            // 需要直接读取PNG块
            const characterData = await this.extractPNGTextChunks(buffer);
            
            if (characterData) {
                return this.normalizeCharacterData(characterData);
            }
            
            throw new Error('PNG中未找到角色数据');
        } catch (error) {
            throw new Error('PNG解析失败: ' + error.message);
        }
    }

    /**
     * 从PNG提取文本块
     */
    async extractPNGTextChunks(buffer) {
        // PNG文件结构解析
        const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        
        if (!buffer.slice(0, 8).equals(PNG_SIGNATURE)) {
            throw new Error('无效的PNG文件');
        }
        
        let offset = 8;
        let characterData = null;
        
        while (offset < buffer.length) {
            // 读取块长度
            const length = buffer.readUInt32BE(offset);
            offset += 4;
            
            // 读取块类型
            const type = buffer.slice(offset, offset + 4).toString('ascii');
            offset += 4;
            
            // 读取块数据
            const data = buffer.slice(offset, offset + length);
            offset += length;
            
            // 跳过CRC
            offset += 4;
            
            // 检查是否是tEXt块
            if (type === 'tEXt' || type === 'iTXt') {
                const text = data.toString('utf8');
                
                // SillyTavern格式：chara\0{json_data}
                if (text.startsWith('chara\0')) {
                    const jsonStr = text.substring(6);
                    try {
                        const decoded = Buffer.from(jsonStr, 'base64').toString('utf8');
                        characterData = JSON.parse(decoded);
                        break;
                    } catch (e) {
                        // 尝试直接解析
                        try {
                            characterData = JSON.parse(jsonStr);
                            break;
                        } catch (e2) {
                            continue;
                        }
                    }
                }
            }
            
            // 到达结尾块
            if (type === 'IEND') break;
        }
        
        return characterData;
    }

    /**
     * TXT字段映射
     */
    mapTxtField(field) {
        const fieldMap = {
            '名称': 'name',
            '名字': 'name',
            'name': 'name',
            '描述': 'description',
            'description': 'description',
            '性格': 'personality',
            'personality': 'personality',
            '场景': 'scenario',
            'scenario': 'scenario',
            '初始消息': 'first_mes',
            'first_mes': 'first_mes',
            '对话示例': 'mes_example',
            'mes_example': 'mes_example',
            '创建者': 'creator',
            'creator': 'creator',
            '标签': 'tags',
            'tags': 'tags',
            '成人': 'nsfw',
            'nsfw': 'nsfw',
            '癖好': 'fetishes',
            'fetishes': 'fetishes',
            '身体特征': 'body_features',
            'body_features': 'body_features',
            '服装': 'clothing',
            'clothing': 'clothing',
            '关系': 'relationships',
            'relationships': 'relationships'
        };
        
        return fieldMap[field.toLowerCase()] || field.toLowerCase();
    }

    /**
     * 标准化角色数据
     */
    normalizeCharacterData(data) {
        const normalized = { ...this.standardFormat };
        
        // 映射常见字段名
        const fieldMappings = {
            'char_name': 'name',
            'char_persona': 'personality',
            'world_scenario': 'scenario',
            'char_greeting': 'first_mes',
            'example_dialogue': 'mes_example',
            'char_desc': 'description'
        };
        
        // 应用映射
        for (const [key, value] of Object.entries(data)) {
            const mappedKey = fieldMappings[key] || key;
            if (normalized.hasOwnProperty(mappedKey)) {
                normalized[mappedKey] = value;
            }
        }
        
        // 处理特殊字段
        if (typeof normalized.tags === 'string') {
            normalized.tags = normalized.tags.split(/[,，、]/).map(t => t.trim()).filter(t => t);
        }
        
        if (typeof normalized.fetishes === 'string') {
            normalized.fetishes = normalized.fetishes.split(/[,，、]/).map(t => t.trim()).filter(t => t);
        }
        
        // 检测是否为成人内容
        if (!normalized.nsfw) {
            const adultKeywords = ['成人', '18+', 'nsfw', 'adult', '调教', '主人', '性奴'];
            const allText = Object.values(normalized).join(' ').toLowerCase();
            normalized.nsfw = adultKeywords.some(keyword => allText.includes(keyword));
        }
        
        // 验证必需字段
        if (!normalized.name) {
            throw new Error('角色卡缺少名称');
        }
        
        return normalized;
    }

    /**
     * 生成角色描述（用于召唤）
     */
    generateCharacterPrompt(character) {
        let prompt = `角色名：${character.name}\n\n`;
        
        if (character.description) {
            prompt += `描述：${character.description}\n\n`;
        }
        
        if (character.personality) {
            prompt += `性格：${character.personality}\n\n`;
        }
        
        if (character.scenario) {
            prompt += `背景设定：${character.scenario}\n\n`;
        }
        
        if (character.body_features) {
            prompt += `身体特征：${character.body_features}\n\n`;
        }
        
        if (character.clothing) {
            prompt += `服装：${character.clothing}\n\n`;
        }
        
        if (character.relationships) {
            prompt += `关系：${character.relationships}\n\n`;
        }
        
        if (character.fetishes && character.fetishes.length > 0) {
            prompt += `特殊偏好：${character.fetishes.join('、')}\n\n`;
        }
        
        if (character.first_mes) {
            prompt += `初始消息：${character.first_mes}\n\n`;
        }
        
        if (character.mes_example) {
            prompt += `对话风格示例：\n${character.mes_example}`;
        }
        
        return prompt;
    }

    /**
     * 导出为标准格式
     */
    exportToJSON(character) {
        return JSON.stringify(character, null, 2);
    }

    exportToTXT(character) {
        let txt = '';
        
        txt += `名称：${character.name}\n`;
        if (character.description) txt += `描述：${character.description}\n`;
        if (character.personality) txt += `性格：${character.personality}\n`;
        if (character.scenario) txt += `场景：${character.scenario}\n`;
        if (character.first_mes) txt += `初始消息：${character.first_mes}\n`;
        if (character.mes_example) txt += `对话示例：\n${character.mes_example}\n`;
        if (character.creator) txt += `创建者：${character.creator}\n`;
        if (character.tags.length > 0) txt += `标签：${character.tags.join('、')}\n`;
        
        if (character.nsfw) {
            txt += `\n===成人内容===\n`;
            if (character.body_features) txt += `身体特征：${character.body_features}\n`;
            if (character.clothing) txt += `服装：${character.clothing}\n`;
            if (character.relationships) txt += `关系：${character.relationships}\n`;
            if (character.fetishes.length > 0) txt += `癖好：${character.fetishes.join('、')}\n`;
        }
        
        return txt;
    }
}

module.exports = new CharacterCardParser();
