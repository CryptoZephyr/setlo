"use client";

import { fromDate, getLocalTimeZone, type ZonedDateTime } from "@internationalized/date";
import { ChevronDown } from "lucide-react";
import {
  Checkbox as AriaCheckbox,
  DateInput,
  DateSegment,
  DateField as AriaDateField,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
  Switch as AriaSwitch,
  Text,
  TextArea as AriaTextArea,
  TextField as AriaTextField,
  Button as AriaButton,
} from "react-aria-components";
import { parseUsdg } from "@/lib/money";
import { cn } from "./cn";

const inputCls =
  "min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-[15px] text-text outline-none placeholder:text-text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20 data-[invalid]:border-bad";
const labelCls = "text-sm font-medium text-text";
const descCls = "text-[13px] text-text-muted";
const errCls = "text-[13px] text-bad";

type Common = { label: string; description?: string; error?: string | null; className?: string; isRequired?: boolean };

export function TextField({
  label,
  description,
  error,
  className,
  value,
  onChange,
  type,
  placeholder,
  isRequired,
  autoComplete,
  inputMode,
}: Common & {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "decimal" | "numeric";
}) {
  return (
    <AriaTextField
      value={value}
      onChange={onChange}
      type={type}
      isRequired={isRequired}
      isInvalid={!!error}
      autoComplete={autoComplete}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className={labelCls}>{label}</Label>
      <Input className={inputCls} placeholder={placeholder} inputMode={inputMode} />
      {description && <Text slot="description" className={descCls}>{description}</Text>}
      <FieldError className={errCls}>{error}</FieldError>
    </AriaTextField>
  );
}

export function TextArea({ label, description, error, className, value, onChange, placeholder, rows = 4 }: Common & { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <AriaTextField value={value} onChange={onChange} isInvalid={!!error} className={cn("flex flex-col gap-1.5", className)}>
      <Label className={labelCls}>{label}</Label>
      <AriaTextArea rows={rows} className={cn(inputCls, "py-2.5 leading-relaxed")} placeholder={placeholder} />
      {description && <Text slot="description" className={descCls}>{description}</Text>}
      <FieldError className={errCls}>{error}</FieldError>
    </AriaTextField>
  );
}

/** USDG amount input. Shows the unit inside the field; validation errors come from the caller. */
export function MoneyField({ label, description, error, className, value, onChange, isRequired }: Common & { value: string; onChange: (v: string) => void }) {
  const invalid = value !== "" && parseUsdg(value) === null;
  return (
    <AriaTextField
      value={value}
      onChange={onChange}
      isRequired={isRequired}
      isInvalid={invalid || !!error}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className={labelCls}>{label}</Label>
      <div className="relative">
        <Input className={cn(inputCls, "tabular pr-16 text-right")} inputMode="decimal" placeholder="0.00" />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-text-muted">USDG</span>
      </div>
      {description && <Text slot="description" className={descCls}>{description}</Text>}
      <FieldError className={errCls}>{invalid ? "Enter an amount with up to 6 decimals" : error}</FieldError>
    </AriaTextField>
  );
}

/** Local date and time, with the timezone shown. Value is unix seconds. */
export function DateTimeField({ label, description, error, className, value, onChange }: Common & { value: number | null; onChange: (v: number | null) => void }) {
  const tz = getLocalTimeZone();
  const zdt: ZonedDateTime | null = value ? fromDate(new Date(value * 1000), tz) : null;
  return (
    <AriaDateField
      value={zdt}
      onChange={(v) => onChange(v ? Math.floor(v.toDate().getTime() / 1000) : null)}
      granularity="minute"
      hourCycle={24}
      isInvalid={!!error}
      className={cn("flex flex-col gap-1.5", className)}
    >
      <Label className={labelCls}>{label}</Label>
      <DateInput className={cn(inputCls, "tabular flex items-center gap-0.5")}>
        {(segment) => (
          <DateSegment
            segment={segment}
            className="rounded px-0.5 outline-none data-[focused]:bg-brand data-[focused]:text-brand-contrast data-[placeholder]:text-text-muted/70 data-[type=literal]:text-text-muted"
          />
        )}
      </DateInput>
      {description && <Text slot="description" className={descCls}>{description}</Text>}
      <FieldError className={errCls}>{error}</FieldError>
    </AriaDateField>
  );
}

export function Select<T extends string>({ label, description, className, value, onChange, options }: Common & { value: T; onChange: (v: T) => void; options: { id: T; label: string }[] }) {
  return (
    <AriaSelect selectedKey={value} onSelectionChange={(k) => k != null && onChange(k as T)} className={cn("flex flex-col gap-1.5", className)}>
      <Label className={labelCls}>{label}</Label>
      <AriaButton className={cn(inputCls, "flex items-center justify-between text-left")}>
        <SelectValue />
        <ChevronDown className="size-4 text-text-muted" aria-hidden />
      </AriaButton>
      {description && <Text slot="description" className={descCls}>{description}</Text>}
      <Popover className="min-w-(--trigger-width) rounded-md border border-border bg-surface p-1 shadow-pop">
        <ListBox className="outline-none">
          {options.map((o) => (
            <ListBoxItem
              key={o.id}
              id={o.id}
              className="flex min-h-10 cursor-default items-center rounded px-3 text-[15px] outline-none data-[focused]:bg-surface-muted data-[selected]:font-medium"
            >
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}

export function Switch({ children, isSelected, onChange, isDisabled }: { children: React.ReactNode; isSelected: boolean; onChange: (v: boolean) => void; isDisabled?: boolean }) {
  return (
    <AriaSwitch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled} className="group flex min-h-11 cursor-pointer items-center gap-3 text-[15px] data-[disabled]:opacity-50">
      <span className="flex h-6 w-10 shrink-0 items-center rounded-full bg-border-strong px-0.5 transition-colors group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand group-data-[selected]:bg-brand">
        <span className="size-5 rounded-full bg-white shadow transition-transform group-data-[selected]:translate-x-4" />
      </span>
      {children}
    </AriaSwitch>
  );
}

export function Checkbox({ children, isSelected, onChange }: { children: React.ReactNode; isSelected: boolean; onChange: (v: boolean) => void }) {
  return (
    <AriaCheckbox isSelected={isSelected} onChange={onChange} className="group flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[15px]">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border border-border-strong bg-surface group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-brand group-data-[selected]:border-brand group-data-[selected]:bg-brand">
        <svg viewBox="0 0 16 16" className="hidden size-3.5 text-white group-data-[selected]:block" aria-hidden>
          <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span>{children}</span>
    </AriaCheckbox>
  );
}
