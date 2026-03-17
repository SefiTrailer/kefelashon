import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));

// ─────────────────────────────────────────────────────────────────────
// BETTER KEYWORD MATCHER - word-based, not substring
// ─────────────────────────────────────────────────────────────────────
function containsWord(text, word) {
  if (!text) return false;
  // Hebrew word boundary: space, start/end, or punctuation
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[\\s,\\.\"\\(\\)'])${escaped}($|[\\s,\\.\"\\(\\)'])`, '');
  return re.test(text);
}

function containsAny(text, words) {
  return words.some(w => containsWord(text, w));
}

// ─────────────────────────────────────────────────────────────────────
// KEYWORD → TAG RULES
// ─────────────────────────────────────────────────────────────────────
const RULES = [
  // --- Animals ---
  { keywords: ['כלב', 'כלבים'], tags: ['חיות', 'כלבים'] },
  { keywords: ['חתול', 'חתולה', 'חתולים'], tags: ['חיות', 'חתולים'] },
  { keywords: ['סוס', 'סוסה', 'סוסים', 'סוסוס'], tags: ['חיות', 'סוסים'] },
  { keywords: ['חמור', 'חמורים'], tags: ['חיות', 'חמורים'] },
  { keywords: ['פרה', 'פרות', 'שור', 'שוורים', 'עגל'], tags: ['חיות', 'בקר'] },
  { keywords: ['כבש', 'כבשה', 'גדי', 'עז', 'עיזים', 'צאן'], tags: ['חיות', 'צאן'] },
  { keywords: ['אריה', 'אריות', 'לביא'], tags: ['חיות', 'אריות'] },
  { keywords: ['פיל', 'פילים'], tags: ['חיות', 'פילים'] },
  { keywords: ['דג', 'דגים', 'דגה', 'דגה'], tags: ['חיות', 'דגים'] },
  { keywords: ['ציפור', 'ציפורים', 'עורב', 'יונה', 'נשר', 'תרנגול', 'ברווז', 'פרגית', 'פינגווין', 'לבלר', 'טווס', 'טווסוס'], tags: ['חיות', 'עופות'] },
  { keywords: ['נמר', 'חתולוטרה', 'ג׳ירף', 'ג\'ירף', 'אוראנגטן'], tags: ['חיות', 'חיות בר'] },
  { keywords: ['נמלה', 'נמלים', 'נמלמה', 'עכביש', 'עכבש', 'דבורה', 'דבורים', 'פרפר', 'חגב'], tags: ['חיות', 'חרקים'] },
  { keywords: ['צב', 'לטאה', 'נחש', 'תנין', 'דינוזאור', 'גדינוזאור'], tags: ['חיות', 'זוחלים'] },
  { keywords: ['למה', 'אלפקה', 'עלמה ולמה', 'נמלמה'], tags: ['חיות', 'למה'] },
  { keywords: ['דב', 'דבים'], tags: ['חיות', 'דבים'] },

  // --- Food & Drink ---
  { keywords: ['לחם', 'פיתה', 'חלה', 'חלות'], tags: ['אוכל ושתייה', 'לחם ומאפים'] },
  { keywords: ['גלידה', 'ארטיק', 'שוקולד', 'ממתק', 'סוכריה', 'לקקן', 'ממתקים'], tags: ['אוכל ושתייה', 'ממתקים'] },
  { keywords: ['יין', 'ענבים', 'כרם'], tags: ['אוכל ושתייה', 'יין וענבים'] },
  { keywords: ['בירה', 'אלכוהול', 'ויסקי', 'וודקה', 'משקה חריף'], tags: ['אוכל ושתייה', 'משקאות חריפים'] },
  { keywords: ['קפה', 'תה'], tags: ['אוכל ושתייה', 'משקאות'] },
  { keywords: ['ירק', 'ירקות', 'בצל', 'גזר', 'עגבניה', 'חסה', 'כרוב'], tags: ['אוכל ושתייה', 'ירקות'] },
  { keywords: ['פרי', 'תפוח', 'אגס', 'בננה', 'תותים', 'תפוז'], tags: ['אוכל ושתייה', 'פירות'] },
  { keywords: ['חלב', 'גבינה', 'יוגורט', 'חמאה', 'קוטג'], tags: ['אוכל ושתייה', 'מוצרי חלב'] },
  { keywords: ['מרק', 'מנה', 'צלחת'], tags: ['אוכל ושתייה'] },

  // --- Jewish & Religion ---
  { keywords: ['תפילה', 'תפיליין', 'ציצית', 'טלית', 'כיפה', 'מזוזה', 'שופר', 'לולב', 'אתרוג'], tags: ['יהדות ומסורת', 'תפילה ומצוות'] },
  { keywords: ['שבת', 'קידוש', 'הבדלה', 'ניגון'], tags: ['יהדות ומסורת', 'שבת'] },
  { keywords: ['תורה', 'ישיבה', 'חדר', 'גמרא'], tags: ['יהדות ומסורת', 'תורה ולימוד'] },
  { keywords: ['רב', 'פוסק', 'חסיד', 'חרדי', 'צדיק', 'גדול'], tags: ['יהדות ומסורת', 'רבנים'] },
  { keywords: ['כשר', 'כשרות'], tags: ['יהדות ומסורת', 'כשרות'] },
  { keywords: ['ברסלב', 'נחמן'], tags: ['יהדות ומסורת', 'ברסלב'] },

  // --- Holidays ---
  { keywords: ['פסח', 'מצה', 'חמץ', 'הגדה', 'ליל הסדר', 'סדר פסח'], tags: ['חגים ומועדים', 'פסח'] },
  { keywords: ['חנוכה', 'חנוכייה', 'סביבון', 'סופגניה', 'לביבה'], tags: ['חגים ומועדים', 'חנוכה'] },
  { keywords: ['פורים', 'אסתר', 'המן', 'תחפושת', 'רעשן'], tags: ['חגים ומועדים', 'פורים'] },
  { keywords: ['ראש השנה', 'שנה טובה'], tags: ['חגים ומועדים', 'ראש השנה'] },
  { keywords: ['יום כיפור', 'כיפור', 'צום'], tags: ['חגים ומועדים', 'יום כיפור'] },
  { keywords: ['סוכות', 'סוכה', 'ארבעת המינים'], tags: ['חגים ומועדים', 'סוכות'] },
  { keywords: ['שבועות', 'מתן תורה'], tags: ['חגים ומועדים', 'שבועות'] },
  { keywords: ['לג בעומר', 'מדורה'], tags: ['חגים ומועדים', 'לג בעומר'] },
  { keywords: ['יום העצמאות'], tags: ['חגים ומועדים', 'יום העצמאות'] },

  // --- Army & Security ---
  { keywords: ['חייל', 'חיילים', 'מילואים', 'קרב', 'מלחמה'], tags: ['צבא וביטחון'] },
  { keywords: ['צה"ל', 'צבא', 'צה\'ל'], tags: ['צבא וביטחון', 'צה"ל'] },
  { keywords: ['נשק', 'רובה', 'אקדח'], tags: ['צבא וביטחון', 'נשק'] },
  { keywords: ['טיל', 'טילים', 'פצצה', 'כיפת ברזל'], tags: ['צבא וביטחון', 'ביטחון'] },
  { keywords: ['משטרה', 'שוטר', 'שוטרים'], tags: ['מקצועות ועבודה', 'משטרה'] },
  { keywords: ['חמאס', 'טרור', 'איראן'], tags: ['צבא וביטחון', 'ביטחון'] },

  // --- Politics ---
  { keywords: ['ביבי', 'נתניהו', 'קואליציה', 'אופוזיציה', 'כנסת'], tags: ['פוליטיקה ואקטואליה', 'פוליטיקה ישראלית'] },
  { keywords: ['טראמפ', 'ביידן'], tags: ['פוליטיקה ואקטואליה', 'פוליטיקה עולמית'] },
  { keywords: ['בחירות', 'הצבעה'], tags: ['פוליטיקה ואקטואליה', 'בחירות'] },
  { keywords: ['ירושלים'], tags: ['פוליטיקה ואקטואליה', 'ירושלים'] },
  { keywords: ['מחאה', 'הפגנה'], tags: ['פוליטיקה ואקטואליה', 'אקטואליה'] },

  // --- Music & Culture ---
  { keywords: ['ניסים בלאק', 'אייל גולן', 'עומר אדם', 'ליהיא לפיד'], tags: ['מוזיקה ותרבות', 'זמרים'] },
  { keywords: ['שיר', 'שירה', 'זמר', 'מנגן', 'גיטרה', 'פסנתר', 'מנגינה'], tags: ['מוזיקה ותרבות', 'מוזיקה'] },
  { keywords: ['סרט', 'קולנוע', 'נטפליקס', 'פילם'], tags: ['מוזיקה ותרבות', 'קולנוע'] },
  { keywords: ['ציור', 'אמנות', 'אומנות', 'גרפיטי', 'מונה ליזה'], tags: ['מוזיקה ותרבות', 'אמנות'] },
  { keywords: ['ספר', 'ספרות', 'קריאה', 'ספרייה'], tags: ['מוזיקה ותרבות', 'ספרות'] },
  { keywords: ['טלוויזיה', 'חדשות', 'תוכנית טלוויזיה'], tags: ['מוזיקה ותרבות', 'טלוויזיה'] },
  
  // --- Tech ---
  { keywords: ['גוגל', 'אפל', 'פייסבוק', 'אינסטגרם', 'יוטיוב', 'וואטסאפ', 'טיקטוק'], tags: ['טכנולוגיה ומדע', 'רשתות חברתיות'] },
  { keywords: ['מחשב', 'לפטופ', 'אינטרנט', 'בינה מלאכותית', 'רובוט'], tags: ['טכנולוגיה ומדע', 'מחשבים'] },
  { keywords: ['רכב', 'מכונית', 'אוטובוס', 'אופנוע'], tags: ['טכנולוגיה ומדע', 'כלי רכב'] },
  { keywords: ['חשמל', 'מנורה', 'שקע', 'סוללה'], tags: ['טכנולוגיה ומדע', 'חשמל'] },
  { keywords: ['מדען', 'ניסוי', 'מעבדה'], tags: ['טכנולוגיה ומדע', 'מדע'] },

  // --- Sports ---
  { keywords: ['כדורגל', 'כדורסל', 'טניס', 'שחייה', 'ריצה', 'אתלטיקה', 'אולימפיאדה'], tags: ['ספורט'] },
  { keywords: ['אופניים', 'אופני'], tags: ['ספורט', 'אופניים'] },

  // --- Nature: SPECIFIC only - no vague 'ים' 'הר' that match inside words ---
  { keywords: ['פרח', 'פרחים', 'כלנית', 'ורד', 'ורדים', 'צמח', 'צמחים'], tags: ['טבע וצומח', 'פרחים וצמחים'] },
  { keywords: ['יער', 'שדה', 'גינה'], tags: ['טבע וצומח', 'גינה ויער'] },
  { keywords: ['שמש', 'ירח', 'כוכבים', 'עננים', 'שחקים'], tags: ['טבע וצומח', 'שמיים'] },
  { keywords: ['מדבר', 'נהר', 'אגם', 'הרים', 'ים המלח'], tags: ['טבע וצומח', 'נוף'] },

  // --- Home & Daily ---
  { keywords: ['כלי מטבח', 'מחבת', 'סיר', 'מזלג', 'כף', 'מטבח'], tags: ['בית ויומיום', 'כלי מטבח'] },
  { keywords: ['חליפה', 'שמלה', 'חולצה', 'מכנסיים', 'נעליים', 'כובע', 'ביגוד'], tags: ['בית ויומיום', 'ביגוד'] },
  { keywords: ['מיטה', 'שינה', 'כרית', 'שמיכה'], tags: ['בית ויומיום', 'שינה'] },
  { keywords: ['ניקיון', 'כביסה', 'שטיפה', 'מגב', 'מגבון'], tags: ['בית ויומיום', 'ניקיון'] },
  { keywords: ['קניות', 'סופרמרקט'], tags: ['בית ויומיום', 'קניות'] },

  // --- Family & Children ---
  { keywords: ['ילד', 'ילדים'], tags: ['משפחה וילדים', 'ילדים'] },
  { keywords: ['תינוק', 'תינוקות'], tags: ['משפחה וילדים', 'תינוקות'] },
  { keywords: ['הורים', 'אמא', 'אב', 'סבא', 'סבתא', 'נכד'], tags: ['משפחה וילדים', 'משפחה'] },
  { keywords: ['בית ספר', 'מורה', 'כיתה'], tags: ['משפחה וילדים', 'חינוך'] },

  // --- Professions ---
  { keywords: ['רופא', 'רופאים', 'בית חולים', 'מרפאה', 'ניתוח', 'רפואה'], tags: ['מקצועות ועבודה', 'רפואה'] },
  { keywords: ['עורך דין', 'שופט', 'בית משפט'], tags: ['מקצועות ועבודה', 'משפט'] },
  { keywords: ['בנייה', 'קבלן', 'אדריכל'], tags: ['מקצועות ועבודה', 'בנייה'] },
  { keywords: ['עסק', 'חברה', 'מנכ"ל', 'שכר', 'משכורת'], tags: ['מקצועות ועבודה', 'עסקים'] },
  { keywords: ['כסף', 'מטבע', 'בנק', 'מיסים', 'מחיר', 'ריבית', 'כלכלה', 'מניה'], tags: ['מקצועות ועבודה', 'כלכלה וכספים'] },
  { keywords: ['דירה', 'שכירות', 'משכנתא'], tags: ['מקצועות ועבודה', 'נדל"ן'] },

  // --- Emotions & Traits ---
  { keywords: ['בוש', 'בושה', 'מביך'], tags: ['רגשות ותכונות', 'בושה'] },
  { keywords: ['עצוב', 'בכי', 'בכה', 'דמעות'], tags: ['רגשות ותכונות', 'עצב'] },
  { keywords: ['שמחה', 'שמח'], tags: ['רגשות ותכונות', 'שמחה'] },
  { keywords: ['כעס', 'זעם'], tags: ['רגשות ותכונות', 'כעס'] },
  { keywords: ['גאוה', 'גאה'], tags: ['רגשות ותכונות', 'גאוה'] },
  { keywords: ['משוגע', 'מטורף', 'שוטה'], tags: ['רגשות ותכונות', 'הומור'] },

  // --- Wordplay meta tags ---
  { keywords: ['כפל לשון', 'משחק מילים', 'לשון נופל על לשון'], tags: ['מילים ומשחקי לשון'] },
];

// Tags to REMOVE (bad, too generic)
const REMOVE_TAGS = new Set([
  'ביטוי', 'בית', 'חיה', 'פתגם', 'משל', 'שמיעתי', 'מטבע לשון', 'כפל לשון',
  'עיצבון', 'חכמה', 'תעודה', 'שיח מכבד', 'קשרים', 'פרצופים'
]);

function getTagsFromText(text) {
  if (!text) return [];
  const added = new Set();
  RULES.forEach(rule => {
    if (containsAny(text, rule.keywords)) {
      rule.tags.forEach(t => added.add(t));
    }
  });
  return [...added];
}

// Reset data.json to a clean state first by removing leftover bad tags
// Then re-apply properly
let changed = 0;
for (const [filename, meta] of Object.entries(data)) {
  const fullText = `${filename.replace('.jpg', '')} ${meta.title || ''} ${meta.explanation || ''}`;
  const existingTags = new Set((meta.topic || '').split(',').map(t => t.trim()).filter(Boolean));
  
  let newTags = new Set();
  
  // Keep existing valid tags, remove bad ones
  for (const tag of existingTags) {
    if (!REMOVE_TAGS.has(tag)) {
      newTags.add(tag);
    }
  }
  
  // Remove overly-broad 'נוף' and 'טבע וצומח' that were incorrectly mass-added
  newTags.delete('נוף');
  // Only keep 'טבע וצומח' if there's relevant content
  if (!containsAny(fullText, ['פרח', 'פרחים', 'כלנית', 'ורד', 'צמח', 'יער', 'שדה', 'גינה', 'מדבר', 'שמש', 'ירח', 'שחקים', 'עננים', 'שמיים'])) {
    newTags.delete('טבע וצומח');
    newTags.delete('נוף');
    newTags.delete('גינה ויער');
    newTags.delete('פרחים וצמחים');
    newTags.delete('שמיים');
  }
  
  // Add targeted tags from keyword analysis
  const suggested = getTagsFromText(fullText);
  for (const t of suggested) {
    newTags.add(t);
  }
  
  // Also remove leftover bad specific tags
  newTags.delete('שמיעתי');
  newTags.delete('חיה');
  newTags.delete('משל');
  newTags.delete('ביטוי');
  newTags.delete('בית');
  newTags.delete('פתגם');

  const newTopicStr = [...newTags].join(', ');
  if (newTopicStr !== (meta.topic || '')) {
    data[filename].topic = newTopicStr;
    changed++;
  }
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf-8');
console.log(`Done! Updated ${changed} images.`);

// Show top tags after cleanup
const allTags = {};
for (const m of Object.values(data)) {
  if (m.topic) m.topic.split(',').forEach(t => {
    const tag = t.trim();
    if (tag) allTags[tag] = (allTags[tag] || 0) + 1;
  });
}
const sorted = Object.entries(allTags).sort((a, b) => b[1] - a[1]);
console.log('Total distinct tags:', sorted.length);
console.log('Top 40:', sorted.slice(0,40).map(([t,c]) => `${c} ${t}`).join('\n'));
