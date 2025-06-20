// Ficheiro: Testes/derrota2-backend/src/middleware/authMiddleware.js
// Versão com logs de depuração para descobrirmos a causa do erro 401

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  console.log('--- Middleware de Autenticação Ativado ---');
  const authHeader = req.headers.authorization;

  // Log 1: Vamos ver o que o cabeçalho de autorização contém
  console.log('Cabeçalho de Autorização Recebido:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('FALHA: Cabeçalho ausente ou mal formatado.');
    return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Log 2: Vamos verificar qual é a chave secreta que o Node.js está a usar
    console.log('A tentar verificar o token com a chave secreta:', process.env.JWT_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Log 3: Se a verificação for bem-sucedida, veremos os dados do usuário
    console.log('SUCESSO: Token decodificado com sucesso:', decoded);

    req.user = decoded;
    next();
  } catch (error) {
    // Log 4: Se a verificação falhar, este log dirá o motivo exato
    console.error('FALHA ao verificar o token. Motivo:', error.message);
    res.status(401).json({ error: 'Token inválido.' });
  }
}

module.exports = authMiddleware;