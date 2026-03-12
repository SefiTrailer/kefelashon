// Native fetch is available in Node 25


async function testSave() {
    const payload = {
        filename: "התאפסת.png",
        title: "התאפסת?",
        explanation: "בתמונה נראה שעון עצר העשוי כולו מפסטה, עם הכיתוב 'EAT A PASTA' ושאלת הגיחוך 'התאפסת?!?' (הנשמעת כמו 'התאפס פסטה?!')",
        topic: "פסטה-טסט",
        isApproved: true
    };

    console.log('Sending payload:', JSON.stringify(payload, null, 2));

    try {
        const res = await fetch('http://localhost:3088/api/metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testSave();
