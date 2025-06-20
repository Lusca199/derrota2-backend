// src/controllers/reactionController.js (Versão com notificação de curtida e origem_id)

const db = require('../config/database');

// Lógica para CURTIR uma publicação
exports.likePublication = async (req, res) => {
  const { publicationId } = req.params;
  const userId = req.user.id; // ID de quem está a curtir

  try {
    // Insere a reação na base de dados
    const reactionResult = await db.query(
      `INSERT INTO reacao (usuario_id, alvo_id, alvo_tipo, tipo) 
       VALUES ($1, $2, 'POST', 'CURTIR') 
       ON CONFLICT (usuario_id, alvo_id, alvo_tipo) DO NOTHING
       RETURNING usuario_id`, // RETURNING para saber se a linha é nova
      [userId, publicationId]
    );

    // --- INÍCIO DA LÓGICA DE NOTIFICAÇÃO DE CURTIDA ---
    // Apenas cria a notificação se a curtida foi realmente inserida agora (não era um conflito)
    if (reactionResult.rowCount > 0) {
      try {
        // 1. Encontrar o autor da publicação
        const postResult = await db.query('SELECT autor_id FROM publicacao WHERE id_pub = $1', [publicationId]);
        
        if (postResult.rows.length > 0) {
          const autorId = postResult.rows[0].autor_id;

          // 2. Evitar auto-notificação e verificar preferências do autor
          if (Number(autorId) !== Number(userId)) {
            const configResult = await db.query(
              'SELECT notificacoes_ativas FROM configuracao_usuario WHERE id_usuario = $1',
              [autorId]
            );

            if (configResult.rows.length > 0 && configResult.rows[0].notificacoes_ativas) {
              // 3. Obter o nome de quem curtiu
              const likerInfo = await db.query('SELECT nome FROM usuario WHERE id_usuario = $1', [userId]);
              const nomeLiker = likerInfo.rows[0]?.nome || 'Alguém';

              // 4. Criar a notificação
              const mensagem = `${nomeLiker} curtiu a sua publicação.`;
              // --- ALTERAÇÃO AQUI: Adicionamos a coluna origem_id ---
              await db.query(
                `INSERT INTO notificacao (destinatario_id, mensagem, tipo, origem_id) 
                 VALUES ($1, $2, 'LIKE', $3)`,
                [autorId, mensagem, publicationId] // O origem_id é o ID da publicação curtida
              );
            }
          }
        }
      } catch (notificationError) {
        console.error("Falha ao criar notificação de 'curtida':", notificationError);
      }
    }
    // --- FIM DA LÓGICA DE NOTIFICAÇÃO ---

    res.status(201).json({ message: 'Publicação curtida com sucesso.' });
  } catch (error) {
    console.error('Erro ao curtir publicação:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

// Lógica para DESCURTIR uma publicação
exports.unlikePublication = async (req, res) => {
  const { publicationId } = req.params;
  const userId = req.user.id;

  try {
    await db.query(
      "DELETE FROM reacao WHERE usuario_id = $1 AND alvo_id = $2 AND alvo_tipo = 'POST'",
      [userId, publicationId]
    );
    res.status(200).json({ message: 'Publicação descurtida com sucesso.' });
  } catch (error) {
    console.error('Erro ao descurtir publicação:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};