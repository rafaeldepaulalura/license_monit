import React, { useState } from 'react';
import { Lock, Save, User, Shield } from 'lucide-react';
import { changePassword } from '../services/api';

function Settings({ admin }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 6 caracteres' });
      return;
    }

    setLoading(true);

    try {
      await changePassword(currentPassword, newPassword);
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Erro ao alterar senha' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Gerencie suas configurações de conta</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)', maxWidth: 900 }}>
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <User size={18} />
              Perfil
            </span>
          </div>
          <div className="card-body">
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--space-lg)',
              marginBottom: 'var(--space-lg)'
            }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 24,
                fontWeight: 700
              }}>
                {admin?.name?.[0] || admin?.username?.[0] || 'A'}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{admin?.name || 'Administrador'}</div>
                <div style={{ color: 'var(--text-secondary)' }}>@{admin?.username}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-md)' }}>
              <div className="flex items-center gap-sm mb-md">
                <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
                <span>Nível de acesso:</span>
                <span className="badge badge-info">{admin?.role || 'admin'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Lock size={18} />
              Alterar Senha
            </span>
          </div>
          <div className="card-body">
            {message.text && (
              <div style={{
                padding: 'var(--space-sm) var(--space-md)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-md)',
                background: message.type === 'error' 
                  ? 'rgba(239, 68, 68, 0.15)' 
                  : 'rgba(34, 197, 94, 0.15)',
                color: message.type === 'error' 
                  ? 'var(--accent-danger)' 
                  : 'var(--accent-success)'
              }}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">Senha Atual</label>
                <input
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nova Senha</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar Nova Senha</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando...' : (
                  <>
                    <Save size={16} />
                    Salvar Nova Senha
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* API Info */}
      <div className="card" style={{ marginTop: 'var(--space-lg)', maxWidth: 900 }}>
        <div className="card-header">
          <span className="card-title">Informações da API</span>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
            Use estas informações para configurar o aplicativo Licitante Prime:
          </p>
          
          <div style={{ 
            background: 'var(--bg-primary)', 
            padding: 'var(--space-md)', 
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'monospace',
            fontSize: 13
          }}>
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <span style={{ color: 'var(--text-muted)' }}>API URL:</span>{' '}
              <span style={{ color: 'var(--accent-info)' }}>
                {window.location.origin.replace(':3000', ':3001')}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Endpoints:</span>
              <ul style={{ margin: 'var(--space-sm) 0 0 var(--space-lg)', color: 'var(--text-secondary)' }}>
                <li>POST /api/licenses/activate</li>
                <li>POST /api/licenses/validate</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
