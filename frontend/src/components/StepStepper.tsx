import { Fragment } from 'react';

interface StepStepperProps {
  /** 已翻译好的步骤标题（含当前应用语言）。 */
  steps: string[];
  /** 当前步骤 0-based 索引。 */
  current: number;
  /** 点击节点时触发（允许回到过去的步骤）。 */
  onStepClick: (index: number) => void;
  /** stepper 的无障碍标签。 */
  ariaLabel: string;
}

/**
 * 横向流程图式步骤条：每个步骤一个圆节点 + 标题，节点间以连接线相连。
 * - 已完成步骤：coral 实心 + 对勾，可点击回退。
 * - 当前步骤：coral 描边高亮，比其它节点略大。
 * - 未完成步骤：灰态，尚不可直接跳转（先要让用户经过前置步骤）。
 * 语言与配色沿用当前暖色主题（coral / tan / ink）。
 */
export function StepStepper({ steps, current, onStepClick, ariaLabel }: StepStepperProps) {
  const connectorBefore = (i: number) =>
    i > 0 && (
      <span
        aria-hidden="true"
        className={`h-[2px] flex-1 rounded-full ${i <= current ? 'bg-coral-deep/70' : 'bg-tan/30'}`}
      />
    );

  return (
    <nav aria-label={ariaLabel} className="flex items-center gap-1.5">
      {steps.map((title, i) => {
        const done = i < current;
        const isCurrent = i === current;
        const reachable = i <= current;
        const dotClass = done
          ? 'flex h-9 w-9 items-center justify-center rounded-full bg-coral-deep text-white shadow-warm-sm'
          : isCurrent
            ? 'flex h-10 w-10 items-center justify-center rounded-full border-2 border-coral-deep text-coral-deep ring-2 ring-coral-deep/25 ring-offset-1'
            : 'flex h-8 w-8 items-center justify-center rounded-full border border-tan/30 text-ink-soft';

        return (
          <Fragment key={i}>
            {connectorBefore(i)}
            <div className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => reachable && onStepClick(i)}
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${title}${done ? ' · 已完成' : isCurrent ? ' · 当前步骤' : ''}`}
                className={`${dotClass} transition hover:scale-105 disabled:cursor-not-allowed`}
              >
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-semibold">{i + 1}</span>
                )}
              </button>
              <span
                className={`text-[11px] font-medium leading-none text-center max-w-[7rem] ${
                  isCurrent ? 'text-coral-deep' : done ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                {title}
              </span>
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}