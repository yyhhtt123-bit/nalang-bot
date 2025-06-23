class StateManager {
    constructor() {
        this.userStates = new Map();
        this.tempCharacterData = new Map();
        this.activeCharacters = new Map();
    }
    
    // 用户状态管理
    getState(chatId) {
        return this.userStates.get(chatId);
    }
    
    setState(chatId, state) {
        this.userStates.set(chatId, state);
    }
    
    clearState(chatId) {
        this.userStates.delete(chatId);
    }
    
    // 添加这个方法 - 这是缺失的方法
    setProcessing(chatId, isProcessing) {
        const state = this.userStates.get(chatId);
        if (state) {
            state.isProcessing = isProcessing;
            this.userStates.set(chatId, state);
        }
    }
    
    // 清除用户状态（别名方法）
    clearUserState(chatId) {
        this.userStates.delete(chatId);
    }
    
    // 临时角色数据管理
    setTempCharacter(chatId, data) {
        this.tempCharacterData.set(chatId, data);
    }
    
    getTempCharacter(chatId) {
        return this.tempCharacterData.get(chatId);
    }
    
    clearTempCharacter(chatId) {
        this.tempCharacterData.delete(chatId);
    }
    
    // 活跃角色管理
    setActiveCharacter(chatId, character) {
        this.activeCharacters.set(chatId, character);
    }
    
    getActiveCharacter(chatId) {
        return this.activeCharacters.get(chatId);
    }
    
    clearActiveCharacter(chatId) {
        this.activeCharacters.delete(chatId);
    }
}

module.exports = StateManager;
