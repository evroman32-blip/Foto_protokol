import { createServer } from 'node:http';

const port = Number(process.env.WEB_PORT ?? 3000);

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>Mandarin PhotoProtocol</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; color: #2b2d42; }
    h1 { color: #e85d04; }
  </style>
</head>
<body>
  <h1>Mandarin Strategic Implant PhotoProtocol</h1>
  <p>Фундамент monorepo создан. Next.js UI — следующий этап реализации.</p>
  <p><a href="http://localhost:3001/api/v1/health">API Health</a></p>
</body>
</html>`;

createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(port, () => {
  console.log(`Mandarin Web scaffold on http://localhost:${port}`);
});
