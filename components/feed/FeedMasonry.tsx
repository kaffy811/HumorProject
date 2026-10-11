"use client";
import { useEffect, useRef } from "react";
export function FeedMasonry({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current!;
    let frame = 0;
    const layout = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cols =
            window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1,
          gap = 24,
          width = (root.clientWidth - (cols - 1) * gap) / cols,
          heights = Array(cols).fill(0);
        root.classList.add("is-positioned");
        Array.from(root.children).forEach((node, i) => {
          const el = node as HTMLElement,
            col = i % cols;
          el.style.width = `${width}px`;
          el.style.left = `${col * (width + gap)}px`;
          el.style.top = `${heights[col]}px`;
          heights[col] += el.getBoundingClientRect().height + gap;
        });
        root.style.height = `${Math.max(...heights, 0) - (root.children.length ? gap : 0)}px`;
      });
    };
    const observer = new ResizeObserver(layout);
    observer.observe(root);
    Array.from(root.children).forEach((el) => observer.observe(el));
    layout();
    window.addEventListener("resize", layout);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", layout);
      root.classList.remove("is-positioned");
      root.style.height = "";
    };
  }, [children]);
  return (
    <div className="feed-masonry" ref={ref}>
      {children}
    </div>
  );
}
