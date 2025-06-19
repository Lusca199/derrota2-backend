// src/routes/publicationRoutes.js (versão com upload de mídia)

const express = require('express');
const router = express.Router();
const publicationController = require('../controllers/publicationController');
const authMiddleware = require('../middleware/authMiddleware');

// --- 1. IMPORTAR MULTER E PATH ---
const multer = require('multer');
const path = require('path');

// --- 2. CONFIGURAR O ARMAZENAMENTO PARA MÍDIAS DE PUBLICAÇÃO ---
// É uma boa prática guardar mídias de publicação numa pasta separada das fotos de perfil.
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/media/'); // Nova pasta para mídias
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'post-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: mediaStorage });

// --- ROTAS CRUD PARA PUBLICAÇÕES ---

// Read (Ler todas as publicações) - Rota Pública
router.get('/', publicationController.getAllPublications);

// Read (Ler uma única publicação)
router.get('/:id', authMiddleware, publicationController.getPublicationById);

// Create (Criar publicação) - Rota Protegida com Middleware de Upload
// --- 3. ADICIONAR O MIDDLEWARE DE UPLOAD AQUI ---
router.post(
    '/', 
    authMiddleware, 
    upload.single('publicationMedia'), // O nome 'publicationMedia' é importante!
    publicationController.createPublication
);

// Update (Atualizar publicação) - Rota Protegida
router.put('/:id', authMiddleware, publicationController.updatePublication);

// Delete (Apagar publicação) - Rota Protegida
router.delete('/:id', authMiddleware, publicationController.deletePublication);


module.exports = router;