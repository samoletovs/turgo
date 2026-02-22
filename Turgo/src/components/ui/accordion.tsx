"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (value: string) => void;
  type: "single" | "multiple";
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: new Set(),
  toggle: () => {},
  type: "single",
});

interface AccordionProps {
  type?: "single" | "multiple";
  defaultValue?: string | string[];
  className?: string;
  children: React.ReactNode;
}

export function Accordion({
  type = "single",
  defaultValue,
  className,
  children,
}: AccordionProps) {
  const [openItems, setOpenItems] = React.useState<Set<string>>(() => {
    if (!defaultValue) return new Set();
    return new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue]);
  });

  const toggle = React.useCallback(
    (value: string) => {
      setOpenItems((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          next.delete(value);
        } else {
          if (type === "single") next.clear();
          next.add(value);
        }
        return next;
      });
    },
    [type],
  );

  return (
    <AccordionContext.Provider value={{ openItems, toggle, type }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  );
}

const AccordionItemContext = React.createContext<string>("");

interface AccordionItemProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function AccordionItem({
  value,
  className,
  children,
}: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={`border-b ${className || ""}`}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

interface AccordionTriggerProps {
  className?: string;
  children: React.ReactNode;
}

export function AccordionTrigger({
  className,
  children,
}: AccordionTriggerProps) {
  const { openItems, toggle } = React.useContext(AccordionContext);
  const value = React.useContext(AccordionItemContext);
  const isOpen = openItems.has(value);

  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      className={`flex w-full items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline ${className || ""}`}
      aria-expanded={isOpen}
    >
      {children}
      <ChevronDown
        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}

interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
}

export function AccordionContent({
  className,
  children,
}: AccordionContentProps) {
  const { openItems } = React.useContext(AccordionContext);
  const value = React.useContext(AccordionItemContext);
  const isOpen = openItems.has(value);

  if (!isOpen) return null;

  return (
    <div
      className={`overflow-hidden pb-4 pt-0 text-sm text-muted-foreground ${className || ""}`}
    >
      {children}
    </div>
  );
}
