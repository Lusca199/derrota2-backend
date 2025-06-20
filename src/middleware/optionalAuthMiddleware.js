// Ficheiro: Testes/derrota2-backend/src/middleware/optionalAuthMiddleware.js
// Este middleware tenta validar um token, mas não falha se ele não existir.

const jwt = require('jsonwebtoken');

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  // Se não houver cabeçalho ou token, tudo bem. Apenas continuamos.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    // Se houver um token, tentamos verificá-lo
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // E adicionamos o usuário ao request para ser usado no controller
    req.user = decoded;
  } catch (error) {
    // Se o token for inválido (expirado, etc.), ignoramos e continuamos
    // sem um usuário autenticado.
    console.log("Token opcional inválido ou expirado, continuando como visitante.");
  }

  // Passa para a próxima função (o controller)
  next();
}

module.exports = optionalAuthMiddleware;