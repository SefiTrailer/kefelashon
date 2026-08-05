import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_REPOS = [
    path.resolve(__dirname, '../public/images')
];
const DATA_FILE = path.resolve(__dirname, '../../data.json');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const PUBLIC_IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const PUBLIC_THUMBNAILS_DIR = path.join(PUBLIC_DIR, 'thumbnails');
const PUBLIC_DATA_FILE = path.join(PUBLIC_DIR, 'public-data.json');

console.log('Preparing public assets (v2 - Extension Blind & Newest First)...');

// Ensure public directories exist
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_THUMBNAILS_DIR)) {
    fs.mkdirSync(PUBLIC_THUMBNAILS_DIR, { recursive: true });
}

// Read the main data
let data = {};
if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

const publicFiles = [];
const publicData = {};
const fileStats = {};

// Get ALL source images from both folders
const allSourceImages = [];
for (const dir of SOURCE_REPOS) {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        files.forEach(f => allSourceImages.push({ name: f, dir }));
    }
}

async function buildPublicGallery() {
    for (const item of allSourceImages) {
        const filename = item.name;
        const sourcePath = path.join(item.dir, filename);
        
        const base = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        const ext = path.extname(filename).toLowerCase();
        
        // Find metadata (extension-blind)
        const metaKey = data[filename]
            ? filename
            : data[base + '.webp']
                ? base + '.webp'
                : data[base + '.png']
                    ? base + '.png'
                    : data[base + '.jpg']
                        ? base + '.jpg'
                        : data[base + '.jpeg']
                            ? base + '.jpeg'
                            : null;

        const metadata = metaKey ? data[metaKey] : {};
        
        // Target in public is always .webp for consistency and efficiency
        const newFilename = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');
        const destPath = path.join(PUBLIC_IMAGES_DIR, newFilename);

        // Only process if destination doesn't exist or is older than source
        let shouldProcess = !fs.existsSync(destPath);
        if (!shouldProcess) {
            const sourceStat = fs.statSync(sourcePath);
            const destStat = fs.statSync(destPath);
            if (sourceStat.mtimeMs > destStat.mtimeMs) {
                shouldProcess = true;
            }
        }

        if (shouldProcess) {
            try {
                // If the source is already a webp and doesn't need resizing, just copy it
                if (ext === '.webp') {
                    fs.copyFileSync(sourcePath, destPath);
                } else {
                    await sharp(sourcePath)
                        .resize({ width: 1280, withoutEnlargement: true })
                }
            } catch (err) {
                console.error(`Failed to process ${filename}:`, err);
                continue;
            }
        }

        // Thumbnail destination
        const destThumbPath = path.join(PUBLIC_THUMBNAILS_DIR, newFilename);
        let shouldProcessThumb = !fs.existsSync(destThumbPath);
        if (!shouldProcessThumb) {
            try {
                const sourceStat = fs.statSync(sourcePath);
                const thumbStat = fs.statSync(destThumbPath);
                if (sourceStat.mtimeMs > thumbStat.mtimeMs) {
                    shouldProcessThumb = true;
                }
            } catch {
                shouldProcessThumb = true;
            }
        }

        if (shouldProcessThumb) {
            try {
                await sharp(sourcePath)
                    .resize({ width: 250, withoutEnlargement: true })
                    .webp({ quality: 60 })
                    .toFile(destThumbPath);
            } catch (err) {
                console.error(`Failed to process thumbnail for ${filename}:`, err);
            }
        }

        if (fs.existsSync(destPath)) {
            publicFiles.push(newFilename);
            
            // Only include in public-data if fully tagged
            if (metadata.title && metadata.explanation) {
                let dateMillis = metadata.createdAt || metadata.dateMillis;
                if (!dateMillis) {
                    try { dateMillis = fs.statSync(sourcePath).mtimeMs; } catch { dateMillis = 0; }
                }
                
                publicData[newFilename] = {
                    ...metadata,
                    dateMillis
                };
            }
            
            try { fileStats[newFilename] = fs.statSync(destPath).size; } catch { fileStats[newFilename] = 0; }
        }
    }

    // Unique-ify publicFiles and publicData/fileStats
    const uniqueFiles = Array.from(new Set(publicFiles));
    
    // Sort: Newest First
    uniqueFiles.sort((a, b) => {
        const timeA = publicData[a]?.dateMillis || 0;
        const timeB = publicData[b]?.dateMillis || 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.localeCompare(b);
    });

    const finalPublicJson = {
        files: uniqueFiles,
        data: publicData,
        fileStats: fileStats
    };

    fs.writeFileSync(PUBLIC_DATA_FILE, JSON.stringify(finalPublicJson, null, 2));

    console.log(`Public assets preparation complete. Exported ${uniqueFiles.length} images.`);
}

buildPublicGallery();
