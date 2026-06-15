const fs = require("fs");
const path = require("path");

const write = (message) => {
  fs.writeSync(1, `${message}\n`);
};

write(
  JSON.stringify({
    event: "render-start",
    cwd: process.cwd(),
    hasMongoUri: Boolean(process.env.MONGO_URI),
    hasPort: Boolean(process.env.PORT),
    nodeEnv: process.env.NODE_ENV || "",
    nodeVersion: process.version,
    renderExternalHostname: process.env.RENDER_EXTERNAL_HOSTNAME || "",
    renderServiceId: process.env.RENDER_SERVICE_ID || "",
    serverFileExists: fs.existsSync(path.join(process.cwd(), "server.js"))
  })
);

try {
  require("../server");
} catch (error) {
  write("render-start fatal error:");
  write(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
