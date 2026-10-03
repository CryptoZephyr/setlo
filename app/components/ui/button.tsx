"use client";

import Link from "next/link";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "./cn";

export const button = tv({
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-medium transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 disabled:opacity-50",
  variants: {
    intent: {
      primary: "bg-brand text-brand-contrast hover:bg-brand-hover data-[hovered]:bg-brand-hover data-[pressed]:bg-brand-hover",
      secondary: "border border-border-strong bg-surface text-text hover:bg-surface-muted data-[hovered]:bg-surface-muted",
      ghost: "text-text hover:bg-surface-muted data-[hovered]:bg-surface-muted",
      danger: "border border-bad/30 bg-surface text-bad hover:bg-bad-soft data-[hovered]:bg-bad-soft",
      onPhoto: "bg-bg text-text hover:bg-white",
    },
    size: { md: "", sm: "min-h-9 px-3 text-sm", lg: "min-h-12 px-6 text-base" },
    full: { true: "w-full" },
  },
  defaultVariants: { intent: "primary", size: "md" },
});

type Variants = VariantProps<typeof button>;

export function Button({ intent, size, full, className, pending, children, ...props }: AriaButtonProps & Variants & { className?: string; pending?: boolean }) {
  return (
    <AriaButton {...props} isDisabled={props.isDisabled || pending} className={cn(button({ intent, size, full }), className)}>
      {(state) => (
        <>
          {pending && <Spinner />}
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </AriaButton>
  );
}

export function LinkButton({ href, intent, size, full, className, children }: Variants & { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(button({ intent, size, full }), className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("size-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
