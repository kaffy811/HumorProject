export function imageType(bytes: Uint8Array): string | null {
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) return "image/png";
  if(Buffer.from(bytes.slice(0,4)).toString()==="RIFF" && Buffer.from(bytes.slice(8,12)).toString()==="WEBP") return "image/webp";
  return null;
}
export function captionsFrom(value: unknown): string[] {
  const c = (value as {captions?:unknown})?.captions;
  if (!Array.isArray(c) || c.length!==4 || c.some(x=>typeof x!=="string" || x.trim().length<1 || x.length>240) || new Set(c.map(x=>typeof x==="string"?x.trim():x)).size!==4) throw new Error("Invalid captions");
  return c.map(x=>x.trim());
}

export function sameOrigin(request: Request): boolean {
  try { const origin = new URL(request.headers.get("origin") || "");
    return ["https:","http:"].includes(origin.protocol) && origin.host === request.headers.get("host");
  } catch { return false; }
}
