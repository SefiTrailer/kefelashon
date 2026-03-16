import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const IMAGES_DIR = 'app/public/images';

try {
    // 1. Get files tracked in Git (remote/main)
    const gitFilesStr = execSync(`git ls-tree -r origin/main --name-only ${IMAGES_DIR}`).toString();
    const gitFiles = new Set(gitFilesStr.split('\n').map(f => path.basename(f)).filter(Boolean));

    // 2. Get local files
    const localFiles = new Set(fs.readdirSync(IMAGES_DIR));

    // 3. Compare
    const inGitNotLocal = [...gitFiles].filter(f => !localFiles.has(f));
    const inLocalNotGit = [...localFiles].filter(f => !gitFiles.has(f));

    console.log(`Summary for ${IMAGES_DIR}:`);
    console.log(`- Files in GitHub but NOT local: ${inGitNotLocal.length}`);
    if (inGitNotLocal.length > 0) {
        console.log('Examples:', inGitNotLocal.slice(0, 5));
    }
    console.log(`- Files local but NOT in GitHub (Untracked): ${inLocalNotGit.length}`);
    if (inLocalNotGit.length > 0) {
        console.log('Examples:', inLocalNotGit.slice(0, 5));
    }

} catch (err) {
    console.error('Error comparing files:', err.message);
}
