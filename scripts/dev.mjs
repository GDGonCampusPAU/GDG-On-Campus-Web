import { spawn } from 'node:child_process'

const children = ['backend', 'frontend', 'frontend/hackaton'].map((directory) =>
  spawn('npm', ['run', 'dev', '--prefix', directory], { stdio: 'inherit', detached: true }),
)
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* process already exited */ }
  }
  process.exitCode = code
}
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1) })
  child.on('exit', (code) => stop(code || 0))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
