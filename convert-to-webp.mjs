/**
 * convert-to-webp.mjs
 * Converts logo.png, qrcode.png, and all gallery images to WebP.
 * Originals are NOT deleted — safe and reversible.
 * Run from the project root: node convert-to-webp.mjs
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'app', 'public');
const IMAGES_DIR = path.join(PUBLIC, 'images');
const BACKUP_DIR = path.join(__dirname, 'app', 'תמונות מקור');
const DATA_FILE = path.join(__dirname, 'data.json');

let metadata = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        metadata = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (e) {
        console.error('Error reading data.json:', e.message);
    }
}

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let totalOriginalBytes = 0;
let totalWebpBytes = 0;
let converted = 0;
let skipped = 0;
let errors = 0;

async function convertFile(inputPath, outputPath, options = {}) {
    const { quality = 82, lossless = false } = options;

    const inputStat = fs.statSync(inputPath);

    // Skip if output already exists and is newer
    if (fs.existsSync(outputPath)) {
        const outputStat = fs.statSync(outputPath);
        if (outputStat.mtimeMs >= inputStat.mtimeMs) {
            skipped++;
            return { skipped: true };
        }
    }

    try {
        sharp.cache(false); // Disable cache to prevent file locking issues
        totalOriginalBytes += inputStat.size;
        await sharp(inputPath)
            .webp({ quality, lossless })
            .toFile(outputPath);
            
        // Move original to backup folder after success
        if (fs.existsSync(inputPath)) {
            const fileName = path.basename(inputPath);
            const backupPath = path.join(BACKUP_DIR, fileName);
            
            // If file already exists in backup, append a suffix to avoid overwrite
            let finalBackupPath = backupPath;
            if (fs.existsSync(finalBackupPath)) {
                const ext = path.extname(fileName);
                const base = path.basename(fileName, ext);
                finalBackupPath = path.join(BACKUP_DIR, `${base}_${Date.now()}${ext}`);
            }
            
            fs.copyFileSync(inputPath, finalBackupPath);
            fs.unlinkSync(inputPath);
        }

        const outputStat = fs.statSync(outputPath);

        totalOriginalBytes += inputStat.size;
        totalWebpBytes += outputStat.size;
        converted++;

        const reduction = (((inputStat.size - outputStat.size) / inputStat.size) * 100).toFixed(1);
        const originalMB = (inputStat.size / 1024 / 1024).toFixed(2);
        const webpMB = (outputStat.size / 1024 / 1024).toFixed(2);
        console.log(`✓ ${path.basename(inputPath)} → ${path.basename(outputPath)} | ${originalMB}MB → ${webpMB}MB (-${reduction}%)`);
        return { success: true };
    } catch (err) {
        errors++;
        console.error(`✗ Error converting ${path.basename(inputPath)}: ${err.message}`);
        return { error: err.message };
    }
}

async function main() {
    console.log('🎨 Starting WebP conversion...\n');

    // 1. Convert logo.png
    const logoPng = path.join(PUBLIC, 'logo.png');
    const logoWebp = path.join(PUBLIC, 'logo.webp');
    if (fs.existsSync(logoPng)) {
        console.log('📌 Converting logo...');
        const res = await convertFile(logoPng, logoWebp, { quality: 90 });
        if (res && res.success && metadata['logo.png']) {
            metadata['logo.webp'] = { ...metadata['logo.png'] };
            delete metadata['logo.png'];
            fs.writeFileSync(DATA_FILE, JSON.stringify(metadata, null, 2));
        }
    }

    // 2. Convert qrcode.png (lossless to keep QR scannable)
    const qrPng = path.join(PUBLIC, 'qrcode.png');
    const qrWebp = path.join(PUBLIC, 'qrcode.webp');
    if (fs.existsSync(qrPng)) {
        console.log('📌 Converting QR code (lossless)...');
        const res = await convertFile(qrPng, qrWebp, { lossless: true });
        if (res && res.success && metadata['qrcode.png']) {
            metadata['qrcode.webp'] = { ...metadata['qrcode.png'] };
            delete metadata['qrcode.png'];
            fs.writeFileSync(DATA_FILE, JSON.stringify(metadata, null, 2));
        }
    }

    // 3. Convert all gallery images
    console.log('\n📌 Converting gallery images...');
    const files = fs.readdirSync(IMAGES_DIR);
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    console.log(`Found ${imageFiles.length} images to process.\n`);

    const BATCH_SIZE = 8;
    for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        const batch = imageFiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(async file => {
            const inputPath = path.join(IMAGES_DIR, file);
            const webpName = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            const outputPath = path.join(IMAGES_DIR, webpName);
            const isQualityPng = file.toLowerCase().endsWith('.png');
            
            const result = await convertFile(inputPath, outputPath, { quality: isQualityPng ? 85 : 82 });
            
            if (result && result.success) {
                // Synchronize metadata key in data.json
                if (metadata[file] && !metadata[webpName]) {
                    metadata[webpName] = { ...metadata[file] };
                    delete metadata[file];
                    return { updatedMetadata: true };
                }
            }
            return result;
        }));

        const anyMetadataUpdated = results.some(r => r && r.updatedMetadata);
        if (anyMetadataUpdated) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(metadata, null, 2));
        }

        if ((i + BATCH_SIZE) % 80 === 0 || i + BATCH_SIZE >= imageFiles.length) {
            console.log(`  Progress: ${Math.min(i + BATCH_SIZE, imageFiles.length)}/${imageFiles.length}`);
        }
    }

    // Summary
    const savedMB = ((totalOriginalBytes - totalWebpBytes) / 1024 / 1024).toFixed(1);
    const savedPct = totalOriginalBytes > 0
        ? (((totalOriginalBytes - totalWebpBytes) / totalOriginalBytes) * 100).toFixed(1)
        : 0;
    const origTotalMB = (totalOriginalBytes / 1024 / 1024).toFixed(1);
    const webpTotalMB = (totalWebpBytes / 1024 / 1024).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Done! Converted: ${converted} | Skipped (up-to-date): ${skipped} | Errors: ${errors}`);
    console.log(`📦 Original total: ${origTotalMB}MB → WebP total: ${webpTotalMB}MB`);
    console.log(`💾 Saved: ${savedMB}MB (${savedPct}% reduction)`);
    console.log('='.repeat(60));
    console.log('\n✅ Originals moved to "app/תמונות מקור". Update code references to use .webp extensions.');
}

main().catch(console.error);
