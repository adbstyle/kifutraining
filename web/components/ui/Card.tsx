import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative rounded-[4px] bg-rasen-900 chalk-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
