// Ficheiro: Testes/derrota2-backend/src/controllers/userController.js
// Versão final com verificação de bloqueio no perfil

const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// As outras funções (registerUser, loginUser, etc.) permanecem inalteradas
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


// Ficheiro: Testes/derrota2-backend/src/controllers/userController.js
// Substitua APENAS a função getUserProfile

// Lógica para buscar o perfil de um único usuário (VERSÃO FINAL E CORRIGIDA)
exports.getUserProfile = async (req, res) => {
  // ID do usuário logado (pode ser nulo)
  const requesterId = req.user ? req.user.id : null;
  // ID do perfil que está a ser visitado
  const { userId: profileId } = req.params;

  try {
    const result = await db.query(
      `SELECT
         u.id_usuario, u.nome, u.email, u.biografia, u.localizacao, u.foto_perfil_url, u.criado_em,
         -- Subquery para contar seguidores
         (SELECT COUNT(*) FROM relacao_usuario WHERE seguido_id = u.id_usuario AND bloqueado = FALSE) AS followers_count,
         -- Subquery para contar quantos ele segue
         (SELECT COUNT(*) FROM relacao_usuario WHERE seguidor_id = u.id_usuario AND bloqueado = FALSE) AS following_count,
         -- Subquery para verificar se existe um bloqueio entre o requisitante e o perfil
         EXISTS (
             SELECT 1 FROM relacao_usuario r
             WHERE r.bloqueado = TRUE AND (
                 (r.seguidor_id = $2 AND r.seguido_id = $1) OR
                 (r.seguidor_id = $1 AND r.seguido_id = $2)
             )
         ) AS is_blocked_by_me
       FROM usuario u
       WHERE u.id_usuario = $1`,
      [profileId, requesterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const profile = result.rows[0];

    // Se o perfil estiver bloqueado, retornamos apenas a informação essencial
    if (profile.is_blocked_by_me) {
      return res.status(200).json({
        id_usuario: profile.id_usuario,
        nome: profile.nome,
        email: profile.email,
        foto_perfil_url: profile.foto_perfil_url,
        is_blocked_by_me: true
      });
    }

    // Se não, retornamos o perfil completo
    res.status(200).json(profile);

  } catch (error) {
    console.error("Erro ao buscar perfil:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// As outras funções (updateUserProfilePicture, etc.) permanecem inalteradas
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

exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    try {
        const userResult = await db.query('SELECT id_usuario FROM usuario WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição será enviado.' });
        }
        const userId = userResult.rows[0].id_usuario;
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + 1);
        await db.query(
            'INSERT INTO redefinicao_senha (usuario_id, token, expira_em) VALUES ($1, $2, $3)',
            [userId, resetToken, expiration]
        );
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

exports.resetPassword = async (req, res) => {
    const { token, senha } = req.body;
    if (!token || !senha) {
        return res.status(400).json({ error: 'O token e a nova senha são obrigatórios.' });
    }
    try {
        const result = await db.query(
            'SELECT * FROM redefinicao_senha WHERE token = $1 AND expira_em > NOW()',
            [token]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Token inválido ou expirado.' });
        }
        const { usuario_id } = result.rows[0];
        const salt = await bcrypt.genSalt(10);
        const senha_hash = await bcrypt.hash(senha, salt);
        await db.query('UPDATE usuario SET senha_hash = $1 WHERE id_usuario = $2', [senha_hash, usuario_id]);
        await db.query('DELETE FROM redefinicao_senha WHERE token = $1', [token]);
        res.status(200).json({ message: 'Senha redefinida com sucesso!' });
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};