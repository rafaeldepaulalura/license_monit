/**
 * LICITANTE PRIME - Main Process
 * 
 * Este é o processo principal do Electron.
 * Gerencia:
 * - Janela principal da aplicação
 * - WebViews OCULTOS para scraping de cada pregão
 * - Sistema de alertas e notificações
 * - Persistência de dados (electron-store)
 */

const { app, BrowserWindow, ipcMain, Notification, shell, Tray, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Sistema de Licenças Online
const onlineLicense = require('./onlineLicense');

// Sistema de Notificações Telegram
const telegramNotifier = require('./telegramNotifier');

let tray = null;

// ==================== CONFIGURAÇÃO DO STORE ====================
const store = new Store({
  // Não especificar 'name' para usar o padrão 'config.json'
  clearInvalidConfig: true,
  defaults: {
    license: null,
    pregoes: [],
    keywords: [],
    monitoringInterval: 30, // segundos (30 segundos)
    soundEnabled: true,
    lastMessages: {}, // { pregaoId: [uniqueIds das mensagens já vistas] }
    savedMessages: {}, // { pregaoId: [mensagens salvas] } - PERSISTÊNCIA
    telegram: {
      enabled: false,
      chatId: ''
    }
  }
});

// Log do caminho onde os dados são salvos
console.log('[Store] Arquivo de dados:', store.path);

// ==================== CONFIGURAÇÃO DAS APIs ====================
const API_CONFIG = {
  PCP: {
    baseUrl: 'https://apipcp.portaldecompraspublicas.com.br',
    publicKey: 'd7294c418ecf803c10cfa23f8d2aedd3',
    endpoints: {
      chat: '/publico/obterChat'
    }
  },
  LICITANET: {
    baseUrl: 'https://licitanet-api-sala-disputa-treinamento.licitanet.com.br',
    xToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzM4NCJ9.eyJpYXQiOjE3Njc3MDQwNTMsImlzcyI6ImxpY2l0YW5ldC5jb20uYnIiLCJuYmYiOjE3Njc3MDQwNTIsImRhdGEiOnsibXBMWjJjVFg3USUzRCUzRCI6ImFGYWZvSmFhIiwicDRUZTNkSE81ZyUzRCUzRCI6ImJGcWNtcHlhcDVTZWxhU1FaMjQlM0QifX0.oiw8KfWREoHWszaGU2SbSl4o3hcGcokyVLztrkdvUboFIVKlLP3iYcj_xiYllZbk',
    apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzM4NCJ9.eyJpYXQiOjE3Njc3MDQwNTMsImlzcyI6ImxpY2l0YW5ldC5jb20uYnIiLCJuYmYiOjE3Njc3MDQwNTIsImRhdGEiOnsibXBMWjJjVFg3USUzRCUzRCI6ImFGYWZvSmFhIiwicDRUZTNkSE81ZyUzRCUzRCI6ImJGcWNtcHlhcDVTZWxhU1FaMjQlM0QifX0.oiw8KfWREoHWszaGU2SbSl4o3hcGcokyVLztrkdvUboFIVKlLP3iYcj_xiYllZbk',
    endpoints: {
      message: '/process/message'
    }
  }
};

// ==================== VARIÁVEIS GLOBAIS ====================
let mainWindow = null;
const scraperWindows = new Map(); // Map<pregaoId, BrowserWindow>
const monitoringIntervals = new Map(); // Map<pregaoId, intervalId>
const apiMonitoringIntervals = new Map(); // Map<pregaoId, intervalId> para APIs

// Verificação periódica de licença online (a cada 1 hora)
let licenseCheckInterval = null;
const LICENSE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hora

// ==================== FUNÇÕES UTILITÁRIAS ====================

/**
 * Gera hash simples de uma string (para deduplicação de mensagens)
 */
function hashMessage(text) {
  if (!text) return '0';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

/**
 * Verifica se é desenvolvimento ou produção
 */
function isDev() {
  return !app.isPackaged;
}

// ==================== API PORTAL DE COMPRAS PÚBLICAS ====================

/**
 * Busca mensagens do chat via API do Portal de Compras Públicas
 */
async function fetchPCPMessages(idLicitacao, idUltimaFrase = null) {
  try {
    const { baseUrl, publicKey, endpoints } = API_CONFIG.PCP;
    
    let url = `${baseUrl}${endpoints.chat}?publicKey=${publicKey}&idLicitacao=${idLicitacao}`;
    
    // Se tiver ID da última frase, buscar apenas mensagens novas
    if (idUltimaFrase) {
      url += `&idUltimaFrase=${idUltimaFrase}`;
    }
    
    console.log(`[PCP API] Buscando mensagens: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.dadosChat) {
      return { success: false, error: 'Resposta inválida da API', mensagens: [] };
    }
    
    // Converter formato PCP para formato padrão do sistema
    const mensagens = data.dadosChat.map(msg => ({
      id: `pcp-${msg.id}`,
      uniqueId: `pcp-${msg.id}`,
      remetente: msg.Apelido || 'Sistema',
      tipo: msg.Apelido || 'Sistema',
      texto: msg.Frase,
      data: msg.Data,
      hora: msg.Hora,
      dataHora: `${msg.Data} ${msg.Hora}`,
      timestamp: parseDataHora(msg.Data, msg.Hora),
      plataforma: 'pcp',
      idOriginal: msg.id
    }));
    
    // Ordenar por timestamp (mais recente primeiro)
    mensagens.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[PCP API] ✅ Recebidas ${mensagens.length} mensagens`);
    
    return {
      success: true,
      count: mensagens.length,
      mensagens,
      quantidadeTotal: data.quantidadeTotal,
      paginaAtual: data.paginaAtual
    };
    
  } catch (error) {
    console.error(`[PCP API] ❌ Erro:`, error.message);
    return { success: false, error: error.message, mensagens: [] };
  }
}

/**
 * Busca TODAS as mensagens do chat PCP (paginado)
 */
async function fetchAllPCPMessages(idLicitacao) {
  try {
    let allMessages = [];
    let pagina = 1;
    let hasMore = true;
    
    while (hasMore && pagina <= 10) { // Máximo 10 páginas (500 mensagens)
      const { baseUrl, publicKey, endpoints } = API_CONFIG.PCP;
      const url = `${baseUrl}${endpoints.chat}?publicKey=${publicKey}&idLicitacao=${idLicitacao}&pagina=${pagina}`;
      
      console.log(`[PCP API] Buscando página ${pagina}...`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.dadosChat || data.dadosChat.length === 0) {
        hasMore = false;
        break;
      }
      
      // Converter formato PCP para formato padrão
      const mensagens = data.dadosChat.map(msg => ({
        id: `pcp-${msg.id}`,
        uniqueId: `pcp-${msg.id}`,
        remetente: msg.Apelido || 'Sistema',
        tipo: msg.Apelido || 'Sistema',
        texto: msg.Frase,
        data: msg.Data,
        hora: msg.Hora,
        dataHora: `${msg.Data} ${msg.Hora}`,
        timestamp: parseDataHora(msg.Data, msg.Hora),
        plataforma: 'pcp',
        idOriginal: msg.id
      }));
      
      allMessages.push(...mensagens);
      
      // Verificar se há mais páginas
      if (data.dadosChat.length < data.quantidadePorPagina) {
        hasMore = false;
      } else {
        pagina++;
      }
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[PCP API] ✅ Total: ${allMessages.length} mensagens de ${pagina} páginas`);
    
    return {
      success: true,
      count: allMessages.length,
      mensagens: allMessages
    };
    
  } catch (error) {
    console.error(`[PCP API] ❌ Erro:`, error.message);
    return { success: false, error: error.message, mensagens: [] };
  }
}

/**
 * Converte data e hora no formato brasileiro para timestamp
 */
function parseDataHora(data, hora) {
  try {
    // Data no formato DD/MM/YYYY, Hora no formato HH:MM:SS
    const [dia, mes, ano] = data.split('/');
    const [h, m, s] = hora.split(':');
    return new Date(ano, mes - 1, dia, h, m, s || 0).getTime();
  } catch (e) {
    return Date.now();
  }
}

// ==================== API LICITANET ====================

/**
 * Busca mensagens do chat via API do Licitanet
 */
async function fetchLicitanetMessages(codProcess, page = 1, limit = 250) {
  try {
    const { baseUrl, xToken, apiKey, endpoints } = API_CONFIG.LICITANET;
    
    const url = `${baseUrl}${endpoints.message}/${codProcess}?page=${page}&limit=${limit}`;
    
    console.log(`[Licitanet API] Buscando mensagens: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Token': xToken,
        'ApiKey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data) {
      return { success: false, error: 'Resposta inválida da API', mensagens: [] };
    }
    
    // Converter formato Licitanet para formato padrão do sistema
    const mensagens = data.data.map(msg => ({
      id: `licitanet-${msg.identifier}`,
      uniqueId: `licitanet-${msg.identifier}`,
      remetente: msg.name || 'Sistema',
      tipo: msg.name || 'Sistema',
      item: msg.batch ? `Lote ${msg.batch}` : '',
      texto: msg.message,
      data: formatLicitanetDate(msg.datMessage),
      hora: formatLicitanetTime(msg.datMessage),
      dataHora: formatLicitanetDateTime(msg.datMessage),
      timestamp: parseLicitanetDateTime(msg.datMessage),
      plataforma: 'licitanet',
      idOriginal: msg.identifier,
      idProcesso: msg.identifierProcess
    }));
    
    // Ordenar por timestamp (mais recente primeiro)
    mensagens.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[Licitanet API] ✅ Recebidas ${mensagens.length} mensagens`);
    
    return {
      success: true,
      count: mensagens.length,
      mensagens,
      pagination: data.pagination
    };
    
  } catch (error) {
    console.error(`[Licitanet API] ❌ Erro:`, error.message);
    return { success: false, error: error.message, mensagens: [] };
  }
}

/**
 * Busca TODAS as mensagens do chat Licitanet (paginado)
 */
async function fetchAllLicitanetMessages(codProcess) {
  try {
    let allMessages = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 5) { // Máximo 5 páginas (1250 mensagens)
      const result = await fetchLicitanetMessages(codProcess, page, 250);
      
      if (!result.success || result.mensagens.length === 0) {
        hasMore = false;
        break;
      }
      
      allMessages.push(...result.mensagens);
      
      // Verificar se há mais páginas
      if (result.pagination && page >= result.pagination.totalPages) {
        hasMore = false;
      } else {
        page++;
      }
    }
    
    // Ordenar por timestamp (mais recente primeiro)
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`[Licitanet API] ✅ Total: ${allMessages.length} mensagens de ${page} páginas`);
    
    return {
      success: true,
      count: allMessages.length,
      mensagens: allMessages
    };
    
  } catch (error) {
    console.error(`[Licitanet API] ❌ Erro:`, error.message);
    return { success: false, error: error.message, mensagens: [] };
  }
}

/**
 * Formata data do Licitanet (YYYY-MM-DD HH:MM:SS) para DD/MM/YYYY
 */
function formatLicitanetDate(dateStr) {
  try {
    const [datePart] = dateStr.split(' ');
    const [ano, mes, dia] = datePart.split('-');
    return `${dia}/${mes}/${ano}`;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Formata hora do Licitanet (YYYY-MM-DD HH:MM:SS) para HH:MM:SS
 */
function formatLicitanetTime(dateStr) {
  try {
    const [, timePart] = dateStr.split(' ');
    return timePart;
  } catch (e) {
    return '';
  }
}

/**
 * Formata data/hora do Licitanet para exibição
 */
function formatLicitanetDateTime(dateStr) {
  return `${formatLicitanetDate(dateStr)} ${formatLicitanetTime(dateStr)}`;
}

/**
 * Converte data/hora do Licitanet para timestamp
 */
function parseLicitanetDateTime(dateStr) {
  try {
    // Formato: YYYY-MM-DD HH:MM:SS
    return new Date(dateStr.replace(' ', 'T')).getTime();
  } catch (e) {
    return Date.now();
  }
}

// ==================== CRIAÇÃO DA JANELA PRINCIPAL ====================

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Monitoramento de Chat - Licitante Prime',
    icon: path.join(__dirname, 'public', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true // Habilitar webview tag
    }
  });

  // Carregar a aplicação
  if (isDev()) {
    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Parar todos os monitoramentos
    stopAllMonitoring();
  });

  // Minimizar para a bandeja ao invés de fechar (opcional)
  mainWindow.on('close', (event) => {
    // Se houver pregões sendo monitorados, minimizar ao invés de fechar
    const pregoes = store.get('pregoes') || [];
    const activeMonitoring = pregoes.some(p => p.monitoring);
    
    if (activeMonitoring && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      new Notification({
        title: 'Licitante Prime',
        body: 'O monitoramento continua em segundo plano.'
        // icon: path.join(__dirname, 'public', 'icon.ico')
      }).show();
    }
  });
}

// ==================== SCRAPER - JANELAS OCULTAS ====================

/**
 * Cria uma janela BrowserWindow OCULTA para fazer scraping de um pregão
 */
function createScraperWindow(pregao) {
  console.log(`[Scraper] Criando janela oculta para: ${pregao.nome || pregao.id}`);
  
  const scraperWin = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false, // OCULTO - não mostra a janela
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:pregao-${pregao.id}` // Sessão isolada para cada pregão
    }
  });

  // Evento quando a página carrega
  scraperWin.webContents.on('did-finish-load', async () => {
    console.log(`[Scraper ${pregao.id}] Página carregada`);
    
    // Aguardar um pouco para a página renderizar completamente (Angular precisa de tempo)
    setTimeout(async () => {
      try {
        // Tentar abrir o painel de chat
        const openResult = await tryOpenChatPanel(scraperWin, pregao.id);
        console.log(`[Scraper ${pregao.id}] Chat aberto:`, openResult.success);
        
        // Aguardar o sidebar carregar as mensagens
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Extrair mensagens
        const result = await extractAllMessages(scraperWin, pregao.id);
        
        if (result.success && result.mensagens.length > 0) {
          console.log(`[Scraper ${pregao.id}] ✅ Extraídas ${result.count} mensagens no carregamento inicial`);
          processMessages(pregao.id, result.mensagens);
        } else {
          console.log(`[Scraper ${pregao.id}] ⚠️ Nenhuma mensagem encontrada. Debug:`, result.debug || result.error);
        }
      } catch (err) {
        console.error(`[Scraper ${pregao.id}] Erro no carregamento inicial:`, err.message);
      }
    }, 4000);
  });

  // Evento de erro
  scraperWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`[Scraper ${pregao.id}] Erro ao carregar: ${errorDescription}`);
  });

  // Navegar para a URL do pregão
  scraperWin.loadURL(pregao.url);
  
  return scraperWin;
}

/**
 * Tenta abrir o painel de chat na página
 */
async function tryOpenChatPanel(scraperWin, pregaoId) {
  try {
    // Primeiro verificar se o painel já está aberto
    const isOpen = await scraperWin.webContents.executeJavaScript(`
      (function() {
        // Verificar se o sidebar de mensagens está visível
        const sidebar = document.querySelector('.p-sidebar-active');
        const mensagensTitulo = document.querySelector('.titulo-mensagens');
        return !!(sidebar && mensagensTitulo);
      })();
    `);
    
    if (isOpen) {
      console.log(`[Scraper ${pregaoId}] Chat já está aberto`);
      return { success: true, alreadyOpen: true };
    }
    
    const result = await scraperWin.webContents.executeJavaScript(`
      (function() {
        // Seletores ESPECÍFICOS para o BOTÃO de envelope (não o título)
        // O botão fica na barra inferior da página
        const selectors = [
          // Ícone FontAwesome - mais específico
          'i.fa-envelope.fas',
          '.fa-envelope.fas',
          '.fa-envelope',
          // Botão que contém o ícone de envelope
          'button:has(.fa-envelope)',
          'button:has(.pi-envelope)',
          // Ícones PrimeNG
          '.pi-envelope',
          // Ícone de envelope na barra de ações
          '[class*="toolbar"] .fa-envelope',
          '[class*="footer"] .fa-envelope',
          'button[aria-label*="Mensagem"]',
          'button[aria-label*="mensagem"]'
        ];
        
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
              // Verificar se o elemento está visível
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                // Se for um ícone (i), clicar no parent ou no próprio elemento
                const clickTarget = el.tagName === 'I' ? (el.closest('button') || el) : el;
                clickTarget.click();
                return { success: true, selector: selector, element: el.outerHTML.substring(0, 200) };
              }
            }
          } catch(e) {
            // Alguns seletores como :has podem falhar em navegadores antigos
          }
        }
        
        return { 
          success: false, 
          message: 'Botão de envelope não encontrado',
          totalButtons: document.querySelectorAll('button').length
        };
      })();
    `);
    
    console.log(`[Scraper ${pregaoId}] Resultado do clique:`, result);
    return result;
    
  } catch (error) {
    console.error(`[Scraper ${pregaoId}] Erro ao abrir chat:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Navega para a última página do chat e extrai todas as mensagens
 * Usa seletores DOM baseados na estrutura real do Comprasnet
 */
async function extractAllMessages(scraperWin, pregaoId) {
  try {
    const result = await scraperWin.webContents.executeJavaScript(`
      (async function() {
        try {
          const todasMensagens = [];
          const debugInfo = { pages: 0, totalFound: 0, method: '', html: '' };
          
          // Função para extrair mensagens da página atual usando seletores DOM
          function extractCurrentPage() {
            const mensagens = [];
            
            // Buscar o sidebar de mensagens - múltiplos seletores
            const sidebar = document.querySelector('.p-sidebar') || 
                           document.querySelector('.p-sidebar-active') ||
                           document.querySelector('[class*="sidebar"]');
            debugInfo.hasSidebar = !!sidebar;
            
            // Se não encontrou sidebar, tentar buscar no body inteiro
            const searchRoot = sidebar || document.body;
            
            // Buscar todos os containers de mensagem usando múltiplos seletores
            // Baseado no HTML real: <div class="...p-grid cp-mensagens-compra...">
            let messageContainers = searchRoot.querySelectorAll('.cp-mensagens-compra');
            
            // Se não encontrou, tentar seletores alternativos
            if (messageContainers.length === 0) {
              messageContainers = searchRoot.querySelectorAll('[class*="cp-mensagens"]');
            }
            if (messageContainers.length === 0) {
              messageContainers = searchRoot.querySelectorAll('.p-grid[class*="mensagens"]');
            }
            if (messageContainers.length === 0) {
              // Último recurso: buscar divs com a estrutura de mensagem
              messageContainers = searchRoot.querySelectorAll('.p-dataview-content > div');
            }
            
            debugInfo.containersFound = messageContainers.length;
            
            // Capturar sample do HTML para debug
            if (sidebar) {
              debugInfo.sidebarHTML = sidebar.innerHTML.substring(0, 1000);
            } else {
              // Procurar qualquer conteúdo que contenha "Mensagem do Pregoeiro"
              const bodyText = document.body.innerText;
              if (bodyText.includes('Mensagem do Pregoeiro') || bodyText.includes('Mensagem do Participante')) {
                debugInfo.hasMensagemText = true;
                debugInfo.bodyTextSample = bodyText.substring(bodyText.indexOf('Mensagem do'), bodyText.indexOf('Mensagem do') + 500);
              }
            }
            
            messageContainers.forEach((container, idx) => {
              try {
                // Extrair remetente: <div class="mensagens-remetente">Mensagem do Pregoeiro</div>
                const remetenteEl = container.querySelector('.mensagens-remetente, [class*="mensagens-remetente"]');
                let remetente = remetenteEl ? remetenteEl.textContent.trim() : '';
                
                // Normalizar remetente
                if (remetente.includes('Pregoeiro')) {
                  remetente = 'Pregoeiro';
                } else if (remetente.includes('Participante')) {
                  remetente = 'Participante';
                } else if (remetente.includes('Sistema')) {
                  remetente = 'Sistema';
                } else {
                  remetente = 'Desconhecido';
                }
                
                // Extrair item: <div class="mensagens-item">Item 2</div>
                const itemEl = container.querySelector('.mensagens-item, [class*="mensagens-item"]');
                let item = itemEl ? itemEl.textContent.trim().replace('Item ', '') : '';
                
                // Extrair texto: <div class="mensagens-texto">O item 2 está na etapa...</div>
                const textoEl = container.querySelector('.mensagens-texto, [class*="mensagens-texto"]');
                let texto = textoEl ? textoEl.textContent.trim() : '';
                
                // Extrair data/hora: <small>Enviada em 06/01/2026 às 15:03:01h</small>
                const dataEl = container.querySelector('.mensagens-data small, .mensagens-data, [class*="mensagens-data"]');
                let dataHoraStr = dataEl ? dataEl.textContent.trim() : '';
                
                // Parsear data/hora: "Enviada em 06/01/2026 às 15:03:01h"
                let data = '';
                let hora = '';
                const dataMatch = dataHoraStr.match(/(\\d{2}\\/\\d{2}\\/\\d{4})/);
                const horaMatch = dataHoraStr.match(/(\\d{2}:\\d{2}:\\d{2})/);
                if (dataMatch) data = dataMatch[1];
                if (horaMatch) hora = horaMatch[1];
                
                // Só adicionar se tiver texto
                if (texto && texto.length > 3) {
                  const uniqueId = data + hora + remetente + texto.substring(0, 50);
                  
                  // Calcular timestamp
                  let timestamp = Date.now();
                  if (data && hora) {
                    const [dia, mes, ano] = data.split('/');
                    timestamp = new Date(ano + '-' + mes + '-' + dia + 'T' + hora).getTime();
                  }
                  
                  mensagens.push({
                    uniqueId: uniqueId,
                    remetente: remetente,
                    tipo: remetente,
                    item: item,
                    texto: texto,
                    data: data,
                    hora: hora,
                    dataHora: data + ' ' + hora,
                    timestamp: timestamp
                  });
                }
              } catch (e) {
                console.error('Erro ao processar container:', e);
              }
            });
            
            debugInfo.method = 'DOM selectors';
            return mensagens;
          }
          
          // Função para ir para uma página específica usando aria-label
          async function goToPage(pageNumber) {
            // Procurar botão com aria-label do número da página
            const pageBtn = document.querySelector('button[aria-label="' + pageNumber + '"]');
            
            // Debug: listar todos os botões de página disponíveis
            const allPageBtns = document.querySelectorAll('.p-paginator-pages button');
            const availablePages = [];
            allPageBtns.forEach(btn => {
              const label = btn.getAttribute('aria-label');
              if (label) availablePages.push(label);
            });
            
            if (pageBtn) {
              // Verificar se já está na página (p-highlight indica página atual)
              if (pageBtn.classList.contains('p-highlight')) {
                return { success: true, alreadyOnPage: true, availablePages };
              }
              pageBtn.click();
              await new Promise(r => setTimeout(r, 1200));
              return { success: true, alreadyOnPage: false, availablePages };
            }
            return { success: false, availablePages, lookingFor: pageNumber };
          }
          
          // Função para ir para a primeira página usando o botão "First Page"
          async function goToFirstPage() {
            // Primeiro tentar o botão "First Page"
            const firstPageBtn = document.querySelector('button[aria-label="First Page"]:not(.p-disabled)');
            if (firstPageBtn && !firstPageBtn.classList.contains('p-disabled')) {
              firstPageBtn.click();
              await new Promise(r => setTimeout(r, 1200));
              return { success: true, method: 'First Page button' };
            }
            
            // Se o botão First Page não existe ou está disabled, tentar clicar no botão "1"
            const page1Btn = document.querySelector('button[aria-label="1"]');
            if (page1Btn) {
              if (!page1Btn.classList.contains('p-highlight')) {
                page1Btn.click();
                await new Promise(r => setTimeout(r, 1200));
              }
              return { success: true, method: 'Page 1 button' };
            }
            
            return { success: false };
          }
          
          // Primeiro, garantir que estamos na página 1 usando o botão First Page
          const goToFirst = await goToFirstPage();
          debugInfo.wentToFirst = goToFirst;
          
          // Aguardar a página carregar
          await new Promise(r => setTimeout(r, 1000));
          
          // Extrair da página 1 (mensagens mais recentes - MAIS IMPORTANTES)
          let currentPageMsgs = extractCurrentPage();
          todasMensagens.push(...currentPageMsgs);
          debugInfo.pages++;
          debugInfo.page1Count = currentPageMsgs.length;
          
          // Sempre tentar navegar pelas páginas 2, 3, 4, 5
          // (máximo 5 páginas como definido pelo usuário)
          for (let pageNum = 2; pageNum <= 5; pageNum++) {
            const result = await goToPage(pageNum);
            
            // Log para debug
            if (!result.success) {
              debugInfo.failedPage = { page: pageNum, availablePages: result.availablePages };
            }
            
            // Se não conseguiu ir para essa página, parar
            if (!result.success) {
              debugInfo.stoppedAtPage = pageNum;
              break;
            }
            
            // Se já estava nessa página e não navegou, provavelmente não existe
            // Nesse caso, como clicamos em um número, deveria haver o botão
            
            await new Promise(r => setTimeout(r, 1000)); // Esperar renderização
            
            currentPageMsgs = extractCurrentPage();
            
            // Se não há mensagens nessa página, parar
            if (currentPageMsgs.length === 0) {
              debugInfo.emptyPage = pageNum;
              break;
            }
            
            todasMensagens.push(...currentPageMsgs);
            debugInfo.pages++;
          }
          
          // Voltar para a página 1 para a próxima atualização
          await goToFirstPage();
          debugInfo.returnedToPage1 = true;
          
          // Remover duplicatas baseado no uniqueId
          const uniqueMap = new Map();
          todasMensagens.forEach(msg => {
            if (!uniqueMap.has(msg.uniqueId)) {
              uniqueMap.set(msg.uniqueId, msg);
            }
          });
          
          const mensagensUnicas = Array.from(uniqueMap.values());
          
          // Ordenar por timestamp DECRESCENTE (mais recente primeiro)
          mensagensUnicas.sort((a, b) => b.timestamp - a.timestamp);
          
          // Adicionar ID final
          mensagensUnicas.forEach((msg, idx) => {
            msg.id = 'msg-' + idx + '-' + msg.timestamp;
          });
          
          debugInfo.totalFound = mensagensUnicas.length;
          
          // Debug: pegar um sample do HTML
          const sampleContainer = document.querySelector('.cp-mensagens-compra, [class*="cp-mensagens"]');
          if (sampleContainer) {
            debugInfo.sampleHTML = sampleContainer.outerHTML.substring(0, 500);
          }
          
          return JSON.stringify({
            success: true,
            count: mensagensUnicas.length,
            mensagens: mensagensUnicas,
            debug: debugInfo
          });
          
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error.message,
            stack: error.stack,
            count: 0,
            mensagens: []
          });
        }
      })();
    `);
    
    const parsed = JSON.parse(result);
    
    console.log(`[Scraper ${pregaoId}] Extraído: ${parsed.count} mensagens de ${parsed.debug?.pages || 1} páginas`);
    if (parsed.debug) {
      console.log(`[Scraper ${pregaoId}] Debug:`, {
        method: parsed.debug.method,
        containersFound: parsed.debug.containersFound,
        hasSidebar: parsed.debug.hasSidebar
      });
    }
    
    return parsed;
    
  } catch (error) {
    console.error(`[Scraper ${pregaoId}] Erro ao extrair mensagens:`, error.message);
    return { success: false, error: error.message, count: 0, mensagens: [] };
  }
}

/**
 * Extrai mensagens do chat do Comprasnet (versão simplificada para updates)
 */
async function extractMessages(scraperWin, pregaoId) {
  return extractAllMessages(scraperWin, pregaoId);
}

/**
 * Processa mensagens extraídas - verifica palavras-chave e envia alertas
 */
function processMessages(pregaoId, messages) {
  const keywords = store.get('keywords') || [];
  const enabledKeywords = keywords.filter(k => k.enabled);
  const lastMessages = store.get('lastMessages') || {};
  const seenIds = new Set(lastMessages[pregaoId] || []);
  
  // Filtrar apenas mensagens novas usando uniqueId
  const newMessages = messages.filter(msg => {
    const uniqueId = msg.uniqueId || hashMessage(msg.texto + msg.dataHora);
    if (seenIds.has(uniqueId)) return false;
    seenIds.add(uniqueId);
    return true;
  });
  
  // Atualizar IDs vistos (manter últimos 1000)
  lastMessages[pregaoId] = Array.from(seenIds).slice(-1000);
  store.set('lastMessages', lastMessages);
  
  if (newMessages.length === 0) return;
  
  console.log(`[Processor] ${newMessages.length} novas mensagens no pregão ${pregaoId}`);
  
  // PERSISTÊNCIA: Salvar mensagens no store
  const savedMessages = store.get('savedMessages') || {};
  const existingMessages = savedMessages[pregaoId] || [];
  
  // Adicionar novas mensagens (evitar duplicatas)
  const existingIds = new Set(existingMessages.map(m => m.uniqueId));
  const messagesToAdd = newMessages.filter(m => !existingIds.has(m.uniqueId));
  
  if (messagesToAdd.length > 0) {
    // Combinar e ordenar por timestamp (mais recente primeiro)
    const allMessages = [...messagesToAdd, ...existingMessages];
    allMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    // Manter no máximo 500 mensagens por pregão para não sobrecarregar
    savedMessages[pregaoId] = allMessages.slice(0, 500);
    store.set('savedMessages', savedMessages);
    console.log(`[Processor] Salvas ${messagesToAdd.length} mensagens. Total: ${savedMessages[pregaoId].length}`);
  }
  
  // Enviar mensagens para o renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:messages', {
      pregaoId,
      messages: newMessages
    });
  }
  
  // Verificar palavras-chave
  newMessages.forEach(msg => {
    const matchedKeyword = enabledKeywords.find(kw => 
      msg.texto.toLowerCase().includes(kw.text.toLowerCase())
    );
    
    if (matchedKeyword) {
      console.log(`🚨 ALERTA! Palavra-chave "${matchedKeyword.text}" detectada!`);
      
      // Buscar nome do pregão
      const pregoes = store.get('pregoes') || [];
      const pregao = pregoes.find(p => p.id === pregaoId);
      const pregaoNome = pregao ? pregao.nome : pregaoId;
      
      // Enviar alerta para o renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('alert:keyword', {
          pregaoId,
          message: msg,
          keyword: matchedKeyword,
          timestamp: new Date().toISOString()
        });
        
        // Mostrar janela se estiver minimizada
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.flashFrame(true);
      }
      
      // Notificação do sistema
      const notification = new Notification({
        title: '🚨 ALERTA - Licitante Prime',
        body: `Palavra-chave "${matchedKeyword.text}" detectada!\n${msg.texto.substring(0, 100)}...`,
        // icon: path.join(__dirname, 'public', 'icon.ico'),
        urgency: 'critical'
      });
      notification.show();
      
      // ========== NOTIFICAÇÃO TELEGRAM ==========
      const telegramConfig = store.get('telegram');
      if (telegramConfig && telegramConfig.enabled && telegramConfig.chatId) {
        console.log(`[Telegram] Enviando alerta para chat ${telegramConfig.chatId}`);
        
        telegramNotifier.sendKeywordAlert(telegramConfig.chatId, {
          pregaoNome: pregaoNome,
          keyword: matchedKeyword.text,
          mensagem: msg.texto,
          dataHora: msg.dataHora || `${msg.data} ${msg.hora}`
        }).then(result => {
          if (result.success) {
            console.log('[Telegram] ✅ Alerta enviado com sucesso');
          } else {
            console.log('[Telegram] ❌ Falha ao enviar:', result.error);
          }
        }).catch(err => {
          console.error('[Telegram] ❌ Erro:', err.message);
        });
      }
    }
  });
}

// ==================== CONTROLE DE MONITORAMENTO ====================

/**
 * Auto-start: Retoma automaticamente o monitoramento de pregões que estavam ativos
 * Chamado quando o app inicia para restaurar o estado anterior
 */
async function autoStartActiveMonitoring() {
  // Aguardar um pouco para garantir que a janela principal está pronta
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Verificar licença primeiro
  const licenseStatus = checkLicenseStatus();
  if (!licenseStatus.valid) {
    console.log('[AutoStart] ⚠️ Licença inválida, não será possível iniciar monitoramento automático');
    return;
  }
  
  // Buscar pregões que estavam com monitoring: true
  const pregoes = store.get('pregoes') || [];
  const activePregoes = pregoes.filter(p => p.monitoring === true);
  
  if (activePregoes.length === 0) {
    console.log('[AutoStart] Nenhum pregão com monitoramento ativo para reiniciar');
    return;
  }
  
  console.log(`[AutoStart] 🚀 Reiniciando monitoramento de ${activePregoes.length} pregão(ões)...`);
  
  // Notificar usuário
  new Notification({
    title: 'Licitante Prime',
    body: `Reiniciando monitoramento de ${activePregoes.length} pregão(ões)...`,
    urgency: 'normal'
  }).show();
  
  // Iniciar monitoramento de cada pregão com um pequeno delay entre eles
  // para não sobrecarregar o sistema
  for (let i = 0; i < activePregoes.length; i++) {
    const pregao = activePregoes[i];
    
    console.log(`[AutoStart] (${i + 1}/${activePregoes.length}) Iniciando: ${pregao.nome}`);
    
    try {
      // Marcar como não monitorando temporariamente para que startMonitoring funcione
      const allPregoes = store.get('pregoes') || [];
      const idx = allPregoes.findIndex(p => p.id === pregao.id);
      if (idx !== -1) {
        allPregoes[idx].monitoring = false;
        store.set('pregoes', allPregoes);
      }
      
      // Iniciar monitoramento
      const result = startMonitoring(pregao.id);
      
      if (result.success) {
        console.log(`[AutoStart] ✅ ${pregao.nome} - monitoramento iniciado`);
      } else {
        console.log(`[AutoStart] ❌ ${pregao.nome} - falhou: ${result.error}`);
      }
    } catch (error) {
      console.error(`[AutoStart] ❌ Erro ao iniciar ${pregao.nome}:`, error.message);
    }
    
    // Aguardar 2 segundos antes de iniciar o próximo (para não sobrecarregar)
    if (i < activePregoes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('[AutoStart] ✅ Todos os monitoramentos foram reiniciados');
  
  // Notificar usuário que o monitoramento foi restaurado
  new Notification({
    title: 'Licitante Prime',
    body: `Monitoramento restaurado! ${activePregoes.length} pregão(ões) sendo monitorado(s).`,
    urgency: 'normal'
  }).show();
}

/**
 * Inicia o monitoramento de um pregão
 * Suporta múltiplas plataformas: Comprasnet (scraping), PCP (API), Licitanet (API)
 */
function startMonitoring(pregaoId) {
  const pregoes = store.get('pregoes') || [];
  const pregao = pregoes.find(p => p.id === pregaoId);
  
  if (!pregao) {
    console.error(`[Monitor] Pregão ${pregaoId} não encontrado`);
    return { success: false, error: 'Pregão não encontrado' };
  }
  
  // Verificar licença
  const license = store.get('license');
  if (!license || !license.valid) {
    return { success: false, error: 'Licença inválida' };
  }
  
  const plataforma = pregao.plataforma || 'comprasnet';
  console.log(`[Monitor] Iniciando monitoramento: ${pregao.nome} (${plataforma})`);
  
  // Decidir qual método de monitoramento usar baseado na plataforma
  if (plataforma === 'pcp') {
    return startPCPMonitoring(pregaoId, pregao);
  } else if (plataforma === 'licitanet') {
    return startLicitanetMonitoring(pregaoId, pregao);
  } else {
    // Comprasnet - usar scraping
    return startComprasnetMonitoring(pregaoId, pregao);
  }
}

/**
 * Inicia monitoramento via API do Licitanet
 */
function startLicitanetMonitoring(pregaoId, pregao) {
  // Se já existe monitoramento, não criar outro
  if (apiMonitoringIntervals.has(pregaoId)) {
    console.log(`[Licitanet] Monitoramento já existe para ${pregaoId}`);
    return { success: true };
  }
  
  const codProcess = pregao.idLicitacao;
  if (!codProcess) {
    return { success: false, error: 'Código do processo não informado' };
  }
  
  console.log(`[Licitanet] Iniciando monitoramento do processo ${codProcess}`);
  
  // Buscar mensagens iniciais
  fetchAllLicitanetMessages(codProcess).then(result => {
    if (result.success && result.mensagens.length > 0) {
      console.log(`[Licitanet ${pregaoId}] ✅ ${result.count} mensagens iniciais`);
      processMessages(pregaoId, result.mensagens);
    }
  });
  
  // Intervalo de monitoramento
  const interval = store.get('monitoringInterval') || 30;
  const finalInterval = Math.max(interval, 20); // Mínimo 20 segundos para API
  
  console.log(`[Licitanet] Intervalo: ${finalInterval} segundos`);
  
  const intervalId = setInterval(async () => {
    try {
      console.log(`[Licitanet ${pregaoId}] Buscando novas mensagens...`);
      
      // Buscar página 1 (mensagens mais recentes)
      const result = await fetchLicitanetMessages(codProcess, 1, 250);
      
      if (result.success && result.mensagens.length > 0) {
        processMessages(pregaoId, result.mensagens);
      }
    } catch (err) {
      console.error(`[Licitanet ${pregaoId}] Erro:`, err.message);
    }
  }, finalInterval * 1000);
  
  apiMonitoringIntervals.set(pregaoId, intervalId);
  
  // Atualizar status no store
  const pregoes = store.get('pregoes') || [];
  const idx = pregoes.findIndex(p => p.id === pregaoId);
  if (idx !== -1) {
    pregoes[idx].monitoring = true;
    store.set('pregoes', pregoes);
  }
  
  return { success: true };
}

/**
 * Inicia monitoramento via API do Portal de Compras Públicas
 */
function startPCPMonitoring(pregaoId, pregao) {
  // Se já existe monitoramento, não criar outro
  if (apiMonitoringIntervals.has(pregaoId)) {
    console.log(`[PCP] Monitoramento já existe para ${pregaoId}`);
    return { success: true };
  }
  
  const idLicitacao = pregao.idLicitacao;
  if (!idLicitacao) {
    return { success: false, error: 'ID da licitação não informado' };
  }
  
  console.log(`[PCP] Iniciando monitoramento da licitação ${idLicitacao}`);
  
  // Buscar mensagens iniciais
  fetchAllPCPMessages(idLicitacao).then(result => {
    if (result.success && result.mensagens.length > 0) {
      console.log(`[PCP ${pregaoId}] ✅ ${result.count} mensagens iniciais`);
      processMessages(pregaoId, result.mensagens);
    }
  });
  
  // Intervalo de monitoramento
  const interval = store.get('monitoringInterval') || 30;
  const finalInterval = Math.max(interval, 20); // Mínimo 20 segundos para API
  
  console.log(`[PCP] Intervalo: ${finalInterval} segundos`);
  
  const intervalId = setInterval(async () => {
    try {
      console.log(`[PCP ${pregaoId}] Buscando novas mensagens...`);
      
      // Buscar apenas página 1 (mensagens mais recentes)
      const result = await fetchPCPMessages(idLicitacao);
      
      if (result.success && result.mensagens.length > 0) {
        processMessages(pregaoId, result.mensagens);
      }
    } catch (err) {
      console.error(`[PCP ${pregaoId}] Erro:`, err.message);
    }
  }, finalInterval * 1000);
  
  apiMonitoringIntervals.set(pregaoId, intervalId);
  
  // Atualizar status no store
  const pregoes = store.get('pregoes') || [];
  const idx = pregoes.findIndex(p => p.id === pregaoId);
  if (idx !== -1) {
    pregoes[idx].monitoring = true;
    store.set('pregoes', pregoes);
  }
  
  return { success: true };
}

/**
 * Inicia monitoramento via scraping do Comprasnet
 */
function startComprasnetMonitoring(pregaoId, pregao) {
  // Se já existe uma janela scraper, não criar outra
  if (scraperWindows.has(pregaoId)) {
    console.log(`[Monitor] Scraper já existe para ${pregaoId}`);
    return { success: true };
  }
  
  // Criar janela scraper oculta
  const scraperWin = createScraperWindow(pregao);
  scraperWindows.set(pregaoId, scraperWin);
  
  // Iniciar intervalo de scraping (30 segundos)
  const interval = store.get('monitoringInterval') || 30;
  // Garantir que não seja menor que 30 segundos para não sobrecarregar
  const finalInterval = Math.max(interval, 30);
  
  console.log(`[Monitor] Intervalo de monitoramento: ${finalInterval} segundos`);
  
  const intervalId = setInterval(async () => {
    const win = scraperWindows.get(pregaoId);
    if (!win || win.isDestroyed()) {
      console.log(`[Scraper ${pregaoId}] Janela destruída, parando intervalo`);
      clearInterval(intervalId);
      monitoringIntervals.delete(pregaoId);
      return;
    }
    
    try {
      console.log(`[Scraper ${pregaoId}] === INICIANDO CICLO DE SCRAPING ===`);
      
      // Verificar se o chat já está aberto, senão abrir
      console.log(`[Scraper ${pregaoId}] Verificando/abrindo painel de chat...`);
      const chatResult = await tryOpenChatPanel(win, pregaoId);
      console.log(`[Scraper ${pregaoId}] Chat:`, chatResult.alreadyOpen ? 'já aberto' : (chatResult.success ? 'aberto agora' : 'falhou'));
      
      if (!chatResult.alreadyOpen && chatResult.success) {
        // Se acabou de abrir, aguardar mais tempo para carregar
        console.log(`[Scraper ${pregaoId}] Aguardando 4s para sidebar carregar...`);
        await new Promise(resolve => setTimeout(resolve, 4000));
      } else {
        // Se já estava aberto, só aguardar um pouco
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Extrair mensagens (foca na página 1 onde as mensagens novas aparecem)
      console.log(`[Scraper ${pregaoId}] Extraindo mensagens...`);
      const result = await extractMessages(win, pregaoId);
      
      if (result.debug) {
        console.log(`[Scraper ${pregaoId}] Páginas: ${result.debug.pages}, Página1: ${result.debug.page1Count || 'N/A'} msgs`);
        if (result.debug.stoppedAtPage) {
          console.log(`[Scraper ${pregaoId}] Parou na página: ${result.debug.stoppedAtPage}, disponíveis: ${JSON.stringify(result.debug.failedPage?.availablePages || [])}`);
        }
      }
      
      console.log(`[Scraper ${pregaoId}] Resultado extração:`, {
        success: result.success,
        count: result.count,
        error: result.error || 'nenhum'
      });
      
      if (result.success && result.mensagens && result.mensagens.length > 0) {
        console.log(`[Scraper ${pregaoId}] ✅ Processando ${result.mensagens.length} mensagens`);
        processMessages(pregaoId, result.mensagens);
      } else {
        console.log(`[Scraper ${pregaoId}] ⚠️ Nenhuma mensagem encontrada`);
        if (result.debug) {
          console.log(`[Scraper ${pregaoId}] Debug:`, JSON.stringify(result.debug).substring(0, 500));
        }
        
        // Se não encontrou mensagens, tentar reabrir o chat
        if (result.debug?.containersFound === 0) {
          console.log(`[Scraper ${pregaoId}] Tentando recarregar página para próximo ciclo...`);
          try {
            await win.webContents.reload();
          } catch (e) {
            console.log(`[Scraper ${pregaoId}] Erro ao recarregar:`, e.message);
          }
        }
      }
      
      console.log(`[Scraper ${pregaoId}] === FIM DO CICLO === (próximo em ${finalInterval}s)`);
    } catch (err) {
      console.error(`[Scraper ${pregaoId}] ❌ Erro no ciclo de scraping:`, err.message);
    }
  }, finalInterval * 1000);
  
  monitoringIntervals.set(pregaoId, intervalId);
  
  // Atualizar status no store
  const pregoes = store.get('pregoes') || [];
  const idx = pregoes.findIndex(p => p.id === pregaoId);
  if (idx !== -1) {
    pregoes[idx].monitoring = true;
    store.set('pregoes', pregoes);
  }
  
  console.log(`[Monitor] Monitoramento iniciado para ${pregao.nome || pregaoId}`);
  
  return { success: true };
}

/**
 * Para o monitoramento de um pregão
 */
function stopMonitoring(pregaoId) {
  // Parar intervalo de scraping (Comprasnet)
  const intervalId = monitoringIntervals.get(pregaoId);
  if (intervalId) {
    clearInterval(intervalId);
    monitoringIntervals.delete(pregaoId);
  }
  
  // Parar intervalo de API (PCP, Licitanet)
  const apiIntervalId = apiMonitoringIntervals.get(pregaoId);
  if (apiIntervalId) {
    clearInterval(apiIntervalId);
    apiMonitoringIntervals.delete(pregaoId);
  }
  
  // Fechar janela scraper (se existir)
  const scraperWin = scraperWindows.get(pregaoId);
  if (scraperWin && !scraperWin.isDestroyed()) {
    scraperWin.close();
  }
  scraperWindows.delete(pregaoId);
  
  // Atualizar status no store
  const pregoes = store.get('pregoes') || [];
  const pregao = pregoes.find(p => p.id === pregaoId);
  if (pregao) {
    pregao.monitoring = false;
    store.set('pregoes', pregoes);
  }
  
  console.log(`[Monitor] Monitoramento parado para ${pregaoId}`);
  
  return { success: true };
}

/**
 * Para todos os monitoramentos
 */
function stopAllMonitoring() {
  // Parar todos os intervalos de scraping
  monitoringIntervals.forEach((intervalId, pregaoId) => {
    clearInterval(intervalId);
  });
  monitoringIntervals.clear();
  
  // Parar todos os intervalos de API
  apiMonitoringIntervals.forEach((intervalId, pregaoId) => {
    clearInterval(intervalId);
  });
  apiMonitoringIntervals.clear();
  
  // Fechar todas as janelas scraper
  scraperWindows.forEach((win, pregaoId) => {
    if (!win.isDestroyed()) {
      win.close();
    }
  });
  scraperWindows.clear();
}

// ==================== IPC HANDLERS ====================

// ==================== SISTEMA DE LICENÇAS ====================

// Chave secreta para assinatura (DEVE SER A MESMA DO GERADOR!)
const LICENSE_SECRET = 'LP2026_S3CR3T_K3Y_L1C1T4NT3_PR1M3';

// Planos disponíveis
const LICENSE_PLANS = {
  TRIAL: { name: 'Trial', days: 7, label: '7 Dias Grátis' },
  SEMI: { name: 'Semestral', days: 180, label: '6 Meses' },
  ANUAL: { name: 'Anual', days: 365, label: '1 Ano' }
};

/**
 * Gera hash para validação de licença
 */
function generateLicenseHash(str) {
  let hash = 0;
  const combined = str + LICENSE_SECRET;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').substring(0, 8);
}

/**
 * Decodifica data de base36
 */
function decodeLicenseDate(encoded) {
  const timestamp = parseInt(encoded, 36) * 1000 * 60;
  return new Date(timestamp);
}

/**
 * Valida uma chave de licença
 * Formato: LPRIME-PLANO-DATA5-RAND4-HASH4
 * Exemplo: LPRIME-TRIAL-A1B2C-XY3Z-ABCD
 */
function validateLicenseKey(key) {
  try {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Chave inválida' };
    }

    const cleanKey = key.toUpperCase().trim();
    const parts = cleanKey.split('-');
    
    console.log('[License] Validando chave:', cleanKey);
    console.log('[License] Partes:', parts);
    
    if (parts.length !== 5 || parts[0] !== 'LPRIME') {
      return { valid: false, error: 'Formato de chave inválido' };
    }

    const [prefix, planPart, datePart, randomPart, hashPart] = parts;
    
    // Identificar o plano (aceita TRIAL, SEMI, ANUAL, SEMIX, etc.)
    let planType = null;
    if (planPart === 'TRIAL' || planPart.startsWith('TRIAL')) planType = 'TRIAL';
    else if (planPart === 'SEMI' || planPart.startsWith('SEMI')) planType = 'SEMI';
    else if (planPart === 'ANUAL' || planPart.startsWith('ANUAL')) planType = 'ANUAL';
    
    if (!planType) {
      console.log('[License] Plano não reconhecido:', planPart);
      return { valid: false, error: 'Plano não reconhecido' };
    }

    // Verificar hash (usa planType, não planPart, para compatibilidade)
    const baseString = `${planType}-${datePart}-${randomPart}`;
    const expectedHash = generateLicenseHash(baseString).substring(0, 4);
    
    console.log('[License] Base string:', baseString);
    console.log('[License] Hash esperado:', expectedHash, '| Hash recebido:', hashPart);
    
    if (hashPart !== expectedHash) {
      return { valid: false, error: 'Chave de licença inválida' };
    }

    // Decodificar data
    const creationDate = decodeLicenseDate(datePart);
    const expirationDate = new Date(creationDate.getTime() + LICENSE_PLANS[planType].days * 24 * 60 * 60 * 1000);
    const now = new Date();
    
    const isExpired = now > expirationDate;
    const daysRemaining = Math.max(0, Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24)));

    return {
      valid: true,
      expired: isExpired,
      key: cleanKey,
      plan: planType,
      planInfo: LICENSE_PLANS[planType],
      createdAt: creationDate.toISOString(),
      expiresAt: expirationDate.toISOString(),
      daysRemaining: daysRemaining
    };

  } catch (error) {
    return { valid: false, error: 'Erro ao validar: ' + error.message };
  }
}

/**
 * Verifica status da licença salva
 */
function checkLicenseStatus() {
  const license = store.get('license');
  
  if (!license || !license.key) {
    return { valid: false, activated: false, error: 'Nenhuma licença ativada' };
  }

  // Se é uma licença ativada ONLINE, confiar nos dados salvos
  // (a validação online é feita periodicamente)
  if (license.onlineValidation) {
    console.log('[License] Licença online detectada, verificando expiração...');
    
    // Apenas verificar se expirou
    const now = new Date();
    const expiresAt = license.expiresAt ? new Date(license.expiresAt) : null;
    
    if (expiresAt && now > expiresAt) {
      return { 
        valid: false, 
        activated: true, 
        expired: true,
        plan: license.plan,
        expiresAt: license.expiresAt,
        error: 'Licença expirada'
      };
    }
    
    return {
      valid: true,
      activated: true,
      expired: false,
      plan: license.plan,
      expiresAt: license.expiresAt,
      onlineValidation: true
    };
  }

  // Para licenças LOCAIS, usar validação por hash
  const validation = validateLicenseKey(license.key);
  
  if (!validation.valid) {
    return { valid: false, activated: true, error: validation.error };
  }

  if (validation.expired) {
    return { 
      valid: false, 
      activated: true, 
      expired: true,
      plan: validation.plan,
      expiresAt: validation.expiresAt,
      error: 'Licença expirada'
    };
  }

  return {
    valid: true,
    activated: true,
    expired: false,
    ...validation
  };
}

// Licença - IPC Handlers
ipcMain.handle('license:get', () => {
  console.log('[Store] Buscando licença...');
  console.log('[Store] Caminho do arquivo:', store.path);
  
  const license = store.get('license');
  console.log('[Store] Licença encontrada:', license ? JSON.stringify({
    key: license.key,
    valid: license.valid,
    onlineValidation: license.onlineValidation,
    expiresAt: license.expiresAt
  }) : 'NENHUMA');
  
  if (license && license.key) {
    // Re-validar para atualizar status de expiração
    const status = checkLicenseStatus();
    console.log('[Store] Status da licença:', JSON.stringify(status));
    return { ...license, ...status };
  }
  return null;
});

ipcMain.handle('license:set', (event, license) => {
  console.log('[Store] ========== SALVANDO LICENÇA ==========');
  console.log('[Store] Caminho do arquivo:', store.path);
  console.log('[Store] Dados a salvar:', JSON.stringify(license, null, 2));
  
  store.set('license', license);
  
  // Verificar se salvou corretamente
  const saved = store.get('license');
  console.log('[Store] Licença salva verificada:', saved ? 'OK' : 'FALHOU!');
  console.log('[Store] Key salva:', saved?.key);
  console.log('[Store] ========================================');
  
  return { success: true };
});

ipcMain.handle('license:clear', () => {
  console.log('[Store] ========== LIMPANDO LICENÇA ==========');
  store.delete('license');
  console.log('[Store] Licença removida do store');
  console.log('[Store] ========================================');
  return { success: true };
});

ipcMain.handle('license:validate', (event, key) => {
  const validation = validateLicenseKey(key);
  
  if (!validation.valid) {
    return validation;
  }

  if (validation.expired) {
    return { valid: false, error: 'Esta chave já expirou' };
  }

  // Salvar licença válida
  const license = {
    key: validation.key,
    valid: true,
    expired: false,
    type: validation.plan,
    plan: validation.plan,
    planInfo: validation.planInfo,
    expiresAt: validation.expiresAt,
    activatedAt: new Date().toISOString(),
    daysRemaining: validation.daysRemaining
  };
  
  store.set('license', license);
  return license;
});

ipcMain.handle('license:check', () => {
  return checkLicenseStatus();
});

// ==================== LICENÇA ONLINE ====================

/**
 * Ativa licença no servidor online
 */
ipcMain.handle('license:activateOnline', async (event, licenseKey) => {
  try {
    console.log('[License] ========== ATIVAÇÃO ONLINE ==========');
    console.log('[License] Chave:', licenseKey);
    console.log('[Store] Caminho do arquivo:', store.path);
    
    // Mostrar o Hardware ID que será usado
    const hwId = onlineLicense.getHardwareId();
    console.log('[License] Hardware ID atual:', hwId.substring(0, 32) + '...');
    
    const result = await onlineLicense.activateLicense(licenseKey);
    console.log('[License] Resultado do servidor:', JSON.stringify(result, null, 2));
    
    if (result.valid && result.success) {
      // Salvar licença com info online
      const license = {
        key: licenseKey,
        valid: true,
        expired: false,
        type: result.license.plan,
        plan: result.license.plan,
        expiresAt: result.license.expiresAt,
        activatedAt: new Date().toISOString(),
        hardwareId: result.license.hardwareId,
        onlineValidation: true,
        lastOnlineCheck: new Date().toISOString()
      };
      
      console.log('[Store] Salvando licença:', JSON.stringify(license, null, 2));
      store.set('license', license);
      
      // Verificar se salvou corretamente
      const savedLicense = store.get('license');
      console.log('[Store] Verificação após salvar:', savedLicense ? 'OK' : 'FALHOU!');
      if (savedLicense) {
        console.log('[Store] Key salva:', savedLicense.key);
        console.log('[Store] Valid:', savedLicense.valid);
      }
      console.log('[License] ========================================');
      
      // Iniciar verificação periódica
      startLicenseCheckInterval();
      
      return { success: true, license };
    }
    
    console.log('[License] ========================================');
    return result;
  } catch (error) {
    console.error('[License] Erro na ativação online:', error);
    console.log('[License] ========================================');
    return { valid: false, error: error.message };
  }
});

/**
 * Valida licença online (verificação periódica)
 */
ipcMain.handle('license:validateOnline', async () => {
  const license = store.get('license');
  if (!license || !license.key) {
    return { valid: false, error: 'Nenhuma licença ativada' };
  }
  
  try {
    const result = await onlineLicense.validateLicenseOnline(license.key);
    
    if (result.valid) {
      // Servidor confirmou que a licença está ativa
      license.lastOnlineCheck = new Date().toISOString();
      license.valid = true;
      license.expired = false;
      if (result.license) {
        license.expiresAt = result.license.expiresAt;
        license.plan = result.license.plan || license.plan;
      }
      store.set('license', license);
      console.log('[License] ✅ Licença válida no servidor. Expira em:', license.expiresAt);
    } else if (!result.offline) {
      console.log('[License] ⚠️ Licença bloqueada no servidor:', result.error);
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('license:blocked', {
          error: result.error,
          code: result.code
        });
      }
      
      new Notification({
        title: '⚠️ Licença Bloqueada',
        body: result.error || 'Sua licença foi bloqueada. Entre em contato com o suporte.',
        urgency: 'critical'
      }).show();
    }
    
    return result;
  } catch (error) {
    console.error('[License] Erro na validação online:', error);
    return { valid: true, offline: true, error: error.message };
  }
});

/**
 * Inicia verificação periódica da licença
 */
function startLicenseCheckInterval() {
  // Limpar intervalo existente
  if (licenseCheckInterval) {
    clearInterval(licenseCheckInterval);
  }
  
  console.log('[License] Iniciando verificação periódica (a cada 1 hora)');
  
  licenseCheckInterval = setInterval(async () => {
    const license = store.get('license');
    if (!license || !license.key || !license.onlineValidation) return;
    
    console.log('[License] Verificando licença online...');
    
    try {
      const result = await onlineLicense.validateLicenseOnline(license.key);
      
      if (!result.valid && !result.offline) {
        console.log('[License] ⚠️ Licença inválida/bloqueada:', result.error);
        
        // Notificar frontend
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('license:blocked', {
            error: result.error,
            code: result.code
          });
        }
        
        // Parar todos os monitoramentos
        stopAllMonitoring();
      } else {
        console.log('[License] ✅ Licença válida');
        license.lastOnlineCheck = new Date().toISOString();
        store.set('license', license);
      }
    } catch (error) {
      console.log('[License] Erro na verificação (modo offline):', error.message);
    }
  }, LICENSE_CHECK_INTERVAL);
}

/**
 * Obtém o Hardware ID da máquina
 */
ipcMain.handle('license:getHardwareId', () => {
  return onlineLicense.getHardwareId();
});

// Pregões
ipcMain.handle('pregoes:get', () => store.get('pregoes') || []);
ipcMain.handle('pregoes:add', (event, pregao) => {
  const pregoes = store.get('pregoes') || [];
  pregoes.push({
    ...pregao,
    id: pregao.id || require('uuid').v4(),
    monitoring: false,
    createdAt: new Date().toISOString()
  });
  store.set('pregoes', pregoes);
  return { success: true, pregoes };
});
ipcMain.handle('pregoes:remove', (event, pregaoId) => {
  stopMonitoring(pregaoId);
  
  // Remover pregão da lista
  const pregoes = store.get('pregoes') || [];
  const filtered = pregoes.filter(p => p.id !== pregaoId);
  store.set('pregoes', filtered);
  
  // Limpar mensagens salvas desse pregão
  const savedMessages = store.get('savedMessages') || {};
  delete savedMessages[pregaoId];
  store.set('savedMessages', savedMessages);
  
  // Limpar IDs de deduplicação
  const lastMessages = store.get('lastMessages') || {};
  delete lastMessages[pregaoId];
  store.set('lastMessages', lastMessages);
  
  console.log(`[Pregao] Removido pregão ${pregaoId} e suas mensagens salvas`);
  
  return { success: true, pregoes: filtered };
});

// Palavras-chave
ipcMain.handle('keywords:get', () => store.get('keywords') || []);
ipcMain.handle('keywords:set', (event, keywords) => {
  store.set('keywords', keywords);
  return { success: true };
});

// Monitoramento
ipcMain.handle('monitoring:start', (event, pregaoId) => {
  return startMonitoring(pregaoId);
});
ipcMain.handle('monitoring:stop', (event, pregaoId) => {
  return stopMonitoring(pregaoId);
});

// Configurações
ipcMain.handle('config:getInterval', () => store.get('monitoringInterval') || 10);
ipcMain.handle('config:setInterval', (event, interval) => {
  store.set('monitoringInterval', interval);
  return { success: true };
});
ipcMain.handle('config:getSoundEnabled', () => store.get('soundEnabled'));
ipcMain.handle('config:setSoundEnabled', (event, enabled) => {
  store.set('soundEnabled', enabled);
  return { success: true };
});

// ==================== TELEGRAM ====================
ipcMain.handle('telegram:getConfig', () => {
  return store.get('telegram') || { enabled: false, chatId: '' };
});

ipcMain.handle('telegram:setConfig', (event, config) => {
  store.set('telegram', config);
  console.log('[Telegram] Configuração salva:', config);
  return { success: true };
});

ipcMain.handle('telegram:test', async (event, chatId) => {
  try {
    console.log('[Telegram] Testando notificação para chat:', chatId);
    const result = await telegramNotifier.sendTestMessage(chatId);
    return result;
  } catch (error) {
    console.error('[Telegram] Erro no teste:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('telegram:getBotInfo', async () => {
  try {
    const info = await telegramNotifier.getBotInfo();
    return info;
  } catch (error) {
    return { 
      success: true, 
      bot: { 
        link: telegramNotifier.BOT_LINK,
        username: telegramNotifier.BOT_USERNAME
      } 
    };
  }
});

// Mensagens - PERSISTÊNCIA
ipcMain.handle('messages:getSaved', (event, pregaoId) => {
  const savedMessages = store.get('savedMessages') || {};
  return savedMessages[pregaoId] || [];
});

ipcMain.handle('messages:getAllSaved', () => {
  return store.get('savedMessages') || {};
});

ipcMain.handle('messages:getHistory', (event, pregaoId) => {
  // Retornar mensagens salvas
  const savedMessages = store.get('savedMessages') || {};
  return savedMessages[pregaoId] || [];
});

ipcMain.handle('messages:clearCache', (event, pregaoId) => {
  // Limpar IDs de deduplicação
  const lastMessages = store.get('lastMessages') || {};
  delete lastMessages[pregaoId];
  store.set('lastMessages', lastMessages);
  
  // Limpar mensagens salvas desse pregão
  const savedMessages = store.get('savedMessages') || {};
  delete savedMessages[pregaoId];
  store.set('savedMessages', savedMessages);
  
  return { success: true };
});

ipcMain.handle('messages:clearAll', () => {
  store.set('lastMessages', {});
  store.set('savedMessages', {});
  return { success: true };
});

// Shell
ipcMain.handle('shell:openExternal', (event, url) => {
  shell.openExternal(url);
  return { success: true };
});

// ==================== SYSTEM TRAY ====================

function createTray() {
  // Usar ícone do app
  const iconPath = path.join(__dirname, 'public', 'icon.ico');
  
  try {
    tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir Licitante Prime',
        click: () => {
          if (mainWindow) {
            if (!mainWindow.isVisible()) mainWindow.show();
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setToolTip('Licitante Prime - Monitoramento');
    tray.setContextMenu(contextMenu);
    
    // Duplo clique no ícone abre a janela
    tray.on('double-click', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
    
    console.log('[Tray] Ícone da bandeja criado com sucesso');
  } catch (err) {
    console.error('[Tray] Erro ao criar ícone da bandeja:', err.message);
  }
}

// ==================== APP LIFECYCLE ====================

// Prevenir múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Outra instância já está rodando. Fechando...');
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      // Se a janela está oculta, mostrar primeiro
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      // Se está minimizada, restaurar
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      // Focar a janela
      mainWindow.focus();
    } else {
      // Se por algum motivo a janela não existe, criar uma nova
      createMainWindow();
    }
  });

  app.whenReady().then(() => {
    console.log('App pronto. Criando janela principal...');
    createMainWindow();
    createTray();
    
    // Verificar se tem licença online e iniciar verificação periódica
    const license = store.get('license');
    if (license && license.onlineValidation) {
      console.log('[License] Licença online detectada, iniciando verificação periódica');
      startLicenseCheckInterval();
      
      // Fazer verificação imediata após 10 segundos
      setTimeout(async () => {
        try {
          const result = await onlineLicense.validateLicenseOnline(license.key);
          if (!result.valid && !result.offline) {
            console.log('[License] ⚠️ Licença bloqueada:', result.error);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('license:blocked', {
                error: result.error,
                code: result.code
              });
            }
          }
        } catch (e) {
          console.log('[License] Verificação inicial falhou (modo offline)');
        }
      }, 10000);
    }
    
    // ==================== AUTO-START MONITORAMENTO ====================
    // Retomar automaticamente o monitoramento de pregões que estavam ativos
    autoStartActiveMonitoring();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 || !mainWindow) {
        createMainWindow();
      } else {
        // Mostrar janela se estiver oculta
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopAllMonitoring();
  });
}
