// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { formatMoney } from './format';
import { LOG_SLIDER_POSITIONS, Slider, sliderScale } from './Slider';

describe('Slider', () => {
  it('is labelled, shows the formatted value and speaks it', () => {
    render(<Slider label="Rent" value={1950} onValueChange={() => {}} min={0} max={5000} step={50} formatValue={formatMoney} />);
    const slider = screen.getByRole('slider', { name: 'Rent' });
    expect(slider).toHaveAttribute('aria-valuetext', '$1,950');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '5000');
    expect(slider).toHaveAttribute('step', '50');
    expect(screen.getByText('$1,950', { selector: 'output' })).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$5,000')).toBeInTheDocument();
  });

  it('emits the new value as a number', () => {
    const onValueChange = vi.fn();
    render(<Slider label="Groceries" value={500} onValueChange={onValueChange} min={0} max={2000} step={10} />);
    fireEvent.change(screen.getByRole('slider', { name: 'Groceries' }), { target: { value: '730' } });
    expect(onValueChange).toHaveBeenCalledWith(730);
  });

  it('updates its label when used as a controlled input', () => {
    function Harness() {
      const [v, setV] = useState(10);
      return <Slider label="Eating out" value={v} onValueChange={setV} min={0} max={20} />;
    }
    render(<Harness />);
    const slider = screen.getByRole('slider', { name: 'Eating out' });
    fireEvent.change(slider, { target: { value: '14' } });
    expect(slider).toHaveAttribute('aria-valuetext', '14');
    expect(screen.getByText('14', { selector: 'output' })).toBeInTheDocument();
  });

  it('shows an estimate tag and a hint wired to aria-describedby', () => {
    render(<Slider label="Car" value={310} onValueChange={() => {}} min={0} max={1000} isEstimate hint="Insurance, fuel, upkeep" />);
    const slider = screen.getByRole('slider', { name: 'Car' });
    expect(screen.getByText('estimate')).toBeInTheDocument();
    expect(slider).toHaveAccessibleDescription('Insurance, fuel, upkeep');
  });

  describe('log scale', () => {
    const min = 1000;
    const max = 20000;

    it('maps the track ends to min and max, and the middle to the geometric mean', () => {
      expect(sliderScale.fromPosition(0, min, max, 1, 'log')).toBe(1000);
      expect(sliderScale.fromPosition(LOG_SLIDER_POSITIONS, min, max, 1, 'log')).toBe(20000);
      // sqrt(1000 · 20000) = 4472.1…
      expect(sliderScale.fromPosition(LOG_SLIDER_POSITIONS / 2, min, max, 1, 'log')).toBe(4472);
      expect(sliderScale.toPosition(4472, min, max, 'log')).toBe(LOG_SLIDER_POSITIONS / 2);
    });

    it('gives equal ratios equal distance (to within one rounded track position)', () => {
      const a = sliderScale.toPosition(2000, min, max, 'log') - sliderScale.toPosition(1000, min, max, 'log');
      const b = sliderScale.toPosition(10000, min, max, 'log') - sliderScale.toPosition(5000, min, max, 'log');
      expect(a).toBeGreaterThan(40);
      expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    });

    it('emits values snapped to step', () => {
      const onValueChange = vi.fn();
      render(
        <Slider label="Guess" value={4000} onValueChange={onValueChange} min={min} max={max} step={50} scale="log" />,
      );
      const slider = screen.getByRole('slider', { name: 'Guess' });
      expect(slider).toHaveAttribute('max', String(LOG_SLIDER_POSITIONS));
      fireEvent.change(slider, { target: { value: String(LOG_SLIDER_POSITIONS / 2) } });
      expect(onValueChange).toHaveBeenCalledWith(4450);
    });

    it('rejects min ≤ 0', () => {
      const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<Slider label="Bad" value={1} onValueChange={() => {}} min={0} max={10} scale="log" />)).toThrow(
        /min > 0/,
      );
      quiet.mockRestore();
    });
  });
});
