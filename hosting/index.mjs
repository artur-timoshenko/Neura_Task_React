import { createFrontend, readHostingConfig } from './app.mjs';
const config = readHostingConfig();
const { app, upgrade } = createFrontend(config);
const server = app.listen(config.port, '::', () => console.log('Frontend ready on port ' + config.port));
server.on('upgrade', upgrade);
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
