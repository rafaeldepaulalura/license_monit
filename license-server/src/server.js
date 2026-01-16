/**
 * LICITANTE PRIME - License Server
 * Servidor Principal
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const licensesRouter = require('./routes/licenses');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARES ====================

// Segurança
app.use(helmet());

// CORS - permitir acesso do painel admin e do app
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Parse JSON
app.use(express.json());

// Rate limiting para APIs públicas
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por IP
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' }
});

// Rate limiting mais restrito para ativação
const activationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 tentativas por hora
  message: { error: 'Muitas tentativas de ativação. Tente novamente em 1 hora.' }
});

// ==================== ROTAS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API de licenças (para o app desktop)
app.use('/api/licenses', apiLimiter, licensesRouter);
app.post('/api/licenses/activate', activationLimiter);

// API administrativa (para o painel)
app.use('/api/admin', adminRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     LICITANTE PRIME - LICENSE SERVER                  ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  🚀 Servidor rodando na porta ${PORT}                    ║`);
  console.log('║                                                       ║');
  console.log('║  Endpoints:                                           ║');
  console.log('║  - GET  /health              - Health check           ║');
  console.log('║  - POST /api/licenses/activate - Ativar licença       ║');
  console.log('║  - POST /api/licenses/validate - Validar licença      ║');
  console.log('║  - POST /api/admin/login     - Login admin            ║');
  console.log('║  - GET  /api/admin/licenses  - Listar licenças        ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
});
