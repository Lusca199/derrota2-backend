// Ficheiro: Testes/derrota2-backend/src/server.js
// Versão final com as rotas de notificação integradas

// 1. GARANTIR QUE ESTA É A PRIMEIRA LINHA DO FICHEIRO
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path'); 

// Importação das nossas rotas
const userRoutes = require('./routes/userRoutes.js');
const publicationRoutes = require('./routes/publicationRoutes.js');
const relationshipRoutes = require('./routes/relationshipRoutes.js');
const reactionRoutes = require('./routes/reactionRoutes.js');
const commentRoutes = require('./routes/commentRoutes.js');
const searchRoutes = require('./routes/searchRoutes.js');
// --- NOVA IMPORTAÇÃO AQUI ---
const notificationRoutes = require('./routes/notificationRoutes.js');

const app = express();
// A porta será lida do .env graças à configuração na linha 1
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, '../public')));

// Rota principal
app.get('/api', (req, res) => {
  res.json({ message: 'Bem-vindo à API do AppX!' });
});

// Usar as rotas
app.use('/api/usuarios', userRoutes);
app.use('/api/publicacoes', publicationRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/reacoes', reactionRoutes);
app.use('/api/comentarios', commentRoutes);
app.use('/api/search', searchRoutes);
// --- NOVO USO DE ROTA AQUI ---
app.use('/api/notificacoes', notificationRoutes);


// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});