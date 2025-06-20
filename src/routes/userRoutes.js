// Ficheiro: Testes/derrota2-backend/src/routes/userRoutes.js
// Versão FINAL com autenticação opcional na rota de perfil

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
// 1. IMPORTAR O MIDDLEWARE OPCIONAL
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- ROTAS DE AUTENTICAÇÃO E ACESSO ---
router.post('/cadastro', userController.registerUser);
router.post('/login', userController.loginUser);

// --- ROTAS PARA RECUPERAÇÃO DE SENHA ---
router.post('/esqueci-senha', userController.requestPasswordReset);
router.post('/resetar-senha', userController.resetPassword);

// --- ROTAS DE PERFIL (PROTEGIDAS) ---
router.put('/perfil', authMiddleware, userController.updateUserProfile);
router.put(
    '/perfil/foto',
    authMiddleware,
    upload.single('profilePic'),
    userController.updateUserProfilePicture
);

// --- ROTA PÚBLICA (COM AUTENTICAÇÃO OPCIONAL) PARA VER PERFIL ---
// 2. ADICIONAR O MIDDLEWARE AQUI
router.get('/:userId', optionalAuthMiddleware, userController.getUserProfile);


module.exports = router;