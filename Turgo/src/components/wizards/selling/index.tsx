"use client";

import { Bot, Camera, Check, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { SellingAgentWizardProps } from "./types";
import { SELLING_STEP_LABELS, SELLING_STEP_MAP } from "./types";
import { useSellingWizard } from "./useSellingWizard";
import { PhotoPreview } from "./PhotoUploadStep";
import { DonePanel } from "./ReviewStep";

export function SellingAgentWizard({
  locale,
  categories = [],
  locations = [],
}: SellingAgentWizardProps) {
  const {
    messages,
    currentStep,
    input,
    setInput,
    isThinking,
    isSubmitting,
    data,
    messagesEndRef,
    inputRef,
    fileInputRef,
    handleSendMessage,
    handleAction,
    onPhotoUpload,
    onRemovePhoto,
  } = useSellingWizard({ locale, categories, locations });
  const currentStepIndex = SELLING_STEP_MAP[currentStep] ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress indicator */}
      <div className="mb-6 flex items-center gap-2 px-2">
        {SELLING_STEP_LABELS.map((label, i) => {
          const isActive = i === currentStepIndex;
          const isCompleted = i < currentStepIndex;
          return (
            <div key={label} className="flex items-center flex-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-all ${
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCompleted
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < 4 && (
                <div
                  className={`mx-1 h-0.5 flex-1 ${i < currentStepIndex ? "bg-primary" : "bg-muted"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Chat messages */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex h-[min(500px,60vh)] flex-col">
            {/* Agent header */}
            <div className="flex items-center gap-3 border-b px-4 py-3 bg-primary/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">Selling Agent</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-[11px] text-muted-foreground">
                    {currentStep === "done"
                      ? "Agent active — monitoring your listing"
                      : "Helping you create the perfect listing"}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      msg.role === "agent"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted"
                    }`}
                  >
                    {msg.role === "agent" ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : (
                      <User className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex max-w-[85%] flex-col gap-1.5">
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.content
                        .split("**")
                        .map((part, i) =>
                          i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
                        )}
                    </div>

                    {/* Inline component */}
                    {msg.component}

                    {/* Action buttons */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleAction(action.value)}
                            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:border-primary"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Photo previews inline */}
              {data.photoPreviews.length > 0 && currentStep === "analyzing" && (
                <PhotoPreview
                  previews={data.photoPreviews}
                  onRemove={onRemovePhoto}
                />
              )}

              {/* Thinking indicator */}
              {(isThinking || isSubmitting) && (
                <div className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                          style={{ animationDelay: "0ms" }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                          style={{ animationDelay: "150ms" }}
                        />
                        <span
                          className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/40"
                          style={{ animationDelay: "300ms" }}
                        />
                      </div>
                      {isSubmitting && (
                        <span className="text-xs text-muted-foreground ml-2">
                          Publishing your listing...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t p-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={onPhotoUpload}
                className="hidden"
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex gap-2"
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    currentStep === "pricing"
                      ? "Enter price in EUR..."
                      : currentStep === "agent_config"
                        ? "Minimum price in EUR..."
                        : "Type a message..."
                  }
                  disabled={
                    isThinking || isSubmitting || currentStep === "done"
                  }
                  className="rounded-full text-sm"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isThinking || isSubmitting}
                  className="shrink-0 rounded-full"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy explanation */}
      {currentStep === "done" && <DonePanel />}
    </div>
  );
}
