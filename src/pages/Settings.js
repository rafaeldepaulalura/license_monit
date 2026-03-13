import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Volume2, 
  VolumeX, 
  Clock,
  Save,
  RefreshCw,
  Info,
  Send,
  MessageCircle,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Copy
} from 'lucide-react';

function SettingsPage() {
  const [interval, setInterval] = useState(30);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Estados do Telegram
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState(null);
  const [botLink, setBotLink] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);

  // Carregar configurações
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI) {
        const [intervalValue, soundValue, telegramConfig, botInfo] = await Promise.all([
          window.electronAPI.getMonitoringInterval(),
          window.electronAPI.getSoundEnabled(),
          window.electronAPI.getTelegramConfig(),
          window.electronAPI.getTelegramBotInfo()
        ]);
        setInterval(Math.max(20, intervalValue || 30));
        setSoundEnabled(soundValue !== false);
        
        // Configurações do Telegram
        if (telegramConfig) {
          setTelegramEnabled(telegramConfig.enabled || false);
          setTelegramChatId(telegramConfig.chatId || '');
        }
        
        // Link do bot
        if (botInfo && botInfo.success) {
          setBotLink(botInfo.bot.link);
        }
      }
    };
    loadSettings();
  }, []);

  // Auto-salvar Telegram quando toggle ou chatId mudam
  const saveTelegramConfig = async (enabled, chatId) => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.setTelegramConfig({
          enabled: enabled,
          chatId: (chatId || '').trim()
        });
        console.log('[Settings] Telegram config salva automaticamente');
        setTelegramSaved(true);
        setTimeout(() => setTelegramSaved(false), 2000);
      } catch (error) {
        console.error('[Settings] Erro ao salvar Telegram:', error);
      }
    }
  };

  // Wrapper para toggle do Telegram (salva automaticamente)
  const handleTelegramToggle = (newValue) => {
    setTelegramEnabled(newValue);
    saveTelegramConfig(newValue, telegramChatId);
  };
  
  // Wrapper para Chat ID (salva automaticamente ao sair do campo)
  const handleTelegramChatIdBlur = () => {
    if (telegramChatId.trim()) {
      saveTelegramConfig(telegramEnabled, telegramChatId);
    }
  };

  // Salvar configurações
  const handleSave = async () => {
    setSaving(true);
    
    try {
      if (window.electronAPI) {
        await Promise.all([
          window.electronAPI.setMonitoringInterval(interval),
          window.electronAPI.setSoundEnabled(soundEnabled),
          window.electronAPI.setTelegramConfig({
            enabled: telegramEnabled,
            chatId: telegramChatId.trim()
          })
        ]);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    } finally {
      setSaving(false);
    }
  };
  
  // Testar notificação do Telegram
  const handleTestTelegram = async () => {
    if (!telegramChatId.trim()) {
      setTelegramTestResult({ success: false, error: 'Digite seu Chat ID primeiro' });
      return;
    }
    
    setTelegramTesting(true);
    setTelegramTestResult(null);
    
    try {
      if (window.electronAPI) {
        // Salvar config antes de testar
        await saveTelegramConfig(telegramEnabled, telegramChatId);
        
        const result = await window.electronAPI.testTelegramNotification(telegramChatId.trim());
        setTelegramTestResult(result);
        
        // Se o teste deu certo, ativar automaticamente
        if (result.success && !telegramEnabled) {
          setTelegramEnabled(true);
          await saveTelegramConfig(true, telegramChatId);
        }
      }
    } catch (error) {
      setTelegramTestResult({ success: false, error: error.message });
    } finally {
      setTelegramTesting(false);
    }
  };
  
  // Abrir link do bot no navegador
  const handleOpenBotLink = () => {
    const link = botLink || 'https://t.me/MonitoraChatBot';
    if (window.electronAPI) {
      window.electronAPI.openExternal(link);
    } else {
      window.open(link, '_blank');
    }
  };
  
  // Copiar link do bot
  const handleCopyBotLink = () => {
    const link = botLink || 'https://t.me/MonitoraChatBot';
    navigator.clipboard.writeText(link);
  };

  // Testar som
  const handleTestSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (frequency, startTime, duration) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioCtx.currentTime;
      playBeep(880, now, 0.15);
      playBeep(1100, now + 0.2, 0.15);
      playBeep(880, now + 0.4, 0.15);
      playBeep(1100, now + 0.6, 0.3);
      
    } catch (e) {
      console.error('Erro ao testar som:', e);
    }
  };

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Personalize o comportamento do sistema</p>
      </header>

      <div className="page-content">
        {/* Intervalo de Monitoramento */}
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title">
              <Clock size={16} />
              Intervalo de Monitoramento
            </span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
              Define de quantos em quantos segundos o sistema verifica novas mensagens no chat.
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
              <input
                type="range"
                min="20"
                max="120"
                step="10"
                value={interval}
                onChange={e => setInterval(Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <div style={{
                minWidth: 80,
                padding: 'var(--space-sm) var(--space-md)',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--accent-primary)'
              }}>
                {interval}s
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              fontSize: 11, 
              color: 'var(--text-muted)',
              marginTop: 'var(--space-xs)'
            }}>
              <span>20 segundos (mínimo)</span>
              <span>120 segundos (econômico)</span>
            </div>
          </div>
        </div>

        {/* Som de Alerta */}
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title">
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              Som de Alerta
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                  Tocar som ao detectar palavra-chave
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Um alerta sonoro será emitido quando uma palavra-chave for encontrada
                </p>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestSound}
                >
                  <RefreshCw size={14} />
                  Testar Som
                </button>
                
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  style={{
                    width: 56,
                    height: 30,
                    borderRadius: 15,
                    border: 'none',
                    background: soundEnabled ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'white',
                    top: 3,
                    left: soundEnabled ? 28 : 4,
                    transition: 'all var(--transition-fast)',
                    boxShadow: 'var(--shadow-sm)'
                  }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Notificações Telegram */}
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
              <Send size={16} />
              Notificações via Telegram
              {telegramSaved && (
                <span style={{ 
                  fontSize: 11, 
                  color: 'var(--accent-green)', 
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <CheckCircle size={12} />
                  Salvo!
                </span>
              )}
            </span>
            <button
              onClick={() => handleTelegramToggle(!telegramEnabled)}
              style={{
                width: 56,
                height: 30,
                borderRadius: 15,
                border: 'none',
                background: telegramEnabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all var(--transition-fast)'
              }}
            >
              <span style={{
                position: 'absolute',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'white',
                top: 3,
                left: telegramEnabled ? 28 : 4,
                transition: 'all var(--transition-fast)',
                boxShadow: 'var(--shadow-sm)'
              }} />
            </button>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
              Receba alertas de palavras-chave diretamente no seu Telegram, mesmo quando estiver longe do computador.
            </p>
            
            {/* Passo a passo */}
            <div style={{ 
              background: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius-md)', 
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-lg)'
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>
                <MessageCircle size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                Como configurar (3 passos simples):
              </p>
              <ol style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, paddingLeft: 20 }}>
                <li style={{ marginBottom: 8 }}>
                  <strong>Passo 1:</strong> Clique em <strong>"Obter meu Chat ID"</strong> - vai abrir o bot @userinfobot no Telegram
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Passo 2:</strong> Clique em <strong>"Iniciar"</strong> e o bot vai enviar seu <strong>Id</strong> (número)
                </li>
                <li style={{ marginBottom: 8 }}>
                  <strong>Passo 3:</strong> Copie o número do <strong>Id</strong> e cole no campo abaixo
                </li>
              </ol>
              
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (window.electronAPI) {
                      window.electronAPI.openExternal('https://t.me/userinfobot');
                    } else {
                      window.open('https://t.me/userinfobot', '_blank');
                    }
                  }}
                  style={{ background: '#0088cc' }}
                >
                  <ExternalLink size={14} />
                  Obter meu Chat ID
                </button>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenBotLink}
                  title="Abrir nosso bot de notificações"
                >
                  <Send size={14} />
                  Iniciar Bot de Alertas
                </button>
              </div>
              
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-md)', fontStyle: 'italic' }}>
                Importante: Depois de configurar o Chat ID, clique em "Iniciar Bot de Alertas" para ativar as notificações.
              </p>
            </div>
            
            {/* Campo Chat ID */}
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">
                Seu Chat ID do Telegram
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex: 123456789"
                  value={telegramChatId}
                  onChange={e => setTelegramChatId(e.target.value)}
                  onBlur={handleTelegramChatIdBlur}
                  onKeyDown={e => { if (e.key === 'Enter') handleTelegramChatIdBlur(); }}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                />
                <button 
                  className="btn btn-secondary"
                  onClick={handleTestTelegram}
                  disabled={telegramTesting || !telegramChatId.trim()}
                >
                  {telegramTesting ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      Testar
                    </>
                  )}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                O Chat ID é um número que o bot envia quando você inicia a conversa
              </p>
            </div>
            
            {/* Resultado do teste */}
            {telegramTestResult && (
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                borderRadius: 'var(--radius-md)',
                background: telegramTestResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${telegramTestResult.success ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)'
              }}>
                {telegramTestResult.success ? (
                  <>
                    <CheckCircle size={16} color="var(--accent-green)" />
                    <span style={{ fontSize: 13, color: 'var(--accent-green)' }}>
                      Notificação enviada! Verifique seu Telegram.
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} color="var(--accent-red)" />
                    <span style={{ fontSize: 13, color: 'var(--accent-red)' }}>
                      {telegramTestResult.error || 'Erro ao enviar notificação'}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sobre */}
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="card-header">
            <span className="card-title">
              <Info size={16} />
              Sobre o Sistema
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aplicação</p>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Licitante Prime</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Versão</p>
                <p style={{ fontSize: 14, fontWeight: 500 }}>4.1.0</p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Plataforma</p>
                <p style={{ fontSize: 14, fontWeight: 500 }}>
                  {window.electronAPI?.platform === 'win32' ? 'Windows' :
                   window.electronAPI?.platform === 'darwin' ? 'macOS' : 
                   window.electronAPI?.platform || 'Web'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tecnologia</p>
                <p style={{ fontSize: 14, fontWeight: 500 }}>Electron + React</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botão Salvar */}
        <button 
          className="btn btn-primary btn-lg"
          onClick={handleSave}
          disabled={saving}
          style={{ minWidth: 200 }}
        >
          {saving ? (
            <RefreshCw size={18} className="animate-pulse" />
          ) : saved ? (
            <>
              <Save size={18} />
              Salvo!
            </>
          ) : (
            <>
              <Save size={18} />
              Salvar Configurações
            </>
          )}
        </button>
      </div>
    </>
  );
}

export default SettingsPage;
