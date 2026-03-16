import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, 'data.json');
const IMAGES_DIR = path.resolve(__dirname, 'app/public/images');

async function syncMetadata() {
    if (!fs.existsSync(DATA_FILE)) {
        console.log('data.json not found.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const filesInGallery = fs.readdirSync(IMAGES_DIR);
    const gallerySet = new Set(filesInGallery);
    const baseToFiles = {};
    
    filesInGallery.forEach(f => {
        const base = f.replace(/\.[^/.]+$/, "");
        if (!baseToFiles[base]) baseToFiles[base] = [];
        baseToFiles[base].push(f);
    });

    const newData = {};
    let fixCount = 0;

    for (const [key, value] of Object.entries(data)) {
        if (gallerySet.has(key)) {
            // Perfect match
            newData[key] = value;
        } else {
            // Try changing extension
            const base = key.replace(/\.[^/.]+$/, "");
            if (baseToFiles[base] && baseToFiles[base].length > 0) {
                const actualFile = baseToFiles[base][0]; // Take the first one (usually .jpg)
                console.log(`Syncing: ${key} -> ${actualFile}`);
                newData[actualFile] = value;
                fixCount++;
            } else {
                // Keep orphaned metadata for now, or you could discard it
                newData[key] = value;
            }
        }
    }

    // Also look for files in gallery NOT in data.json (orphans)
    // Actually, App.jsx handles missing metadata gracefully.

    fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
    console.log(`Sync finished. Fixed ${fixCount} keys.`);
}

syncMetadata();
