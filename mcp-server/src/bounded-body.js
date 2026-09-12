// Bound both bytes and elapsed time, including peers that stop sending data.
export async function readBoundedText(message, limit, timeoutMs = 10_000) {
  if (Number(message.headers.get('content-length')) > limit) throw new Error('request_too_large');
  if (!message.body) return '';
  const reader = message.body.getReader();
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException('Body read timed out', 'AbortError'));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expiry]);
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        void reader.cancel().catch(() => {});
        throw new Error('request_too_large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } finally { clearTimeout(timer); reader.releaseLock(); }
}
