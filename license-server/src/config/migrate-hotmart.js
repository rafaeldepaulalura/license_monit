/**
 * LICITANTE PRIME - License Server
 * Migração para integração Hotmart + Plano Trial
 * 
 * Execute: node src/config/migrate-hotmart.js
 */

require('dotenv').config();
const pool = require('./database');

const migration = `
-- ==================== NOVAS COLUNAS PARA HOTMART ====================

-- Adicionar colunas Hotmart na tabela licenses
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS hotmart_subscriber_code VARCHAR(50);
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS hotmart_transaction VARCHAR(50);

-- Índice para busca rápida por subscriber code
CREATE INDEX IF NOT EXISTS idx_licenses_hotmart_subscriber ON licenses(hotmart_subscriber_code);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(customer_email);

-- ==================== TABELA DE WEBHOOKS (AUDITORIA) ====================

CREATE TABLE IF NOT EXISTS hotmart_webhooks (
  id SERIAL PRIMARY KEY,
  event VARCHAR(50) NOT NULL,
  payload JSONB,
  received_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_event ON hotmart_webhooks(event);
CREATE INDEX IF NOT EXISTS idx_webhooks_received ON hotmart_webhooks(received_at);

-- ==================== PLANOS ATUALIZADOS ====================

-- Plano Trial (7 dias grátis)
INSERT INTO plans (id, name, duration_days, price, description, active)
VALUES ('trial', 'Trial - 7 Dias', 7, 0.00, 'Período de teste gratuito por 7 dias', true)
ON CONFLICT (id) DO UPDATE SET
  name = 'Trial - 7 Dias',
  duration_days = 7,
  price = 0.00,
  description = 'Período de teste gratuito por 7 dias',
  active = true;

-- Plano Mensal (Hotmart)
INSERT INTO plans (id, name, duration_days, price, description, active)
VALUES ('mensal', 'Plano Mensal', 30, 41.90, 'Assinatura mensal - R$41,90/mês', true)
ON CONFLICT (id) DO UPDATE SET
  name = 'Plano Mensal',
  duration_days = 30,
  price = 41.90,
  description = 'Assinatura mensal - R$41,90/mês',
  active = true;
`;

async function runMigration() {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║      MIGRAÇÃO HOTMART + TRIAL                        ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log('🔄 Executando migração...');
    
    await pool.query(migration);
    
    console.log('✅ Migração executada com sucesso!');
    console.log('');
    
    // Verificar planos
    const plans = await pool.query('SELECT id, name, duration_days, price FROM plans ORDER BY duration_days');
    console.log('📋 Planos disponíveis:');
    plans.rows.forEach(p => {
      console.log(`   - ${p.id}: ${p.name} (${p.duration_days} dias) - R$${p.price}`);
    });
    
    console.log('');
    console.log('✅ Pronto! O webhook da Hotmart pode ser configurado.');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  }
}

runMigration();
