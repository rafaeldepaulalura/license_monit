import React, { useState, useEffect } from 'react';
import { 
  Key, 
  CheckCircle, 
  Clock, 
  XCircle, 
  Activity,
  TrendingUp
} from 'lucide-react';
import { getStats, getLicenses } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentLicenses, setRecentLicenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, licensesData] = await Promise.all([
        getStats(),
        getLicenses({ limit: 5 })
      ]);
      setStats(statsData);
      setRecentLicenses(licensesData.licenses);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: { class: 'badge-success', label: 'Ativa' },
      pending: { class: 'badge-warning', label: 'Pendente' },
      blocked: { class: 'badge-danger', label: 'Bloqueada' },
      expired: { class: 'badge-secondary', label: 'Expirada' }
    };
    const badge = badges[status] || badges.pending;
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Visão geral do sistema de licenças</p>
      </header>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Key size={24} />
          </div>
          <div className="stat-value">{stats?.total_count || 0}</div>
          <div className="stat-label">Total de Licenças</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-value">{stats?.active_count || 0}</div>
          <div className="stat-label">Licenças Ativas</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow">
            <Clock size={24} />
          </div>
          <div className="stat-value">{stats?.pending_count || 0}</div>
          <div className="stat-label">Pendentes</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-value">{stats?.blocked_count || 0}</div>
          <div className="stat-label">Bloqueadas</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-lg)' }}>
        {/* Recent Licenses */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Activity size={18} />
              Últimas Licenças
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Chave</th>
                  <th>Cliente</th>
                  <th>Plano</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLicenses.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma licença cadastrada
                    </td>
                  </tr>
                ) : (
                  recentLicenses.map(license => (
                    <tr key={license.id}>
                      <td>
                        <code className="license-key" style={{ fontSize: 11 }}>
                          {license.license_key}
                        </code>
                      </td>
                      <td>{license.customer_name || '-'}</td>
                      <td>{license.plan_name}</td>
                      <td>{getStatusBadge(license.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stats by Plan */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <TrendingUp size={18} />
              Por Plano
            </span>
          </div>
          <div className="card-body">
            {stats?.by_plan?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                Sem dados
              </p>
            ) : (
              stats?.by_plan?.map((item, index) => (
                <div 
                  key={index}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--space-sm) 0',
                    borderBottom: index < stats.by_plan.length - 1 ? '1px solid var(--border-color)' : 'none'
                  }}
                >
                  <span>{item.name}</span>
                  <span className="badge badge-info">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity Info */}
      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div className="stat-icon green">
            <TrendingUp size={24} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              {stats?.recent_activations || 0} ativações
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Nos últimos 7 dias
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
