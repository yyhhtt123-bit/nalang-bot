// emotionSystem.js

// 基础情绪状态定义
const EMOTION_STATES = {
    desire: {
        name: '欲望',
        type: '情感',
        description: '强烈的渴望、性欲或情感上的需求。'
    },
    passion: {
        name: '激情',
        type: '情感',
        description: '充满热情或兴奋的状态。'
    },
    intimacy: {
        name: '亲密',
        type: '情感',
        description: '与他人建立深度连接的渴望或感受。'
    },
    curiosity: {
        name: '好奇',
        type: '情感',
        description: '对未知事物的兴趣或探索的渴望。'
    },
    fantasy: {
        name: '幻想',
        type: '情感',
        description: '沉浸于某种情感或性相关的想象中。'
    },
    jealousy: {
        name: '嫉妒',
        type: '情感',
        description: '因他人占有某物或情感而产生的不满。'
    },
    satisfaction: {
        name: '满足',
        type: '情感',
        description: '感受到需求或愿望得到满足的状态。'
    },
    frustration: {
        name: '挫败',
        type: '情感',
        description: '因无法实现目标或欲望而感到沮丧。'
    },
    dominance: {
        name: '支配',
        type: '性情趣',
        description: '对他人产生控制或权威的需求。'
    },
    submission: {
        name: '臣服',
        type: '性情趣',
        description: '愿意被他人引导或支配的渴望。'
    },
    flirtation: {
        name: '调情',
        type: '情趣',
        description: '通过语言或行为表达轻度的吸引或挑逗。'
    },
    arousal: {
        name: '唤起',
        type: '性欲',
        description: '身体或情感上的性兴奋状态。'
    }
};

// 情绪触发词（关键词）
const EMOTION_TRIGGERS = {
    desire: ['渴望', '想要', '需求', '性欲'],
    passion: ['热情', '激情', '兴奋'],
    intimacy: ['亲密', '依赖', '靠近'],
    curiosity: ['好奇', '探索', '尝试'],
    fantasy: ['幻想', '想象', '做梦'],
    jealousy: ['嫉妒', '吃醋', '不满'],
    satisfaction: ['满足', '愉悦', '高兴'],
    frustration: ['挫败', '沮丧', '失落'],
    dominance: ['支配', '掌控', '命令'],
    submission: ['臣服', '服从', '屈服'],
    flirtation: ['调情', '挑逗', '吸引'],
    arousal: ['兴奋', '性兴奋', '唤起']
};

// 情绪响应（基于情绪的动态反馈）
const EMOTION_RESPONSES = {
    desire: [
        '我感受到了你的渴望，想要聊聊吗？',
        '告诉我，你现在最想要的是什么？'
    ],
    passion: [
        '你的激情真是让人着迷！',
        '看得出来你充满了热情，继续保持！'
    ],
    intimacy: [
        '亲密的连接让人感到温暖。',
        '你想要的是更深的交流，对吗？'
    ],
    curiosity: [
        '好奇心是探索新世界的起点。',
        '有什么你特别想知道的？'
    ],
    fantasy: [
        '你的幻想世界一定很美妙。',
        '愿意分享你的想象吗？'
    ],
    jealousy: [
        '嫉妒是一种复杂的感受，想聊一聊吗？',
        '或许表达你的感受会让你更轻松。'
    ],
    satisfaction: [
        '满足感让人感到幸福。',
        '真好，继续享受这种状态吧！'
    ],
    frustration: [
        '挫败感有时难以避免，但你可以克服。',
        '想聊聊让你感到挫败的事情吗？'
    ],
    dominance: [
        '你似乎喜欢掌控一切，这很有趣。',
        '你的支配欲望让我感到好奇。'
    ],
    submission: [
        '臣服并不是弱点，而是一种信任。',
        '愿意分享更多你的内心感受吗？'
    ],
    flirtation: [
        '调情是一种微妙的艺术。',
        '你的语言充满了吸引力。'
    ],
    arousal: [
        '你似乎处于兴奋状态，想继续聊聊吗？',
        '这样的情绪很自然，让我们继续吧。'
    ]
};

// 获取情绪强度描述
function getIntensityDescription(intensity) {
    if (intensity > 0.8) return '非常强烈';
    if (intensity > 0.5) return '中等强度';
    return '较低强度';
}

// 生成情绪强度条（用于可视化表示情绪强度）
function getEmotionBar(intensity) {
    const barLength = 20; // 条的总长度
    const filledLength = Math.round(intensity * barLength);
    return '█'.repeat(filledLength) + '-'.repeat(barLength - filledLength);
}

// 根据用户输入检测情绪
function detectEmotion(input) {
    for (const [emotion, triggers] of Object.entries(EMOTION_TRIGGERS)) {
        if (triggers.some(trigger => input.includes(trigger))) {
            return emotion;
        }
    }
    return null; // 未匹配到情绪
}

module.exports = {
    EMOTION_STATES,
    EMOTION_TRIGGERS,
    EMOTION_RESPONSES,
    getIntensityDescription,
    getEmotionBar,
    detectEmotion
};
