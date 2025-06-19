// src/controllers/searchController.js (Novo Ficheiro)

const db = require('../config/database');

exports.search = async (req, res) => {
  const { q } = req.query; // 'q' é o nosso parâmetro de busca, ex: /api/search?q=react

  if (!q || q.trim() === '') {
    return res.status(400).json({ error: 'O termo de busca não pode ser vazio.' });
  }

  try {
    // Para a busca de texto em posts, formatamos o termo para o tsquery
    // Ex: "react native" -> "react & native"
    const searchTerm = q.trim().split(' ').join(' & ');

    // Executa as duas buscas em paralelo para mais eficiência
    const [postResults, userResults] = await Promise.all([
      // Query 1: Busca por publicações usando o índice de full-text search (tsv)
      db.query(
        `SELECT p.id_pub, p.texto, p.criado_em, m.url as media_url,
                u.id_usuario as autor_id, u.nome as nome_autor, u.foto_perfil_url
         FROM publicacao p
         JOIN usuario u ON p.autor_id = u.id_usuario
         LEFT JOIN midia m ON p.id_pub = m.pub_id
         WHERE p.tsv @@ to_tsquery('portuguese', $1)
         ORDER BY p.criado_em DESC`,
        [searchTerm]
      ),
      // Query 2: Busca por usuários usando o nome (com ILIKE para ser case-insensitive)
      db.query(
        "SELECT id_usuario, nome, email, foto_perfil_url FROM usuario WHERE nome ILIKE $1",
        [`%${q}%`]
      )
    ]);

    // Retorna um objeto com os dois conjuntos de resultados
    res.status(200).json({
      posts: postResults.rows,
      users: userResults.rows,
    });

  } catch (error) {
    console.error("Erro ao realizar busca:", error);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};