import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Key, 
  Settings, 
  LogOut,
  Shield
} from 'lucide-react';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Licenses from './pages/Licenses';
import SettingsPage from './pages/Settings';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    
    if (token && user) {
      setIsAuthenticated(true);
      setAdmin(JSON.parse(user));
    }
    setLoading(false);
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setIsAuthenticated(false);
    setAdmin(null);
  };

  // Login
  const handleLogin = (token, adminData) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(adminData));
    setIsAuthenticated(true);
    setAdmin(adminData);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sidebar-logo-icon" style={{ margin: '0 auto 16px', width: 64, height: 64 }}>
            <Shield size={32} />
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Menu de navegação
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'licenses', label: 'Licenças', icon: Key },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  // Renderizar página
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'licenses':
        return <Licenses />;
      case 'settings':
        return <SettingsPage admin={admin} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Shield size={22} />
            </div>
            <div>
              <div className="sidebar-logo-text">Licitante Prime</div>
              <div className="sidebar-logo-subtitle">Painel Admin</div>
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
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ marginBottom: 'var(--space-md)', fontSize: 14 }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Logado como</div>
            <div style={{ fontWeight: 600 }}>{admin?.name || admin?.username}</div>
          </div>
          <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleLogout}>
            <LogOut size={18} />
            Sair
          </button>
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
