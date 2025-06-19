// src/controllers/reactionController.js (Novo Arquivo)

const db = require('../config/database');

// Lógica para CURTIR uma publicação
exports.likePublication = async (req, res) => {
  const { publicationId } = req.params;
  const userId = req.user.id;

  try {
    // Usamos ON CONFLICT para evitar erros caso o usuário tente curtir duas vezes.
    // Se a curtida já existir, não faz nada. Se não, insere.
    await db.query(
      `INSERT INTO reacao (usuario_id, alvo_id, alvo_tipo, tipo) 
       VALUES ($1, $2, 'POST', 'CURTIR') 
       ON CONFLICT (usuario_id, alvo_id, alvo_tipo) DO NOTHING`,
      [userId, publicationId]
    );
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