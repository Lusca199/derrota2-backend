// src/server.js (versão final com rota de busca)

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
const searchRoutes = require('./routes/searchRoutes.js'); // <-- 1. IMPORTAR A NOVA ROTA

const app = express();
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
app.use('/api/search', searchRoutes); // <-- 2. USAR A NOVA ROTA

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});