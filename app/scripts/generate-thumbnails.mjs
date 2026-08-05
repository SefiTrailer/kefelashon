import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_IMAGES_DIR = path.resolve(__dirname, '../public/images');
const PUBLIC_THUMBNAILS_DIR = path.resolve(__dirname, '../public/thumbnails');

if (!fs.existsSync(PUBLIC_THUMBNAILS_DIR)) {
    fs.mkdirSync(PUBLIC_THUMBNAILS_DIR, { recursive: true });
}

async function generateThumbnails() {
    console.log('Generating high-performance thumbnails (250px WebP)...');
    
    if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
        console.error('Public images directory does not exist:', PUBLIC_IMAGES_DIR);
        return;
    }

    const files = fs.readdirSync(PUBLIC_IMAGES_DIR).filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    console.log(`Found ${files.length} images to process for thumbnails.`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in batches of 20 to maximize speed without overloading memory
    const BATCH_SIZE = 20;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (filename) => {
            const sourcePath = path.join(PUBLIC_IMAGES_DIR, filename);
            const thumbFilename = filename.replace(/\.(png|jpg|jpeg|webp)$/i, '.webp');
            const destPath = path.join(PUBLIC_THUMBNAILS_DIR, thumbFilename);

            let shouldProcess = !fs.existsSync(destPath);
            if (!shouldProcess) {
                try {
                    const sourceStat = fs.statSync(sourcePath);
                    const destStat = fs.statSync(destPath);
                    if (sourceStat.mtimeMs > destStat.mtimeMs) {
                        shouldProcess = true;
                    }
                } catch {
                    shouldProcess = true;
                }
            }

            if (!shouldProcess) {
                skippedCount++;
                return;
            }

            try {
                await sharp(sourcePath)
                    .resize({ width: 250, withoutEnlargement: true })
                    .webp({ quality: 60 })
                    .toFile(destPath);
                processedCount++;
            } catch (err) {
                console.error(`Failed to create thumbnail for ${filename}:`, err);
                errorCount++;
            }
        }));

        if ((i + BATCH_SIZE) % 200 === 0 || i + BATCH_SIZE >= files.length) {
            console.log(`Progress: ${Math.min(i + BATCH_SIZE, files.length)} / ${files.length} images...`);
        }
    }

    console.log(`Thumbnails generation complete: ${processedCount} generated, ${skippedCount} up to date, ${errorCount} errors.`);
}

generateThumbnails();
