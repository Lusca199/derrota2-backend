// src/config/database.js (versão correta)
const { Pool } = require('pg');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
module.exports = {
  query: (text, params) => pool.query(text, params),
};