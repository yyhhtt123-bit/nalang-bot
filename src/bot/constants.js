module.exports = {
    // 模式名称映射
    MODE_NAMES: {
        general: '通用模式',
        adult: '成人模式',
        roleplay: '角色扮演模式',
        confession: '忏悔室模式',
        summon: '召唤模式'
    },
    
    // 内存类型名称
    MEMORY_TYPE_NAMES: {
        character: '角色',
        location: '场景',
        item: '物品',
        event: '事件',
        relationship: '关系',
        bodyFeatures: '身体特征',
        clothing: '服装',
        actions: '动作',
        sensations: '感觉',
        roles: '角色关系',
        scenarios: '场景设定',
        fetishes: '特殊偏好',
        user_info: '用户信息',
        preference: '用户偏好',
        dislike: '用户厌恶',
        nickname: '昵称偏好',
        safeword: '安全词'
    },
    
    // 更新间隔
    UPDATE_INTERVAL: 300, // 流式更新间隔 ms
    CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 清理间隔 24小时
    
    // 限制
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_CHARACTERS: 10,
    MAX_STORIES: 10,
    
    // 默认设置
    DEFAULT_SETTINGS: {
        model: 'nalang-xl',
        contextWindow: 4096,
        maxTokens: 1500,
        temperature: 0.7
    }
};
