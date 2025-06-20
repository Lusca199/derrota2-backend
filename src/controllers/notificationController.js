// Ficheiro: Testes/derrota2-backend/src/controllers/notificationController.js
// Versão com a função de contagem otimizada

const db = require('../config/database');

/**
 * Busca todas as notificações para o usuário autenticado.
 * As notificações são ordenadas da mais recente para a mais antiga.
 */
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
      `SELECT id_notif, destinatario_id, mensagem, tipo, lida, timestamp 
       FROM notificacao 
       WHERE destinatario_id = $1 
       ORDER BY timestamp DESC`,
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    res.status(500).json({ error: 'Erro interno do servidor ao buscar notificações.' });
  }
};

/**
 * Marca uma notificação específica como lida.
 * Garante que a notificação pertence ao usuário que faz o pedido.
 */
exports.markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { notificationId } = req.params;

  if (!notificationId) {
    return res.status(400).json({ error: 'O ID da notificação é obrigatório.' });
  }

  try {
    const result = await db.query(
      `UPDATE notificacao 
       SET lida = TRUE 
       WHERE id_notif = $1 AND destinatario_id = $2
       RETURNING id_notif`,
      [notificationId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Notificação não encontrada ou não pertence a você.' });
    }

    res.status(200).json({ message: 'Notificação marcada como lida com sucesso.' });
  } catch (error) {
    console.error("Erro ao marcar notificação como lida:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};


/**
 * --- NOVA FUNÇÃO DE OTIMIZAÇÃO ---
 * Busca apenas a CONTAGEM de notificações não lidas para o usuário.
 * É mais eficiente do que buscar todos os objetos.
 */
exports.getUnreadCount = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(
        `SELECT COUNT(*) FROM notificacao WHERE destinatario_id = $1 AND lida = FALSE`,
        [userId]
    );

    // O resultado de COUNT(*) vem como uma string, então convertemos para inteiro.
    const count = parseInt(result.rows[0].count, 10);

    res.status(200).json({ count: count });

  } catch (error) {
    console.error("Erro ao buscar contagem de notificações:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};