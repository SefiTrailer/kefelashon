/**
 * update-public-data.mjs
 * Lightweight alternative to prepare-public.js:
 * Regenerates app/public/public-data.json from data.json
 * WITHOUT recompressing images (assumes they're already processed).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../data.json');
const PUBLIC_IMAGES_DIR = path.resolve(__dirname, 'public/images');
const PUBLIC_DATA_FILE = path.resolve(__dirname, 'public/public-data.json');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

// Get all images already in public/images
const publicImages = fs.existsSync(PUBLIC_IMAGES_DIR)
    ? fs.readdirSync(PUBLIC_IMAGES_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    : [];

const publicFiles = [];
const publicData = {};
const fileStats = {};

for (const filename of publicImages) {
    // The public image might be .webp while data.json key is .png/.jpg — normalize
    const noExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');

    // Try exact match or .png variant
    const metaKey = data[filename]
        ? filename
        : data[noExt + '.png']
            ? noExt + '.png'
            : data[noExt + '.jpg']
                ? noExt + '.jpg'
                : null;

    const meta = metaKey ? data[metaKey] : null;

    publicFiles.push(filename);

    if (meta && meta.title && meta.explanation) {
        let dateMillis = meta.createdAt;
        if (!dateMillis) {
            const match = filename.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_/);
            if (match) {
                const dateStr = match[1] + '-' + match[2] + '-' + match[3] + 'T' + match[4] + ':' + match[5] + ':' + match[6] + 'Z';
                dateMillis = new Date(dateStr).getTime();
            } else {
                try { dateMillis = fs.statSync(path.join(PUBLIC_IMAGES_DIR, filename))?.mtimeMs || 0; }
                catch { dateMillis = 0; }
            }
        }
        publicData[filename] = {
            ...meta,
            dateMillis
        };
        try { fileStats[filename] = fs.statSync(path.join(PUBLIC_IMAGES_DIR, filename)).size; } catch { fileStats[filename] = 0; }
    }
}

// Sort: tagged first, then alphabetical
publicFiles.sort((a, b) => {
    const aT = publicData[a]?.title ? 1 : 0;
    const bT = publicData[b]?.title ? 1 : 0;
    if (aT !== bT) return bT - aT;
    return a.localeCompare(b);
});

fs.writeFileSync(PUBLIC_DATA_FILE, JSON.stringify({ files: publicFiles, data: publicData, fileStats }, null, 2));
console.log(`Updated public-data.json: ${publicFiles.length} images, ${Object.keys(publicData).length} tagged.`);
