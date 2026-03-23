import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, 'public/logo.webp');
const outputPath = path.join(__dirname, 'public/logo.ico');

async function convert() {
    console.log('Converting logo.webp to logo.ico...');
    
    // 1. Get PNG buffer at 256x256
    const pngBuffer = await sharp(inputPath)
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

    // 2. Create ICO header
    // Header: 6 bytes
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type: 1 = Icon
    header.writeUInt16LE(1, 4); // Count: 1 image

    // Entry: 16 bytes
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width (256 represented as 0)
    entry.writeUInt8(0, 1); // Height (256 represented as 0)
    entry.writeUInt8(0, 2); // Colors (0 = more than 256)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngBuffer.length, 8); // Size
    entry.writeUInt32LE(22, 12); // Offset (6 header + 16 entry)

    // 3. Write file
    const icoBuffer = Buffer.concat([header, entry, pngBuffer]);
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`Successfully created: ${outputPath}`);
}

convert().catch(console.error);
