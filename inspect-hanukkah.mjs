import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

const imagesWithHanukkah = [];
const shortExplanations = [];

for (const [filename, item] of Object.entries(data)) {
    const topics = item.topic ? item.topic.split(',').map(t => t.trim()) : [];
    if (topics.includes('חנוכה')) {
        imagesWithHanukkah.push({
            filename,
            title: item.title,
            explanation: item.explanation,
            topic: item.topic
        });
    }

    if (item.explanation && item.explanation.length < 50) {
        shortExplanations.push({
            filename,
            title: item.title,
            explanation: item.explanation
        });
    }
}

console.log(`Found ${imagesWithHanukkah.length} images with Hanukkah tag.`);
console.log(`Found ${shortExplanations.length} images with short explanations.`);

console.log('\n--- All Short Explanations ---');
shortExplanations.forEach(img => {
    console.log(`File: ${img.filename}`);
    console.log(`Title: ${img.title}`);
    console.log(`Explanation: ${img.explanation}`);
    console.log('---');
});
