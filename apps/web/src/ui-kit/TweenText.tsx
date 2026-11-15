'use client';
// A formatted value that eases from its previous text to the next one ("$35.7K" → "$61.3K") instead of
// jumping, for numbers that change while a slider is dragged. Display only: it never formats or
// computes a value of its own; every frame keeps the target's words and decimals, and the last frame is
// exactly the text it was given. When the words around the numbers change (K → M, "Measuring…" → "83%")
// it shows the new text at once. Under prefers-reduced-motion it shows the new text at once too.
import { useEffect, useRef, useState } from 'react';

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

type Parsed = { skeleton: string; nums: { value: number; decimals: number; grouped: boolean }[] };

function parse(text: string): Parsed {
  const nums: Parsed['nums'] = [];
  const skeleton = text.replace(NUMBER, (m) => {
    const dot = m.indexOf('.');
    nums.push({ value: Number(m.replace(/,/g, '')), decimals: dot < 0 ? 0 : m.length - dot - 1, grouped: m.includes(',') });
    return '\u0000';
  });
  return { skeleton, nums };
}

/** The text between `from` (k = 0) and `to` (k = 1); `to` itself when their words differ. Pure (exported for tests). */
export function tweenText(from: string, to: string, k: number): string {
  if (k >= 1 || from === to) return to;
  if (k <= 0) return from;
  const a = parse(from);
  const b = parse(to);
  if (a.skeleton !== b.skeleton || a.nums.length !== b.nums.length) return to;
  let i = 0;
  return to.replace(NUMBER, () => {
    const n = b.nums[i]!;
    const v = a.nums[i]!.value + (n.value - a.nums[i]!.value) * k;
    i += 1;
    return v.toLocaleString('en-US', { minimumFractionDigits: n.decimals, maximumFractionDigits: n.decimals, useGrouping: n.grouped });
  });
}

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/** `text`, eased in from the previous value over `ms` (ease-out). */
export function useTweenText(text: string, ms = 320): string {
  const [shown, setShown] = useState(text);
  const shownRef = useRef(text);
  useEffect(() => {
    const from = shownRef.current;
    if (from === text) return;
    const instant = reducedMotion();
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = instant ? 1 : Math.min(1, (now - t0) / ms);
      const next = tweenText(from, text, 1 - (1 - k) ** 3);
      shownRef.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, ms]);
  return shown;
}

/** A text node that eases between values (see useTweenText); usable inside HTML or SVG <text>. */
export function TweenText({ text, ms }: { text: string; ms?: number }) {
  return <>{useTweenText(text, ms)}</>;
}
