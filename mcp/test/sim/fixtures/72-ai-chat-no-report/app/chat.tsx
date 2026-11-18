export async function ask(messages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'gpt-4o-mini', messages }) });
  return r.json();
}
