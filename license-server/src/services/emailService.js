/**
 * LICITANTE PRIME - License Server
 * Serviço de Envio de Email via Gmail SMTP
 * Usa templates do banco de dados (email_templates) quando disponíveis
 */

const nodemailer = require('nodemailer');
const pool = require('../config/database');

const GMAIL_USER = process.env.GMAIL_USER || 'licitanteprime@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'itya lwbc jeyk wvzr';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });
  }
  return transporter;
}

async function getTemplate(templateId) {
  try {
    const result = await pool.query(
      'SELECT * FROM email_templates WHERE id = $1 AND active = true',
      [templateId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.log(`[Email] Template "${templateId}" não encontrado no banco, usando fallback`);
    return null;
  }
}

function replaceVariables(html, vars) {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(value || '');
  }
  return result;
}

/**
 * Envia email genérico (usado para testes de template)
 */
async function sendRawEmail(to, subject, htmlContent) {
  try {
    const mailOptions = {
      from: `"Licitante Prime" <${GMAIL_USER}>`,
      to,
      subject,
      html: htmlContent
    };
    const info = await getTransporter().sendMail(mailOptions);
    console.log('[Email] ✅ Email enviado para:', to, '| MessageId:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] ❌ Erro ao enviar email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia email com a chave de licença para o cliente
 */
async function sendLicenseEmail(customerEmail, customerName, licenseKey, planName, expiresAt) {
  try {
    const firstName = customerName ? customerName.split(' ')[0] : 'Cliente';
    const expiresDate = expiresAt ? new Date(expiresAt).toLocaleDateString('pt-BR') : 'N/A';

    const template = await getTemplate('new_license');

    let subject, htmlContent;

    if (template) {
      subject = template.subject;
      htmlContent = replaceVariables(template.html_content, {
        '{{nome}}': firstName,
        '{{chave}}': licenseKey,
        '{{plano}}': planName,
        '{{validade}}': expiresDate,
        '{{email}}': customerEmail
      });
    } else {
      subject = '🔑 Sua Licença do Monitoramento de Chat - Licitante Prime';
      htmlContent = getFallbackLicenseHtml(firstName, licenseKey, planName, expiresDate, customerEmail);
    }

    return await sendRawEmail(customerEmail, subject, htmlContent);
  } catch (error) {
    console.error('[Email] ❌ Erro ao enviar email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia email de renovação de licença
 */
async function sendRenewalEmail(customerEmail, customerName, licenseKey, planName, newExpiresAt) {
  try {
    const firstName = customerName ? customerName.split(' ')[0] : 'Cliente';
    const expiresDate = new Date(newExpiresAt).toLocaleDateString('pt-BR');

    const template = await getTemplate('renewal');

    let subject, htmlContent;

    if (template) {
      subject = template.subject;
      htmlContent = replaceVariables(template.html_content, {
        '{{nome}}': firstName,
        '{{chave}}': licenseKey,
        '{{plano}}': planName,
        '{{validade}}': expiresDate
      });
    } else {
      subject = '✅ Licença Renovada - Licitante Prime';
      htmlContent = getFallbackRenewalHtml(firstName, planName, expiresDate);
    }

    return await sendRawEmail(customerEmail, subject, htmlContent);
  } catch (error) {
    console.error('[Email] ❌ Erro ao enviar email de renovação:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia email de bloqueio de licença
 */
async function sendBlockedEmail(customerEmail, customerName, reason) {
  try {
    const firstName = customerName ? customerName.split(' ')[0] : 'Cliente';

    const template = await getTemplate('blocked');

    let subject, htmlContent;

    if (template) {
      subject = template.subject;
      htmlContent = replaceVariables(template.html_content, {
        '{{nome}}': firstName,
        '{{motivo}}': reason || 'Pagamento não identificado'
      });
    } else {
      subject = '⚠️ Licença Suspensa - Licitante Prime';
      htmlContent = getFallbackBlockedHtml(firstName, reason);
    }

    return await sendRawEmail(customerEmail, subject, htmlContent);
  } catch (error) {
    console.error('[Email] ❌ Erro ao enviar email de bloqueio:', error.message);
    return { success: false, error: error.message };
  }
}

// ==================== FALLBACK TEMPLATES ====================

function getFallbackLicenseHtml(name, key, plan, expires, email) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;color:#e4e4e7;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px;text-align:center;border-radius:12px 12px 0 0}.header h1{color:white;margin:0;font-size:24px}.body-content{background:#1a1b23;padding:30px;border:1px solid #2d2d3d}.license-box{background:#0f1117;border:2px solid #6366f1;border-radius:8px;padding:20px;text-align:center;margin:20px 0}.license-key{font-family:'Courier New',monospace;font-size:22px;font-weight:bold;color:#818cf8;letter-spacing:2px;word-break:break-all}.footer{background:#0f1117;padding:20px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #2d2d3d;border-top:none}.footer p{color:#71717a;font-size:12px;margin:4px 0}</style></head>
<body><div class="container">
<div class="header"><h1>Licitante Prime</h1><p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Monitoramento de Chat</p></div>
<div class="body-content">
<p style="font-size:16px">Olá, <strong>${name}</strong>!</p>
<p style="color:#a1a1aa;font-size:14px">Sua licença foi criada com sucesso:</p>
<div class="license-box"><p style="color:#a1a1aa;font-size:12px;margin:0 0 10px">SUA CHAVE DE LICENÇA</p><div class="license-key">${key}</div></div>
<p style="color:#a1a1aa;font-size:14px">Plano: ${plan} | Válida até: ${expires}</p>
</div>
<div class="footer"><p>Licitante Prime</p><p>Dúvidas? contato@licitanteprime.com.br</p></div>
</div></body></html>`;
}

function getFallbackRenewalHtml(name, plan, expires) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;color:#e4e4e7;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#22c55e,#16a34a);padding:30px;text-align:center;border-radius:12px 12px 0 0}.header h1{color:white;margin:0;font-size:24px}.body-content{background:#1a1b23;padding:30px;border:1px solid #2d2d3d}.footer{background:#0f1117;padding:20px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #2d2d3d;border-top:none}.footer p{color:#71717a;font-size:12px;margin:4px 0}</style></head>
<body><div class="container">
<div class="header"><h1>✅ Licença Renovada!</h1></div>
<div class="body-content">
<p style="font-size:16px">Olá, <strong>${name}</strong>!</p>
<p style="color:#a1a1aa;font-size:14px">Seu pagamento foi confirmado. Plano: <strong>${plan}</strong> | Válida até: <strong>${expires}</strong></p>
</div>
<div class="footer"><p>Licitante Prime</p></div>
</div></body></html>`;
}

function getFallbackBlockedHtml(name, reason) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#0f1117;color:#e4e4e7;margin:0;padding:0}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:linear-gradient(135deg,#ef4444,#dc2626);padding:30px;text-align:center;border-radius:12px 12px 0 0}.header h1{color:white;margin:0;font-size:24px}.body-content{background:#1a1b23;padding:30px;border:1px solid #2d2d3d}.footer{background:#0f1117;padding:20px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #2d2d3d;border-top:none}.footer p{color:#71717a;font-size:12px;margin:4px 0}</style></head>
<body><div class="container">
<div class="header"><h1>⚠️ Licença Suspensa</h1></div>
<div class="body-content">
<p style="font-size:16px">Olá, <strong>${name}</strong>.</p>
<p style="color:#a1a1aa;font-size:14px">Sua licença foi suspensa. Motivo: ${reason || 'Pagamento não identificado'}</p>
<p style="color:#a1a1aa;font-size:14px">Para reativar, regularize seu pagamento.</p>
</div>
<div class="footer"><p>Licitante Prime</p></div>
</div></body></html>`;
}

module.exports = {
  sendLicenseEmail,
  sendRenewalEmail,
  sendBlockedEmail,
  sendRawEmail
};
