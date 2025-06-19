// src/config/database.js

// Usando a biblioteca 'pg' para conectar com o PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexões é mais eficiente que uma conexão única
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Exportamos uma função 'query' que poderemos usar em todo o projeto
module.exports = {
  query: (text, params) => pool.query(text, params),
};