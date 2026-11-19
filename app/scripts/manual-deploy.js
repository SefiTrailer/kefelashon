import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const repoUrl = 'https://github.com/SefiTrailer/kefelashon.git';

function run(cmd, cwd = distDir) {
    console.log(`[Deploy] Running: ${cmd}`);
    return execSync(cmd, { cwd, encoding: 'utf-8', windowsHide: true });
}

export function deployToGitHubPages() {
    console.log('[Deploy] Starting incremental deployment to gh-pages...');

    if (!fs.existsSync(distDir)) {
        throw new Error(`dist directory not found at: ${distDir}`);
    }

    // Ensure CNAME and .nojekyll exist in dist
    fs.writeFileSync(path.join(distDir, 'CNAME'), 'kefelashon.co.il\n', 'utf-8');
    fs.writeFileSync(path.join(distDir, '.nojekyll'), '', 'utf-8');

    const gitDir = path.join(distDir, '.git');
    if (!fs.existsSync(gitDir)) {
        run('git init');
        run(`git remote add origin ${repoUrl}`);
        run('git fetch origin gh-pages --depth 1');
    }

    // Stage all changes (new files, modified public-data, etc.)
    run('git add -A');

    // Check if there is anything to commit
    const status = run('git status --porcelain').trim();
    if (!status) {
        console.log('[Deploy] No new files to deploy to gh-pages.');
        return { ok: true, skipped: true };
    }

    // Commit and push only the delta
    run('git commit -m "Deploy to GitHub Pages"');
    run('git push origin HEAD:gh-pages');

    console.log('[Deploy] gh-pages deployed successfully!');
    return { ok: true, deployed: true };
}

// Allow direct CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    try {
        deployToGitHubPages();
    } catch (e) {
        console.error('[Deploy Failed]', e.message);
        process.exit(1);
    }
}
