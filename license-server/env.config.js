/**
 * LICITANTE PRIME - License Server
 * Exemplo de Configuração de Ambiente
 * 
 * COPIE ESTE ARQUIVO PARA .env E CONFIGURE AS VARIÁVEIS
 * 
 * Variáveis necessárias:
 * 
 * PORT=3001
 * NODE_ENV=production
 * 
 * # Banco de Dados PostgreSQL
 * DATABASE_URL=postgresql://usuario:senha@host:5432/licitante_licenses
 * 
 * # Segurança
 * JWT_SECRET=sua-chave-jwt-secreta-aqui-mude-isso
 * LICENSE_SECRET=sua-chave-licenca-secreta-aqui-mude-isso
 * APP_API_KEY=sua-api-key-do-app-aqui-mude-isso
 * 
 * # CORS (domínios permitidos, separados por vírgula)
 * CORS_ORIGINS=https://admin.seudominio.com,http://localhost:3000
 */

// Se não existir arquivo .env, usar valores padrão para desenvolvimento
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL não configurada. Configure o arquivo .env');
}

module.exports = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  licenseSecret: process.env.LICENSE_SECRET || 'dev-license-secret',
  appApiKey: process.env.APP_API_KEY || 'dev-api-key',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*']
};
