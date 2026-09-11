import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { AllianceProvider } from '@/contexts/AllianceContext';
import { DrawableFieldMap } from '@/components/pit-scout/DrawableFieldMap';
import { getStrokes, type DrawnPath } from '@/lib/autoPaths';

// jsdom has no canvas implementation; the component must tolerate a null 2D context.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      isPrimary: boolean;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? 'mouse';
        this.isPrimary = init.isPrimary ?? true;
      }
    }
    (window as unknown as { PointerEvent: typeof PointerEventPolyfill }).PointerEvent = PointerEventPolyfill;
  }
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // Pointer capture isn't implemented in jsdom either.
  (HTMLElement.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
  (HTMLElement.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
});

const rect = () => ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON() {} }) as DOMRect;

function renderMap(paths: DrawnPath[], opts: { disabled?: boolean } = {}) {
  const onChange = vi.fn();
  const ui = (p: DrawnPath[]) => (
    <AllianceProvider>
      <DrawableFieldMap paths={p} onChange={onChange} disabled={opts.disabled} />
    </AllianceProvider>
  );
  const utils = render(ui(paths));
  const canvas = utils.container.querySelector('canvas') as HTMLCanvasElement;
  // Give the canvas a box so normalized coordinates are meaningful.
  canvas.getBoundingClientRect = rect;
  return { ...utils, canvas, onChange, rerenderWith: (p: DrawnPath[]) => utils.rerender(ui(p)) };
}

const draw = (canvas: HTMLCanvasElement, pts: [number, number][], pointerId = 1) => {
  fireEvent.pointerDown(canvas, { pointerId, pointerType: 'touch', button: 0, clientX: pts[0][0], clientY: pts[0][1] });
  for (const [x, y] of pts.slice(1)) {
    fireEvent.pointerMove(canvas, { pointerId, pointerType: 'touch', clientX: x, clientY: y });
  }
  const [lx, ly] = pts[pts.length - 1];
  fireEvent.pointerUp(canvas, { pointerId, pointerType: 'touch', clientX: lx, clientY: ly });
};

describe('DrawableFieldMap', () => {
  it('creates the first path from an empty list when the scout draws', () => {
    const { canvas, onChange } = renderMap([]);
    draw(canvas, [[10, 10], [60, 60], [120, 100]]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const paths = onChange.mock.calls[0][0] as DrawnPath[];
    expect(paths).toHaveLength(1);
    const strokes = getStrokes(paths[0]);
    expect(strokes).toHaveLength(1);
    expect(strokes[0][0]).toEqual({ x: 0.05, y: 0.05 });
    expect(strokes[0].length).toBeGreaterThanOrEqual(2);
  });

  it('keeps separate strokes separate (no connecting line after lifting the pen)', () => {
    const existing: DrawnPath = { id: 'p1', label: 'Path 1', color: '#3b82f6', points: [], strokes: [] };
    const { canvas, onChange, rerenderWith } = renderMap([existing]);
    draw(canvas, [[0, 0], [50, 50]]);
    rerenderWith(onChange.mock.calls[0][0] as DrawnPath[]);
    draw(canvas, [[150, 150], [190, 190]]);
    const after2 = onChange.mock.calls[1][0] as DrawnPath[];
    expect(getStrokes(after2[0])).toHaveLength(2);
    expect(after2[0].points).toHaveLength(4);
  });

  it('ignores taps and a second simultaneous finger', () => {
    const { canvas, onChange } = renderMap([]);
    // Tap (no movement) -> no stroke.
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', clientX: 10, clientY: 10 });
    expect(onChange).not.toHaveBeenCalled();
    // Two fingers: only the first pointer draws.
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerDown(canvas, { pointerId: 2, pointerType: 'touch', button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(canvas, { pointerId: 2, pointerType: 'touch', clientX: 150, clientY: 150 });
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: 'touch', clientX: 150, clientY: 150 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 40 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('undo removes exactly the last stroke', () => {
    const p: DrawnPath = {
      id: 'p1', label: 'Path 1', color: '#3b82f6',
      strokes: [[{ x: 0, y: 0 }, { x: 0.2, y: 0.2 }], [{ x: 0.8, y: 0.8 }, { x: 1, y: 1 }]],
      points: [{ x: 0, y: 0 }, { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 1, y: 1 }],
    };
    const { onChange } = renderMap([p]);
    fireEvent.click(screen.getByRole('button', { name: /undo stroke/i }));
    const next = onChange.mock.calls[0][0] as DrawnPath[];
    expect(getStrokes(next[0])).toEqual([[{ x: 0, y: 0 }, { x: 0.2, y: 0.2 }]]);
  });

  it('does nothing when disabled', () => {
    const { canvas, onChange } = renderMap([], { disabled: true });
    draw(canvas, [[0, 0], [50, 50]]);
    expect(onChange).not.toHaveBeenCalled();
  });
});
