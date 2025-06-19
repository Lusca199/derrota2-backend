// src/controllers/commentController.js

const db = require('../config/database');

/**
 * Lógica para CRIAR um novo comentário em uma publicação.
 * Esta função é protegida e requer que o usuário esteja autenticado.
 */
exports.createComment = async (req, res) => {
  const { publicationId } = req.params; // O ID da publicação vem da URL
  const { texto } = req.body; // O texto do comentário vem do corpo da requisição
  const autor_id = req.user.id; // O ID do usuário logado vem do middleware de autenticação

  // Validação para garantir que o comentário não esteja vazio
  if (!texto || texto.trim() === '') {
    return res.status(400).json({ error: 'O texto do comentário não pode estar vazio.' });
  }

  try {
    // Insere o novo comentário na base de dados
    const result = await db.query(
      `INSERT INTO comentario (pub_id, autor_id, texto) 
       VALUES ($1, $2, $3) 
       RETURNING id_coment, texto, criado_em`,
      [publicationId, autor_id, texto]
    );

    const novoComentario = result.rows[0];

    // Para uma melhor experiência no front-end, retornamos o comentário completo
    // já com os dados do autor, para não precisar de uma nova busca.
    const autor = await db.query('SELECT nome, foto_perfil_url FROM usuario WHERE id_usuario = $1', [autor_id]);

    res.status(201).json({
        ...novoComentario,
        autor_id: autor_id,
        nome_autor: autor.rows[0].nome,
        autor_foto_perfil_url: autor.rows[0].foto_perfil_url
    });

  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    // Verifica se o erro é por uma publicação que não existe
    if (error.code === '23503') { // Foreign key violation
        return res.status(404).json({ error: 'Publicação não encontrada.' });
    }
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

/**
 * Lógica para LER todos os comentários de uma publicação específica.
 * Esta rota é pública.
 */
exports.getCommentsForPublication = async (req, res) => {
  const { publicationId } = req.params;

  try {
    // Busca todos os comentários e junta com a tabela de usuários para pegar nome e foto
    const result = await db.query(
      `SELECT 
            c.id_coment AS id_comentario, 
            c.texto, 
            c.criado_em, 
            u.id_usuario AS autor_id, 
            u.nome AS nome_autor, 
            u.foto_perfil_url AS autor_foto_perfil_url
       FROM comentario c
       JOIN usuario u ON c.autor_id = u.id_usuario
       WHERE c.pub_id = $1
       ORDER BY c.criado_em ASC`, // Ordena do mais antigo para o mais novo
      [publicationId]
    );

    res.status(200).json(result.rows);
  } catch (error)
  {
    console.error('Erro ao buscar comentários:', error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};