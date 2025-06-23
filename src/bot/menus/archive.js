// bot/menus/archive.js
class ArchiveMenu {
    static async show(bot, chatId, messageId) {
        const text = '[档案] 请选择档案类型：';
        const keyboard = {
            inline_keyboard: [
                [{ text: '[人物] 人物档案', callback_data: 'char_archives' }],
                [{ text: '[故事] 故事档案', callback_data: 'story_archives' }],
                [{ text: '<- 返回主菜单', callback_data: 'back_to_menu' }]
            ]
        };
        
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }
}

module.exports = ArchiveMenu;
