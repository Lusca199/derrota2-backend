// src/routes/userRoutes.js (versão com rotas de recuperação de senha)

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// --- ROTAS DE AUTENTICAÇÃO E ACESSO ---
router.post('/cadastro', userController.registerUser);
router.post('/login', userController.loginUser);

// --- NOVAS ROTAS PARA RECUPERAÇÃO DE SENHA ---
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

// --- ROTA PÚBLICA PARA VER PERFIL ---
router.get('/:userId', userController.getUserProfile);


module.exports = router;