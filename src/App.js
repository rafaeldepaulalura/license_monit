import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Tags, 
  Bell, 
  Settings, 
  Key,
  Activity,
  AlertTriangle,
  Lock,
  Clock
} from 'lucide-react';

// Páginas
import Dashboard from './pages/Dashboard';
import Pregoes from './pages/Pregoes';
import Keywords from './pages/Keywords';
import Alerts from './pages/Alerts';
import License from './pages/License';
import SettingsPage from './pages/Settings';

function ExpiredScreen({ license, setLicense }) {
  const [checking, setChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  useEffect(() => {
    let interval;
    
    const checkOnline = async () => {
      if (!window.electronAPI?.validateLicenseOnline || !license?.key) return;
      
      setChecking(true);
      try {
        const result = await window.electronAPI.validateLicenseOnline();
        setLastCheck(new Date().toLocaleTimeString('pt-BR'));
        
        if (result?.valid && !result?.offline) {
          const updatedLicense = await window.electronAPI.getLicense();
          if (updatedLicense && updatedLicense.valid && !updatedLicense.expired) {
            setLicense(updatedLicense);
          }
        }
      } catch (err) {
        console.log('Erro na verificação:', err);
      } finally {
        setChecking(false);
      }
    };

    checkOnline();
    interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, [license?.key, setLicense]);

  return (
    <div className="app-container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)'
    }}>
      <div style={{
        maxWidth: 500,
        textAlign: 'center',
        padding: 'var(--space-xl)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '2px solid var(--accent-orange)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'var(--accent-orange-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto var(--space-lg)'
        }}>
          <Clock size={50} color="var(--accent-orange)" />
        </div>
        
        <h1 style={{ 
          fontSize: 28, 
          fontWeight: 700, 
          color: 'var(--accent-orange)',
          marginBottom: 'var(--space-md)'
        }}>
          Licença Expirada
        </h1>
        
        <p style={{ 
          color: 'var(--text-secondary)', 
          marginBottom: 'var(--space-lg)',
          lineHeight: 1.6
        }}>
          Sua licença do <strong>Licitante Prime</strong> expirou em{' '}
          <strong>{new Date(license?.expiresAt).toLocaleDateString('pt-BR')}</strong>.
          <br />
          Renove sua licença para continuar usando o sistema.
        </p>

        <div style={{
          background: 'var(--bg-tertiary)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 'var(--space-lg)'
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
            Plano
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            {license?.planInfo?.label || license?.type || 'N/A'}
          </div>
        </div>

        <button 
          className="btn btn-primary btn-lg"
          onClick={async () => {
            if (window.electronAPI?.clearLicense) {
              await window.electronAPI.clearLicense();
            }
            setLicense({ allowAccess: true, cleared: true });
          }}
          style={{ width: '100%' }}
        >
          <Key size={18} />
          Renovar Licença
        </button>

        <div style={{ 
          marginTop: 'var(--space-lg)',
          padding: 'var(--space-sm) var(--space-md)',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: checking ? 'var(--accent-orange)' : 'var(--accent-green)',
            animation: checking ? 'pulse 1s infinite' : 'none'
          }} />
          {checking 
            ? 'Verificando renovação...' 
            : lastCheck 
              ? `Última verificação: ${lastCheck} — Verificando a cada 30s`
              : 'Aguardando verificação...'
          }
        </div>

        <p style={{ 
          fontSize: 11, 
          color: 'var(--text-muted)', 
          marginTop: 'var(--space-sm)'
        }}>
          Quando a licença for renovada, o sistema desbloqueará automaticamente.
        </p>
      </div>
    </div>
  );
}

function App() {
  // Estado global
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [license, setLicense] = useState(null);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [pregoes, setPregoes] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [messages, setMessages] = useState({}); // { pregaoId: [messages] }
  const [pregoesWithAlerts, setPregoesWithAlerts] = useState(new Set()); // Pregões com alertas não lidos

  // Carregar dados iniciais e verificar licença
  useEffect(() => {
    const loadInitialData = async () => {
      if (window.electronAPI) {
        try {
          const [licenseData, pregoesData, keywordsData, savedMessagesData] = await Promise.all([
            window.electronAPI.getLicense(),
            window.electronAPI.getPregoes(),
            window.electronAPI.getKeywords(),
            window.electronAPI.getAllSavedMessages() // Carregar mensagens salvas
          ]);
          
          setLicense(licenseData);
          setPregoes(pregoesData || []);
          setKeywords(keywordsData || []);
          
          // Carregar mensagens salvas
          if (savedMessagesData && Object.keys(savedMessagesData).length > 0) {
            console.log('📂 Mensagens salvas carregadas:', Object.keys(savedMessagesData).length, 'pregões');
            setMessages(savedMessagesData);
          }
        } catch (error) {
          console.error('Erro ao carregar dados:', error);
        }
      }
      setLicenseChecked(true);
    };

    loadInitialData();
  }, []);

  // Verificar licença periodicamente (a cada 5 minutos)
  useEffect(() => {
    const checkLicense = async () => {
      if (window.electronAPI) {
        try {
          const licenseData = await window.electronAPI.getLicense();
          setLicense(licenseData);
        } catch (error) {
          console.error('Erro ao verificar licença:', error);
        }
      }
    };

    const interval = setInterval(checkLicense, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Listeners para mensagens e alertas do Main Process
  useEffect(() => {
    if (!window.electronAPI) return;

    // Listener para novas mensagens
    const handleMessages = (data) => {
      console.log('📨 Novas mensagens recebidas para pregão:', data.pregaoId, 'quantidade:', data.messages?.length);
      
      if (!data.pregaoId || !data.messages) {
        console.error('❌ Dados inválidos recebidos:', data);
        return;
      }
      
      setMessages(prev => {
        // Obter mensagens existentes para este pregão
        const existingMsgs = prev[data.pregaoId] || [];
        
        // IDs das mensagens já existentes para evitar duplicatas
        const existingIds = new Set(existingMsgs.map(m => m.uniqueId || m.id));
        
        // Filtrar apenas mensagens novas
        const newMsgs = data.messages.filter(m => {
          const msgId = m.uniqueId || m.id;
          return !existingIds.has(msgId);
        });
        
        console.log(`📨 Pregão ${data.pregaoId}: ${newMsgs.length} novas (${existingMsgs.length} existentes)`);
        
        if (newMsgs.length === 0) {
          return prev; // Sem mudanças
        }
        
        // Combinar e ordenar por timestamp (mais recente primeiro)
        const allMsgs = [...newMsgs, ...existingMsgs];
        allMsgs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        return {
          ...prev,
          [data.pregaoId]: allMsgs
        };
      });
    };

    // Listener para alertas de palavras-chave
    const handleAlert = (data) => {
      console.log('🚨 ALERTA:', data);
      setAlerts(prev => [{
        id: Date.now(),
        ...data,
        read: false
      }, ...prev].slice(0, 100));
      
      // Marcar pregão como tendo alerta não lido
      if (data.pregaoId) {
        setPregoesWithAlerts(prev => new Set([...prev, data.pregaoId]));
      }
      
      // Tocar som de alerta
      playAlertSound();
    };
    
    // Listener para licença bloqueada pelo servidor
    const handleLicenseBlocked = (data) => {
      console.log('🚫 Licença bloqueada:', data);
      setLicense(prev => ({
        ...prev,
        valid: false,
        blocked: true,
        blockReason: data.error,
        blockCode: data.code
      }));
      
      // Tocar som de alerta
      playAlertSound();
    };

    window.electronAPI.onChatMessages(handleMessages);
    window.electronAPI.onAlertKeyword(handleAlert);
    
    if (window.electronAPI.onLicenseBlocked) {
      window.electronAPI.onLicenseBlocked(handleLicenseBlocked);
    }

    return () => {
      // Cleanup listeners se necessário
    };
  }, []);

  // Tocar som de alerta
  const playAlertSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Criar sequência de beeps para alerta
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
      console.error('Erro ao tocar som:', e);
    }
  }, []);

  // Handlers
  const handleLicenseUpdate = (newLicense) => {
    setLicense(newLicense);
  };

  const handlePregoesUpdate = (newPregoes) => {
    setPregoes(newPregoes);
  };

  const handleKeywordsUpdate = (newKeywords) => {
    setKeywords(newKeywords);
    if (window.electronAPI) {
      window.electronAPI.setKeywords(newKeywords);
    }
  };

  const handleMarkAlertRead = (alertId) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, read: true } : a
    ));
  };

  // Limpar indicador de alerta de um pregão
  const handleClearPregaoAlert = (pregaoId) => {
    setPregoesWithAlerts(prev => {
      const newSet = new Set(prev);
      newSet.delete(pregaoId);
      return newSet;
    });
  };

  // Verificar licença
  const isLicenseValid = license && license.valid && !license.expired && !license.blocked && new Date(license.expiresAt) > new Date();
  const isLicenseExpired = license && (license.expired || new Date(license.expiresAt) <= new Date());
  const isLicenseBlocked = license && license.blocked;
  
  // Contadores
  const activeMonitoring = pregoes.filter(p => p.monitoring).length;
  const unreadAlerts = alerts.filter(a => !a.read).length;

  // Calcular dias restantes
  const daysRemaining = license?.expiresAt 
    ? Math.max(0, Math.ceil((new Date(license.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Tela de bloqueio quando licença foi bloqueada pelo servidor
  if (licenseChecked && isLicenseBlocked) {
    return (
      <div className="app-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)'
      }}>
        <div style={{
          maxWidth: 500,
          textAlign: 'center',
          padding: 'var(--space-xl)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '2px solid var(--accent-red)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'var(--accent-red-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-lg)'
          }}>
            <Lock size={50} color="var(--accent-red)" />
          </div>
          
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: 'var(--accent-red)',
            marginBottom: 'var(--space-md)'
          }}>
            Licença Bloqueada
          </h1>
          
          <p style={{ 
            color: 'var(--text-secondary)', 
            marginBottom: 'var(--space-lg)',
            lineHeight: 1.6
          }}>
            Sua licença do <strong>Licitante Prime</strong> foi bloqueada.
            <br />
            {license?.blockReason || 'Entre em contato com o suporte para mais informações.'}
          </p>

          <div style={{
            background: 'var(--bg-tertiary)',
            padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-lg)'
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
              Código do Erro
            </div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {license?.blockCode || 'LICENSE_BLOCKED'}
            </div>
          </div>

          <button 
            className="btn btn-primary btn-lg"
            onClick={() => {
              // Permitir acesso à tela de licença para inserir nova chave
              setLicense(prev => ({ ...prev, allowAccess: true, blocked: false }));
            }}
            style={{ width: '100%' }}
          >
            <Key size={18} />
            Inserir Nova Licença
          </button>

          <p style={{ 
            fontSize: 11, 
            color: 'var(--text-muted)', 
            marginTop: 'var(--space-lg)'
          }}>
            Suporte: contato@licitanteprime.com.br
          </p>
        </div>
      </div>
    );
  }

  // Tela de bloqueio quando licença está expirada
  if (licenseChecked && isLicenseExpired) {
    return <ExpiredScreen license={license} setLicense={setLicense} />;
  }

  // Permitir acesso à tela de licença se clicou em "Renovar"
  if (licenseChecked && (license?.allowAccess || license?.cleared)) {
    return (
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon" style={{ background: 'var(--accent-orange-muted)' }}>
                <Lock size={22} color="var(--accent-orange)" />
              </div>
              <div className="sidebar-logo-text">
                <span className="sidebar-logo-title">Licitante Prime</span>
                <span className="sidebar-logo-subtitle" style={{ color: 'var(--accent-orange)' }}>EXPIRADO</span>
              </div>
            </div>
          </div>
          <div style={{ padding: 'var(--space-lg)', textAlign: 'center' }}>
            <AlertTriangle size={40} color="var(--accent-orange)" />
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 'var(--space-md)' }}>
              Ative uma nova licença para desbloquear
            </p>
          </div>
        </aside>
        <main className="main-content">
          <License 
            license={license}
            onLicenseUpdate={handleLicenseUpdate}
          />
        </main>
      </div>
    );
  }

  // Menu de navegação
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pregoes', label: 'Pregões', icon: FileText, badge: activeMonitoring > 0 ? activeMonitoring : null },
    { id: 'keywords', label: 'Palavras-chave', icon: Tags },
    { id: 'alerts', label: 'Alertas', icon: Bell, badge: unreadAlerts > 0 ? unreadAlerts : null },
    { id: 'license', label: 'Licença', icon: Key },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  // Renderizar página atual
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            pregoes={pregoes}
            alerts={alerts}
            messages={messages}
            isLicenseValid={isLicenseValid}
          />
        );
      case 'pregoes':
        return (
          <Pregoes 
            pregoes={pregoes}
            onPregoesUpdate={handlePregoesUpdate}
            messages={messages}
            isLicenseValid={isLicenseValid}
            pregoesWithAlerts={pregoesWithAlerts}
            onClearPregaoAlert={handleClearPregaoAlert}
          />
        );
      case 'keywords':
        return (
          <Keywords 
            keywords={keywords}
            onKeywordsUpdate={handleKeywordsUpdate}
          />
        );
      case 'alerts':
        return (
          <Alerts 
            alerts={alerts}
            onMarkRead={handleMarkAlertRead}
          />
        );
      case 'license':
        return (
          <License 
            license={license}
            onLicenseUpdate={handleLicenseUpdate}
          />
        );
      case 'settings':
        return <SettingsPage />;
      default:
        return <Dashboard pregoes={pregoes} alerts={alerts} messages={messages} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Activity size={22} />
            </div>
            <div className="sidebar-logo-text">
              <span className="sidebar-logo-title">Licitante Prime</span>
              <span className="sidebar-logo-subtitle">MONITORAMENTO</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <item.icon size={20} className="nav-icon" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="license-status">
            <span className={`license-dot ${isLicenseValid ? 'valid' : 'invalid'}`} />
            <span style={{ color: isLicenseValid ? 'var(--accent-green)' : 'var(--accent-red)' }}>
              {isLicenseValid ? 'Licença Ativa' : 'Licença Inválida'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
