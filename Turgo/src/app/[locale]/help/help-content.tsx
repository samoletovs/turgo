"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Rocket,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Shield,
} from "lucide-react";

const SECTIONS = [
  { id: "gettingStarted", icon: Rocket, keys: ["q1", "q2", "q3"] },
  { id: "sellingAgents", icon: TrendingUp, keys: ["q1", "q2", "q3"] },
  { id: "buyingAgents", icon: ShoppingCart, keys: ["q1", "q2", "q3"] },
  { id: "payments", icon: CreditCard, keys: ["q1", "q2", "q3"] },
  { id: "accountPrivacy", icon: Shield, keys: ["q1", "q2", "q3"] },
] as const;

export function HelpContent() {
  const t = useTranslations("help");

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <div key={section.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">
                {t(`sections.${section.id}.title`)}
              </h2>
            </div>
            <Accordion type="single" className="rounded-xl border divide-y">
              {section.keys.map((key) => (
                <AccordionItem
                  key={key}
                  value={`${section.id}-${key}`}
                  className="border-0 px-4"
                >
                  <AccordionTrigger className="text-left font-medium">
                    {t(`sections.${section.id}.${key}.q`)}
                  </AccordionTrigger>
                  <AccordionContent>
                    {t(`sections.${section.id}.${key}.a`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        );
      })}
    </div>
  );
}
