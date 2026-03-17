import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

const targets = Object.keys(data).filter(filename => {
    const meta = data[filename];
    // Target: Approved, NOT AI-improved, NOT AI-added
    return meta.isApproved === true && 
           meta.isAIImproved !== true && 
           meta.isAIAdded !== true && 
           meta.explanation && 
           meta.explanation.trim().length > 0;
});

console.log(`Found ${targets.length} human-written, approved images with explanations.`);

const sample = targets.slice(0, 5);
console.log("\nSample Targets:");
sample.forEach(t => console.log(`- ${t}: ${data[t].title}`));

// We will process these in a separate step to generate suggestions
fs.writeFileSync('./suggestion-targets.json', JSON.stringify(targets, null, 2), 'utf-8');
