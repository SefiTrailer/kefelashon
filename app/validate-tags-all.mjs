import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const DATA_FILE = path.resolve(__dirname, '../data.json');
const MASTER_TAGS_FILE = path.resolve(__dirname, '../tags_master.json');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not defined in .env');
    process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

// Load data and master tags
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const master = JSON.parse(fs.readFileSync(MASTER_TAGS_FILE, 'utf-8'));
const categories = master.categories;

const SYSTEM_PROMPT = `
You are an expert in the Hebrew language and "Kefel Lashon" (pun/wordplay) images.
Your task is to VALIDATE and REFINE the tags (topics) for a given image entry.

GUIDELINES (based on the ai-image-tagging skill):
1. **Tag Limit:** Each image must have up to 5 tags maximum.
2. **Reviewing Existing Tags:** 
   - Verify: Ensure tags fit the image's name and explanation.
   - Remove: Discard irrelevant, incorrect, or redundant tags.
   - Enforce Limit: If there are more than 5 tags, keep only the top 5 most descriptive and accurate tags.
3. **Consistency Guidelines:**
   - **Hebrew Only:** All tags must be in Hebrew.
   - **Format:** Return a single comma-separated string (e.g., "חיות, כלבים, פוליטיקה").
   - **Hierarchy:** Include at least one broad category (if appropriate) from the provided pool and some specific tags.
4. **Pool of Categories:** Prefer using these broad categories if they fit:
   ${categories.join(', ')}

Return ONLY the comma-separated string of validated tags. Do not include any other text or Markdown.
`;

async function validateEntry(title, explanation, currentTopic, retries = 3) {
    const prompt = `Title: ${title}\nExplanation: ${explanation}\nCurrent Tags: ${currentTopic}\n\nPlease validate and refine these tags based on the guidelines.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.2,
            }
        });
        
        const text = response.text.trim();
        
        // Basic sanitization: remove quotes if the AI adds them
        return text.replace(/^"|"$/g, '').trim();
    } catch (e) {
        if (retries > 0 && (e.message.includes('429') || e.message.includes('Quota'))) {
            console.log(`⚠️ Quota exceeded for "${title}". Waiting 15s... (${retries} retries left)`);
            await new Promise(r => setTimeout(r, 15000));
            return validateEntry(title, explanation, currentTopic, retries - 1);
        }
        console.error(`Error for ${title}:`, e.message);
        return null;
    }
}

async function main() {
    const entries = Object.entries(data);
    const limitArg = process.argv.find(a => a.startsWith('--limit='));
    const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

    console.log(`Starting validation for ${Math.min(entries.length, limit)} entries...`);
    
    let processed = 0;
    let updatedCount = 0;

    for (const [filename, item] of entries) {
        if (processed >= limit) break;

        // Skip if already validated (optional, but good for resuming)
        if (item.isValidated) {
            processed++;
            continue;
        }

        if (!item.title || !item.explanation) {
            processed++;
            continue;
        }

        console.log(`[${processed + 1}/${entries.length}] Validating: ${item.title}`);
        
        const originalTags = item.topic || "";
        const validatedTags = await validateEntry(item.title, item.explanation, originalTags);

        if (validatedTags) {
            if (validatedTags !== originalTags) {
                console.log(`   Before: ${originalTags}`);
                console.log(`   After:  ${validatedTags}`);
                data[filename].topic = validatedTags;
                updatedCount++;
            }
            data[filename].isValidated = true;
        }

        processed++;

        // Auto-save every 20 entries
        if (processed % 20 === 0) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
            console.log('💾 Progress saved to data.json');
        }

        // Delay to respect rate limits (e.g., 6 seconds per request)
        await new Promise(r => setTimeout(r, 6000));
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n✅ Finished! Processed ${processed} entries. Updated ${updatedCount} entries.`);
}

main();
