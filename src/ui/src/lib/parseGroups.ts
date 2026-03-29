/** Extract JSON group array from Claude's response (raw JSON, markdown, or wrapped). */
export function parseGroupsFromResponse(
  data: unknown,
): Array<{ name: string; documents: string[] }> {
  let text = '';
  if (typeof data === 'object' && data !== null && 'answer' in data) {
    text = String((data as { answer: string }).answer);
  } else if (typeof data === 'string') {
    text = data;
  } else {
    text = JSON.stringify(data);
  }

  // Try raw JSON parse first
  try {
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) return arr;
  } catch { /* not raw JSON */ }

  // Extract from markdown code block
  const codeBlock = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]); } catch { /* bad JSON in block */ }
  }

  // Try to find a JSON array anywhere in the text
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try { return JSON.parse(arrMatch[0]); } catch { /* not valid */ }
  }

  return [];
}
