// src/routes/searchRoutes.js (Novo Ficheiro)

const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');

// A busca é uma rota pública, não precisa de autenticação para ser usada
// A rota será GET /api/search?q=...
router.get('/', searchController.search);

module.exports = router;