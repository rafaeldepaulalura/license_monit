/**
 * LICITANTE PRIME - License Server
 * Script de Migração do Banco de Dados
 */

require('dotenv').config();
const pool = require('./database');

const migrations = `
-- Tabela de Administradores
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'admin',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Planos
CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  duration_days INTEGER NOT NULL,
  price DECIMAL(10,2),
  description TEXT,
  active BOOLEAN DEFAULT true
);

-- Tabela de Licenças
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(50) UNIQUE NOT NULL,
  plan_id VARCHAR(20) REFERENCES plans(id),
  status VARCHAR(20) DEFAULT 'pending',
  hardware_id VARCHAR(100),
  machine_name VARCHAR(100),
  customer_name VARCHAR(100),
  customer_email VARCHAR(100),
  customer_phone VARCHAR(20),
  notes TEXT,
  activated_at TIMESTAMP,
  expires_at TIMESTAMP,
  blocked_at TIMESTAMP,
  blocked_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_validation_at TIMESTAMP,
  last_validation_ip VARCHAR(50),
  activation_count INTEGER DEFAULT 0,
  max_activations INTEGER DEFAULT 1
);

-- Tabela de Logs de Licença
CREATE TABLE IF NOT EXISTS license_logs (
  id SERIAL PRIMARY KEY,
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  details JSONB,
  ip_address VARCHAR(50),
  hardware_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_hardware ON licenses(hardware_id);
CREATE INDEX IF NOT EXISTS idx_logs_license ON license_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON license_logs(created_at);

-- Inserir planos padrão
INSERT INTO plans (id, name, duration_days, price, description) VALUES
  ('mensal', 'Mensal', 30, 49.90, 'Acesso por 30 dias'),
  ('trimestral', 'Trimestral', 90, 129.90, 'Acesso por 90 dias'),
  ('semestral', 'Semestral', 180, 239.90, 'Acesso por 180 dias'),
  ('anual', 'Anual', 365, 399.90, 'Acesso por 1 ano'),
  ('vitalicio', 'Vitalício', 36500, 999.90, 'Acesso permanente')
ON CONFLICT (id) DO NOTHING;
`;

async function runMigrations() {
  try {
    console.log('🔄 Executando migrações...');
    await pool.query(migrations);
    console.log('✅ Migrações executadas com sucesso!');
    
    // Verificar se existe admin
    const adminCheck = await pool.query('SELECT COUNT(*) FROM admins');
    if (parseInt(adminCheck.rows[0].count) === 0) {
      console.log('⚠️  Nenhum admin encontrado. Execute: npm run seed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  }
}

runMigrations();
