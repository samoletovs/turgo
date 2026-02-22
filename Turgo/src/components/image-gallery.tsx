"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface GalleryImage {
  url: string;
  alt?: string;
}

interface ImageGalleryProps {
  images: GalleryImage[];
  className?: string;
}

// ──────────────────────────────────────────────
// SWIPE HOOK
// ──────────────────────────────────────────────

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void, threshold = 50) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      // Only trigger if horizontal swipe is dominant
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
      touchStart.current = null;
    },
    [onSwipeLeft, onSwipeRight, threshold],
  );

  return { onTouchStart, onTouchEnd };
}

// ──────────────────────────────────────────────
// CROSSFADE VARIANTS
// ──────────────────────────────────────────────

const fadeVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// ──────────────────────────────────────────────
// GALLERY COMPONENT
// ──────────────────────────────────────────────

export function ImageGallery({ images, className }: ImageGalleryProps) {
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = images.length;
  const hasPrev = current > 0;
  const hasNext = current < total - 1;

  const goTo = useCallback((idx: number) => setCurrent(idx), []);
  const goPrev = useCallback(() => setCurrent((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setCurrent((i) => Math.min(total - 1, i + 1)), []);

  // Keyboard navigation (inline gallery — only when focused / not in lightbox)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (lightboxOpen) return; // lightbox has its own handler
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, lightboxOpen]);

  const swipeHandlers = useSwipe(goNext, goPrev);

  if (total === 0) {
    return (
      <div className={cn("flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-muted-foreground", className)}>
        No images
      </div>
    );
  }

  return (
    <>
      {/* ── Inline Gallery ── */}
      <div ref={containerRef} className={cn("overflow-hidden rounded-xl bg-muted", className)}>
        {/* Main image */}
        <button
          type="button"
          className="relative block w-full aspect-[4/3] cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setLightboxOpen(true)}
          aria-label="Open fullscreen gallery"
          {...swipeHandlers}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current}
              variants={fadeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              <Image
                src={images[current].url}
                alt={images[current].alt || `Image ${current + 1}`}
                fill
                className="object-cover"
                priority={current === 0}
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            </motion.div>
          </AnimatePresence>

          {/* Counter badge */}
          {total > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white select-none pointer-events-none">
              {current + 1} / {total}
            </span>
          )}
        </button>

        {/* Nav arrows */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={!hasPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-30 disabled:cursor-default"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={!hasNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-30 disabled:cursor-default"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Thumbnails */}
        {total > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx)}
                className={cn(
                  "relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  idx === current ? "border-primary ring-1 ring-primary/30" : "border-transparent opacity-70 hover:opacity-100",
                )}
                aria-label={`View image ${idx + 1}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt || `Thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Lightbox Modal ── */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto border-0 bg-black/95 p-0 sm:rounded-xl overflow-hidden [&>button]:hidden"
          onPointerDownOutside={() => setLightboxOpen(false)}
        >
          {/* Accessible but visually hidden title */}
          <DialogTitle className="sr-only">Image gallery</DialogTitle>

          <LightboxBody
            images={images}
            current={current}
            setCurrent={setCurrent}
            onClose={() => setLightboxOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ──────────────────────────────────────────────
// LIGHTBOX BODY (separated for keyboard scope)
// ──────────────────────────────────────────────

function LightboxBody({
  images,
  current,
  setCurrent,
  onClose,
}: {
  images: GalleryImage[];
  current: number;
  setCurrent: (i: number) => void;
  onClose: () => void;
}) {
  const total = images.length;
  const goPrev = useCallback(() => setCurrent(Math.max(0, current - 1)), [setCurrent, current]);
  const goNext = useCallback(() => setCurrent(Math.min(total - 1, current + 1)), [setCurrent, current, total]);

  // Keyboard nav inside lightbox
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goPrev, goNext, onClose]);

  const swipeHandlers = useSwipe(goNext, goPrev);

  return (
    <div className="relative flex flex-col items-center justify-center" {...swipeHandlers}>
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="Close lightbox"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Counter */}
      {total > 1 && (
        <div className="absolute left-3 top-3 z-10 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
          {current + 1} / {total}
        </div>
      )}

      {/* Main image */}
      <div className="relative flex h-[80vh] w-[90vw] items-center justify-center sm:h-[85vh] sm:w-[85vw]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current}
            variants={fadeVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Image
              src={images[current].url}
              alt={images[current].alt || `Image ${current + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            disabled={current === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20 disabled:cursor-default"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={current === total - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-20 disabled:cursor-default"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex max-w-[90vw] gap-1.5 overflow-x-auto rounded-lg bg-black/40 p-1.5 backdrop-blur-sm">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrent(idx)}
              className={cn(
                "relative h-10 w-10 shrink-0 overflow-hidden rounded border transition-all",
                idx === current ? "border-white ring-1 ring-white/50" : "border-transparent opacity-60 hover:opacity-100",
              )}
              aria-label={`View image ${idx + 1}`}
            >
              <Image
                src={img.url}
                alt={img.alt || `Thumbnail ${idx + 1}`}
                fill
                className="object-cover"
                sizes="40px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
