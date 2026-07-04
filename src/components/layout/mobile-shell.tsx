import { cn } from "@/lib/utils";

interface MobileShellProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileShell({ children, className }: MobileShellProps) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-midnight">
      <div
        className={cn(
          "relative flex min-h-dvh w-full max-w-[400px] flex-col bg-midnight shadow-[0_0_80px_rgba(0,0,0,0.6)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
