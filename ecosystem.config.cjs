module.exports = {
  apps: [
    {
      name: "API",
      script: "npx tsx index.ts",
      cwd: "./api"
    },
    {
      name: "FRONTEND",
      script: "npm",
      args: "run start"
    },
    {
      name: "ADMIN",
      script: "npm",
      args: "run start",
      cwd: "./admin"
    }
  ]
}
