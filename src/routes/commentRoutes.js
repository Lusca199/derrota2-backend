// src/routes/commentRoutes.js

const express = require('express');
const router = express.Router();
const commentController = require('../controllers/commentController');
const authMiddleware = require('../middleware/authMiddleware');

// Rota para buscar todos os comentários de uma publicação (pública)
// Exemplo de uso: GET http://localhost:3001/api/comentarios/123
router.get('/:publicationId', commentController.getCommentsForPublication);

// Rota para criar um novo comentário em uma publicação (protegida por autenticação)
// Exemplo de uso: POST http://localhost:3001/api/comentarios/123
router.post('/:publicationId', authMiddleware, commentController.createComment);

module.exports = router;