// Ficheiro: Testes/derrota2-backend/src/routes/relationshipRoutes.js
// Adicionada a rota DELETE para desbloquear

const express = require('express');
const router = express.Router();
const relationshipController = require('../controllers/relationshipController');
const authMiddleware = require('../middleware/authMiddleware.js');

// --- ROTAS PÚBLICAS ---
router.get('/:userId/followers', relationshipController.getFollowers);
router.get('/:userId/following', relationshipController.getFollowing);

// --- ROTAS PROTEGIDAS ---
router.post('/follow/:userId', authMiddleware, relationshipController.followUser);
router.delete('/follow/:userId', authMiddleware, relationshipController.unfollowUser);
router.get('/status/:targetUserId', authMiddleware, relationshipController.getRelationshipStatus);

// --- ROTAS DE BLOQUEIO ---
router.post('/block/:userId', authMiddleware, relationshipController.blockUser);
// --- NOVA ROTA ADICIONADA AQUI ---
router.delete('/block/:userId', authMiddleware, relationshipController.unblockUser);

module.exports = router;