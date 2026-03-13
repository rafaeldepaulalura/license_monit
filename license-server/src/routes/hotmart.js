/**
 * LICITANTE PRIME - License Server
 * Webhook da Hotmart - Integração de Pagamentos
 * 
 * Eventos tratados:
 * - PURCHASE_APPROVED     → Cria licença + envia email
 * - PURCHASE_COMPLETE     → Renova licença (pagamento recorrente)
 * - PURCHASE_CANCELED     → Bloqueia licença
 * - PURCHASE_REFUNDED     → Bloqueia licença
 * - PURCHASE_DELAYED      → Bloqueia licença (boleto não pago)
 * - PURCHASE_PROTEST       → Bloqueia licença (chargeback)
 * - PURCHASE_CHARGEBACK   → Bloqueia licença
 * - SUBSCRIPTION_CANCELLATION → Bloqueia licença
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const licenseService = require('../services/licenseService');
const emailService = require('../services/emailService');

// Hottok de segurança da Hotmart
const HOTMART_HOTTOK = process.env.HOTMART_HOTTOK || 'W7sv8wTp05YmYbAgbd4msMPKHhHj1e242e9510-f5e2-47ed-9e23-6a02057f68ee';
const HOTMART_PRODUCT_ID = process.env.HOTMART_PRODUCT_ID || '7206989';

// Plano padrão para vendas Hotmart
const HOTMART_PLAN_ID = 'mensal';
const HOTMART_TRIAL_PLAN_ID = 'trial';

/**
 * Valida o hottok da requisição
 */
function validateHottok(req) {
  const hottok = req.body?.hottok || req.headers['x-hotmart-hottok'];
  return hottok === HOTMART_HOTTOK;
}

/**
 * Extrai dados relevantes do payload Hotmart
 */
function extractHotmartData(body) {
  const data = body.data || body;
  
  return {
    event: body.event,
    buyerEmail: data.buyer?.email || '',
    buyerName: data.buyer?.name || '',
    buyerPhone: data.buyer?.checkout_phone || '',
    productId: String(data.product?.id || ''),
    productName: data.product?.name || '',
    transaction: data.purchase?.transaction || '',
    status: data.purchase?.status || '',
    subscriptionStatus: data.subscription?.status || '',
    subscriberCode: data.subscription?.subscriber?.code || '',
    planName: data.subscription?.plan?.name || '',
    recurrenceNumber: data.purchase?.recurrence_number || 1,
    dateNextCharge: data.purchase?.date_next_charge || null
  };
}

/**
 * POST /api/webhooks/hotmart
 * Recebe eventos da Hotmart
 */
router.post('/', async (req, res) => {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║          HOTMART WEBHOOK RECEBIDO                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    
    // Validar hottok
    if (!validateHottok(req)) {
      console.log('[Hotmart] ❌ Hottok inválido');
      return res.status(401).json({ error: 'Hottok inválido' });
    }
    
    const hotmartData = extractHotmartData(req.body);
    
    console.log('[Hotmart] Evento:', hotmartData.event);
    console.log('[Hotmart] Comprador:', hotmartData.buyerName, '-', hotmartData.buyerEmail);
    console.log('[Hotmart] Produto ID:', hotmartData.productId);
    console.log('[Hotmart] Transação:', hotmartData.transaction);
    console.log('[Hotmart] Assinatura:', hotmartData.subscriberCode);
    console.log('[Hotmart] Recorrência #:', hotmartData.recurrenceNumber);
    
    // Registrar webhook no banco para auditoria
    await logWebhook(hotmartData.event, req.body);
    
    // Processar evento
    switch (hotmartData.event) {
      case 'PURCHASE_APPROVED':
        await handlePurchaseApproved(hotmartData);
        break;
        
      case 'PURCHASE_COMPLETE':
        await handlePurchaseComplete(hotmartData);
        break;
        
      case 'PURCHASE_CANCELED':
      case 'PURCHASE_REFUNDED':
      case 'PURCHASE_DELAYED':
      case 'PURCHASE_PROTEST':
      case 'PURCHASE_CHARGEBACK':
        await handlePurchaseBlocked(hotmartData);
        break;
        
      case 'SUBSCRIPTION_CANCELLATION':
        await handleSubscriptionCancellation(hotmartData);
        break;
        
      default:
        console.log('[Hotmart] ⚠️ Evento não tratado:', hotmartData.event);
    }
    
    // Sempre retornar 200 para a Hotmart não reenviar
    res.status(200).json({ success: true, event: hotmartData.event });
    
  } catch (error) {
    console.error('[Hotmart] ❌ Erro no webhook:', error);
    // Retornar 200 mesmo com erro para não reenviar infinitamente
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * PURCHASE_APPROVED - Primeira compra ou reativação
 * Cria licença nova ou reativa existente
 */
async function handlePurchaseApproved(data) {
  console.log('[Hotmart] 🟢 Processando PURCHASE_APPROVED...');
  
  const { buyerEmail, buyerName, buyerPhone, subscriberCode, recurrenceNumber } = data;
  
  if (!buyerEmail) {
    console.log('[Hotmart] ❌ Email do comprador não encontrado');
    return;
  }
  
  // Verificar se já existe licença para este email
  const existing = await findLicenseByEmail(buyerEmail);
  
  if (existing) {
    console.log('[Hotmart] 📋 Licença existente encontrada:', existing.license_key);
    
    // Renovar/reativar licença existente
    const newExpires = calculateExpiration(30);
    
    await pool.query(`
      UPDATE licenses SET
        status = 'active',
        expires_at = $1,
        blocked_at = NULL,
        blocked_reason = NULL,
        notes = COALESCE(notes, '') || $2,
        updated_at = NOW()
      WHERE id = $3
    `, [
      newExpires,
      `\n[Hotmart] Renovado em ${new Date().toLocaleString('pt-BR')} | Assinatura: ${subscriberCode} | Recorrência #${recurrenceNumber}`,
      existing.id
    ]);
    
    await licenseService.logAction(existing.id, 'hotmart_renewed', {
      event: 'PURCHASE_APPROVED',
      subscriberCode,
      recurrenceNumber,
      transaction: data.transaction
    }, null, null);
    
    console.log('[Hotmart] ✅ Licença renovada até:', newExpires.toLocaleDateString('pt-BR'));
    
    // Enviar email de renovação
    await emailService.sendRenewalEmail(buyerEmail, buyerName, existing.license_key, 'Plano Mensal', newExpires);
    
  } else {
    console.log('[Hotmart] 🆕 Criando nova licença...');
    
    // Criar nova licença
    const license = await licenseService.createLicense({
      planId: HOTMART_PLAN_ID,
      customerName: buyerName,
      customerEmail: buyerEmail,
      customerPhone: buyerPhone,
      notes: `[Hotmart] Compra automática | Assinatura: ${subscriberCode} | Transação: ${data.transaction}`
    });
    
    // Definir expiração de 30 dias
    const expiresAt = calculateExpiration(30);
    
    try {
      await pool.query(`
        UPDATE licenses SET
          status = 'active',
          expires_at = $1,
          hotmart_subscriber_code = $2,
          hotmart_transaction = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [expiresAt, subscriberCode, data.transaction, license.id]);
    } catch (dbError) {
      // Fallback se as colunas hotmart não existirem ainda
      console.log('[Hotmart] ⚠️ Colunas hotmart não encontradas, usando update básico');
      await pool.query(`
        UPDATE licenses SET
          status = 'active',
          expires_at = $1,
          notes = COALESCE(notes, '') || $2,
          updated_at = NOW()
        WHERE id = $3
      `, [expiresAt, `\n[Hotmart] Assinatura: ${subscriberCode} | Transação: ${data.transaction}`, license.id]);
    }
    
    await licenseService.logAction(license.id, 'hotmart_created', {
      event: 'PURCHASE_APPROVED',
      subscriberCode,
      transaction: data.transaction,
      buyerEmail,
      buyerName
    }, null, null);
    
    console.log('[Hotmart] ✅ Licença criada:', license.license_key);
    console.log('[Hotmart] ✅ Válida até:', expiresAt.toLocaleDateString('pt-BR'));
    
    // Enviar email com a chave de licença
    await emailService.sendLicenseEmail(buyerEmail, buyerName, license.license_key, 'Plano Mensal', expiresAt);
  }
}

/**
 * PURCHASE_COMPLETE - Pagamento recorrente confirmado
 * Renova a licença por mais 30 dias
 */
async function handlePurchaseComplete(data) {
  console.log('[Hotmart] 🟢 Processando PURCHASE_COMPLETE (renovação)...');
  
  const { buyerEmail, subscriberCode, recurrenceNumber } = data;
  
  const license = await findLicenseByEmailOrSubscriber(buyerEmail, subscriberCode);
  
  if (!license) {
    console.log('[Hotmart] ⚠️ Licença não encontrada para renovação. Criando nova...');
    await handlePurchaseApproved(data);
    return;
  }
  
  // Renovar: usar a data atual ou a expiração existente (o que for maior)
  const baseDate = license.expires_at && new Date(license.expires_at) > new Date()
    ? new Date(license.expires_at)
    : new Date();
  const newExpires = new Date(baseDate.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  await pool.query(`
    UPDATE licenses SET
      status = 'active',
      expires_at = $1,
      blocked_at = NULL,
      blocked_reason = NULL,
      updated_at = NOW()
    WHERE id = $2
  `, [newExpires, license.id]);
  
  await licenseService.logAction(license.id, 'hotmart_renewal_complete', {
    event: 'PURCHASE_COMPLETE',
    subscriberCode,
    recurrenceNumber,
    previousExpires: license.expires_at,
    newExpires
  }, null, null);
  
  console.log('[Hotmart] ✅ Licença renovada até:', newExpires.toLocaleDateString('pt-BR'));
  
  await emailService.sendRenewalEmail(buyerEmail, license.customer_name, license.license_key, 'Plano Mensal', newExpires);
}

/**
 * Compra cancelada/reembolsada/atrasada - Bloqueia licença
 */
async function handlePurchaseBlocked(data) {
  console.log(`[Hotmart] 🔴 Processando ${data.event} (bloqueio)...`);
  
  const { buyerEmail, subscriberCode, event } = data;
  
  const license = await findLicenseByEmailOrSubscriber(buyerEmail, subscriberCode);
  
  if (!license) {
    console.log('[Hotmart] ⚠️ Licença não encontrada para bloqueio');
    return;
  }
  
  const reasonMap = {
    'PURCHASE_CANCELED': 'Compra cancelada',
    'PURCHASE_REFUNDED': 'Reembolso solicitado',
    'PURCHASE_DELAYED': 'Pagamento em atraso',
    'PURCHASE_PROTEST': 'Contestação de pagamento',
    'PURCHASE_CHARGEBACK': 'Chargeback recebido'
  };
  
  const reason = reasonMap[event] || 'Pagamento não confirmado';
  
  await pool.query(`
    UPDATE licenses SET
      status = 'blocked',
      blocked_at = NOW(),
      blocked_reason = $1,
      updated_at = NOW()
    WHERE id = $2
  `, [reason, license.id]);
  
  await licenseService.logAction(license.id, 'hotmart_blocked', {
    event,
    reason,
    subscriberCode,
    transaction: data.transaction
  }, null, null);
  
  console.log('[Hotmart] 🔴 Licença bloqueada:', license.license_key, '| Motivo:', reason);
  
  await emailService.sendBlockedEmail(buyerEmail, license.customer_name, reason);
}

/**
 * Assinatura cancelada - Bloqueia licença
 */
async function handleSubscriptionCancellation(data) {
  console.log('[Hotmart] 🔴 Processando SUBSCRIPTION_CANCELLATION...');
  
  const { buyerEmail, subscriberCode } = data;
  
  const license = await findLicenseByEmailOrSubscriber(buyerEmail, subscriberCode);
  
  if (!license) {
    console.log('[Hotmart] ⚠️ Licença não encontrada para cancelamento');
    return;
  }
  
  await pool.query(`
    UPDATE licenses SET
      status = 'blocked',
      blocked_at = NOW(),
      blocked_reason = 'Assinatura cancelada pelo cliente',
      updated_at = NOW()
    WHERE id = $1
  `, [license.id]);
  
  await licenseService.logAction(license.id, 'hotmart_subscription_cancelled', {
    event: 'SUBSCRIPTION_CANCELLATION',
    subscriberCode
  }, null, null);
  
  console.log('[Hotmart] 🔴 Licença bloqueada por cancelamento:', license.license_key);
  
  await emailService.sendBlockedEmail(buyerEmail, license.customer_name, 'Assinatura cancelada');
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Busca licença pelo email do cliente
 */
async function findLicenseByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM licenses WHERE customer_email = $1 ORDER BY created_at DESC LIMIT 1',
    [email.toLowerCase()]
  );
  return result.rows[0] || null;
}

/**
 * Busca licença pelo email ou código de assinante Hotmart
 */
async function findLicenseByEmailOrSubscriber(email, subscriberCode) {
  // Primeiro tentar pelo subscriber code
  if (subscriberCode) {
    try {
      const result = await pool.query(
        'SELECT * FROM licenses WHERE hotmart_subscriber_code = $1 LIMIT 1',
        [subscriberCode]
      );
      if (result.rows.length > 0) return result.rows[0];
    } catch (err) {
      console.log('[Hotmart] ⚠️ Coluna hotmart_subscriber_code não existe, buscando por email');
    }
  }
  
  // Depois tentar pelo email
  if (email) {
    return findLicenseByEmail(email);
  }
  
  return null;
}

/**
 * Calcula data de expiração
 */
function calculateExpiration(days) {
  return new Date(Date.now() + (days * 24 * 60 * 60 * 1000));
}

/**
 * Registra webhook no banco para auditoria
 */
async function logWebhook(event, payload) {
  try {
    await pool.query(`
      INSERT INTO hotmart_webhooks (event, payload, received_at)
      VALUES ($1, $2, NOW())
    `, [event, JSON.stringify(payload)]);
  } catch (error) {
    // Se a tabela não existir, apenas logar
    console.log('[Hotmart] ⚠️ Não foi possível registrar webhook (tabela pode não existir)');
  }
}

module.exports = router;
