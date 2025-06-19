const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  // O token geralmente é enviado no cabeçalho 'Authorization' no formato "Bearer TOKEN"
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifica se o token é válido usando o nosso segredo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Adiciona os dados do usuário (do token) ao objeto da requisição
    // para que as próximas funções (controllers) saibam quem fez a requisição
    req.user = decoded;

    // Se o token for válido, passa para a próxima função (o controller)
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido.' });
  }
}

module.exports = authMiddleware;