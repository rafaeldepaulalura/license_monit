/**
 * LICITANTE PRIME - License Server
 * Script para criar admin inicial
 */

require('dotenv').config();
const pool = require('./database');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('🔄 Criando admin inicial...');
    
    // Senha padrão: admin123 (MUDE APÓS O PRIMEIRO LOGIN!)
    const passwordHash = await bcrypt.hash('admin123', 12);
    
    const result = await pool.query(`
      INSERT INTO admins (username, password_hash, name, email, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = $2,
        updated_at = NOW()
      RETURNING id, username
    `, ['admin', passwordHash, 'Administrador', 'admin@licitanteprime.com.br', 'superadmin']);
    
    console.log('✅ Admin criado/atualizado:', result.rows[0]);
    console.log('');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║       CREDENCIAIS DO ADMINISTRADOR         ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log('║  Usuário: admin                            ║');
    console.log('║  Senha:   admin123                         ║');
    console.log('║                                            ║');
    console.log('║  ⚠️  MUDE A SENHA APÓS O PRIMEIRO LOGIN!   ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

seed();
