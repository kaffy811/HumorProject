/* eslint-disable @next/next/no-img-element -- Local selected photo preview. */
"use client";
import { useEffect, useState } from "react";
export function AvatarPreview({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <img src={url} alt="Your selected profile photo" width={96} height={96} />;
}
