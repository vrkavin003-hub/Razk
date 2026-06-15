const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const isWindows = process.platform === "win32";
const nodeCommand = process.execPath;
const DEFAULT_BACKEND_PORT = Number(process.env.PORT || 5000);
const DEFAULT_FRONTEND_PORT = Number(process.env.CLIENT_PORT || 5174);

const cleanEnv = Object.entries(process.env).reduce((env, [key, value]) => {
  if (isWindows && key.toLowerCase() === "path") {
    env.Path = env.Path || value;
    return env;
  }
  env[key] = value;
  return env;
}, {});

const canListen = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });

const findAvailablePort = async (startPort) => {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 49}`);
};

const startChild = ({ name, cwd, args, env = {} }) => {
  const child = spawn(nodeCommand, args, {
    cwd: path.join(__dirname, "..", cwd),
    env: { ...cleanEnv, ...env },
    shell: false,
    stdio: ["inherit", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => {
    process.stdout.write(`[${name}] ${data}`);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(`[${name}] ${data}`);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
};

let children = [];

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const main = async () => {
  const backendPort = await findAvailablePort(DEFAULT_BACKEND_PORT);
  const frontendPort = await findAvailablePort(DEFAULT_FRONTEND_PORT);
  const apiUrl = `http://localhost:${backendPort}/api`;

  const processes = [
    {
      name: "server",
      cwd: "server",
      args: ["server.js"],
      env: {
        PORT: String(backendPort)
      }
    },
    {
      name: "client",
      cwd: "client",
      args: ["node_modules/vite/bin/vite.js", "--host", "localhost", "--port", String(frontendPort)],
      env: {
        VITE_API_URL: apiUrl
      }
    }
  ];

  children = processes.map(startChild);

  console.log("Starting Razk Automation HRMS...");
  console.log(`Backend:  http://localhost:${backendPort}/api/health`);
  console.log(`Frontend: http://localhost:${frontendPort}`);
  console.log(`API URL:  ${apiUrl}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
