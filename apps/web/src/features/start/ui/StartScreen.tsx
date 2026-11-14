'use client';
import { start as t } from '@/copy';
import { ArcScope } from '@/ui-kit/arc';
import { cx } from '@/ui-kit';
import type { StartStep, StartVM } from '../model/types';
import { ChooseSource } from './ChooseSource';
import { ConnectBank } from './ConnectBank';
import { GenerateForm } from './GenerateForm';
import { ReadingView } from './ReadingView';
import { ReviewView } from './ReviewView';

const STEP_INDEX: Record<StartStep, number> = { choose: 0, connect: 0, generate: 0, reading: 1, review: 2 };

function Steps({ step }: { step: StartStep }) {
  const at = STEP_INDEX[step];
  return (
    <ol className="flex items-center gap-sm" aria-label={t.stepsLabel}>
      {t.steps.map((label, i) => (
        <li key={label} className="flex items-center gap-sm">
          <span className={cx('flex items-center gap-xs text-xs font-bold transition-colors', i <= at ? 'text-text' : 'text-text-muted')}>
            <span className={cx('grid size-5 place-items-center rounded-full text-[10px] transition-colors',
              i < at ? 'bg-positive text-on-primary' : i === at ? 'bg-ink text-on-primary' : 'bg-surface-strong')}>
              {i + 1}
            </span>
            <span className={cx(i === at ? 'inline' : 'hidden sm:inline')}>{label}</span>
          </span>
          {i < t.steps.length - 1 ? <span className={cx('h-px w-4 sm:w-8', i < at ? 'bg-positive' : 'bg-border')} /> : null}
        </li>
      ))}
    </ol>
  );
}

/** /start: from transactions to a plan, with no typing. Props in, events out. */
export function StartScreen({ vm }: { vm: StartVM }) {
  return (
    <ArcScope>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-xl px-lg pb-3xl pt-lg sm:px-xl">
        <Steps step={vm.step} />
        {vm.step === 'choose' ? (
          <ChooseSource banks={vm.connect.banks} onConnect={vm.chooseConnect} onUpload={vm.uploadFile} onGenerate={vm.chooseGenerate} />
        ) : null}
        {vm.step === 'generate' ? <GenerateForm vm={vm.generator} onBack={vm.back} /> : null}
        {vm.step === 'connect' ? <ConnectBank vm={vm.connect} /> : null}
        {vm.step === 'reading' && vm.reading ? (
          <ReadingView reading={vm.reading} guess={vm.guess} error={vm.error} onSkipGuess={vm.skipGuess} onRetry={vm.retry} onBack={vm.restart} />
        ) : null}
        {vm.step === 'review' && vm.reveal && vm.source ? (
          <ReviewView
            source={vm.source}
            reveal={vm.reveal}
            questions={vm.questions}
            onAnswerCategory={vm.answerCategory}
            onAnswerNone={vm.answerNone}
            onSkip={vm.skipQuestion}
            onFinish={vm.finish}
            onRestart={vm.restart}
          />
        ) : null}
      </main>
    </ArcScope>
  );
}
