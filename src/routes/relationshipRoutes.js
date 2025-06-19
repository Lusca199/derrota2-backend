// src/routes/relationshipRoutes.js (versão atualizada)

const express = require('express');
const router = express.Router();
const relationshipController = require('../controllers/relationshipController');
const authMiddleware = require('../middleware/authMiddleware.js');

// --- ROTAS PÚBLICAS (não precisam de login para serem acedidas) ---
// Rota para LER os seguidores de um usuário
router.get('/:userId/followers', relationshipController.getFollowers);

// Rota para LER quem um usuário segue
router.get('/:userId/following', relationshipController.getFollowing);


// --- ROTAS PROTEGIDAS (precisam de login) ---
// Rota para SEGUIR um usuário.
router.post('/follow/:userId', authMiddleware, relationshipController.followUser);

// Rota para DEIXAR DE SEGUIR um usuário.
router.delete('/follow/:userId', authMiddleware, relationshipController.unfollowUser);
router.post('/block/:userId', authMiddleware, relationshipController.blockUser);
router.get('/status/:targetUserId', authMiddleware, relationshipController.getRelationshipStatus);


module.exports = router;