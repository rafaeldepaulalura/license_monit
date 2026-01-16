/**
 * LICITANTE PRIME - License Server
 * Rotas de Licenças (para o App)
 */

const express = require('express');
const router = express.Router();
const licenseService = require('../services/licenseService');
const { authenticateApp } = require('../middleware/auth');

// Obter IP real do cliente
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.ip;
};

/**
 * POST /api/licenses/activate
 * Ativar uma licença
 */
router.post('/activate', authenticateApp, async (req, res) => {
  try {
    const { licenseKey, hardwareId, machineName } = req.body;
    
    if (!licenseKey || !hardwareId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de licença e Hardware ID são obrigatórios' 
      });
    }
    
    const ipAddress = getClientIP(req);
    const result = await licenseService.activateLicense(licenseKey, hardwareId, machineName, ipAddress);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao ativar licença:', error);
    res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/licenses/validate
 * Validar uma licença (verificação periódica)
 */
router.post('/validate', authenticateApp, async (req, res) => {
  try {
    const { licenseKey, hardwareId } = req.body;
    
    if (!licenseKey || !hardwareId) {
      return res.status(400).json({ 
        valid: false, 
        error: 'Chave de licença e Hardware ID são obrigatórios' 
      });
    }
    
    const ipAddress = getClientIP(req);
    const result = await licenseService.validateLicense(licenseKey, hardwareId, ipAddress);
    
    res.json(result);
  } catch (error) {
    console.error('Erro ao validar licença:', error);
    res.status(500).json({ valid: false, error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/licenses/check
 * Verificar status de uma licença (sem hardware ID)
 */
router.post('/check', authenticateApp, async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    if (!licenseKey) {
      return res.status(400).json({ error: 'Chave de licença é obrigatória' });
    }
    
    // Validar formato
    if (!licenseService.validateKeyFormat(licenseKey)) {
      return res.json({ valid: false, error: 'Formato de chave inválido' });
    }
    
    const licenses = await licenseService.listLicenses({ search: licenseKey, limit: 1 });
    
    if (licenses.length === 0) {
      return res.json({ valid: false, error: 'Licença não encontrada' });
    }
    
    const license = licenses[0];
    
    res.json({
      valid: license.status === 'active' || license.status === 'pending',
      status: license.status,
      plan: license.plan_name,
      expiresAt: license.expires_at,
      isActivated: !!license.hardware_id
    });
  } catch (error) {
    console.error('Erro ao verificar licença:', error);
    res.status(500).json({ valid: false, error: 'Erro interno do servidor' });
  }
});

module.exports = router;
