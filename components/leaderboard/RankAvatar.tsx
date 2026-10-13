/* eslint-disable @next/next/no-img-element -- Private member image endpoints. */
"use client";
import { useState } from "react";
export function RankAvatar({
  name,
  src,
}: {
  name: string;
  src: string | null;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return src && failed !== src ? (
    <img
      className="rank-avatar"
      src={src}
      alt=""
      width={96}
      height={96}
      loading="lazy"
      onError={() => setFailed(src)}
    />
  ) : (
    <span className="rank-avatar rank-avatar-fallback" aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
