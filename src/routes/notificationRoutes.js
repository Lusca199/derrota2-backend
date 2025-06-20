// Ficheiro: Testes/derrota2-backend/src/routes/notificationRoutes.js
// Versão com a rota de contagem otimizada

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

// Como todas as rotas de notificação exigem que o usuário esteja logado,
// podemos aplicar o middleware a todas as rotas de uma vez.
router.use(authMiddleware);


// --- IMPORTANTE: A rota mais específica deve vir primeiro ---

/**
 * @route   GET /api/notificacoes/unread-count
 * @desc    Busca APENAS a contagem de notificações não lidas
 * @access  Privado
 */
router.get('/unread-count', notificationController.getUnreadCount);


/**
 * @route   GET /api/notificacoes
 * @desc    Busca todas as notificações para o usuário logado
 * @access  Privado
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   PATCH /api/notificacoes/:notificationId/read
 * @desc    Marca uma notificação específica como lida
 * @access  Privado
 */
router.patch('/:notificationId/read', notificationController.markAsRead);


module.exports = router;