const { spawn } = require("child_process");
const path = require("path");

const isWindows = process.platform === "win32";
const nodeCommand = process.execPath;

const cleanEnv = Object.entries(process.env).reduce((env, [key, value]) => {
  if (isWindows && key.toLowerCase() === "path") {
    env.Path = env.Path || value;
    return env;
  }
  env[key] = value;
  return env;
}, {});

const processes = [
  {
    name: "server",
    cwd: "server",
    args: ["server.js"]
  },
  {
    name: "client",
    cwd: "client",
    args: ["node_modules/vite/bin/vite.js", "--host", "localhost", "--port", "5174"]
  }
];

const children = processes.map(({ name, cwd, args }) => {
  const child = spawn(nodeCommand, args, {
    cwd: path.join(__dirname, "..", cwd),
    env: cleanEnv,
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
});

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

console.log("Starting HYA Tech HRMS...");
console.log("Backend:  http://localhost:5000/api/health");
console.log("Frontend: http://localhost:5174");
