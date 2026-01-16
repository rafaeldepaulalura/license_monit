/**
 * LICITANTE PRIME - License Server
 * Serviço de Gerenciamento de Licenças
 */

const pool = require('../config/database');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class LicenseService {
  
  /**
   * Gera uma chave de licença única
   */
  generateLicenseKey(planId) {
    const prefix = 'LPRIME';
    const plan = planId.toUpperCase().substring(0, 5);
    const random1 = crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
    const random2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    
    // Gerar hash de verificação
    const baseString = `${plan}-${random1}-${random2}`;
    const hash = crypto.createHash('sha256')
      .update(baseString + process.env.LICENSE_SECRET || 'licitante-prime-secret')
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();
    
    return `${prefix}-${plan}-${random1}-${random2}-${hash}`;
  }

  /**
   * Valida o formato da chave de licença
   */
  validateKeyFormat(licenseKey) {
    const parts = licenseKey.split('-');
    if (parts.length !== 5 || parts[0] !== 'LPRIME') {
      return false;
    }
    
    const [prefix, plan, random1, random2, hash] = parts;
    const baseString = `${plan}-${random1}-${random2}`;
    const expectedHash = crypto.createHash('sha256')
      .update(baseString + process.env.LICENSE_SECRET || 'licitante-prime-secret')
      .digest('hex')
      .substring(0, 4)
      .toUpperCase();
    
    return hash === expectedHash;
  }

  /**
   * Criar nova licença
   */
  async createLicense(data) {
    const { planId, customerName, customerEmail, customerPhone, notes } = data;
    
    // Buscar informações do plano
    const planResult = await pool.query('SELECT * FROM plans WHERE id = $1', [planId]);
    if (planResult.rows.length === 0) {
      throw new Error('Plano não encontrado');
    }
    
    const plan = planResult.rows[0];
    const licenseKey = this.generateLicenseKey(planId);
    
    // Calcular data de expiração (será definida na ativação)
    const result = await pool.query(`
      INSERT INTO licenses (license_key, plan_id, customer_name, customer_email, customer_phone, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [licenseKey, planId, customerName, customerEmail, customerPhone, notes]);
    
    return {
      ...result.rows[0],
      plan
    };
  }

  /**
   * Ativar licença
   */
  async activateLicense(licenseKey, hardwareId, machineName, ipAddress) {
    // Validar formato da chave
    if (!this.validateKeyFormat(licenseKey)) {
      return { success: false, error: 'Chave de licença inválida', code: 'INVALID_KEY' };
    }
    
    // Buscar licença
    const licenseResult = await pool.query(`
      SELECT l.*, p.duration_days, p.name as plan_name
      FROM licenses l
      JOIN plans p ON l.plan_id = p.id
      WHERE l.license_key = $1
    `, [licenseKey]);
    
    if (licenseResult.rows.length === 0) {
      return { success: false, error: 'Licença não encontrada', code: 'NOT_FOUND' };
    }
    
    const license = licenseResult.rows[0];
    
    // Verificar se está bloqueada
    if (license.status === 'blocked') {
      return { 
        success: false, 
        error: 'Licença bloqueada: ' + (license.blocked_reason || 'Entre em contato com o suporte'),
        code: 'BLOCKED'
      };
    }
    
    // Verificar se já está ativada em outra máquina
    if (license.hardware_id && license.hardware_id !== hardwareId) {
      return { 
        success: false, 
        error: 'Esta licença já está ativada em outro computador',
        code: 'ALREADY_ACTIVATED',
        activatedMachine: license.machine_name
      };
    }
    
    // Verificar se expirou
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return { success: false, error: 'Licença expirada', code: 'EXPIRED' };
    }
    
    // Calcular data de expiração se for primeira ativação
    let expiresAt = license.expires_at;
    if (!expiresAt) {
      const now = new Date();
      expiresAt = new Date(now.getTime() + (license.duration_days * 24 * 60 * 60 * 1000));
    }
    
    // Atualizar licença
    await pool.query(`
      UPDATE licenses SET
        status = 'active',
        hardware_id = $1,
        machine_name = $2,
        activated_at = COALESCE(activated_at, NOW()),
        expires_at = $3,
        last_validation_at = NOW(),
        last_validation_ip = $4,
        activation_count = activation_count + 1,
        updated_at = NOW()
      WHERE id = $5
    `, [hardwareId, machineName, expiresAt, ipAddress, license.id]);
    
    // Registrar log
    await this.logAction(license.id, 'activated', { machineName, ipAddress }, ipAddress, hardwareId);
    
    return {
      success: true,
      license: {
        key: license.license_key,
        plan: license.plan_name,
        planId: license.plan_id,
        status: 'active',
        customerName: license.customer_name,
        activatedAt: license.activated_at || new Date(),
        expiresAt: expiresAt
      }
    };
  }

  /**
   * Validar licença (chamado periodicamente pelo app)
   */
  async validateLicense(licenseKey, hardwareId, ipAddress) {
    // Buscar licença
    const licenseResult = await pool.query(`
      SELECT l.*, p.name as plan_name
      FROM licenses l
      JOIN plans p ON l.plan_id = p.id
      WHERE l.license_key = $1
    `, [licenseKey]);
    
    if (licenseResult.rows.length === 0) {
      return { valid: false, error: 'Licença não encontrada', code: 'NOT_FOUND' };
    }
    
    const license = licenseResult.rows[0];
    
    // Verificar status
    if (license.status === 'blocked') {
      await this.logAction(license.id, 'validation_blocked', { reason: license.blocked_reason }, ipAddress, hardwareId);
      return { 
        valid: false, 
        error: 'Licença bloqueada: ' + (license.blocked_reason || 'Entre em contato com o suporte'),
        code: 'BLOCKED'
      };
    }
    
    // Verificar hardware ID
    if (license.hardware_id && license.hardware_id !== hardwareId) {
      await this.logAction(license.id, 'validation_wrong_hardware', { expectedHw: license.hardware_id, receivedHw: hardwareId }, ipAddress, hardwareId);
      return { 
        valid: false, 
        error: 'Esta licença está ativada em outro computador',
        code: 'WRONG_HARDWARE'
      };
    }
    
    // Verificar expiração
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      // Atualizar status para expirado
      await pool.query(`UPDATE licenses SET status = 'expired', updated_at = NOW() WHERE id = $1`, [license.id]);
      await this.logAction(license.id, 'expired', {}, ipAddress, hardwareId);
      return { valid: false, error: 'Licença expirada', code: 'EXPIRED' };
    }
    
    // Atualizar última validação
    await pool.query(`
      UPDATE licenses SET 
        last_validation_at = NOW(), 
        last_validation_ip = $1,
        updated_at = NOW()
      WHERE id = $2
    `, [ipAddress, license.id]);
    
    // Calcular dias restantes
    const daysRemaining = license.expires_at 
      ? Math.ceil((new Date(license.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
      : 999999;
    
    return {
      valid: true,
      license: {
        key: license.license_key,
        plan: license.plan_name,
        planId: license.plan_id,
        status: license.status,
        customerName: license.customer_name,
        expiresAt: license.expires_at,
        daysRemaining,
        activatedAt: license.activated_at
      }
    };
  }

  /**
   * Bloquear licença
   */
  async blockLicense(licenseId, reason, adminId) {
    const result = await pool.query(`
      UPDATE licenses SET
        status = 'blocked',
        blocked_at = NOW(),
        blocked_reason = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [reason, licenseId]);
    
    if (result.rows.length === 0) {
      throw new Error('Licença não encontrada');
    }
    
    await this.logAction(licenseId, 'blocked', { reason, adminId }, null, null);
    
    return result.rows[0];
  }

  /**
   * Desbloquear licença
   */
  async unblockLicense(licenseId, adminId) {
    const result = await pool.query(`
      UPDATE licenses SET
        status = 'active',
        blocked_at = NULL,
        blocked_reason = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [licenseId]);
    
    if (result.rows.length === 0) {
      throw new Error('Licença não encontrada');
    }
    
    await this.logAction(licenseId, 'unblocked', { adminId }, null, null);
    
    return result.rows[0];
  }

  /**
   * Resetar hardware (permitir nova ativação)
   */
  async resetHardware(licenseId, adminId) {
    const result = await pool.query(`
      UPDATE licenses SET
        hardware_id = NULL,
        machine_name = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [licenseId]);
    
    if (result.rows.length === 0) {
      throw new Error('Licença não encontrada');
    }
    
    await this.logAction(licenseId, 'hardware_reset', { adminId }, null, null);
    
    return result.rows[0];
  }

  /**
   * Listar todas as licenças
   */
  async listLicenses(filters = {}) {
    let query = `
      SELECT l.*, p.name as plan_name, p.price as plan_price
      FROM licenses l
      JOIN plans p ON l.plan_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.status) {
      query += ` AND l.status = $${paramIndex++}`;
      params.push(filters.status);
    }
    
    if (filters.search) {
      query += ` AND (l.license_key ILIKE $${paramIndex} OR l.customer_name ILIKE $${paramIndex} OR l.customer_email ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY l.created_at DESC';
    
    if (filters.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(filters.limit);
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(filters.offset);
    }
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Obter licença por ID
   */
  async getLicenseById(licenseId) {
    const result = await pool.query(`
      SELECT l.*, p.name as plan_name, p.price as plan_price, p.duration_days
      FROM licenses l
      JOIN plans p ON l.plan_id = p.id
      WHERE l.id = $1
    `, [licenseId]);
    
    return result.rows[0] || null;
  }

  /**
   * Obter logs de uma licença
   */
  async getLicenseLogs(licenseId, limit = 50) {
    const result = await pool.query(`
      SELECT * FROM license_logs
      WHERE license_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [licenseId, limit]);
    
    return result.rows;
  }

  /**
   * Registrar log de ação
   */
  async logAction(licenseId, action, details, ipAddress, hardwareId) {
    await pool.query(`
      INSERT INTO license_logs (license_id, action, details, ip_address, hardware_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [licenseId, action, JSON.stringify(details), ipAddress, hardwareId]);
  }

  /**
   * Obter estatísticas
   */
  async getStats() {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked_count,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
        COUNT(*) as total_count
      FROM licenses
    `);
    
    const recentActivations = await pool.query(`
      SELECT COUNT(*) as count
      FROM licenses
      WHERE activated_at > NOW() - INTERVAL '7 days'
    `);
    
    const byPlan = await pool.query(`
      SELECT p.name, COUNT(l.id) as count
      FROM plans p
      LEFT JOIN licenses l ON l.plan_id = p.id
      GROUP BY p.id, p.name
      ORDER BY count DESC
    `);
    
    return {
      ...stats.rows[0],
      recent_activations: parseInt(recentActivations.rows[0].count),
      by_plan: byPlan.rows
    };
  }

  /**
   * Atualizar dados do cliente
   */
  async updateLicense(licenseId, data) {
    const { customerName, customerEmail, customerPhone, notes } = data;
    
    const result = await pool.query(`
      UPDATE licenses SET
        customer_name = COALESCE($1, customer_name),
        customer_email = COALESCE($2, customer_email),
        customer_phone = COALESCE($3, customer_phone),
        notes = COALESCE($4, notes),
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [customerName, customerEmail, customerPhone, notes, licenseId]);
    
    return result.rows[0];
  }

  /**
   * Deletar licença
   */
  async deleteLicense(licenseId) {
    await pool.query('DELETE FROM licenses WHERE id = $1', [licenseId]);
  }
}

module.exports = new LicenseService();
