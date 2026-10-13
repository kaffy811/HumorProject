/* eslint-disable @next/next/no-img-element -- Local crop preview. */
"use client";
import { useEffect, useState } from "react";
export function AvatarCropper({
  file,
  onCrop,
}: {
  file: File;
  onCrop: (crop: { x: number; y: number; size: number }) => void;
}) {
  const [url] = useState(() => URL.createObjectURL(file)),
    [dimensions, setDimensions] = useState({ width: 0, height: 0 }),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const size = Math.floor(Math.min(dimensions.width, dimensions.height) / zoom),
    left = Math.round(((dimensions.width - size) * x) / 100),
    top = Math.round(((dimensions.height - size) * y) / 100);
  useEffect(() => {
    if (size > 0) onCrop({ x: left, y: top, size });
  }, [size, left, top, onCrop]);
  return (
    <div className="avatar-cropper">
      <div className="avatar-crop-square">
        {url && (
          <img
            src={url}
            alt="Square avatar crop preview"
            onLoad={(e) =>
              setDimensions({
                width: e.currentTarget.naturalWidth,
                height: e.currentTarget.naturalHeight,
              })
            }
            style={
              size
                ? {
                    width: `${(dimensions.width / size) * 100}%`,
                    height: `${(dimensions.height / size) * 100}%`,
                    left: `${(-left / size) * 100}%`,
                    top: `${(-top / size) * 100}%`,
                  }
                : { width: "100%" }
            }
          />
        )}
      </div>
      <label>
        Zoom
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </label>
      <label>
        Horizontal position
        <input
          type="range"
          min="0"
          max="100"
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
        />
      </label>
      <label>
        Vertical position
        <input
          type="range"
          min="0"
          max="100"
          value={y}
          onChange={(e) => setY(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
