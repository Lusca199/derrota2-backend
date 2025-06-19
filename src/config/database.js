// src/config/database.js (versão final, pronta para produção)

const { Pool } = require('pg');

// Em ambientes de produção (como o Render), as variáveis de ambiente são injetadas diretamente no processo.
// A linha 'require('dotenv').config()' só é necessária para o desenvolvimento local, para carregar o ficheiro .env.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// O Render e outros serviços de alojamento fornecem uma "Connection String".
// Ela contém todas as informações (usuário, senha, host, porta, etc.) numa única string.
// Esta é a forma mais robusta e recomendada de se conectar em produção.
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  // Em produção (Render), é necessário usar SSL para uma conexão segura com o banco de dados.
  // Em desenvolvimento local, geralmente não é necessário.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};