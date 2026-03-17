import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
const master = JSON.parse(fs.readFileSync('./tags_master.json', 'utf-8'));

const normalizeTags = (topicStr) => {
    if (!topicStr) return [];
    const rawTags = topicStr.split(',').map(t => t.trim()).filter(Boolean);
    const result = new Set();
    
    rawTags.forEach(tag => {
        // Always keep the original tag if it's meaningful
        result.add(tag);
        
        // Also add the mapped general category if it exists
        if (master.mappings[tag]) {
            result.add(master.mappings[tag]);
        }
    });

    // Special case: if we have a sub-tag but not its major category yet, 
    // we let the autoTag rules handle it or we could add more mapping logic here.
    return Array.from(result);
};

// Keyword based auto-tagging
const autoTag = (item) => {
    const text = (item.title + ' ' + item.explanation).toLowerCase();
    const tags = new Set(normalizeTags(item.topic));

    const rules = {
        "חיות": ["כלב", "חתול", "חיה", "חיות", "דג", "ציפור", "גדי", "סוס", "גמל", "שור", "חמור", "פרה", "תרנגול", "נמלה", "כבש", "עכביש", "לוטרה", "באפלו", "לובסטר", "דינוזאור", "צב", "אריה", "תוכי", "ארנב", "שרקן"],
        "יהדות ומסורת": ["רב", "גמרא", "תורה", "בית כנסת", "תפילה", "מצווה", "חסיד", "יהודי", "הלכה", "ברסלב", "מדרש", "צדיק", "מצה", "חמץ", "ספירת העומר", "מירון", "ביתר", "תורני"],
        "אוכל ושתייה": ["אוכל", "מאכל", "שתיה", "מתוק", "חלב", "בשרי", "חלבי", "יין", "לחם", "עוגה", "ירקות", "פירות", "מרק", "פיסטוק", "פאי", "סופגניה", "בטטה", "אבטיח"],
        "חגים ומועדים": ["פסח", "סוכות", "ראש השנה", "חנוכה", "פורים", "שבועות", "יום כיפור", "צום", "חג", "מועד", "מצה", "חמץ", "מירון", "לג בעומר", "עצמאות"],
        "פוליטיקה ואקטואליה": ["שר", "ממשלה", "כנסת", "נשיא", "בחירות", "פוליטיקה", "ראש הממשלה", "ביבי", "נתניהו", "טראמפ", "איראן", "דגל", "חייל", "צה\"ל", "צבא", "משטרה", "מג\"ב", "קואליציה"],
        "פתגמים וביטויים": ["ביטוי", "פתגם", "משל", "מטבע לשון", "כפל לשון", "שיח מכבד"],
        "בית ויומיום": ["בית", "חדר", "רהיט", "בגד", "מטבח", "מקלחת", "ניקיון", "סלון", "קולב", "סבון", "מגבונים", "חולצה", "ציפית", "מיטה"],
        "טכנולוגיה ומדע": ["מחשב", "טלפון", "טכנולוגיה", "חשמל", "מכשיר", "אינטרנט", "אפל", "גוגל", "רכב", "מכונית", "רובוט", "נאס\"א", "אטומי", "גרעין"]
    };

    // Sub-tags generation: if a keyword is found, add it as a specific tag too
    for (const [category, keywords] of Object.entries(rules)) {
        keywords.forEach(kw => {
            if (text.includes(kw)) {
                tags.add(category);
                // Also add the specific keyword if it's "interesting" (longer than 2 chars)
                if (kw.length > 2) {
                    tags.add(kw);
                }
            }
        });
    }

    return Array.from(tags).join(', ');
};

const updatedData = {};
for (const [key, value] of Object.entries(data)) {
    updatedData[key] = {
        ...value,
        topic: autoTag(value)
    };
}

fs.writeFileSync('./data.json', JSON.stringify(updatedData, null, 2), 'utf-8');
console.log('data.json has been re-tagged and normalized.');
