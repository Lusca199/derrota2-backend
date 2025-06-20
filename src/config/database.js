// Ficheiro: Testes/derrota2-backend/src/config/database.js
// Versão simplificada, sem carregar o .env

const { Pool } = require('pg');

// A chamada ao require('dotenv').config() foi REMOVIDA daqui,
// pois agora ela vive no server.js, que é o ponto de entrada da aplicação.

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};