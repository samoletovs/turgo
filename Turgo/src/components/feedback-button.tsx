"use client";

import { useState } from "react";

const REPO_OWNER = "samoletovs";
const REPO_NAME = "Turgo";

const types = {
  bug: { emoji: "🐛", label: "Bug Report", ghLabel: "bug" },
  idea: { emoji: "💡", label: "Feature Idea", ghLabel: "enhancement" },
  ux: { emoji: "🎨", label: "UI/UX", ghLabel: "ui/ux" },
} as const;
type FBType = keyof typeof types;

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<FBType>("idea");

  const submit = () => {
    if (!text.trim()) return;
    const t = types[type];
    const title = `${t.emoji} ${t.label}: ${text.slice(0, 80)}`;
    const body = `## ${t.label}\n\n${text}\n\n---\n*Submitted via Turgo in-app feedback*`;
    window.open(
      `https://github.com/${REPO_OWNER}/${REPO_NAME}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=${encodeURIComponent(t.ghLabel)}`,
      "_blank",
    );
    setOpen(false);
    setText("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:shadow-lg md:bottom-4 md:h-auto md:w-auto md:rounded-lg md:px-3 md:py-2"
        aria-label="Send feedback"
      >
        <span className="text-base">💬</span>
        <span className="ml-1.5 hidden text-xs font-medium text-muted-foreground md:inline">
          Feedback
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-[9999] w-80 rounded-xl border border-border bg-card p-4 shadow-xl md:bottom-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">💬 Send Feedback</span>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="mb-2 flex gap-1">
        {(Object.keys(types) as FBType[]).map((k) => (
          <button
            key={k}
            onClick={() => setType(k)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              type === k
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {types[k].emoji} {types[k].label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe what you found or what you'd like..."
        className="h-20 w-full resize-none rounded-lg border border-input bg-background p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => setOpen(false)}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
