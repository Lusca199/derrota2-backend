// src/routes/reactionRoutes.js (Novo Arquivo)

const express = require('express');
const router = express.Router();
const reactionController = require('../controllers/reactionController');
const authMiddleware = require('../middleware/authMiddleware');

// Rota para curtir uma publicação (protegida)
// Ex: POST http://localhost:3001/api/reacoes/123/like
router.post('/:publicationId/like', authMiddleware, reactionController.likePublication);

// Rota para descurtir uma publicação (protegida)
// Ex: DELETE http://localhost:3001/api/reacoes/123/like
router.delete('/:publicationId/like', authMiddleware, reactionController.unlikePublication);

module.exports = router;