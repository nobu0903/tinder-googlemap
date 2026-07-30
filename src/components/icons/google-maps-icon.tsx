import { cn } from "@/lib/utils";

interface GoogleMapsIconProps {
  className?: string;
}

/** Simplified Maps pin — shared by Collection CTA and More Info. */
export function GoogleMapsIcon({ className }: GoogleMapsIconProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-8 shrink-0", className)}
      aria-hidden
    >
      <circle cx="20" cy="20" r="20" fill="white" />
      <path
        fill="#EA4335"
        d="M20 8c-5.52 0-10 4.48-10 10 0 7.5 10 18 10 18s10-10.5 10-18c0-5.52-4.48-10-10-10z"
      />
      <circle cx="20" cy="18" r="3.5" fill="#B31412" />
    </svg>
  );
}
