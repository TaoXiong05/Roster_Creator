import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepStepper } from '../StepStepper';

const steps = ['Basic Info', 'Working Hours', 'Preferred Times', 'Unavailable Times'];

describe('StepStepper', () => {
  it('highlights the current step and marks previous steps as done', () => {
    render(<StepStepper steps={steps} current={1} onStepClick={vi.fn()} ariaLabel="Progress" />);

    expect(screen.getByRole('button', { name: /Basic Info/ })).toHaveClass('bg-coral-deep');
    expect(screen.getByRole('button', { name: /Working Hours/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('button', { name: /Preferred Times/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Unavailable Times/ })).toBeDisabled();
  });

  it('calls onStepClick when a completed step is clicked', async () => {
    const onStepClick = vi.fn();
    render(<StepStepper steps={steps} current={2} onStepClick={onStepClick} ariaLabel="Progress" />);

    await userEvent.click(screen.getByRole('button', { name: /Working Hours/ }));
    expect(onStepClick).toHaveBeenCalledWith(1);
  });

  it('does not advance to future steps via stepper clicks', async () => {
    const onStepClick = vi.fn();
    render(<StepStepper steps={steps} current={0} onStepClick={onStepClick} ariaLabel="Progress" />);

    await userEvent.click(screen.getByRole('button', { name: /Unavailable Times/ }));
    expect(onStepClick).not.toHaveBeenCalled();
  });
});