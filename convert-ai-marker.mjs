import fs from 'fs';
import path from 'path';

const dataPath = './data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// We'll collect all filenames from all apply-batch-*.mjs files
const files = fs.readdirSync('.').filter(f => f.startsWith('apply-batch-') && f.endsWith('.mjs'));

let totalConverted = 0;
const markerTag = "משופר ע\"י AI";

for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const regex = /"([^"]+\.(?:jpg|png))":/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const filename = match[1];
        if (data[filename]) {
            // 1. Remove the public tag
            let currentTopicStr = data[filename].topic || "";
            let currentTags = currentTopicStr.split(',').map(t => t.trim()).filter(Boolean);
            
            if (currentTags.includes(markerTag)) {
                data[filename].topic = currentTags.filter(t => t !== markerTag).join(', ');
            }
            
            // 2. Add the private flag
            data[filename].isAIImproved = true;
            totalConverted++;
        }
    }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully moved AI marker from tag to private flag for ${totalConverted} images.`);
