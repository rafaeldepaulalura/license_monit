import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Ban, 
  CheckCircle, 
  RefreshCw,
  Copy,
  X,
  Trash2,
  Monitor,
  Calendar,
  User,
  Mail,
  Phone,
  FileText
} from 'lucide-react';
import { 
  getLicenses, 
  getLicense, 
  createLicense, 
  blockLicense, 
  unblockLicense, 
  resetHardware,
  deleteLicense,
  getPlans 
} from '../services/api';

function Licenses() {
  const [licenses, setLicenses] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState(null);
  const [selectedLicenseDetails, setSelectedLicenseDetails] = useState(null);
  
  // Form
  const [formData, setFormData] = useState({
    planId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    notes: ''
  });
  const [blockReason, setBlockReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const loadData = async () => {
    try {
      const [licensesData, plansData] = await Promise.all([
        getLicenses({ search, status: statusFilter }),
        getPlans()
      ]);
      setLicenses(licensesData.licenses);
      setPlans(plansData.plans);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLicense = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    
    try {
      await createLicense(formData);
      setShowCreateModal(false);
      setFormData({ planId: '', customerName: '', customerEmail: '', customerPhone: '', notes: '' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao criar licença');
    } finally {
      setFormLoading(false);
    }
  };

  const handleViewDetails = async (license) => {
    try {
      const data = await getLicense(license.id);
      setSelectedLicenseDetails(data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }
  };

  const handleBlock = (license) => {
    setSelectedLicense(license);
    setBlockReason('');
    setShowBlockModal(true);
  };

  const confirmBlock = async () => {
    setFormLoading(true);
    try {
      await blockLicense(selectedLicense.id, blockReason);
      setShowBlockModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao bloquear');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUnblock = async (license) => {
    if (!window.confirm('Deseja desbloquear esta licença?')) return;
    
    try {
      await unblockLicense(license.id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao desbloquear');
    }
  };

  const handleResetHardware = async (license) => {
    if (!window.confirm('Deseja resetar o hardware? A licença poderá ser ativada em outro computador.')) return;
    
    try {
      await resetHardware(license.id);
      loadData();
      if (showDetailModal) {
        handleViewDetails(license);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao resetar');
    }
  };

  const handleDelete = async (license) => {
    if (!window.confirm(`Deseja EXCLUIR permanentemente a licença ${license.license_key}?`)) return;
    
    try {
      await deleteLicense(license.id);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Erro ao excluir');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copiado!');
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { class: 'badge-success', label: 'Ativa', icon: CheckCircle },
      pending: { class: 'badge-warning', label: 'Pendente', icon: RefreshCw },
      blocked: { class: 'badge-danger', label: 'Bloqueada', icon: Ban },
      expired: { class: 'badge-secondary', label: 'Expirada', icon: X }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`badge ${badge.class}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="fade-in">
      <header className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="page-title">Licenças</h1>
            <p className="page-subtitle">Gerencie todas as licenças do sistema</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            Nova Licença
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="card mb-lg">
        <div className="card-body flex gap-md">
          <div style={{ flex: 1, position: 'relative' }}>
            <Search 
              size={18} 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} 
            />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 40 }}
              placeholder="Buscar por chave, nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="form-select" 
            style={{ width: 200 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativas</option>
            <option value="pending">Pendentes</option>
            <option value="blocked">Bloqueadas</option>
            <option value="expired">Expiradas</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Chave</th>
                <th>Cliente</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Máquina</th>
                <th>Expira em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>Carregando...</td>
                </tr>
              ) : licenses.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhuma licença encontrada
                  </td>
                </tr>
              ) : (
                licenses.map(license => (
                  <tr key={license.id}>
                    <td>
                      <div className="flex items-center gap-sm">
                        <code className="license-key" style={{ fontSize: 11 }}>
                          {license.license_key}
                        </code>
                        <button 
                          className="btn btn-icon btn-secondary btn-sm"
                          onClick={() => copyToClipboard(license.license_key)}
                          title="Copiar"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div>{license.customer_name || '-'}</div>
                      {license.customer_email && (
                        <div className="text-sm text-muted">{license.customer_email}</div>
                      )}
                    </td>
                    <td>{license.plan_name}</td>
                    <td>{getStatusBadge(license.status)}</td>
                    <td>
                      {license.hardware_id ? (
                        <span className="badge badge-info">
                          <Monitor size={12} />
                          {license.machine_name || 'Ativada'}
                        </span>
                      ) : (
                        <span className="text-muted">Não ativada</span>
                      )}
                    </td>
                    <td>
                      {license.expires_at 
                        ? formatDate(license.expires_at)
                        : <span className="text-muted">Não definido</span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-sm">
                        <button 
                          className="btn btn-icon btn-secondary btn-sm"
                          onClick={() => handleViewDetails(license)}
                          title="Detalhes"
                        >
                          <Eye size={14} />
                        </button>
                        {license.status === 'blocked' ? (
                          <button 
                            className="btn btn-icon btn-success btn-sm"
                            onClick={() => handleUnblock(license)}
                            title="Desbloquear"
                          >
                            <CheckCircle size={14} />
                          </button>
                        ) : (
                          <button 
                            className="btn btn-icon btn-danger btn-sm"
                            onClick={() => handleBlock(license)}
                            title="Bloquear"
                          >
                            <Ban size={14} />
                          </button>
                        )}
                        {license.hardware_id && (
                          <button 
                            className="btn btn-icon btn-secondary btn-sm"
                            onClick={() => handleResetHardware(license)}
                            title="Resetar Hardware"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                        <button 
                          className="btn btn-icon btn-danger btn-sm"
                          onClick={() => handleDelete(license)}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nova Licença</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowCreateModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateLicense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Plano *</label>
                  <select 
                    className="form-select"
                    value={formData.planId}
                    onChange={(e) => setFormData({...formData, planId: e.target.value})}
                    required
                  >
                    <option value="">Selecione um plano</option>
                    {plans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} - R$ {parseFloat(plan.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Nome do Cliente</label>
                  <input 
                    type="text"
                    className="form-input"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    placeholder="Nome completo"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    type="email"
                    className="form-input"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({...formData, customerEmail: e.target.value})}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Telefone</label>
                  <input 
                    type="text"
                    className="form-input"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Observações</label>
                  <textarea 
                    className="form-textarea"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Anotações sobre o cliente..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading}>
                  {formLoading ? 'Criando...' : 'Criar Licença'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLicenseDetails && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detalhes da Licença</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowDetailModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ 
                background: 'var(--bg-primary)', 
                padding: 'var(--space-md)', 
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-lg)',
                textAlign: 'center'
              }}>
                <div className="text-muted text-sm mb-md">Chave da Licença</div>
                <code className="license-key" style={{ fontSize: 16 }}>
                  {selectedLicenseDetails.license.license_key}
                </code>
                <button 
                  className="btn btn-sm btn-secondary" 
                  style={{ marginLeft: 'var(--space-sm)' }}
                  onClick={() => copyToClipboard(selectedLicenseDetails.license.license_key)}
                >
                  <Copy size={14} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div>
                  <div className="text-muted text-sm flex items-center gap-sm">
                    <User size={14} /> Cliente
                  </div>
                  <div>{selectedLicenseDetails.license.customer_name || '-'}</div>
                </div>
                <div>
                  <div className="text-muted text-sm flex items-center gap-sm">
                    <Mail size={14} /> Email
                  </div>
                  <div>{selectedLicenseDetails.license.customer_email || '-'}</div>
                </div>
                <div>
                  <div className="text-muted text-sm flex items-center gap-sm">
                    <Phone size={14} /> Telefone
                  </div>
                  <div>{selectedLicenseDetails.license.customer_phone || '-'}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Plano</div>
                  <div>{selectedLicenseDetails.license.plan_name}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Status</div>
                  <div>{getStatusBadge(selectedLicenseDetails.license.status)}</div>
                </div>
                <div>
                  <div className="text-muted text-sm flex items-center gap-sm">
                    <Calendar size={14} /> Expira em
                  </div>
                  <div>{formatDate(selectedLicenseDetails.license.expires_at)}</div>
                </div>
                <div>
                  <div className="text-muted text-sm flex items-center gap-sm">
                    <Monitor size={14} /> Máquina
                  </div>
                  <div>{selectedLicenseDetails.license.machine_name || 'Não ativada'}</div>
                </div>
                <div>
                  <div className="text-muted text-sm">Último IP</div>
                  <div>{selectedLicenseDetails.license.last_validation_ip || '-'}</div>
                </div>
              </div>

              {selectedLicenseDetails.license.hardware_id && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <div className="text-muted text-sm mb-md">Hardware ID</div>
                  <code style={{ 
                    fontSize: 11, 
                    wordBreak: 'break-all',
                    background: 'var(--bg-primary)',
                    padding: 'var(--space-sm)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'block'
                  }}>
                    {selectedLicenseDetails.license.hardware_id}
                  </code>
                </div>
              )}

              {selectedLicenseDetails.license.notes && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <div className="text-muted text-sm flex items-center gap-sm mb-md">
                    <FileText size={14} /> Observações
                  </div>
                  <div style={{ 
                    background: 'var(--bg-primary)',
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    {selectedLicenseDetails.license.notes}
                  </div>
                </div>
              )}

              {selectedLicenseDetails.logs?.length > 0 && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <div className="text-muted text-sm mb-md">Histórico de Ações</div>
                  <div style={{ maxHeight: 200, overflow: 'auto' }}>
                    {selectedLicenseDetails.logs.slice(0, 10).map((log, index) => (
                      <div 
                        key={index}
                        style={{ 
                          padding: 'var(--space-sm)',
                          borderBottom: '1px solid var(--border-color)',
                          fontSize: 12
                        }}
                      >
                        <span className="badge badge-secondary" style={{ marginRight: 'var(--space-sm)' }}>
                          {log.action}
                        </span>
                        <span className="text-muted">{formatDate(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedLicenseDetails.license.hardware_id && (
                <button 
                  className="btn btn-secondary"
                  onClick={() => handleResetHardware(selectedLicenseDetails.license)}
                >
                  <RefreshCw size={16} />
                  Resetar Hardware
                </button>
              )}
              <button className="btn btn-primary" onClick={() => setShowDetailModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Bloquear Licença</h3>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowBlockModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 'var(--space-md)' }}>
                Deseja bloquear a licença <strong>{selectedLicense?.license_key}</strong>?
              </p>
              <div className="form-group">
                <label className="form-label">Motivo do bloqueio</label>
                <textarea 
                  className="form-textarea"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Ex: Pagamento não confirmado..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBlockModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmBlock} disabled={formLoading}>
                {formLoading ? 'Bloqueando...' : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Licenses;
