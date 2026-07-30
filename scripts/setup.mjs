// One-time setup: installs all dependencies for the three services, creates env
// files, and initialises + seeds the database. Idempotent-ish (re-running reseeds).
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';

function run(cmd, cwd) {
  console.log(`\n▶  ${cwd ?? '.'}$ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}
function ensureEnv(example, target) {
  if (!existsSync(target)) {
    copyFileSync(example, target);
    console.log(`   created ${target}`);
  }
}

console.log('🛠  LandGuard setup — installing all services\n');

// 1. Root orchestrator (concurrently)
run('npm install');

// 2. Backend
ensureEnv('backend/.env.example', 'backend/.env');
run('npm install', 'backend');
run('npm run db:push', 'backend');
run('npm run db:seed', 'backend');

// 3. Frontend
ensureEnv('frontend/.env.example', 'frontend/.env.local');
run('npm install', 'frontend');

// 4. ML service (Python)
run('python -m pip install -r requirements.txt', 'ml-service');

console.log('\n✅ Setup complete. Now run:  npm run dev   (or double-click start.bat)');
