import { createServer } from 'vite';

const server = await createServer();
await server.listen();
server.printUrls();
for (const event of ['SIGINT', 'SIGTERM']) {
  process.once(event, async () => { await server.close(); process.exit(0); });
}
