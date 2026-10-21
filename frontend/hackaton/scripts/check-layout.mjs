// Reuses the isolated API and browser setup used by the main regression suite.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const child = spawn('npm', ['run', 'test:e2e', '--', '--grep', 'responsive layout'], { cwd: root, stdio: 'inherit' })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
