// Ficheiro: Testes/derrota2-backend/src/controllers/relationshipController.js
// Versão com a criação de notificação de "novo seguidor"

const db = require('../config/database');

// Lógica para seguir um usuário
exports.followUser = async (req, res) => {
    const seguidorId = req.user.id;
    const { userId: seguidoId } = req.params;

    if (Number(seguidorId) === Number(seguidoId)) { 
        return res.status(400).json({ error: 'Você não pode seguir a si mesmo.' }); 
    }

    try {
        const result = await db.query(
            `INSERT INTO relacao_usuario (seguidor_id, seguido_id, bloqueado) VALUES ($1, $2, false) 
             ON CONFLICT (seguidor_id, seguido_id) DO UPDATE SET bloqueado = false, data_relacao = NOW() 
             RETURNING *`,
            [seguidorId, seguidoId]
        );

        // --- INÍCIO DA LÓGICA DE NOTIFICAÇÃO ---
        // Vamos tentar criar a notificação, mas sem bloquear a resposta principal se falhar.
        try {
            // 1. Verificar se o usuário que FOI seguido quer receber notificações.
            const configResult = await db.query(
                'SELECT notificacoes_ativas FROM configuracao_usuario WHERE id_usuario = $1',
                [seguidoId]
            );

            // Prossiga apenas se a configuração for encontrada e estiver ativa
            if (configResult.rows.length > 0 && configResult.rows[0].notificacoes_ativas) {
                
                // 2. Obter o nome de quem seguiu para usar na mensagem.
                const seguidorInfo = await db.query('SELECT nome FROM usuario WHERE id_usuario = $1', [seguidorId]);
                const nomeSeguidor = seguidorInfo.rows.length > 0 ? seguidorInfo.rows[0].nome : 'Alguém';

                // 3. Criar a mensagem e inserir a notificação.
                const mensagem = `${nomeSeguidor} começou a seguir você.`;
                await db.query(
                    `INSERT INTO notificacao (destinatario_id, mensagem, tipo) VALUES ($1, $2, 'FOLLOW')`,
                    [seguidoId, mensagem]
                );
            }
        } catch (notificationError) {
            // Se a notificação falhar, registamos o erro no console, mas não paramos o fluxo.
            // O usuário foi seguido com sucesso, isso é o mais importante.
            console.error("Falha ao criar notificação de 'seguir':", notificationError);
        }
        // --- FIM DA LÓGICA DE NOTIFICAÇÃO ---

        res.status(201).json({ message: 'Usuário seguido com sucesso!', relation: result.rows[0] });

    } catch (error) {
        if (error.code === '23503') { 
            return res.status(404).json({ error: 'Usuário a ser seguido não encontrado.' }); 
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Lógica para deixar de seguir um usuário
exports.unfollowUser = async (req, res) => {
    const seguidorId = req.user.id;
    const { userId: seguidoId } = req.params;
    try {
        const result = await db.query('DELETE FROM relacao_usuario WHERE seguidor_id = $1 AND seguido_id = $2', [seguidorId, seguidoId]);
        if (result.rowCount === 0) { return res.status(404).json({ error: 'Você não está a seguir este usuário.' }); }
        res.status(200).json({ message: 'Deixou de seguir o usuário com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Lógica para LER a lista de SEGUIDORES de um usuário
exports.getFollowers = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.query(
            `SELECT u.id_usuario, u.nome, u.email, u.foto_perfil_url FROM usuario u JOIN relacao_usuario r ON u.id_usuario = r.seguidor_id WHERE r.seguido_id = $1 AND r.bloqueado = false`,
            [userId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Lógica para LER a lista de usuários que um usuário ESTÁ A SEGUIR
exports.getFollowing = async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.query(
            `SELECT u.id_usuario, u.nome, u.email, u.foto_perfil_url FROM usuario u JOIN relacao_usuario r ON u.id_usuario = r.seguido_id WHERE r.seguidor_id = $1 AND r.bloqueado = false`,
            [userId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Lógica para um usuário bloquear outro
exports.blockUser = async (req, res) => {
    const blockerId = req.user.id;
    const { userId: blockedId } = req.params;
    if (Number(blockerId) === Number(blockedId)) { return res.status(400).json({ error: 'Você não pode bloquear a si mesmo.' }); }
    try {
        await db.query(`DELETE FROM relacao_usuario WHERE (seguidor_id = $1 AND seguido_id = $2) OR (seguidor_id = $2 AND seguido_id = $1)`, [blockerId, blockedId]);
        const result = await db.query(
            `INSERT INTO relacao_usuario (seguidor_id, seguido_id, bloqueado) VALUES ($1, $2, true) ON CONFLICT (seguidor_id, seguido_id) DO UPDATE SET bloqueado = true, data_relacao = NOW() RETURNING *`,
            [blockerId, blockedId]
        );
        res.status(200).json({ message: 'Usuário bloqueado com sucesso!', relation: result.rows[0] });
    } catch (error) {
        if (error.code === '23503') { return res.status(404).json({ error: 'Usuário a ser bloqueado não encontrado.' }); }
        console.error(error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// Lógica para verificar o status da relação entre dois usuários
exports.getRelationshipStatus = async (req, res) => {
  const seguidorId = req.user.id; // Usuário logado
  const { targetUserId: seguidoId } = req.params; // Usuário do perfil
  try {
    const result = await db.query(
      'SELECT * FROM relacao_usuario WHERE seguidor_id = $1 AND seguido_id = $2',
      [seguidorId, seguidoId]
    );
    if (result.rows.length === 0) {
      return res.status(200).json({ following: false, blocked: false });
    }
    const relacao = result.rows[0];
    res.status(200).json({
      following: !relacao.bloqueado,
      blocked: relacao.bloqueado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para desbloquear um usuário
exports.unblockUser = async (req, res) => {
    const blockerId = req.user.id;
    const { userId: blockedId } = req.params;
    try {
        // Para desbloquear, simplesmente apagamos a relação de bloqueio que o usuário logado criou
        await db.query(
            'DELETE FROM relacao_usuario WHERE seguidor_id = $1 AND seguido_id = $2 AND bloqueado = TRUE',
            [blockerId, blockedId]
        );
        res.status(200).json({ message: 'Usuário desbloqueado com sucesso.' });
    } catch (error) {
        console.error("Erro ao desbloquear usuário:", error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};