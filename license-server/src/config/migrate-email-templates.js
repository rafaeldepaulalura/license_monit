/**
 * LICITANTE PRIME - License Server
 * Migração para tabela de templates de email
 * 
 * Execute: node src/config/migrate-email-templates.js
 */

require('dotenv').config();
const pool = require('./database');

const migration = `
-- Tabela de Templates de Email
CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(30) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  html_content TEXT NOT NULL,
  description TEXT,
  variables TEXT,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);
`;

const defaultTemplates = [
  {
    id: 'new_license',
    name: 'Nova Licença',
    subject: '🔑 Sua Licença do Monitoramento de Chat - Licitante Prime',
    description: 'Enviado quando o cliente compra pela primeira vez',
    variables: '{{nome}}, {{chave}}, {{plano}}, {{validade}}, {{email}}',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f1117; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body-content { background: #1a1b23; padding: 30px; border: 1px solid #2d2d3d; }
    .license-box { background: #0f1117; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .license-key { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; color: #818cf8; letter-spacing: 2px; word-break: break-all; }
    .info-table { width: 100%; margin: 20px 0; }
    .info-table td { padding: 8px 0; font-size: 14px; }
    .info-table td:first-child { color: #a1a1aa; width: 40%; }
    .info-table td:last-child { color: #e4e4e7; font-weight: 500; }
    .steps { background: #0f1117; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .steps h3 { color: #818cf8; margin: 0 0 15px; font-size: 16px; }
    .steps ol { margin: 0; padding-left: 20px; }
    .steps li { margin-bottom: 10px; font-size: 13px; color: #a1a1aa; }
    .steps li strong { color: #e4e4e7; }
    .footer { background: #0f1117; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2d2d3d; border-top: none; }
    .footer p { color: #71717a; font-size: 12px; margin: 4px 0; }
    .warning { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px; margin: 15px 0; font-size: 13px; color: #fbbf24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Licitante Prime</h1>
      <p>Monitoramento de Chat de Licitações</p>
    </div>
    <div class="body-content">
      <p style="font-size: 16px;">Olá, <strong>{{nome}}</strong>!</p>
      <p style="color: #a1a1aa; font-size: 14px;">
        Sua licença foi criada com sucesso. Use a chave abaixo para ativar o software:
      </p>
      
      <div class="license-box">
        <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 10px;">SUA CHAVE DE LICENÇA</p>
        <div class="license-key">{{chave}}</div>
      </div>

      <table class="info-table">
        <tr><td>Plano:</td><td>{{plano}}</td></tr>
        <tr><td>Válida até:</td><td>{{validade}}</td></tr>
        <tr><td>Email:</td><td>{{email}}</td></tr>
      </table>

      <div class="steps">
        <h3>Como ativar:</h3>
        <ol>
          <li>Abra o aplicativo <strong>Monitoramento de Chat - Licitante Prime</strong></li>
          <li>Na tela de licença, cole a chave acima</li>
          <li>Clique em <strong>"Ativar Licença"</strong></li>
          <li>Pronto! O monitoramento estará disponível</li>
        </ol>
      </div>

      <div class="warning">
        ⚠️ <strong>Importante:</strong> Esta licença é vinculada a um único computador. 
        Caso precise trocar de máquina, entre em contato com nosso suporte.
      </div>
    </div>
    <div class="footer">
      <p>Licitante Prime - Monitoramento de Chat de Licitações</p>
      <p>Dúvidas? contato@licitanteprime.com.br</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'renewal',
    name: 'Renovação de Licença',
    subject: '✅ Licença Renovada - Licitante Prime',
    description: 'Enviado quando o pagamento recorrente é confirmado',
    variables: '{{nome}}, {{chave}}, {{plano}}, {{validade}}',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f1117; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .body-content { background: #1a1b23; padding: 30px; border: 1px solid #2d2d3d; }
    .success-box { background: rgba(34, 197, 94, 0.1); border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .footer { background: #0f1117; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2d2d3d; border-top: none; }
    .footer p { color: #71717a; font-size: 12px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Licença Renovada!</h1>
    </div>
    <div class="body-content">
      <p style="font-size: 16px;">Olá, <strong>{{nome}}</strong>!</p>
      <p style="color: #a1a1aa; font-size: 14px;">
        Seu pagamento foi confirmado e sua licença foi renovada com sucesso.
      </p>
      
      <div class="success-box">
        <p style="color: #22c55e; font-size: 18px; font-weight: bold; margin: 0;">Licença Ativa</p>
        <p style="color: #a1a1aa; font-size: 13px; margin: 8px 0 0;">
          Plano: <strong style="color: #e4e4e7;">{{plano}}</strong> | 
          Válida até: <strong style="color: #e4e4e7;">{{validade}}</strong>
        </p>
      </div>

      <p style="color: #a1a1aa; font-size: 14px;">
        Não é necessário fazer nada. O software será atualizado automaticamente na próxima verificação.
      </p>
    </div>
    <div class="footer">
      <p>Licitante Prime - Monitoramento de Chat de Licitações</p>
      <p>Dúvidas? contato@licitanteprime.com.br</p>
    </div>
  </div>
</body>
</html>`
  },
  {
    id: 'blocked',
    name: 'Licença Bloqueada',
    subject: '⚠️ Licença Suspensa - Licitante Prime',
    description: 'Enviado quando a assinatura é cancelada ou pagamento falha',
    variables: '{{nome}}, {{motivo}}',
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f1117; color: #e4e4e7; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
    .header h1 { color: white; margin: 0; font-size: 24px; }
    .body-content { background: #1a1b23; padding: 30px; border: 1px solid #2d2d3d; }
    .warning-box { background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .footer { background: #0f1117; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #2d2d3d; border-top: none; }
    .footer p { color: #71717a; font-size: 12px; margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Licença Suspensa</h1>
    </div>
    <div class="body-content">
      <p style="font-size: 16px;">Olá, <strong>{{nome}}</strong>.</p>
      
      <div class="warning-box">
        <p style="color: #ef4444; font-size: 16px; font-weight: bold; margin: 0;">Sua licença foi suspensa</p>
        <p style="color: #a1a1aa; font-size: 13px; margin: 8px 0 0;">
          Motivo: {{motivo}}
        </p>
      </div>

      <p style="color: #a1a1aa; font-size: 14px;">
        Para reativar sua licença, regularize seu pagamento. 
        Após a confirmação, a licença será liberada automaticamente.
      </p>
      <p style="color: #a1a1aa; font-size: 14px;">
        Se acredita que houve um erro, entre em contato conosco.
      </p>
    </div>
    <div class="footer">
      <p>Licitante Prime - Monitoramento de Chat de Licitações</p>
      <p>Dúvidas? contato@licitanteprime.com.br</p>
    </div>
  </div>
</body>
</html>`
  }
];

async function runMigration() {
  try {
    console.log('🔄 Criando tabela email_templates...');
    await pool.query(migration);
    
    console.log('🔄 Inserindo templates padrão...');
    for (const tpl of defaultTemplates) {
      await pool.query(`
        INSERT INTO email_templates (id, name, subject, html_content, description, variables)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO NOTHING
      `, [tpl.id, tpl.name, tpl.subject, tpl.html_content, tpl.description, tpl.variables]);
      console.log(`  ✅ Template "${tpl.name}" inserido`);
    }
    
    console.log('');
    console.log('✅ Migração de email templates concluída!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

runMigration();
