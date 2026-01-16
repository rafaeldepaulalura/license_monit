/**
 * LICITANTE PRIME - License Server
 * Middleware de Autenticação
 */

const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'licitante-prime-jwt-secret-change-me';

/**
 * Middleware para verificar token JWT (rotas admin)
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verificar se admin ainda existe e está ativo
    const result = await pool.query(
      'SELECT id, username, name, role FROM admins WHERE id = $1 AND active = true',
      [decoded.adminId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }
    
    req.admin = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    console.error('Erro na autenticação:', error);
    return res.status(500).json({ error: 'Erro interno' });
  }
};

/**
 * Middleware para verificar API Key (rotas do app)
 */
const authenticateApp = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.APP_API_KEY || 'licitante-prime-app-key';
  
  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'API Key inválida' });
  }
  
  next();
};

/**
 * Gerar token JWT
 */
const generateToken = (adminId, username) => {
  return jwt.sign(
    { adminId, username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

module.exports = {
  authenticateAdmin,
  authenticateApp,
  generateToken,
  JWT_SECRET
};
