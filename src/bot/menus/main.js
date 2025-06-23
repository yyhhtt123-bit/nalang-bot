// bot/menus/main.js
class MainMenu {
    static async send(bot, chatId, messageId = null) {
        const menuText = "[主菜单] 请选择您要使用的功能：";
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '[通用] 通用模式', callback_data: 'mode_general' },
                    { text: '[成人] 成人模式', callback_data: 'mode_adult' }
                ],
                [
                    { text: '[角色] 角色扮演', callback_data: 'mode_roleplay' },
                    { text: '[忏悔] 忏悔室', callback_data: 'mode_confession' }
                ],
                [
                    { text: '[档案] 档案', callback_data: 'show_archives' },
                    { text: '[设置] 设置', callback_data: 'show_settings' }
                ],
                [
                    { text: '[记忆] AI记忆', callback_data: 'show_memories' },
                    { text: '[统计] 使用统计', callback_data: 'show_stats' }
                ]
            ]
        };
        
        if (messageId) {
            await bot.editMessageText(menuText, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });
        } else {
            await bot.sendMessage(chatId, menuText, {
                reply_markup: keyboard
            });
        }
    }
}

module.exports = MainMenu;
