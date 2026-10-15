"use client";
import { toPng } from "html-to-image";
export async function downloadPost(node: HTMLElement, id: string) {
  await document.fonts.ready;
  const host = document.createElement("div");
  host.className = "member-shell post-export-host";
  host.style.cssText =
    "position:fixed;left:0;top:0;transform:translateX(-10000px);width:480px;padding:12px;pointer-events:none;";
  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-post-controls]").forEach((el) => el.remove());
  clone.querySelectorAll(".post-caption").forEach((el) => {
    (el as HTMLElement).style.cssText =
      "display:block;overflow:visible;-webkit-line-clamp:unset;height:auto;min-height:0;max-height:none;";
  });
  const watermark = document.createElement("div");
  watermark.className = "post-watermark";
  const logo = document.createElement("span");
  logo.className = "comic-brand-symbol";
  logo.textContent = "h.";
  watermark.append(logo, document.createTextNode("THE HUMOR PROJECT"));
  clone.append(watermark);
  host.append(clone);
  document.body.append(host);
  try {
    await Promise.all(
      Array.from(host.querySelectorAll("img")).map(async (img) => {
        img.loading = "eager";
        await img.decode();
      }),
    );
    const data = await toPng(host, {
      pixelRatio: 2,
      backgroundColor: "#FFF4C2",
      cacheBust: true,
      skipFonts: true,
      // Keep the live clone offscreen, but render its exported copy at the origin.
      style: { position: "relative", transform: "none", left: "0", top: "0" },
    });
    const a = document.createElement("a");
    a.href = data;
    a.download = `humor-${id}.png`;
    a.click();
  } finally {
    host.remove();
  }
}
