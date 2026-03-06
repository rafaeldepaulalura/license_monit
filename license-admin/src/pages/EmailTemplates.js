import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, 
  Save, 
  Send, 
  Eye, 
  Code, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle,
  Edit3,
  RefreshCw,
  Info
} from 'lucide-react';
import { 
  getEmailTemplates, 
  getEmailTemplate, 
  updateEmailTemplate, 
  testEmailTemplate 
} from '../services/api';

function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState('preview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [message, setMessage] = useState(null);

  const [editSubject, setEditSubject] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [editActive, setEditActive] = useState(true);

  const previewRef = useRef(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await getEmailTemplates();
      setTemplates(data.templates || []);
    } catch (error) {
      showMessage('Erro ao carregar templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectTemplate = async (tpl) => {
    try {
      const data = await getEmailTemplate(tpl.id);
      const template = data.template;
      setSelectedTemplate(template);
      setEditSubject(template.subject);
      setEditHtml(template.html_content);
      setEditActive(template.active);
      setEditMode(false);
      setViewMode('preview');
    } catch (error) {
      showMessage('Erro ao carregar template', 'error');
    }
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    try {
      setSaving(true);
      await updateEmailTemplate(selectedTemplate.id, {
        subject: editSubject,
        html_content: editHtml,
        active: editActive
      });
      showMessage('Template salvo com sucesso!', 'success');
      setSelectedTemplate({ ...selectedTemplate, subject: editSubject, html_content: editHtml, active: editActive });
      loadTemplates();
    } catch (error) {
      showMessage('Erro ao salvar template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail || !selectedTemplate) return;
    try {
      setTesting(true);
      await testEmailTemplate(selectedTemplate.id, testEmail);
      showMessage(`Email de teste enviado para ${testEmail}`, 'success');
      setShowTestModal(false);
    } catch (error) {
      showMessage('Erro ao enviar email de teste', 'error');
    } finally {
      setTesting(false);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const getPreviewHtml = () => {
    let html = editHtml || '';
    const testVars = {
      '{{nome}}': 'João da Silva',
      '{{chave}}': 'LP-XXXX-XXXX-XXXX-XXXX',
      '{{plano}}': 'Mensal',
      '{{validade}}': new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pt-BR'),
      '{{email}}': 'cliente@exemplo.com',
      '{{motivo}}': 'Pagamento não identificado'
    };
    for (const [key, value] of Object.entries(testVars)) {
      html = html.split(key).join(value);
    }
    return html;
  };

  const getTemplateIcon = (id) => {
    switch (id) {
      case 'new_license': return { color: '#818cf8', bg: 'rgba(129,140,248,0.15)' };
      case 'renewal': return { color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
      case 'blocked': return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
      default: return { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' };
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <p>Carregando templates...</p>
      </div>
    );
  }

  if (selectedTemplate) {
    const iconStyle = getTemplateIcon(selectedTemplate.id);
    return (
      <div className="fade-in">
        {message && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 9999,
            background: message.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
            color: 'white', padding: '12px 20px', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s ease'
          }}>
            {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {message.text}
          </div>
        )}

        <header className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <button 
              className="btn btn-secondary btn-icon" 
              onClick={() => setSelectedTemplate(null)}
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="page-title" style={{ fontSize: 22, marginBottom: 2 }}>{selectedTemplate.name}</h1>
              <p className="page-subtitle">{selectedTemplate.description}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowTestModal(true)}
            >
              <Send size={16} /> Testar
            </button>
            {editMode && (
              <button 
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
            <button 
              className={`btn ${editMode ? 'btn-outline' : 'btn-primary'}`}
              onClick={() => setEditMode(!editMode)}
            >
              <Edit3 size={16} /> {editMode ? 'Cancelar' : 'Editar'}
            </button>
          </div>
        </header>

        {editMode && (
          <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Assunto do Email</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', paddingBottom: 2 }}>
                  <label style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Ativo</label>
                  <button
                    onClick={() => setEditActive(!editActive)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: editActive ? 'var(--accent-success)' : 'var(--bg-tertiary)',
                      position: 'relative', transition: 'background 0.2s'
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3,
                      left: editActive ? 23 : 3, transition: 'left 0.2s'
                    }} />
                  </button>
                </div>
              </div>

              {selectedTemplate.variables && (
                <div style={{
                  marginTop: 'var(--space-md)', padding: '10px 14px',
                  background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <Info size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Variáveis disponíveis:</strong>{' '}
                    {selectedTemplate.variables}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
          <button
            className={`btn ${viewMode === 'preview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('preview')}
            style={{ fontSize: 13 }}
          >
            <Eye size={15} /> Preview
          </button>
          <button
            className={`btn ${viewMode === 'code' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('code')}
            style={{ fontSize: 13 }}
          >
            <Code size={15} /> HTML
          </button>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {viewMode === 'preview' ? (
            <div style={{ background: '#1a1a2e', minHeight: 500 }}>
              <iframe
                ref={previewRef}
                srcDoc={getPreviewHtml()}
                style={{
                  width: '100%', minHeight: 600, border: 'none',
                  background: '#0f1117'
                }}
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <textarea
                value={editHtml}
                onChange={(e) => editMode && setEditHtml(e.target.value)}
                readOnly={!editMode}
                style={{
                  width: '100%', minHeight: 600, padding: 'var(--space-lg)',
                  background: '#0d1117', color: '#c9d1d9', border: 'none',
                  fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                  fontSize: 13, lineHeight: 1.6, resize: 'vertical',
                  outline: 'none', tabSize: 2
                }}
                spellCheck={false}
              />
              {!editMode && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11
                }}>
                  Somente leitura - Clique em "Editar" para modificar
                </div>
              )}
            </div>
          )}
        </div>

        {showTestModal && (
          <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Send size={18} /> Enviar Email de Teste
                </span>
                <button 
                  className="btn btn-icon btn-secondary" 
                  onClick={() => setShowTestModal(false)}
                  style={{ fontSize: 18 }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 'var(--space-md)' }}>
                  O email será enviado com dados fictícios para você visualizar como o cliente recebe.
                </p>
                <div className="form-group">
                  <label className="form-label">Email de destino</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="seu@email.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowTestModal(false)}>
                  Cancelar
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleTest}
                  disabled={testing || !testEmail}
                >
                  <Send size={16} /> {testing ? 'Enviando...' : 'Enviar Teste'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in">
      {message && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: message.type === 'success' ? 'rgba(34,197,94,0.9)' : 'rgba(239,68,68,0.9)',
          color: 'white', padding: '12px 20px', borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)', animation: 'fadeIn 0.3s ease'
        }}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Templates de Email</h1>
            <p className="page-subtitle">Configure os emails enviados automaticamente aos clientes</p>
          </div>
          <button className="btn btn-secondary" onClick={loadTemplates}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
        {templates.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
              <Mail size={48} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>
                Nenhum template encontrado.
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Execute a migração no servidor: <code>npm run migrate:email-templates</code>
              </p>
            </div>
          </div>
        ) : (
          templates.map(tpl => {
            const iconStyle = getTemplateIcon(tpl.id);
            return (
              <div 
                key={tpl.id} 
                className="card" 
                style={{ cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-color)' }}
                onClick={() => selectTemplate(tpl)}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 'var(--radius-md)',
                    background: iconStyle.bg, color: iconStyle.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Mail size={24} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600 }}>{tpl.name}</span>
                      <span className={`badge ${tpl.active ? 'badge-success' : 'badge-secondary'}`}>
                        {tpl.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 4 }}>
                      {tpl.description}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      Assunto: {tpl.subject}
                    </p>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'right', flexShrink: 0 }}>
                    {tpl.updated_at && (
                      <div>Atualizado: {new Date(tpl.updated_at).toLocaleDateString('pt-BR')}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 'var(--radius-md)',
            background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Info size={22} />
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Como funciona?</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
              Os templates usam variáveis dinâmicas como <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>{'{{nome}}'}</code>, 
              {' '}<code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>{'{{chave}}'}</code>, 
              {' '}<code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4 }}>{'{{plano}}'}</code> que são 
              substituídas pelos dados reais do cliente na hora do envio. Edite o HTML diretamente para personalizar 
              o layout e o conteúdo. Use o botão "Testar" para enviar um email de teste para o seu email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailTemplates;
