/**
 * LICITANTE PRIME - License Server
 * Rotas Administrativas
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const licenseService = require('../services/licenseService');
const { authenticateAdmin, generateToken } = require('../middleware/auth');

// ==================== AUTENTICAÇÃO ====================

/**
 * POST /api/admin/login
 * Login do administrador
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    // Buscar admin
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 AND active = true',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    const admin = result.rows[0];
    
    // Verificar senha
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    
    // Gerar token
    const token = generateToken(admin.id, admin.username);
    
    res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/admin/change-password
 * Alterar senha do admin
 */
router.post('/change-password', authenticateAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }
    
    // Buscar admin
    const result = await pool.query('SELECT * FROM admins WHERE id = $1', [req.admin.id]);
    const admin = result.rows[0];
    
    // Verificar senha atual
    const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    
    // Atualizar senha
    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.admin.id]
    );
    
    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/admin/me
 * Obter dados do admin logado
 */
router.get('/me', authenticateAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// ==================== DASHBOARD ====================

/**
 * GET /api/admin/stats
 * Obter estatísticas do dashboard
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await licenseService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== LICENÇAS ====================

/**
 * GET /api/admin/licenses
 * Listar todas as licenças
 */
router.get('/licenses', authenticateAdmin, async (req, res) => {
  try {
    const { status, search, limit = 100, offset = 0 } = req.query;
    
    const licenses = await licenseService.listLicenses({
      status,
      search,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({ licenses });
  } catch (error) {
    console.error('Erro ao listar licenças:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/admin/licenses/:id
 * Obter detalhes de uma licença
 */
router.get('/licenses/:id', authenticateAdmin, async (req, res) => {
  try {
    const license = await licenseService.getLicenseById(req.params.id);
    
    if (!license) {
      return res.status(404).json({ error: 'Licença não encontrada' });
    }
    
    const logs = await licenseService.getLicenseLogs(req.params.id);
    
    res.json({ license, logs });
  } catch (error) {
    console.error('Erro ao obter licença:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/admin/licenses
 * Criar nova licença
 */
router.post('/licenses', authenticateAdmin, async (req, res) => {
  try {
    const { planId, customerName, customerEmail, customerPhone, notes } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plano é obrigatório' });
    }
    
    const license = await licenseService.createLicense({
      planId,
      customerName,
      customerEmail,
      customerPhone,
      notes
    });
    
    res.status(201).json({ license });
  } catch (error) {
    console.error('Erro ao criar licença:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/admin/licenses/:id
 * Atualizar dados de uma licença
 */
router.put('/licenses/:id', authenticateAdmin, async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, notes } = req.body;
    
    const license = await licenseService.updateLicense(req.params.id, {
      customerName,
      customerEmail,
      customerPhone,
      notes
    });
    
    if (!license) {
      return res.status(404).json({ error: 'Licença não encontrada' });
    }
    
    res.json({ license });
  } catch (error) {
    console.error('Erro ao atualizar licença:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/admin/licenses/:id
 * Deletar uma licença
 */
router.delete('/licenses/:id', authenticateAdmin, async (req, res) => {
  try {
    await licenseService.deleteLicense(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar licença:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/admin/licenses/:id/block
 * Bloquear uma licença
 */
router.post('/licenses/:id/block', authenticateAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const license = await licenseService.blockLicense(req.params.id, reason, req.admin.id);
    
    res.json({ license, message: 'Licença bloqueada com sucesso' });
  } catch (error) {
    console.error('Erro ao bloquear licença:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * POST /api/admin/licenses/:id/unblock
 * Desbloquear uma licença
 */
router.post('/licenses/:id/unblock', authenticateAdmin, async (req, res) => {
  try {
    const license = await licenseService.unblockLicense(req.params.id, req.admin.id);
    
    res.json({ license, message: 'Licença desbloqueada com sucesso' });
  } catch (error) {
    console.error('Erro ao desbloquear licença:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

/**
 * POST /api/admin/licenses/:id/reset-hardware
 * Resetar hardware ID (permitir nova ativação)
 */
router.post('/licenses/:id/reset-hardware', authenticateAdmin, async (req, res) => {
  try {
    const license = await licenseService.resetHardware(req.params.id, req.admin.id);
    
    res.json({ license, message: 'Hardware resetado. A licença pode ser ativada em um novo computador.' });
  } catch (error) {
    console.error('Erro ao resetar hardware:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

// ==================== PLANOS ====================

/**
 * GET /api/admin/plans
 * Listar planos disponíveis
 */
router.get('/plans', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM plans ORDER BY duration_days');
    res.json({ plans: result.rows });
  } catch (error) {
    console.error('Erro ao listar planos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
