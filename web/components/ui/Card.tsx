import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[4px] bg-surface-container-low border-[1.5px] border-outline",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
