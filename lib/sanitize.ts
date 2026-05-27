export function isInternalKey(key: string) {
  return /^(thinking_|reasoning_|internal_)/.test(key);
}

export function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (isInternalKey(k)) continue;
      if (k === 'assistant' && (typeof v === 'object' || Array.isArray(v))) {
        if (Array.isArray(v)) {
          out[k] = v.map((m: any) => ({ role: m.role, content: m.content }));
        } else {
          out[k] = { role: (v as any).role, content: (v as any).content };
        }
        continue;
      }
      out[k] = sanitizeObject(v);
    }
    return out;
  }
  return obj;
}

export function ensureInputIds(payload: any): any {
  if (!payload || !payload.input) return payload;
  if (!Array.isArray(payload.input)) return payload;

  payload.input = payload.input.map((item: any) => {
    if (item && typeof item === 'object') {
      const hasId = typeof item.id !== 'undefined' && item.id !== null && item.id !== '';
      if (!hasId || (hasId && !/^rs/.test(String(item.id)))) {
        const newItem = { ...item };
        newItem.id = `rs_${Math.random().toString(36).slice(2,10)}`;
        return newItem;
      }
    }
    return item;
  });
  return payload;
}

export function sanitizePayload(payload: any): any {
  try {
    const cleaned = sanitizeObject(payload);
    return ensureInputIds(cleaned);
  } catch (e) {
    return payload;
  }
}
