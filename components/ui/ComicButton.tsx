import type { ButtonHTMLAttributes } from "react";
export function ComicButton({
  className = "",
  secondary = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { secondary?: boolean }) {
  return (
    <button
      {...props}
      className={`comic-button ${secondary ? "is-secondary" : ""} ${className}`}
    />
  );
}
