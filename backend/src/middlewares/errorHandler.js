export function notFound(req, res) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Registro inexistente em update/delete do Prisma
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Registro não encontrado' });
  }
  // Corpo JSON malformado ou grande demais
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Conteúdo grande demais' });
  }
  // Erros de upload (multer)
  if (err.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'Arquivo maior que o limite de 25 MB',
      LIMIT_FILE_COUNT: 'Envie no máximo 10 arquivos por vez',
      LIMIT_UNEXPECTED_FILE: 'Campo de arquivo inesperado (use "files")',
    };
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: messages[err.code] || 'Falha no envio do arquivo' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Erro interno do servidor' : err.message,
  });
}
