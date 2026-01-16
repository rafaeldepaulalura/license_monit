# 🚀 Deploy no Easypanel - Licitante Prime License Server

## Pré-requisitos

- VPS com Easypanel instalado
- Acesso ao painel do Easypanel

---

## 📦 Passo 1: Criar Banco de Dados PostgreSQL

1. No Easypanel, vá em **"Create"** → **"Database"**
2. Escolha **PostgreSQL**
3. Configure:
   - **Name:** `licitante-licenses-db`
   - **Username:** `licitante`
   - **Password:** (anote a senha gerada ou defina uma)
   - **Database:** `licenses`
4. Clique em **"Create"**
5. Anote a **Connection String** (algo como: `postgresql://licitante:SENHA@licitante-licenses-db:5432/licenses`)

---

## 🔧 Passo 2: Deploy da API (Backend)

1. No Easypanel, vá em **"Create"** → **"App"**
2. Escolha **"GitHub"** ou **"Docker"**

### Opção A: Via GitHub
1. Conecte seu repositório
2. Configure:
   - **Root Directory:** `license-server`
   - **Build Command:** `npm ci --only=production`
   - **Start Command:** `npm start`

### Opção B: Via Docker (Recomendado)
1. Escolha **"Docker"**
2. No seu repositório, faça push da pasta `license-server`
3. O Easypanel vai usar o `Dockerfile` automaticamente

### Variáveis de Ambiente (OBRIGATÓRIO)
No Easypanel, adicione estas variáveis:

```
PORT=3001
NODE_ENV=production
DATABASE_URL=postgresql://licitante:SENHA@licitante-licenses-db:5432/licenses
JWT_SECRET=sua-chave-jwt-super-secreta-aqui-123456
LICENSE_SECRET=sua-chave-licenca-super-secreta-aqui-789
APP_API_KEY=licitante-prime-app-key-2024
CORS_ORIGINS=https://admin.SEUDOMINIO.easypanel.host,http://localhost:3000
```

⚠️ **IMPORTANTE:** Altere os valores de `JWT_SECRET`, `LICENSE_SECRET` e `APP_API_KEY` para valores únicos e seguros!

### Configurações Finais
- **Port:** 3001
- **Domain:** Anote o domínio gerado (ex: `api.licitante.easypanel.host`)

---

## 🗄️ Passo 3: Executar Migrações

Após o deploy, você precisa criar as tabelas no banco de dados.

### Via Terminal do Easypanel:
1. Clique no app da API
2. Vá em **"Terminal"**
3. Execute:

```bash
npm run migrate
npm run seed
```

Isso irá:
- Criar todas as tabelas necessárias
- Criar o usuário admin padrão

### Credenciais Iniciais:
```
Usuário: admin
Senha: admin123
```

⚠️ **MUDE A SENHA APÓS O PRIMEIRO LOGIN!**

---

## 🎨 Passo 4: Deploy do Painel Admin (Frontend)

1. No Easypanel, vá em **"Create"** → **"App"**
2. Escolha **"Docker"**
3. Configure o repositório com a pasta `license-admin`

### Variáveis de Ambiente:
```
REACT_APP_API_URL=https://api.SEUDOMINIO.easypanel.host
```

### Build Args (no Dockerfile):
```
REACT_APP_API_URL=https://api.SEUDOMINIO.easypanel.host
```

### Configurações:
- **Port:** 80
- **Domain:** Anote o domínio (ex: `admin.licitante.easypanel.host`)

---

## ✅ Passo 5: Testar

1. Acesse o painel admin: `https://admin.SEUDOMINIO.easypanel.host`
2. Faça login com `admin` / `admin123`
3. Crie uma licença de teste
4. Configure o Licitante Prime com a nova licença

---

## 🔐 Passo 6: Configurar o Licitante Prime

No arquivo `C:\LicitantePrime\src\services\onlineLicense.js`, atualize:

```javascript
const LICENSE_API_URL = 'https://api.SEUDOMINIO.easypanel.host';
const APP_API_KEY = 'licitante-prime-app-key-2024'; // Mesmo valor do servidor
```

---

## 📝 Resumo das URLs

| Serviço | URL |
|---------|-----|
| API de Licenças | `https://api.SEUDOMINIO.easypanel.host` |
| Painel Admin | `https://admin.SEUDOMINIO.easypanel.host` |
| Health Check | `https://api.SEUDOMINIO.easypanel.host/health` |

---

## 🔄 Endpoints da API

### Para o App Desktop:
```
POST /api/licenses/activate   - Ativar licença
POST /api/licenses/validate   - Validar licença
POST /api/licenses/check      - Verificar status
```

### Para o Painel Admin:
```
POST /api/admin/login              - Login
GET  /api/admin/stats              - Dashboard
GET  /api/admin/licenses           - Listar licenças
POST /api/admin/licenses           - Criar licença
POST /api/admin/licenses/:id/block - Bloquear
POST /api/admin/licenses/:id/unblock - Desbloquear
```

---

## 🆘 Problemas Comuns

### Erro de CORS
Verifique se `CORS_ORIGINS` inclui o domínio do painel admin.

### Erro de Conexão com Banco
Verifique se o `DATABASE_URL` está correto e se o serviço PostgreSQL está rodando.

### Erro 401 na API
Verifique se o `APP_API_KEY` está correto no app e no servidor.

---

## 📞 Suporte

Em caso de dúvidas, entre em contato: contato@licitanteprime.com.br
