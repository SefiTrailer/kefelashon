import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, 'data.json');
const IMAGES_DIR = path.resolve(__dirname, 'app/public/images');

async function bulkRename() {
    if (!fs.existsSync(DATA_FILE)) {
        console.log('data.json not found.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const files = fs.readdirSync(IMAGES_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    
    let renameCount = 0;
    let collisionCount = 0;

    // Use a fresh copy of data to avoid mutation issues during loop
    const newData = { ...data };

    for (const filename of files) {
        const meta = data[filename];
        if (!meta || !meta.title) continue;

        const title = meta.title.trim();
        if (!title) continue;

        const ext = path.extname(filename).toLowerCase();
        let sanitizedTitle = title.replace(/[<>:"/\\|?*]/g, '').trim();
        if (!sanitizedTitle) continue;

        let targetFilename = sanitizedTitle + ext;
        
        // If already correct (case-insensitive check for Windows)
        if (filename.toLowerCase() === targetFilename.toLowerCase()) {
            // Ensure exact case matches if intended, but on Windows it usually doesn't matter
            continue;
        }

        let targetPath = path.join(IMAGES_DIR, targetFilename);
        let counter = 1;

        while (fs.existsSync(targetPath)) {
            // If it's a conflict with ANOTHER file
            targetFilename = `${sanitizedTitle} ${counter}${ext}`;
            targetPath = path.join(IMAGES_DIR, targetFilename);
            counter++;
            collisionCount++;
        }

        console.log(`Renaming: "${filename}" -> "${targetFilename}"`);
        const oldPath = path.join(IMAGES_DIR, filename);
        fs.renameSync(oldPath, targetPath);
        
        // Update metadata key
        newData[targetFilename] = meta;
        delete newData[filename];
        renameCount++;
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
    console.log(`Bulk rename finished. Renamed: ${renameCount}, Conflicts handled: ${collisionCount}`);
}

bulkRename();
