// src/controllers/userController.js (versão com recuperação de senha)

const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Módulo para gerar tokens seguros

// ... (as funções registerUser, loginUser, getUserProfile, updateUserProfilePicture, updateUserProfile continuam as mesmas)
// Lógica para o cadastro de um novo usuário
exports.registerUser = async (req, res) => {
  const { nome, email, senha, telefone, data_nasc, biografia } = req.body;
  try {
    const userExists = await db.query('SELECT email FROM usuario WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Este e-mail já está em uso.' });
    }
    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);
    const newUser = await db.query(
      'INSERT INTO usuario (nome, email, senha_hash, telefone, data_nasc, biografia) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_usuario, nome, email',
      [nome, email, senha_hash, telefone, data_nasc, biografia]
    );
    await db.query(
        'INSERT INTO configuracao_usuario (id_usuario) VALUES ($1)',
        [newUser.rows[0].id_usuario]
    );
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para o login do usuário
exports.loginUser = async (req, res) => {
  const { email, senha } = req.body;
  try {
    const userResult = await db.query('SELECT * FROM usuario WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(senha, user.senha_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const token = jwt.sign(
        { id: user.id_usuario, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );
    res.status(200).json({ message: 'Login bem-sucedido!', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para buscar o perfil de um único usuário (versão atualizada com contagens)
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await db.query(
      `SELECT id_usuario, nome, email, biografia, localizacao, foto_perfil_url, criado_em,
        (SELECT COUNT(*) FROM relacao_usuario WHERE seguido_id = $1) AS followers_count,
        (SELECT COUNT(*) FROM relacao_usuario WHERE seguidor_id = $1) AS following_count
       FROM usuario WHERE id_usuario = $1`, [userId] );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para atualizar a foto de perfil do usuário
exports.updateUserProfilePicture = async (req, res) => {
  const userId = req.user.id;
  if (!req.file) { return res.status(400).json({ error: 'Nenhum ficheiro foi enviado.' }); }
  const foto_perfil_url = `/public/uploads/${req.file.filename}`;
  try {
    const result = await db.query( 'UPDATE usuario SET foto_perfil_url = $1 WHERE id_usuario = $2 RETURNING foto_perfil_url', [foto_perfil_url, userId] );
    if (result.rows.length === 0) { return res.status(404).json({ error: 'Usuário não encontrado.' }); }
    res.status(200).json({ foto_perfil_url: result.rows[0].foto_perfil_url });
  } catch (error) {
    console.error("Erro ao atualizar foto de perfil:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para um usuário ATUALIZAR os seus próprios dados de perfil
exports.updateUserProfile = async (req, res) => {
  const userId = req.user.id;
  const { nome, biografia, localizacao } = req.body;
  if (nome !== undefined && !nome.trim()) { return res.status(400).json({ error: 'O nome não pode ficar em branco.' });}
  try {
    const currentUserResult = await db.query('SELECT nome, biografia, localizacao FROM usuario WHERE id_usuario = $1', [userId]);
    if (currentUserResult.rows.length === 0) { return res.status(404).json({ error: 'Usuário não encontrado.' }); }
    const currentUserData = currentUserResult.rows[0];
    const newNome = nome || currentUserData.nome;
    const newBiografia = biografia !== undefined ? biografia : currentUserData.biografia;
    const newLocalizacao = localizacao !== undefined ? localizacao : currentUserData.localizacao;
    const result = await db.query( `UPDATE usuario SET nome = $1, biografia = $2, localizacao = $3 WHERE id_usuario = $4 RETURNING id_usuario, nome, email, biografia, localizacao, foto_perfil_url, criado_em`, [newNome, newBiografia, newLocalizacao, userId] );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao atualizar perfil do usuário:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// ----- ADICIONE AS NOVAS FUNÇÕES A PARTIR DAQUI -----

/**
 * Lógica para solicitar uma redefinição de senha.
 * Passo 1 do fluxo de recuperação.
 */
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await db.query('SELECT id_usuario FROM usuario WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // **IMPORTANTE**: Não informamos ao front-end que o email não foi encontrado.
            // Isso é uma medida de segurança para evitar que maus atores descubram quais emails estão cadastrados.
            // Apenas retornamos uma mensagem genérica de sucesso.
            return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição será enviado.' });
        }
        const userId = userResult.rows[0].id_usuario;

        // Gera um token aleatório e seguro
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // Define um tempo de expiração para o token (e.g., 1 hora)
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);

        // Salva o token na nova tabela, associado ao usuário
        await db.query(
            'INSERT INTO redefinicao_senha (usuario_id, token, expira_em) VALUES ($1, $2, $3)',
            [userId, resetToken, expiration]
        );

        // --- SIMULAÇÃO DE ENVIO DE E-MAIL ---
        // Num projeto real, aqui você usaria um serviço como Nodemailer, SendGrid, etc.
        // para enviar um e-mail para o usuário.
        console.log('--- SIMULAÇÃO DE E-MAIL ---');
        console.log(`Token de redefinição para ${email}: ${resetToken}`);
        console.log(`Link para o front-end: http://localhost:5175/resetar-senha?token=${resetToken}`);
        console.log('---------------------------');

        res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição será enviado.' });

    } catch (error) {
        console.error("Erro ao solicitar redefinição de senha:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

/**
 * Lógica para efetivamente redefinir a senha.
 * Passo 2 do fluxo de recuperação.
 */
exports.resetPassword = async (req, res) => {
    const { token, senha } = req.body;
    if (!token || !senha) {
        return res.status(400).json({ error: 'O token e a nova senha são obrigatórios.' });
    }

    try {
        // Busca o token no banco de dados, garantindo que ele não expirou
        const result = await db.query(
            'SELECT * FROM redefinicao_senha WHERE token = $1 AND expira_em > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Token inválido ou expirado.' });
        }

        const { usuario_id } = result.rows[0];

        // Criptografa a nova senha
        const salt = await bcrypt.genSalt(10);
        const senha_hash = await bcrypt.hash(senha, salt);

        // Atualiza a senha do usuário na tabela `usuario`
        await db.query('UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2', [senha_hash, usuario_id]);

        // Remove o token da tabela para que não possa ser reutilizado
        await db.query('DELETE FROM redefinicao_senha WHERE token = $1', [token]);
        
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};