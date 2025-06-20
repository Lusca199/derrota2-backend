// Ficheiro: Testes/derrota2-backend/src/routes/publicationRoutes.js
// Adicionada a nova rota para buscar publicações de um usuário

const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/media/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: mediaStorage });

// --- ROTAS CRUD PARA PUBLICAÇÕES ---

// GET /api/publicacoes/ -> Ler todas as publicações (feed)
router.get('/', optionalAuthMiddleware, publicationController.getAllPublications);

// --- NOVA ROTA ADICIONADA AQUI ---
// GET /api/publicacoes/user/:userId -> Ler todas as publicações de um usuário específico
router.get('/user/:userId', optionalAuthMiddleware, publicationController.getPublicationsByUser);

// GET /api/publicacoes/:id -> Ler uma única publicação
router.get('/:id', authMiddleware, publicationController.getPublicationById);

// POST /api/publicacoes/ -> Criar publicação
router.post(
    '/',
    authMiddleware,
    upload.single('publicationMedia'),
    publicationController.createPublication
);

// PUT /api/publicacoes/:id -> Atualizar publicação
router.put('/:id', authMiddleware, publicationController.updatePublication);

// DELETE /api/publicacoes/:id -> Apagar publicação
router.delete('/:id', authMiddleware, publicationController.deletePublication);


module.exports = router;