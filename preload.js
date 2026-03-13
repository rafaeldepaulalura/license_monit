/**
 * LICITANTE PRIME - Preload Script
 * 
 * Bridge seguro entre o Main Process e o Renderer Process.
 * Expõe apenas as APIs necessárias via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== LICENÇA ====================
  getLicense: () => ipcRenderer.invoke('license:get'),
  setLicense: (license) => ipcRenderer.invoke('license:set', license),
  clearLicense: () => ipcRenderer.invoke('license:clear'),
  validateLicense: (key) => ipcRenderer.invoke('license:validate', key),
  checkLicense: () => ipcRenderer.invoke('license:check'),
  
  // Licença Online
  activateLicenseOnline: (key) => ipcRenderer.invoke('license:activateOnline', key),
  validateLicenseOnline: () => ipcRenderer.invoke('license:validateOnline'),
  getHardwareId: () => ipcRenderer.invoke('license:getHardwareId'),

  // ==================== PREGÕES ====================
  getPregoes: () => ipcRenderer.invoke('pregoes:get'),
  addPregao: (pregao) => ipcRenderer.invoke('pregoes:add', pregao),
  removePregao: (pregaoId) => ipcRenderer.invoke('pregoes:remove', pregaoId),

  // ==================== PALAVRAS-CHAVE ====================
  getKeywords: () => ipcRenderer.invoke('keywords:get'),
  setKeywords: (keywords) => ipcRenderer.invoke('keywords:set', keywords),

  // ==================== MONITORAMENTO ====================
  startMonitoring: (pregaoId) => ipcRenderer.invoke('monitoring:start', pregaoId),
  stopMonitoring: (pregaoId) => ipcRenderer.invoke('monitoring:stop', pregaoId),

  // ==================== CONFIGURAÇÕES ====================
  getMonitoringInterval: () => ipcRenderer.invoke('config:getInterval'),
  setMonitoringInterval: (interval) => ipcRenderer.invoke('config:setInterval', interval),
  getSoundEnabled: () => ipcRenderer.invoke('config:getSoundEnabled'),
  setSoundEnabled: (enabled) => ipcRenderer.invoke('config:setSoundEnabled', enabled),
  
  // ==================== TELEGRAM ====================
  getTelegramConfig: () => ipcRenderer.invoke('telegram:getConfig'),
  setTelegramConfig: (config) => ipcRenderer.invoke('telegram:setConfig', config),
  testTelegramNotification: (chatId) => ipcRenderer.invoke('telegram:test', chatId),
  getTelegramBotInfo: () => ipcRenderer.invoke('telegram:getBotInfo'),

  // ==================== MENSAGENS ====================
  getMessageHistory: (pregaoId) => ipcRenderer.invoke('messages:getHistory', pregaoId),
  getSavedMessages: (pregaoId) => ipcRenderer.invoke('messages:getSaved', pregaoId),
  getAllSavedMessages: () => ipcRenderer.invoke('messages:getAllSaved'),
  clearMessageCache: (pregaoId) => ipcRenderer.invoke('messages:clearCache', pregaoId),
  clearAllMessages: () => ipcRenderer.invoke('messages:clearAll'),

  // ==================== EVENTOS (LISTENERS) ====================
  onChatMessages: (callback) => {
    ipcRenderer.on('chat:messages', (event, data) => callback(data));
  },
  offChatMessages: (callback) => {
    ipcRenderer.removeListener('chat:messages', callback);
  },
  
  onAlertKeyword: (callback) => {
    ipcRenderer.on('alert:keyword', (event, data) => callback(data));
  },
  offAlertKeyword: (callback) => {
    ipcRenderer.removeListener('alert:keyword', callback);
  },
  
  // Evento de licença bloqueada
  onLicenseBlocked: (callback) => {
    ipcRenderer.on('license:blocked', (event, data) => callback(data));
  },
  offLicenseBlocked: (callback) => {
    ipcRenderer.removeListener('license:blocked', callback);
  },

  // ==================== SHELL ====================
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // ==================== PLATFORM ====================
  platform: process.platform
});

console.log('Preload script loaded successfully');
