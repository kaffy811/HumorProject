// Preview writes must never fall back to the production tables.
export function dataSchema(): "public" | "humor_preview" {
  const schema = process.env.HUMOR_DATA_SCHEMA;
  if (process.env.VERCEL_ENV === "preview" && schema !== "humor_preview")
    throw new Error("Preview database isolation is not configured.");
  if (process.env.VERCEL_ENV === "production" && schema && schema !== "public")
    throw new Error("Production cannot use preview data.");
  if (schema && !["public", "humor_preview"].includes(schema))
    throw new Error("Invalid data schema.");
  return schema === "humor_preview" ? "humor_preview" : "public";
}
export function storageBucket(name: string) {
  return dataSchema() === "humor_preview"
    ? name.replace(/^humor-/, "humor-preview-")
    : name;
}
