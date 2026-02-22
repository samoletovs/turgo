"use client";

import { motion } from "framer-motion";
import { Bot, CheckCircle } from "lucide-react";
import { useTranslations } from "next-intl";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 1, delayChildren: 0.3 },
  },
};

const bubble = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const soldBadge = {
  hidden: { opacity: 0, scale: 0, rotate: -12 },
  show: {
    opacity: 1,
    scale: 1,
    rotate: -6,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 15,
      delay: 2.4,
    },
  },
};

export function HeroAnimation() {
  const t = useTranslations("home");

  return (
    <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
      {/* Phone frame */}
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/10 p-4 sm:p-5">
        {/* Header bar */}
        <div className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t("hero.agentName")}</p>
            <p className="text-xs text-green-500">{t("hero.demoOnline")}</p>
          </div>
        </div>

        {/* Chat bubbles */}
        <motion.div
          className="space-y-3"
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
        >
          {/* User bubble */}
          <motion.div variants={bubble} className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
              {t("hero.demoUserMessage")}
            </div>
          </motion.div>

          {/* Agent bubble */}
          <motion.div variants={bubble} className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-sm text-foreground shadow-sm">
              <p>
                {t("hero.demoSimilar")}{" "}
                <span className="font-semibold">
                  {t("hero.demoSuggestedPrice")}
                </span>
              </p>
              <p className="mt-1 text-muted-foreground">
                {t("hero.demoAgentReply")}
              </p>
            </div>
          </motion.div>

          {/* Progress indicators */}
          <motion.div
            variants={bubble}
            className="flex items-center gap-2 px-1"
          >
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ delay: 2, duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {t("hero.demoListingCreated")}
            </span>
          </motion.div>
        </motion.div>

        {/* SOLD badge */}
        <motion.div
          variants={soldBadge}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
          className="absolute -right-3 -top-3 flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          SOLD
        </motion.div>
      </div>
    </div>
  );
}
