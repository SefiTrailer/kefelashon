import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const repoUrl = 'https://github.com/SefiTrailer/kefel-lashon.git';

function run(cmd, cwd = distDir) {
    console.log(`Running: ${cmd}`);
    return execSync(cmd, { cwd, stdio: 'inherit' });
}

try {
    console.log('Starting custom deployment...');
    
    // 1. Setup dist as a git repo
    try { run('git init'); } catch (e) { console.log('Git already initialized or error.'); }
    
    // 2. Add remote if not exists
    try { run(`git remote add origin ${repoUrl}`); } catch (e) { 
        run(`git remote set-url origin ${repoUrl}`);
    }
    
    // 3. Checkout a temporary branch or just use main
    run('git checkout -b gh-pages-deploy');
    
    // 4. Add all files
    // To avoid ENAMETOOLONG on git add ., we just do it. git add . is usually fine as a single command.
    run('git add .');
    
    // 5. Commit
    run('git commit -m "Deploy to GitHub Pages"');
    
    // 6. Push to gh-pages branch
    run('git push origin gh-pages-deploy:gh-pages --force');
    
    console.log('Deployment successful!');
} catch (error) {
    console.error('Deployment failed:', error.message);
    process.exit(1);
}
