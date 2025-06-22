const logger = require('../utils/logger');

class MemoryExtractor {
    constructor() {
        // 通用记忆模式（增强成人内容）
        this.patterns = {
            // 角色相关模式
            character: {
                // 通用职业/身份
                titles: ['老板', '老板娘', '店主', '掌柜', '守卫', '骑士', '法师', '战士', '盗贼', '商人', '冒险者', '佣兵', '贵族', '平民', '农民', '工匠', '学者', '祭司', '修女', '僧侣', '医生', '护士', '厨师', '侍者', '管家', '仆人'],
                // 成人相关身份
                adultTitles: ['主人', '奴隶', '女仆', '执事', '调教师', '性奴', '母狗', '公狗', '玩物', '宠物', '妓女', '娼妇', '荡妇', '淫妇', '骚货', '贱人', '肉便器', '飞机杯', '精液便所', '肉奴', '性玩具', '公交车', '破鞋', '婊子', '母猪', '发情母狗', '精盆'],
                // 描述性关键词
                descriptors: ['是', '叫', '名为', '名叫', '自称', '被称为', '是一个', '是一位', '是个', '担任', '职业是', '身份是', '沦为', '变成', '堕落为', '被调教成'],
                // 外貌关键词（增强成人描述）
                appearance: ['头发', '眼睛', '身高', '身材', '穿着', '戴着', '拿着', '背着', '年龄', '岁', '外貌', '长相', '肤色', '瞳色', '乳房', '胸部', '乳头', '乳晕', '臀部', '屁股', '阴部', '下体', '私处', '小穴', '肉穴', '蜜穴', '淫穴', '骚穴', '阴道', '阴唇', '阴蒂', '子宫', '花心', 'G点', '肛门', '后穴', '菊花', '阳具', '肉棒', '鸡巴', '阴茎', '龟头', '睾丸', '蛋蛋']
            },
            // 地点相关模式
            location: {
                // 通用地点
                types: ['酒馆', '旅店', '客栈', '城市', '城镇', '村庄', '村落', '森林', '山脉', '山谷', '河流', '湖泊', '海洋', '洞穴', '神殿', '教堂', '城堡', '宫殿', '市场', '广场', '街道', '小巷', '房间', '大厅', '地下室', '阁楼', '花园', '庭院'],
                // 成人场所
                adultTypes: ['卧室', '浴室', '地牢', '密室', '调教室', '刑房', '拷问室', 'SM室', '红灯区', '妓院', '风俗店', '夜总会', '脱衣舞俱乐部', '成人影院', '情趣酒店', '换妻俱乐部', '性爱派对', '淫窟', '肉欲横流之地', '堕落之所', '奴隶市场', '人体改造所', '洗脑室', '催眠室', '触手巢穴', '兽人营地', '魔物巢穴'],
                // 方位词
                directions: ['位于', '坐落', '在', '前往', '来到', '进入', '离开', '经过', '穿过', '北方', '南方', '东方', '西方', '附近', '远处', '深处', '内部', '外部']
            },
            // 物品相关模式
            item: {
                // 通用物品
                types: ['武器', '剑', '刀', '斧', '弓', '箭', '法杖', '盾牌', '铠甲', '头盔', '护手', '靴子', '戒指', '项链', '护身符', '药水', '卷轴', '书籍', '地图', '钥匙', '宝石', '金币', '银币', '铜币', '背包', '绳索', '火把'],
                // 成人用品
                adultTypes: ['项圈', '锁链', '手铐', '脚镣', '口球', '口枷', '眼罩', '皮鞭', '藤条', '教鞭', '马鞭', '电击棒', '震动棒', '按摩棒', '跳蛋', '拉珠', '肛塞', '扩张器', '灌肠器', '导尿管', '贞操带', '乳夹', '乳环', '阴环', '穿孔', '纹身', '烙印', '项圈', '狗链', '笼子', '拘束衣', '驷马', '十字架', '木马', '三角木马', '电动木马', '触手', '催情药', '春药', '媚药', '迷药', '精液', '爱液', '淫水', '润滑剂', '避孕套', '验孕棒'],
                // 动作词
                actions: ['拥有', '持有', '装备', '携带', '得到', '获得', '发现', '找到', '购买', '出售', '交易', '赠送', '收到', '偷取', '掉落', '使用', '插入', '塞入', '灌入', '注入', '涂抹', '穿戴', '锁上', '解开']
            },
            // 事件相关模式
            event: {
                // 通用事件
                keywords: ['发生', '遭遇', '遇到', '触发', '完成', '开始', '结束', '打败', '击败', '战胜', '失败', '逃跑', '死亡', '复活', '觉醒', '发现', '解开', '破解', '达成', '失去', '背叛', '联盟', '结婚', '分离'],
                // 成人事件
                adultKeywords: ['高潮', '射精', '潮吹', '失禁', '排泄', '怀孕', '生产', '流产', '堕胎', '破处', '失身', '轮奸', '群交', '3P', '多P', '换妻', '出轨', '偷情', 'NTR', '绿帽', '调教', '训练', '驯服', '征服', '臣服', '屈服', '堕落', '觉醒', '开发', '改造', '洗脑', '催眠', '控制', '支配', '虐待', '折磨', '羞辱', '暴露', '露出', '公开', '直播', '拍摄', '录像', '卖淫', '援交', '拍卖', '交易', '共享'],
                // 时间词
                temporal: ['之前', '之后', '现在', '刚才', '昨天', '今天', '明天', '早上', '中午', '下午', '晚上', '夜晚', '黎明', '黄昏', '每天', '每夜', '经常', '总是', '永远']
            },
            // 关系相关模式
            relationship: {
                // 通用关系
                types: ['朋友', '敌人', '盟友', '对手', '师父', '徒弟', '父亲', '母亲', '儿子', '女儿', '兄弟', '姐妹', '丈夫', '妻子', '情人', '恋人'],
                // 成人关系
                adultTypes: ['主人', '奴隶', '主', '奴', 'S', 'M', 'Dom', 'Sub', '支配者', '被支配者', '施虐者', '受虐者', '调教师', '被调教者', '性伴侣', '炮友', '情妇', '情夫', '小三', '二奶', '包养', '金主', '干爹', '干妈', '性奴', '肉便器', '公用', '共享', '所有物', '玩具', '宠物', '母狗', '公狗', '种马', '种猪', '配种', '母体', '苗床', '生育机器'],
                // 关系动词
                verbs: ['认识', '熟悉', '喜欢', '讨厌', '爱', '恨', '信任', '怀疑', '跟随', '背叛', '保护', '威胁', '帮助', '阻碍', '占有', '拥有', '控制', '支配', '服从', '臣服', '侍奉', '伺候', '调教', '训练', '开发', '使用', '玩弄', '凌辱', '羞辱', '虐待', '疼爱', '宠爱', '惩罚', '奖赏']
            }
        };

        // 成人内容专用记忆模式（极度增强）
        this.adultPatterns = {
            // 身体特征记忆
            bodyFeatures: {
                // 身体部位描述
                parts: ['胸', '乳', '奶', '咪咪', '木瓜', '乳房', '乳头', '乳晕', '乳尖', '奶头', '腿', '大腿', '小腿', '腰', '小蛮腰', '臀', '屁股', '翘臀', '肥臀', '蜜桃臀', '唇', '嘴唇', '香唇', '檀口', '小嘴', '颈', '脖子', '锁骨', '肩', '香肩', '背', '美背', '腹', '小腹', '肚子', '手', '纤手', '玉手', '指', '手指', '纤指', '足', '脚', '玉足', '美腿', '肌肤', '肌肉', '身躯', '躯体', '体型', '身材', '曲线', '身段', '三围', '阴部', '私处', '下体', '秘处', '花园', '桃源', '洞穴', '蜜穴', '小穴', '肉穴', '嫩穴', '淫穴', '骚穴', '浪穴', '阴道', '阴户', '阴唇', '大阴唇', '小阴唇', '阴蒂', '阴核', '花蕊', '花心', '花瓣', '子宫', '子宫口', '宫颈', 'G点', 'A点', '敏感点', '肛门', '后穴', '菊花', '后庭', '屁眼', '直肠', '阳具', '阴茎', '肉棒', '鸡巴', '屌', '老二', '命根子', '龟头', '马眼', '包皮', '睾丸', '蛋蛋', '阴囊', '前列腺'],
                // 尺寸描述
                sizes: ['丰满', '饱满', '挺拔', '坚挺', '硕大', '巨大', '爆乳', '巨乳', '贫乳', '微乳', '美乳', '纤细', '纤瘦', '修长', '苗条', '丰腴', '肉感', '紧致', '紧窄', '松弛', '柔软', 'Q弹', '有弹性', '滑腻', '光滑', '细腻', '娇嫩', '白皙', '粉嫩', '红润', '潮红', '充血', '肿胀', '窈窕', '婀娜', '性感', '诱人', '妖娆', '风骚', '淫荡'],
                // 敏感部位
                sensitive: ['敏感', '敏感带', '性感带', '要害', '弱点', '开关', '按钮', '禁地', '秘处', '私密', '隐秘', '羞处', '软肋', '命门', '死穴', '兴奋点', '快感点', '高潮点']
            },
            // 服装和状态
            clothing: {
                // 服装类型
                types: ['内衣', '内裤', '胸罩', '文胸', '比基尼', '三点式', '丁字裤', 'T裤', '开裆裤', '情趣内衣', '透视装', '睡衣', '浴衣', '和服', '浴袍', '制服', '护士服', 'OL装', '女仆装', '学生服', '水手服', 'JK', '体操服', '泳装', '死库水', '礼服', '晚礼服', '旗袍', '短裙', '超短裙', '迷你裙', '包臀裙', '开叉裙', '丝袜', '黑丝', '白丝', '肉丝', '网袜', '吊带袜', '过膝袜', '连裤袜', '开裆丝袜', '高跟鞋', '细高跟', '恨天高', '长靴', '过膝靴', '皮靴', '吊带', '吊袜带', '蕾丝', '透明', '镂空', '露背', '露肩', '露脐', '低胸', '爆乳装', '紧身衣', '皮衣', '乳胶衣', '束身衣', '束腰', '围裙', '裸体围裙', '绷带', '纱布', '项圈', '颈圈', '狗圈', '锁链', '铁链', '皮带', '腰带', '贞操带', '绳索', '麻绳', '红绳', '龟甲缚', '驷马', '捆绑'],
                // 服装状态
                states: ['半解', '半脱', '松开', '解开', '敞开', '褪下', '脱落', '滑落', '撕裂', '撕破', '撕碎', '破损', '破洞', '湿透', '浸湿', '黏湿', '透明', '若隐若现', '凌乱', '凌乱不堪', '衣衫不整', '衣冠不整', '春光乍泄', '走光', '露出', '暴露', '半遮半掩', '欲遮还羞', '遮掩', '紧身', '紧贴', '勾勒', '凸显', '宽松', '空荡荡'],
                // 材质
                materials: ['丝绸', '真丝', '蕾丝', '蕾丝花边', '皮革', '真皮', '人造革', '乳胶', '橡胶', 'PVC', '塑料', '金属', '钢', '铁', '棉质', '纯棉', '纱质', '薄纱', '绸缎', '缎面', '天鹅绒', '丝绒', '毛绒', '毛皮', '兽皮', '麻', '粗布', '帆布']
            },
            // 动作和姿态
            actions: {
                // 动作类型
                verbs: ['抚摸', '爱抚', '轻抚', '抚弄', '轻触', '触碰', '触摸', '摸索', '探索', '按压', '按揉', '揉捏', '揉搓', '搓揉', '捏弄', '拧捏', '掐', '抓', '抓握', '握住', '舔', '舔舐', '舔弄', '舔吻', '吸', '吮', '吮吸', '吸吮', '含', '含住', '含弄', '吞', '吞咽', '深喉', '口交', '舔阴', '亲', '亲吻', '深吻', '湿吻', '法式深吻', '啃', '啃咬', '咬', '轻咬', '咬噬', '拥', '拥抱', '搂抱', '紧拥', '缠', '缠绕', '纠缠', '摩', '摩擦', '磨蹭', '蹭', '顶', '顶弄', '抽', '抽动', '抽插', '抽送', '插', '插入', '深入', '进入', '贯穿', '刺入', '顶入', '撞', '撞击', '冲撞', '顶撞', '律动', '摆动', '摇动', '晃动', '颤', '颤抖', '颤栗', '发抖', '哆嗦', '痉挛', '抽搐', '扭', '扭动', '扭腰', '摆臀', '挺', '挺身', '挺腰', '迎合', '配合', '挣扎', '反抗', '抵抗', '躲避', '逃避', '臣服', '屈服', '跪服', '求饶', '哀求', '恳求', '支配', '控制', '掌控', '征服', '占有', '拥有', '侵犯', '侵占', '凌辱', '蹂躏', '玩弄', '戏弄', '调戏', '调教', '训练', '教育', '惩罚', '处罚', '体罚', '鞭打', '抽打', '掌掴', '打屁股', '奖赏', '奖励', '褒奖', '折磨', '虐待', '凌虐', '施虐', '受虐', '自虐', '性交', '做爱', '交媾', '交配', '交合', '性爱', '肏', '操', '干', '日', '艹', '上', '骑', '骑乘', '女上位', '男上位', '后入', '侧入', '站立位', '传教士', '老汉推车', '观音坐莲', '69', '颜射', '口爆', '中出', '内射', '体内射精', '体外射精', '肛交', '爆菊', '走后门', '双龙', '双插', '3P', '群交', '轮奸', '轮流', '车轮战'],
                // 姿势
                poses: ['跪', '跪下', '跪着', '跪趴', '跪伏', '五体投地', '趴', '趴下', '趴着', '俯卧', '俯身', '趴跪', '四肢着地', '狗爬', '母狗式', '仰', '仰躺', '仰卧', '平躺', '躺平', '侧', '侧卧', '侧躺', '侧身', '站', '站立', '站着', '立正', '稍息', '弯', '弯腰', '弯下', '俯身', '鞠躬', '下腰', '撅', '撅起', '撅臀', '翘臀', '抬臀', '撑', '撑开', '张开', '分开', '打开', '岔开', '劈叉', '一字马', '并', '并拢', '夹紧', '合拢', '抬', '抬起', '抬腿', '抬高', '举起', '张', '张开', '张大', '大张', '闭', '闭合', '紧闭', '合上', '蜷', '蜷缩', '缩成一团', '抱膝', '伸', '伸展', '舒展', '展开', '挺', '挺直', '挺胸', '挺腰', '弓', '弓起', '弓背', '弓身', 'M字开腿', 'W坐姿', '鸭子坐', '体操坐'],
                // 反应
                reactions: ['呻吟', '娇吟', '呻咛', '吟叫', '叫', '叫唤', '叫喊', '叫声', '浪叫', '淫叫', '喘', '喘息', '喘气', '娇喘', '急喘', '喘吁吁', '气喘吁吁', '尖叫', '惊叫', '嘶叫', '喊', '喊叫', '大喊', '哭', '哭泣', '哭喊', '啜泣', '抽泣', '饮泣', '泪流满面', '梨花带雨', '求', '求饶', '哀求', '恳求', '乞求', '哀', '哀鸣', '哀嚎', '哀叫', '呜', '呜咽', '呜呜', '啜', '啜泣', '呢喃', '喃喃', '低语', '耳语', '低', '低吟', '低叫', '低喘', '嘶', '嘶吼', '嘶叫', '嘶哑', '咆', '咆哮', '怒吼', '嚎', '嚎叫', '狂叫', '浪叫', '骚叫', '淫声', '浪语', '淫言', '污言', '秽语', '呻吟声', '水声', '啪啪声', '拍打声', '撞击声', '摩擦声']
            },
            // 情绪和感觉
            sensations: {
                // 生理感觉
                physical: ['疼', '疼痛', '痛', '刺痛', '胀痛', '酸痛', '痛楚', '剧痛', '快', '快感', '快乐', '愉悦', '愉快', '舒服', '舒适', '舒爽', '爽', '爽快', '极乐', '酥', '酥麻', '麻', '麻痹', '酸麻', '刺', '刺激', '刺痛', '刺痒', '痒', '瘙痒', '燥', '燥热', '发热', '发烫', '火热', '灼热', '冰', '冰凉', '冰冷', '凉', '凉爽', '冷', '战', '战栗', '颤栗', '发抖', '痉', '痉挛', '抽搐', '抽筋', '紧', '紧绷', '紧张', '绷紧', '松', '放松', '松弛', '松软', '湿', '湿润', '潮湿', '水润', '泥泞', '滑', '滑腻', '黏滑', '干', '干涩', '干燥', '肿', '肿胀', '充血', '胀大', '缩', '收缩', '紧缩', '萎缩', '空', '空虚', '空洞', '充', '充实', '充满', '饱', '饱胀', '满', '满足', '饥', '饥渴', '渴', '渴望', '敏', '敏感', '过敏', '触电', '电流', '酸', '酸软', '酸胀', '软', '软弱', '无力', '脱力', '虚', '虚弱', '虚脱'],
                // 心理状态
                mental: ['羞', '羞耻', '羞涩', '害羞', '羞愧', '羞辱', '耻', '耻辱', '无耻', '兴', '兴奋', '激动', '亢奋', '狂热', '疯狂', '恐', '恐惧', '害怕', '恐慌', '惊恐', '期', '期待', '期望', '渴望', '盼望', '屈', '屈辱', '屈服', '卑微', '满', '满足', '满意', '心满意足', '空', '空虚', '虚无', '失落', '渴', '渴望', '渴求', '饥渴', '欲', '欲望', '欲求', '抗', '抗拒', '抵抗', '拒绝', '顺', '顺从', '服从', '听话', '乖', '乖巧', '迷', '迷乱', '迷惑', '迷茫', '混乱', '清', '清醒', '清楚', '明白', '麻', '麻木', '木然', '无感', '敏', '敏感', '敏锐', '崩', '崩溃', '崩坏', '破碎', '沉', '沉沦', '堕落', '沦陷', '迷失', '失控', '疯狂', '癫狂', '狂乱', '理智全无', '欲仙欲死', '飘飘欲仙', '神魂颠倒', '意乱情迷', '情欲高涨', '春心荡漾', '欲火焚身', '情难自禁', '不能自已'],
                // 欲望程度
                desire: ['欲', '欲火', '欲望', '情欲', '性欲', '淫欲', '淫念', '邪念', '兽欲', '兽性', '原始欲望', '肉欲', '禁欲', '无欲', '纵欲', '纵情', '放纵', '克制', '忍耐', '压抑', '释放', '解放', '爆发', '饥', '饥渴', '饥饿', '渴', '渴望', '渴求', '满', '满足', '满意', '贪', '贪婪', '贪心', '贪欲', '不满足', '永不满足', '节', '节制', '节欲', '清心寡欲', '发情', '发春', '发骚', '骚', '风骚', '骚动', '春', '春心', '春意', '春情', '怀春', '思春', '饥渴难耐', '欲求不满', '急不可耐', '迫不及待', '如饥似渴']
            },
            // 关系和角色
            roles: {
                // 支配关系
                dominant: ['主人', '主', 'Master', 'Mistress', '主宰', '支配者', 'Dom', 'Dominant', '施虐者', 'Sadist', 'S', '调教师', '训练师', '征服者', '掌控者', '拥有者', '所有者', '统治者', '独裁者', '暴君', '君主', '女王', '女王大人', '女王陛下', '女王萨玛', '女神', '女神大人', '爸爸', 'Daddy', '爹地', '主人大人', '主人萨玛', '御主', '御主萨玛', '殿下', '陛下', '大人', '萨玛', '长官', '上级', '老板', '老大', '头目', '首领'],
                submissive: ['奴隶', '奴', 'Slave', '臣服者', 'Sub', 'Submissive', '受虐者', 'Masochist', 'M', '被调教者', '猎物', '玩物', '玩具', '人偶', '人形', '道具', '工具', '宠物', 'Pet', '狗', '狗狗', '小狗', '母狗', '公狗', '猫', '猫咪', '小猫', '母猫', '公猫', '猪', '母猪', '公猪', '种猪', '马', '母马', '种马', '牛', '奶牛', '种牛', '羊', '绵羊', '家畜', '畜生', '牲口', '肉便器', '便器', '厕所', '公厕', '肉厕', '精液便所', '精厕', '飞机杯', '自慰器', '性玩具', 'Toy', '充气娃娃', '抱枕', '精盆', '精壶', '储精器', '公交车', '巴士', '破鞋', '烂货', '贱货', '贱人', '婊子', 'Bitch', '荡妇', 'Slut', '淫妇', '骚货', '浪货', '妓女', 'Whore', '娼妇', '卖春妇', '风尘女', 'RBQ', '肉便器', '下贱', '卑贱', '低贱', '贱奴', '贱畜', '奴才', '女仆', 'Maid', '侍女', '婢女', '使女', '苗床', '母体', '生育机器', '繁殖工具', '配种机', '种付け', '孕袋'],
                // 特殊关系
                special: ['禁忌', '背德', '不伦', '乱伦', '近亲', '兄妹', '姐弟', '父女', '母子', '叔侄', '舅甥', '师生', '上下级', '秘密', '地下', '不正当', '见不得光', '羞耻', '背叛', 'NTR', '绿帽', '牛头人', '出轨', '偷情', '外遇', '第三者', '小三', '情妇', '情夫', '地下情', '婚外情', '一夜情', '炮友', 'FWB', '包养', '被包养', '金主', '援交', '援助交际', '卖春', '买春', '嫖娼', '多人', '3P', '4P', '群P', '群交', '乱交', '换妻', '夫妻交换', '开放关系', '多角关系', '后宫', '逆后宫'],
                // 角色扮演
                roleplay: ['女仆', '女仆装', 'Maid', '护士', '护士装', 'Nurse', '教师', '老师', 'Teacher', '学生', '学生装', 'Student', 'JK', '女高中生', '修女', 'Sister', '尼姑', '警察', '女警', 'Police', '囚犯', '犯人', 'Prisoner', '医生', '女医', 'Doctor', '病人', '患者', 'Patient', '老板', '上司', 'Boss', '秘书', '女秘书', 'Secretary', 'OL', '白领', '贵族', '贵妇', '公主', 'Princess', '女王', 'Queen', '王子', 'Prince', '骑士', 'Knight', '平民', '村民', '农妇', '女巫', 'Witch', '魔女', '精灵', 'Elf', '兽人', '兽娘', '猫娘', '狐娘', '狼女', '吸血鬼', 'Vampire', '魅魔', 'Succubus', '天使', 'Angel', '恶魔', 'Devil', '怪物', 'Monster', '触手', 'Tentacle', '史莱姆', 'Slime', '人外', '异种', '异族']
            },
            // 场景和道具
            scenarios: {
                // 场景类型
                locations: ['密室', '地牢', '地下室', '囚室', '牢房', '调教室', '训练室', 'Dungeon', 'SM室', 'BDSM室', '红房间', '黑房间', '浴室', '浴缸', '淋浴间', '温泉', '澡堂', '公共浴室', '卧室', '床', '床上', '被窝', '办公室', '办公桌', '会议室', '教室', '课堂', '讲台', '保健室', '医务室', '诊所', '医院', '病房', '手术室', '审讯室', '拷问室', '刑讯室', '刑房', '酷刑室', '实验室', '研究室', '改造室', '洗脑室', '催眠室', '按摩室', '按摩店', '风俗店', '夜总会', '酒吧', '包厢', '妓院', '青楼', '勾栏', '红灯区', '情人旅馆', '情趣酒店', '主题房', '电影院', '影院', '放映厅', '更衣室', '试衣间', '厕所', '洗手间', '公厕', '马桶', '小便池', '电梯', '电梯间', '楼梯间', '天台', '屋顶', '阳台', '露台', '车内', '车上', '后座', '地铁', '电车', '公交车', '飞机', '机舱', '头等舱', '仓库', '储藏室', '杂物间', '马厩', '牛棚', '猪圈', '兽栏', '笼子', '囚笼', '铁笼', '木笼', '祭坛', '神殿', '教堂', '忏悔室', '地狱', '深渊', '触手巢穴', '史莱姆巢穴', '魔物巢穴', '兽人营地', '奴隶市场', '拍卖场', '展示台', '处刑台', '断头台', '绞刑架', '火刑架', '十字架'],
                // 道具工具
                tools: ['绳', '绳索', '绳子', '麻绳', '棉绳', '丝绳', '皮绳', '锁', '锁链', '铁链', '锁链', '镣铐', '枷锁', '项圈', '颈圈', '狗圈', '皮项圈', '铁项圈', '钉项圈', '电击项圈', '鞭', '皮鞭', '长鞭', '短鞭', '九尾鞭', '马鞭', '教鞭', '藤条', '竹条', '板子', '戒尺', '拍子', '苍蝇拍', '蜡', '蜡烛', '低温蜡烛', '滴蜡', '冰', '冰块', '冰棍', '冰雕', '振', '振动', '震动', '振动器', '震动棒', '按摩棒', '仙女棒', '跳蛋', '无线跳蛋', '遥控跳蛋', '拉珠', '肛珠', '数珠', '电', '电击', '电击器', '电击棒', '电流', '电极', '夹', '夹子', '乳夹', '乳头夹', '阴夹', '阴蒂夹', '鳄鱼夹', '衣夹', '晾衣夹', '塞', '塞子', '肛塞', '肛门塞', '尾巴肛塞', '狐狸尾巴', '扩张器', '扩肛器', '扩阴器', '开口器', '撑开器', '环', '穿环', '乳环', '乳头环', '阴环', '阴蒂环', '鼻环', '肚脐环', '针', '穿刺针', '注射针', '针灸针', '钉', '钉子', '图钉', '大头针', '刀', '刀片', '刀刃', '剃刀', '手术刀', '烙', '烙铁', '烙印', '火印', '电烙铁', '灌', '灌肠', '灌肠器', '注射器', '导尿', '导尿管', '尿道棒', '尿道塞', '贞', '贞操带', '贞操锁', '贞操笼', '阴茎锁', '口', '口枷', '口球', '口塞', '开口器', '深喉器', '眼', '眼罩', '目隐', '蒙眼布', '耳', '耳塞', '降噪耳机', '手', '手铐', '手镣', '手枷', '皮手铐', '脚', '脚镣', '脚铐', '脚枷', '皮脚铐', '束', '束缚', '束缚带', '皮带', '腰带', '吊带', '拘', '拘束', '拘束衣', '紧身衣', '束身衣', '驷', '驷马', '木驴', '三角木马', '电动木马', '震动木马', '十', '十字架', 'X字架', 'Y字架', '刑架', '药', '药物', '药剂', '春药', '催情药', '媚药', '迷药', '迷奸药', '催眠药', '兴奋剂', '镇静剂', '肌肉松弛剂', '敏感药', '发情药', '排卵药', '避孕药', '堕胎药', '激素', '荷尔蒙', '雌激素', '雄激素', '改造药', '变身药', '精', '精液', '精子', '浓精', '爱', '爱液', '淫水', '淫液', '蜜液', '花蜜', '润', '润滑', '润滑剂', '润滑液', '按摩油', '精油', '催情精油', '套', '避孕套', '安全套', '超薄套', '螺纹套', '颗粒套', '延时套', '女用避孕套', '验', '验孕棒', '验孕试纸', '排卵试纸'],
                // 束缚装置
                restraints: ['手铐', '脚镣', '枷锁', '锁链', '项圈', '贞操带', '口球', '口枷', '眼罩', '耳塞', '鼻钩', '乳夹', '阴夹', '肛塞', '尿道塞', '贞操笼', '全身束缚', '皮革束缚', '绳艺', '龟甲缚', '菱绳缚', '驷马', '吊缚', '悬吊', '倒吊', '分腿器', '开腿器', '固定架', '十字架', 'X架', 'Y架', '断头台', '木马', '三角木马', '刑架', '拷问台', '手术台', '妇科椅', '分娩台', '真空床', '乳胶睡袋', '木乃伊缠绕', '保鲜膜', '胶带', '医用绷带', '石膏', '金属贞操带', '电子贞操带', '远程贞操带', 'App控制', '定时锁', '冰锁', '密码锁', '指纹锁', '虹膜锁', 'GPS定位器', '追踪器', '监控摄像头', '直播设备']
            },
            // 特殊癖好
            fetishes: {
                // 恋物类型
                objects: ['丝袜', '黑丝', '白丝', '肉丝', '网袜', '裤袜', '内衣', '内裤', '胸罩', '吊带袜', '高跟鞋', '长靴', '皮靴', '制服', '护士服', 'JK', '女仆装', 'OL装', '皮革', '皮衣', '皮裤', '皮裙', '乳胶', '乳胶衣', '紧身衣', '绳索', '麻绳', '红绳', '锁链', '金属', '钢铁', '手铐', '脚镣', '项圈', '口球', '眼罩', '蜡烛', '冰块', '羽毛', '毛皮', '兽皮', '液体', '精液', '尿液', '唾液', '汗液', '爱液', '母乳', '血液', '食物', '奶油', '巧克力', '水果', '触手', '史莱姆', '黏液', '凝胶'],
                // 身体部位偏好
                bodyParts: ['足', '脚', '脚趾', '脚底', '脚踝', '腿', '大腿', '小腿', '膝盖', '膝窝', '胸', '乳房', '乳头', '乳晕', '乳沟', '臀', '屁股', '臀缝', '颈', '脖子', '锁骨', '肩', '腋', '腋下', '腋窝', '腹', '肚子', '肚脐', '背', '腰', '腰窝', '手', '手指', '手掌', '耳', '耳垂', '头发', '发丝', '口', '嘴唇', '舌头', '牙齿', '鼻', '鼻孔', '眼', '眼睛', '泪水', '生殖器', '阴部', '阴道', '阴蒂', '阴唇', '肛门', '尿道', '阴茎', '龟头', '睾丸', '前列腺'],
                // 行为偏好
                behaviors: ['支配', '控制', '征服', '占有', '命令', '臣服', '服从', '顺从', '侍奉', '崇拜', '羞辱', '贬低', '侮辱', '嘲笑', '暴露', '露出', '公开', '展示', '偷窥', '偷看', '偷拍', '监视', '展示', '表演', '直播', '拍摄', '惩罚', '体罚', '鞭打', '掌掴', '束缚', '捆绑', '拘束', '监禁', '调教', '训练', '改造', '洗脑', '催眠', '控制', '操控', '玩弄', '戏弄', '逗弄', '折磨', '虐待', '施虐', '受虐', '自虐', '忍耐', '憋尿', '憋精', '禁欲', '贞操', '高潮控制', '边缘控制', '强制高潮', '连续高潮', '潮吹', '射精', '颜射', '中出', '口爆', '吞精', '饮精', '精液浴', '轮奸', '群交', '多P', '公开性爱', '户外', '车震', '角色扮演', 'Cosplay', '年龄扮演', '动物扮演', '宠物扮演', '家具扮演', '物化', '人体改造', '穿孔', '纹身', '烙印', '标记', '怀孕', '孕妇', '哺乳', '产乳', '强制受孕', '强制怀孕', 'NTR', '绿帽', '偷情', '出轨', '分享', '共享', '出借', '拍卖', '贩卖', '人口贩卖'],
                // 感官偏好
                sensory: ['疼痛', '痛苦', '痛楚', '快感', '快乐', '愉悦', '混合', '痛并快乐', '温度', '冷', '热', '冰火两重天', '触感', '软', '硬', '滑', '粗糙', '刺激', '麻', '电', '振动', '束缚感', '紧缚', '压迫', '窒息', '呼吸控制', '缺氧', '濒死', '失禁', '尿失禁', '大便失禁', '排泄', '放尿', '排便', '灌肠', '高潮', '连续高潮', '强制高潮', '高潮拒绝', '边缘', '边缘控制', '寸止', '焦灼', '否定', '拒绝', '剥夺', '感官剥夺', '视觉剥夺', '听觉剥夺', '触觉剥夺', '完全剥夺', '感官超载', '过度刺激', '极限', '突破极限', '超越极限']
            }
        };

        // 重要性权重（成人内容权重更高）
        this.importanceWeights = {
            character: 0.8,
            location: 0.6,
            item: 0.7,
            event: 0.9,
            relationship: 0.85,
            // 成人内容权重最高
            bodyFeatures: 0.95,
            clothing: 0.85,
            actions: 0.98,
            sensations: 0.95,
            roles: 0.97,
            scenarios: 0.9,
            fetishes: 0.99
        };

        // 过滤规则
        this.filters = {
            minLength: 2,
            maxLength: 100, // 增加最大长度以容纳更详细的描述
            stopWords: ['的', '了', '和', '与', '或', '但', '在', '是', '有', '这', '那', '些', '个', '啊', '呀', '吗', '呢', '吧']
        };
    }

    /**
     * 从AI响应中提取记忆（终极增强版）
     */
    async extractMemories(aiResponse, userInput = '', mode = 'general') {
        const memories = [];
        
        try {
            // 预处理文本
            const cleanedText = this.preprocessText(aiResponse);
            
            // 根据模式判断是否需要提取成人内容
            const isAdultMode = ['adult', 'roleplay', 'confession'].includes(mode) || this.detectAdultContent(cleanedText);
            
            // 提取通用记忆（增强版）
            memories.push(...this.extractCharacters(cleanedText, userInput, isAdultMode));
            memories.push(...this.extractLocations(cleanedText, userInput, isAdultMode));
            memories.push(...this.extractItems(cleanedText, userInput, isAdultMode));
            memories.push(...this.extractEvents(cleanedText, userInput, isAdultMode));
            memories.push(...this.extractRelationships(cleanedText, userInput, isAdultMode));
            
            // 如果是成人模式，提取所有成人相关记忆
            if (isAdultMode) {
                memories.push(...this.extractBodyFeatures(cleanedText, userInput));
                memories.push(...this.extractClothing(cleanedText, userInput));
                memories.push(...this.extractAdultActions(cleanedText, userInput));
                memories.push(...this.extractSensations(cleanedText, userInput));
                memories.push(...this.extractAdultRoles(cleanedText, userInput));
                memories.push(...this.extractAdultScenarios(cleanedText, userInput));
                memories.push(...this.extractFetishes(cleanedText, userInput));
            }
            
            // 后处理
            const processedMemories = this.postprocessMemories(memories, cleanedText);
            
            logger.debug('Memory extraction completed', {
                totalExtracted: memories.length,
                afterProcessing: processedMemories.length,
                adultContent: isAdultMode,
                mode: mode
            });
            
            return processedMemories;
            
        } catch (error) {
            logger.error('Memory extraction failed', { error: error.message });
            return [];
        }
    }

    /**
     * 检测是否包含成人内容（增强版）
     */
    detectAdultContent(text) {
        // 收集所有成人相关关键词
        const adultKeywords = [
            // 成人身份
            ...this.patterns.character.adultTitles,
            // 身体部位
            ...this.adultPatterns.bodyFeatures.parts,
            // 成人场所
            ...this.patterns.location.adultTypes,
            // 成人用品
            ...this.patterns.item.adultTypes,
            // 成人事件
            ...this.patterns.event.adultKeywords,
            // 成人关系
            ...this.patterns.relationship.adultTypes,
            // 动作
            ...this.adultPatterns.actions.verbs,
            // 感觉
            ...this.adultPatterns.sensations.physical,
            ...this.adultPatterns.sensations.mental,
            // 角色
            ...this.adultPatterns.roles.dominant,
            ...this.adultPatterns.roles.submissive
        ];
        
        // 检查是否包含任意成人关键词
        return adultKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * 提取角色信息（增强版）
     */
    extractCharacters(text, context, isAdultMode = false) {
        const memories = [];
        
        // 提取通用职业/身份
        const allTitles = isAdultMode 
            ? [...this.patterns.character.titles, ...this.patterns.character.adultTitles]
            : this.patterns.character.titles;
            
        for (const title of allTitles) {
            const regex = new RegExp(`([^，。！？\\s]{1,15}?)(${title})`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const name = match[1].trim();
                const role = match[2];
                
                if (this.isValidName(name)) {
                    // 判断角色类型
                    const isAdultRole = this.patterns.character.adultTitles.includes(role);
                    const importance = isAdultRole ? 0.95 : this.calculateCharacterImportance(name, text);
                    
                    memories.push({
                        memory_type: 'character',
                        key_name: name,
                        content: `身份：${role}${isAdultRole ? '\n类型：成人角色' : ''}`,
                        context: context,
                        importance: importance
                    });
                }
            }
        }
        
        // 提取描述性句式
        const descPattern = new RegExp(
            `([^，。！？\\s]{2,15}?)(?:${this.patterns.character.descriptors.join('|')})([^，。！？]{2,50})`,
            'g'
        );
        
        let match;
        while ((match = descPattern.exec(text)) !== null) {
            const name = match[1].trim();
            const description = match[2].trim();
            
            if (this.isValidName(name) && !this.isCommonPhrase(description)) {
                const existingMemory = memories.find(m => m.key_name === name);
                if (existingMemory) {
                    existingMemory.content += `\n描述：${description}`;
                } else {
                    memories.push({
                        memory_type: 'character',
                        key_name: name,
                        content: `描述：${description}`,
                        context: context,
                        importance: this.calculateCharacterImportance(name, text)
                    });
                }
            }
        }
        
        // 提取外貌描述（包括成人特征）
        if (isAdultMode) {
            for (const memory of memories) {
                const appearanceInfo = this.extractAppearance(text, memory.key_name, isAdultMode);
                if (appearanceInfo) {
                    memory.content += `\n外貌特征：${appearanceInfo}`;
                    memory.importance = Math.min(memory.importance + 0.1, 1.0);
                }
            }
        }
        
        return memories;
    }

    /**
     * 提取地点信息（增强版）
     */
    extractLocations(text, context, isAdultMode = false) {
        const memories = [];
        const extractedLocations = new Set();
        
        // 提取所有地点类型
        const allTypes = isAdultMode 
            ? [...this.patterns.location.types, ...this.patterns.location.adultTypes]
            : this.patterns.location.types;
            
        for (const locType of allTypes) {
            const regex = new RegExp(`([^，。！？\\s]*${locType}[^，。！？\\s]*)`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const location = match[1].trim();
                
                if (!extractedLocations.has(location) && location.length >= this.filters.minLength) {
                    extractedLocations.add(location);
                    
                    const isAdultLocation = this.patterns.location.adultTypes.includes(locType);
                    const description = this.extractLocationDescription(text, location);
                    
                    memories.push({
                        memory_type: 'location',
                        key_name: location,
                        content: `地点类型：${locType}${isAdultLocation ? '\n性质：成人场所' : ''}${description ? '\n描述：' + description : ''}`,
                        context: context,
                        importance: isAdultLocation ? 0.9 : this.calculateLocationImportance(location, text)
                    });
                }
            }
        }
        
        return memories;
    }

    /**
     * 提取物品信息（增强版）
     */
    extractItems(text, context, isAdultMode = false) {
        const memories = [];
        const extractedItems = new Set();
        
        // 提取所有物品类型
        const allTypes = isAdultMode 
            ? [...this.patterns.item.types, ...this.patterns.item.adultTypes]
            : this.patterns.item.types;
            
        for (const itemType of allTypes) {
            const regex = new RegExp(`([^，。！？\\s]*${itemType}[^，。！？\\s]*)`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const item = match[1].trim();
                
                if (!extractedItems.has(item) && item.length >= this.filters.minLength) {
                    extractedItems.add(item);
                    
                    const isAdultItem = this.patterns.item.adultTypes.includes(itemType);
                    
                    memories.push({
                        memory_type: 'item',
                        key_name: item,
                        content: `物品类型：${itemType}${isAdultItem ? '\n性质：成人用品' : ''}`,
                        context: context,
                        importance: isAdultItem ? 0.9 : this.calculateItemImportance(item, text)
                    });
                }
            }
        }
        
        // 通过动作提取物品
        const actionPattern = new RegExp(
            `(?:${this.patterns.item.actions.join('|')})了?([^，。！？]{2,30})`,
            'g'
        );
        
        let match;
        while ((match = actionPattern.exec(text)) !== null) {
            const item = match[1].trim();
            const action = match[0].substring(0, match[0].indexOf(item)).trim();
            
            if (!extractedItems.has(item) && this.isValidItem(item)) {
                extractedItems.add(item);
                
                // 检查是否是成人相关动作
                const adultActions = ['使用', '插入', '塞入', '灌入', '注入', '涂抹', '穿戴', '锁上'];
                const isAdultAction = adultActions.includes(action);
                
                memories.push({
                    memory_type: 'item',
                    key_name: item,
                    content: `获得/使用方式：${action}${isAdultAction ? '\n可能是成人用品' : ''}`,
                    context: context,
                    importance: isAdultAction ? 0.85 : 0.7
                });
            }
        }
        
        return memories;
    }

    /**
     * 提取事件信息（增强版）
     */
    extractEvents(text, context, isAdultMode = false) {
        const memories = [];
        
        // 提取所有事件关键词
        const allKeywords = isAdultMode 
            ? [...this.patterns.event.keywords, ...this.patterns.event.adultKeywords]
            : this.patterns.event.keywords;
            
        for (const keyword of allKeywords) {
            const regex = new RegExp(`([^，。！？]{5,80}${keyword}[^，。！？]{0,50})`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const event = match[0].trim();
                
                if (event.length >= 10) {
                    const isAdultEvent = this.patterns.event.adultKeywords.includes(keyword);
                    
                    memories.push({
                        memory_type: 'event',
                        key_name: `事件_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        content: event + (isAdultEvent ? '\n类型：成人事件' : ''),
                        context: context,
                        importance: isAdultEvent ? 0.95 : this.calculateEventImportance(event, keyword)
                    });
                }
            }
        }
        
        return memories;
    }

    /**
     * 提取关系信息（增强版）
     */
    extractRelationships(text, context, isAdultMode = false) {
        const memories = [];
        
        // 提取所有关系类型
        const allTypes = isAdultMode 
            ? [...this.patterns.relationship.types, ...this.patterns.relationship.adultTypes]
            : this.patterns.relationship.types;
            
        // 提取明确的关系描述
        for (const relType of allTypes) {
            const regex = new RegExp(`([^，。！？\\s]{2,15})的?(${relType})`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const person = match[1].trim();
                const relationship = match[2];
                
                if (this.isValidName(person)) {
                    const isAdultRel = this.patterns.relationship.adultTypes.includes(relationship);
                    
                    memories.push({
                        memory_type: 'relationship',
                        key_name: `${person}_${relationship}`,
                        content: `关系：${person}是${relationship}${isAdultRel ? '\n类型：成人关系' : ''}`,
                        context: context,
                        importance: isAdultRel ? 0.95 : 0.8
                    });
                }
            }
        }
        
        // 提取动词关系
        const relPattern = new RegExp(
            `([^，。！？\\s]{2,15})(?:和|与|对)([^，。！？\\s]{2,15})(?:${this.patterns.relationship.verbs.join('|')})`,
            'g'
        );
        
        let match;
        while ((match = relPattern.exec(text)) !== null) {
            const person1 = match[1].trim();
            const person2 = match[2].trim();
            const relationship = match[0];
            
            if (this.isValidName(person1) && this.isValidName(person2)) {
                memories.push({
                    memory_type: 'relationship',
                    key_name: `${person1}-${person2}`,
                    content: `关系：${relationship}`,
                    context: context,
                    importance: 0.85
                });
            }
        }
        
        return memories;
    }

    /**
     * 提取外貌描述（增强版）
     */
    extractAppearance(text, characterName, includeAdult = false) {
        const appearances = [];
        
        // 包含成人特征
        const keywords = includeAdult 
            ? this.patterns.character.appearance
            : this.patterns.character.appearance.filter(k => !['乳房', '胸部', '乳头', '臀部', '阴部', '下体'].includes(k));
        
        for (const keyword of keywords) {
            const regex = new RegExp(`${characterName}[^，。！？]*?([^，。！？]*${keyword}[^，。！？]*)`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const description = match[1].trim();
                if (description.length > 3 && description.length < 50) {
                    appearances.push(description);
                }
            }
        }
        
        // 如果没有找到与名字直接相关的，尝试查找独立的外貌描述
        if (appearances.length === 0) {
            for (const keyword of keywords) {
                const regex = new RegExp(`([^，。！？]*${keyword}[^，。！？]{3,30})`, 'g');
                let match;
                
                while ((match = regex.exec(text)) !== null) {
                    const description = match[1].trim();
                    // 确保描述中不包含其他人名
                    if (!this.containsOtherNames(description, characterName)) {
                        appearances.push(description);
                    }
                }
            }
        }
        
        return appearances.length > 0 ? appearances.join('；') : null;
    }

    /**
     * 检查文本是否包含其他人名
     */
    containsOtherNames(text, excludeName) {
        // 简单的人名检测（可以根据需要增强）
        const namePattern = /[他她您我你]/;
        return namePattern.test(text) && !text.includes(excludeName);
    }

    // ... 保留所有原有的成人内容提取方法 ...
    // extractBodyFeatures, extractClothing, extractAdultActions 等方法保持不变

    /**
     * 后处理记忆（增强版）
     */
    postprocessMemories(memories, fullText) {
        // 去重
        const uniqueMemories = this.deduplicateMemories(memories);
        
        // 根据上下文调整重要性
        const adjustedMemories = this.adjustImportance(uniqueMemories, fullText);
        
        // 建立记忆之间的关联
        const linkedMemories = this.linkRelatedMemories(adjustedMemories);
        
        // 按重要性排序
        const sortedMemories = linkedMemories.sort((a, b) => b.importance - a.importance);
        
        // 限制数量（成人内容可以保留更多）
        const limitedMemories = this.limitMemoriesByType(sortedMemories, {
            character: 10,      // 角色可以多一些
            location: 8,
            item: 10,
            event: 10,
            relationship: 10,
            // 成人内容可以保留更多
            bodyFeatures: 15,
            clothing: 12,
            actions: 15,
            sensations: 15,
            roles: 12,
            scenarios: 12,
            fetishes: 15
        });
        
        return limitedMemories;
    }

    /**
     * 建立记忆之间的关联
     */
    linkRelatedMemories(memories) {
        // 这里可以实现更复杂的关联逻辑
        // 例如：将角色和他们的行为、物品关联起来
        
        return memories;
    }

    // ... 保留所有其他辅助方法 ...

    /**
     * 预处理文本
     */
    preprocessText(text) {
        // 移除多余的空白字符
        let cleaned = text.replace(/\s+/g, ' ').trim();
        
        // 将特殊标记转换为标准格式
        cleaned = cleaned.replace(/[【\[](.+?)[】\]]/g, '（$1）');
        
        // 标准化标点符号
        cleaned = cleaned.replace(/[!！]/g, '！')
                       .replace(/[?？]/g, '？')
                       .replace(/[,，]/g, '，')
                       .replace(/[.。]/g, '。');
        
        return cleaned;
    }

    /**
     * 验证是否是有效的名字
     */
    isValidName(name) {
        if (name.length < this.filters.minLength || name.length > 15) return false;
        if (this.filters.stopWords.includes(name)) return false;
        if (/^\d+$/.test(name)) return false; // 纯数字
        if (/^[a-zA-Z]+$/.test(name) && name.length < 3) return false; // 太短的英文
        
        // 排除明显不是名字的词
        const notNames = ['什么', '怎么', '为什么', '哪里', '那里', '这里', '那个', '这个'];
        if (notNames.includes(name)) return false;
        
        return true;
    }

    /**
     * 检查是否是常见短语（应该被过滤）
     */
    isCommonPhrase(phrase) {
        const commonPhrases = ['一个人', '这样的', '那样的', '什么的', '之类的', '这种', '那种'];
        return commonPhrases.some(common => phrase.includes(common));
    }

    /**
     * 限制每种类型的记忆数量
     */
    limitMemoriesByType(memories, limits) {
        const typeCount = new Map();
        
        return memories.filter(memory => {
            const count = typeCount.get(memory.memory_type) || 0;
            const limit = limits[memory.memory_type] || 5;
            
            if (count < limit) {
                typeCount.set(memory.memory_type, count + 1);
                return true;
            }
            
            return false;
        });
    }

    /**
     * 提取关键词周围的文本
     */
    extractSurroundingText(text, keyword, radius = 30) {
        const index = text.indexOf(keyword);
        if (index === -1) return keyword;
        
        const start = Math.max(0, index - radius);
        const end = Math.min(text.length, index + keyword.length + radius);
        
        let surrounding = text.substring(start, end);
        
        // 确保不截断句子
        if (start > 0) {
            const firstPunc = surrounding.search(/[，。！？]/);
            if (firstPunc > 0 && firstPunc < radius / 2) {
                surrounding = surrounding.substring(firstPunc + 1);
            }
        }
        
        if (end < text.length) {
            const lastPunc = surrounding.lastIndexOf(/[，。！？]/);
            if (lastPunc > surrounding.length - radius / 2) {
                surrounding = surrounding.substring(0, lastPunc + 1);
            }
        }
        
        return surrounding.trim();
    }

    /**
     * 去重记忆
     */
    deduplicateMemories(memories) {
        const seen = new Map();
        
        return memories.filter(memory => {
            const key = `${memory.memory_type}_${memory.key_name}`;
            
            if (seen.has(key)) {
                // 合并内容
                const existing = seen.get(key);
                existing.content = this.mergeContent(existing.content, memory.content);
                existing.importance = Math.max(existing.importance, memory.importance);
                return false;
            }
            
            seen.set(key, memory);
            return true;
        });
    }

    /**
     * 合并记忆内容
     */
    mergeContent(content1, content2) {
        const lines1 = new Set(content1.split('\n'));
        const lines2 = content2.split('\n');
        
        lines2.forEach(line => lines1.add(line));
        
        return Array.from(lines1).join('\n');
    }

    /**
     * 根据上下文调整重要性
     */
    adjustImportance(memories, fullText) {
        // 如果文本较短，降低所有记忆的重要性
        const textLength = fullText.length;
        const lengthFactor = Math.min(textLength / 500, 1.0);
        
        return memories.map(memory => ({
            ...memory,
            importance: memory.importance * lengthFactor
        }));
    }

    /**
     * 计算角色重要性
     */
    calculateCharacterImportance(name, fullText) {
        const count = (fullText.match(new RegExp(name, 'g')) || []).length;
        const baseImportance = this.importanceWeights.character;
        const frequencyBonus = Math.min(count * 0.1, 0.2);
        
        return Math.min(baseImportance + frequencyBonus, 1.0);
    }

    /**
     * 计算地点重要性
     */
    calculateLocationImportance(location, fullText) {
        const count = (fullText.match(new RegExp(location, 'g')) || []).length;
        const baseImportance = this.importanceWeights.location;
        const frequencyBonus = Math.min(count * 0.05, 0.2);
        
        return Math.min(baseImportance + frequencyBonus, 1.0);
    }

    /**
     * 计算物品重要性
     */
    calculateItemImportance(item, fullText) {
        // 特殊物品加权
        const specialItems = ['剑', '魔法', '宝物', '神器', '钥匙', '地图', '药水', '项圈', '锁链', '贞操带'];
        const isSpecial = specialItems.some(special => item.includes(special));
        
        const baseImportance = this.importanceWeights.item;
        const specialBonus = isSpecial ? 0.2 : 0;
        
        return Math.min(baseImportance + specialBonus, 1.0);
    }

    /**
     * 计算事件重要性
     */
    calculateEventImportance(event, keyword) {
        // 某些关键词表示更重要的事件
        const importantKeywords = ['死亡', '复活', '背叛', '觉醒', '完成', '失败', '高潮', '怀孕', '堕落', '觉醒', 'NTR', '调教完成'];
        const isImportant = importantKeywords.includes(keyword);
        
        const baseImportance = this.importanceWeights.event;
        const keywordBonus = isImportant ? 0.1 : 0;
        
        return Math.min(baseImportance + keywordBonus, 1.0);
    }

    /**
     * 验证物品是否有效
     */
    isValidItem(item) {
        if (item.length < this.filters.minLength || item.length > 30) return false;
        if (this.filters.stopWords.some(word => item === word)) return false;
        
        return true;
    }

    /**
     * 提取地点描述
     */
    extractLocationDescription(text, locationName) {
        // 查找地点名称后的描述
        const regex = new RegExp(`${locationName}[^，。！？]*?(?:是|有|像|似|充满|弥漫)([^，。！？]{5,50})`, 'g');
        const match = regex.exec(text);
        
        return match ? match[1].trim() : null;
    }

    // 以下是所有成人内容相关的提取方法，保持原样...
    extractBodyFeatures(text, context) {
        const memories = [];
        
        // 提取身体部位描述
        for (const part of this.adultPatterns.bodyFeatures.parts) {
            const regex = new RegExp(`([^，。！？]*)(${part})[^，。！？]*`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const description = match[0].trim();
                const bodyPart = match[2];
                
                // 提取相关的尺寸或特征描述
                const sizeDesc = this.adultPatterns.bodyFeatures.sizes.find(size => 
                    description.includes(size)
                );
                
                if (description.length > 5 && description.length < 80) {
                    memories.push({
                        memory_type: 'bodyFeatures',
                        key_name: `身体特征_${bodyPart}`,
                        content: description,
                        context: context,
                        importance: this.importanceWeights.bodyFeatures
                    });
                }
            }
        }
        
        return memories;
    }

    extractClothing(text, context) {
        const memories = [];
        
        // 提取服装类型和状态
        for (const clothType of this.adultPatterns.clothing.types) {
            const regex = new RegExp(`([^，。！？]*${clothType}[^，。！？]*)`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const description = match[1].trim();
                
                // 检查服装状态
                const state = this.adultPatterns.clothing.states.find(s => 
                    description.includes(s)
                );
                
                // 检查材质
                const material = this.adultPatterns.clothing.materials.find(m => 
                    description.includes(m)
                );
                
                if (description.length > 3 && description.length < 80) {
                    memories.push({
                        memory_type: 'clothing',
                        key_name: clothType,
                        content: `${description}${state ? '\n状态：' + state : ''}${material ? '\n材质：' + material : ''}`,
                        context: context,
                        importance: this.importanceWeights.clothing
                    });
                }
            }
        }
        
        return memories;
    }

    extractAdultActions(text, context) {
        const memories = [];
        
        // 提取动作和姿态
        for (const action of this.adultPatterns.actions.verbs) {
            const regex = new RegExp(`([^，。！？]{0,30}${action}[^，。！？]{0,30})`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const actionDesc = match[0].trim();
                
                if (actionDesc.length > 5 && actionDesc.length < 100) {
                    memories.push({
                        memory_type: 'actions',
                        key_name: `动作_${action}`,
                        content: actionDesc,
                        context: context,
                        importance: this.importanceWeights.actions
                    });
                }
            }
        }
        
        // 提取反应
        for (const reaction of this.adultPatterns.actions.reactions) {
            if (text.includes(reaction)) {
                const surroundingText = this.extractSurroundingText(text, reaction, 40);
                memories.push({
                    memory_type: 'actions',
                    key_name: `反应_${reaction}`,
                    content: surroundingText,
                    context: context,
                    importance: 0.92
                });
            }
        }
        
        return memories;
    }

    extractSensations(text, context) {
        const memories = [];
        
        // 提取生理感觉
        for (const sensation of this.adultPatterns.sensations.physical) {
            if (text.includes(sensation)) {
                const surroundingText = this.extractSurroundingText(text, sensation, 40);
                memories.push({
                    memory_type: 'sensations',
                    key_name: `感觉_${sensation}`,
                    content: surroundingText,
                    context: context,
                    importance: this.importanceWeights.sensations
                });
            }
        }
        
        // 提取心理状态
        for (const mental of this.adultPatterns.sensations.mental) {
            if (text.includes(mental)) {
                const surroundingText = this.extractSurroundingText(text, mental, 40);
                memories.push({
                    memory_type: 'sensations',
                    key_name: `心理_${mental}`,
                    content: surroundingText,
                    context: context,
                    importance: this.importanceWeights.sensations
                });
            }
        }
        
        return memories;
    }

    extractAdultRoles(text, context) {
        const memories = [];
        
        // 提取支配关系
        const allRoles = [
            ...this.adultPatterns.roles.dominant,
            ...this.adultPatterns.roles.submissive
        ];
        
        for (const role of allRoles) {
            const regex = new RegExp(`([^，。！？\\s]{1,15})(是|作为|成为|扮演|变成|沦为)(${role})`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const person = match[1].trim();
                const roleType = match[3];
                
                if (this.isValidName(person)) {
                    const isDominant = this.adultPatterns.roles.dominant.includes(roleType);
                    memories.push({
                        memory_type: 'roles',
                        key_name: person,
                        content: `角色：${roleType}\n类型：${isDominant ? '支配者' : '服从者'}`,
                        context: context,
                        importance: this.importanceWeights.roles
                    });
                }
            }
        }
        
        return memories;
    }

    extractAdultScenarios(text, context) {
        const memories = [];
        
        // 提取场景
        for (const location of this.adultPatterns.scenarios.locations) {
            if (text.includes(location)) {
                const surroundingText = this.extractSurroundingText(text, location, 50);
                memories.push({
                    memory_type: 'scenarios',
                    key_name: `场景_${location}`,
                    content: surroundingText,
                    context: context,
                    importance: this.importanceWeights.scenarios
                });
            }
        }
        
        // 提取道具
        for (const tool of [...this.adultPatterns.scenarios.tools, ...this.adultPatterns.scenarios.restraints]) {
            if (text.includes(tool)) {
                const surroundingText = this.extractSurroundingText(text, tool, 40);
                memories.push({
                    memory_type: 'scenarios',
                    key_name: `道具_${tool}`,
                    content: surroundingText,
                    context: context,
                    importance: 0.88
                });
            }
        }
        
        return memories;
    }

    extractFetishes(text, context) {
        const memories = [];
        
        // 检查各种癖好类型
        for (const [category, items] of Object.entries(this.adultPatterns.fetishes)) {
            for (const fetish of items) {
                if (text.includes(fetish)) {
                    const surroundingText = this.extractSurroundingText(text, fetish, 50);
                    memories.push({
                        memory_type: 'fetishes',
                        key_name: `癖好_${category}_${fetish}`,
                        content: surroundingText,
                        context: context,
                        importance: this.importanceWeights.fetishes
                    });
                }
            }
        }
        
        return memories;
    }
}

module.exports = new MemoryExtractor();
