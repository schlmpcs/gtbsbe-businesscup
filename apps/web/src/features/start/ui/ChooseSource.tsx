'use client';
import { useRef } from 'react';
import { start as t } from '@/copy';
import { cx, Photo } from '@/ui-kit';
import type { BankVM } from '../model/types';
import { ArrowIcon, BankIcon, SparkIcon, UploadIcon } from './icons';

export type ChooseSourceProps = {
  banks: BankVM[];
  onConnect: () => void;
  onUpload: (file: File) => void;
  onGenerate: () => void;
};

const card = 'group relative flex w-full items-center gap-md rounded-xl border border-border bg-surface p-lg text-left shadow-[0_1px_2px_rgb(29_27_24/0.04)] transition hover:-translate-y-px hover:shadow-[0_8px_24px_rgb(29_27_24/0.08)]';

/** Step 1: two ways in. Connecting a bank first; a CSV second; a sample statement for anyone else. */
export function ChooseSource({ banks, onConnect, onUpload, onGenerate }: ChooseSourceProps) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="grid grid-cols-1 gap-xl [&>*]:min-w-0 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-3xl">
      <div className="flex flex-col gap-lg">
        <div className="overflow-hidden rounded-xl bg-surface-strong">
          <div className="aspect-[3/2] w-full">
            <Photo src="/onboarding/hero.webp" alt="" priority />
          </div>
        </div>
        <p className="text-sm font-semibold text-text-muted">{t.choose.eyebrow}</p>
        <h1 className="text-3xl leading-tight sm:text-4xl">{t.choose.title}</h1>
        <p className="text-base text-text-muted">{t.choose.lead}</p>
      </div>

      <div className="flex flex-col gap-md">
        <button type="button" onClick={onConnect} className={cx(card, 'flex-col items-stretch border-2 border-ink p-xl')} data-testid="start-connect">
          <span className="flex items-center gap-md">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-ink text-on-primary"><BankIcon /></span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-sm">
                <span className="text-xl font-bold">{t.choose.connect.title}</span>
                <span className="rounded-full bg-primary-soft px-sm py-[2px] text-xs font-bold text-primary-hover">{t.choose.connect.badge}</span>
              </span>
              <span className="text-sm text-text-muted">{t.choose.connect.body}</span>
            </span>
            <ArrowIcon className="shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-text" />
          </span>
          <span className="mt-md flex gap-sm" aria-hidden="true">
            {banks.slice(0, 6).map((b) => (
              <span key={b.id} className="grid size-10 place-items-center rounded-md border border-border bg-surface p-[7px]">
                <Photo src={b.logo} alt="" className="object-contain" priority />
              </span>
            ))}
          </span>
        </button>

        <label className={cx(card, 'cursor-pointer')} data-testid="start-upload">
          <span className="grid size-11 shrink-0 place-items-center rounded-md bg-surface-strong text-text"><UploadIcon /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-lg font-bold">{t.choose.upload.title}</span>
            <span className="text-sm text-text-muted">{t.choose.upload.body}</span>
          </span>
          <ArrowIcon className="shrink-0 text-text-muted" />
          <input
            ref={file}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            aria-label={t.choose.pickFile}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
              if (file.current) file.current.value = '';
            }}
          />
        </label>

        <p className="flex flex-wrap items-center gap-xs px-xs text-sm text-text-muted">
          {t.choose.noBank}
          <button type="button" onClick={onGenerate} className="inline-flex items-center gap-xs font-semibold text-text underline-offset-2 hover:underline" data-testid="start-generate">
            <SparkIcon className="size-4 text-primary" />{t.choose.generateLink}
          </button>
        </p>
      </div>
    </div>
  );
}
