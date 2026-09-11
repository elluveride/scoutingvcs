import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Undo2, Trash2, Plus, Eraser, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import decodeFieldImg from '@/assets/decode-field.png';
import { useAlliance } from '@/contexts/AllianceContext';
import {
  type DrawnPath,
  type PathPoint,
  MAX_PATHS,
  pathPalette,
  getStrokes,
  appendStroke,
  removeLastStroke,
  clearPath,
  newPath,
  isEmptyPath,
} from '@/lib/autoPaths';

export type { DrawnPath } from '@/lib/autoPaths';

interface DrawableFieldMapProps {
  paths: DrawnPath[];
  onChange: (paths: DrawnPath[]) => void;
  disabled?: boolean;
}

/** Minimum distance (normalized units) between sampled points; keeps JSON small. */
const MIN_SEGMENT = 0.004;

/**
 * Touch/mouse/pen drawing surface for tracing autonomous routines on the field.
 *
 * - Pointer events + pointer capture: one code path for finger, stylus, mouse.
 * - Each pen-down→pen-up is a separate stroke, so lifting the pen doesn't draw a
 *   connecting line and Undo removes exactly one stroke.
 * - Canvas is rendered at devicePixelRatio for crisp lines on phones.
 * - Works with an empty `paths` array: the first stroke creates "Path 1".
 */
export function DrawableFieldMap({ paths, onChange, disabled = false }: DrawableFieldMapProps) {
  const { alliance } = useAlliance();
  const palette = useMemo(() => pathPalette(alliance), [alliance]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);
  const [size, setSize] = useState(400);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);

  // Live stroke lives in a ref so pointer-move doesn't re-render React on every event.
  const liveStroke = useRef<PathPoint[]>([]);
  const drawingPointer = useRef<number | null>(null);

  // A stable placeholder path shown when the parent hasn't created one yet.
  const placeholder = useRef<DrawnPath | null>(null);
  if (!placeholder.current || placeholder.current.color !== palette[0]) {
    placeholder.current = { ...(placeholder.current ?? newPath(0, palette)), color: palette[0] };
  }
  const placeholderPath = placeholder.current;
  const displayPaths: DrawnPath[] = useMemo(
    () => (paths.length > 0 ? paths : [placeholderPath]),
    [paths, placeholderPath],
  );
  const safeIndex = Math.min(currentPathIndex, displayPaths.length - 1);
  const currentPath = displayPaths[safeIndex];

  // Keep the selected tab valid when paths are removed/reloaded.
  useEffect(() => {
    if (currentPathIndex > displayPaths.length - 1) {
      setCurrentPathIndex(Math.max(0, displayPaths.length - 1));
    }
  }, [displayPaths.length, currentPathIndex]);

  // Field background image.
  useEffect(() => {
    const img = new Image();
    img.src = decodeFieldImg;
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
  }, []);

  // Track container width (square canvas).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize(Math.max(120, Math.floor(el.clientWidth)));
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const drawStroke = useCallback(
    (ctx: CanvasRenderingContext2D, stroke: PathPoint[], color: string, width: number, alpha: number) => {
      if (stroke.length === 0) return;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (stroke.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke[0].x * size, stroke[0].y * size, width / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(stroke[0].x * size, stroke[0].y * size);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x * size, stroke[i].y * size);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [size],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, size, size);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, size, size);
    }

    displayPaths.forEach((path, idx) => {
      const active = idx === safeIndex;
      const strokes = getStrokes(path);
      strokes.forEach((s) => drawStroke(ctx, s, path.color, active ? 4 : 3, active ? 1 : 0.55));
      // Start marker on the first stroke.
      const first = strokes[0]?.[0];
      if (first) {
        ctx.globalAlpha = active ? 1 : 0.55;
        ctx.fillStyle = path.color;
        ctx.beginPath();
        ctx.arc(first.x * size, first.y * size, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    if (liveStroke.current.length > 0) {
      drawStroke(ctx, liveStroke.current, currentPath.color, 4, 1);
    }
  }, [displayPaths, safeIndex, currentPath.color, size, drawStroke]);

  // Always call the latest redraw (avoids stale closures from async image load).
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  useEffect(() => {
    redrawRef.current();
  }, [redraw, imgReady, size]);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): PathPoint => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drawingPointer.current !== null) return; // ignore second finger
    e.preventDefault();
    drawingPointer.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported (e.g. jsdom) */
    }
    liveStroke.current = [toPoint(e)];
    redrawRef.current();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointer.current !== e.pointerId) return;
    e.preventDefault();
    const p = toPoint(e);
    const last = liveStroke.current[liveStroke.current.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < MIN_SEGMENT) return;
    liveStroke.current.push(p);

    // Incremental draw: only the newest segment, no full repaint.
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && last) {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = currentPath.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x * size, last.y * size);
      ctx.lineTo(p.x * size, p.y * size);
      ctx.stroke();
    }
  };

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointer.current !== e.pointerId) return;
    drawingPointer.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const stroke = liveStroke.current;
    liveStroke.current = [];
    if (stroke.length < 2) {
      redrawRef.current();
      return;
    }
    const base = paths.length > 0 ? [...paths] : [placeholder.current!];
    base[safeIndex] = appendStroke(base[safeIndex], stroke);
    onChange(base);
  };

  const updateCurrent = (fn: (p: DrawnPath) => DrawnPath) => {
    const base = paths.length > 0 ? [...paths] : [placeholder.current!];
    base[safeIndex] = fn(base[safeIndex]);
    onChange(base);
  };

  const addPath = () => {
    const base = paths.length > 0 ? [...paths] : [placeholder.current!];
    if (base.length >= MAX_PATHS) return;
    onChange([...base, newPath(base.length, palette)]);
    setCurrentPathIndex(base.length);
  };

  const deleteCurrentPath = () => {
    if (paths.length === 0) return;
    const next = paths.filter((_, i) => i !== safeIndex);
    onChange(next);
    setCurrentPathIndex(Math.max(0, safeIndex - 1));
  };

  const clearAll = () => {
    onChange([]);
    setCurrentPathIndex(0);
  };

  const currentEmpty = isEmptyPath(currentPath);

  return (
    <div className="space-y-3">
      {/* Path tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {displayPaths.map((path, idx) => (
          <button
            key={path.id}
            type="button"
            onClick={() => setCurrentPathIndex(idx)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-1.5 transition-all min-h-[40px]',
              'border touch-manipulation',
              idx === safeIndex
                ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                : 'border-border bg-muted/50 text-muted-foreground',
            )}
          >
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: path.color }} />
            {path.label}
            {isEmptyPath(path) && <span className="text-[10px] opacity-60">(empty)</span>}
          </button>
        ))}
        {displayPaths.length < MAX_PATHS && !disabled && (
          <Button type="button" variant="outline" size="sm" onClick={addPath} className="h-10 gap-1">
            <Plus className="w-3 h-3" /> Add
          </Button>
        )}
      </div>

      {/* Label editor for the selected path */}
      {!disabled && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">Label</span>
          <Input
            value={currentPath.label}
            onChange={(e) => updateCurrent((p) => ({ ...p, label: e.target.value.slice(0, 40) }))}
            placeholder="e.g. Left start, 3 artifacts"
            className="h-10 text-sm"
            maxLength={40}
          />
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={cn(
          'relative w-full rounded-lg overflow-hidden border border-border bg-[#1a1a2e]',
          disabled && 'opacity-70',
        )}
        style={{ aspectRatio: '1 / 1' }}
      >
        <canvas
          ref={canvasRef}
          width={size * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
          height={size * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
          className={cn('block w-full h-full touch-none select-none', disabled ? 'cursor-not-allowed' : 'cursor-crosshair')}
          style={{ width: size, height: size }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
          onPointerLeave={finishStroke}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Field map for drawing autonomous paths"
          role="img"
        />
      </div>

      {/* Controls */}
      {!disabled && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateCurrent(removeLastStroke)}
            disabled={currentEmpty}
            className="gap-1 h-10"
          >
            <Undo2 className="w-4 h-4" /> Undo stroke
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateCurrent(clearPath)}
            disabled={currentEmpty}
            className="gap-1 h-10"
          >
            <Eraser className="w-4 h-4" /> Clear path
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={deleteCurrentPath}
            disabled={paths.length === 0}
            className="gap-1 h-10"
          >
            <X className="w-4 h-4" /> Remove path
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={clearAll}
            disabled={paths.every(isEmptyPath)}
            className="gap-1 h-10"
          >
            <Trash2 className="w-4 h-4" /> Clear all
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Draw with a finger, stylus, or mouse. Lift to end a stroke; each path can have several strokes.
        Use separate paths for different routines (e.g. left vs right start).
      </p>
    </div>
  );
}
