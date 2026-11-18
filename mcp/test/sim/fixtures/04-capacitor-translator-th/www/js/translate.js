export async function translate(text) { const r = await fetch('https://api.thaitalk.app/v1/translate', { method: 'POST', body: JSON.stringify({ text, from: 'th', to: 'ko' }) }); return r.json(); }
