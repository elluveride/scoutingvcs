import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Undo2, Trash2, Plus, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import decodeFieldImg from '@/assets/decode-field.png';

export interface DrawnPath {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

interface DrawableFieldMapProps {
  paths: DrawnPath[];
  onChange: (paths: DrawnPath[]) => void;
}

const PATH_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

export function DrawableFieldMap({ paths, onChange }: DrawableFieldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPathIndex, setCurrentPathIndex] = useState(0);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load field image
  useEffect(() => {
    const img = new Image();
    img.src = decodeFieldImg;
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
  }, []);

  // Resize canvas to container
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setCanvasSize({ width: w, height: w }); // square field
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw field image
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw saved paths
    paths.forEach((path, idx) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = idx === currentPathIndex ? 4 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = idx === currentPathIndex ? 1 : 0.6;
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw start dot
      ctx.beginPath();
      ctx.fillStyle = path.color;
      ctx.arc(path.points[0].x * canvas.width, path.points[0].y * canvas.height, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw current stroke
    if (currentStroke.length > 1) {
      const color = paths[currentPathIndex]?.color || PATH_COLORS[0];
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(currentStroke[0].x * canvas.width, currentStroke[0].y * canvas.height);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x * canvas.width, currentStroke[i].y * canvas.height);
      }
      ctx.stroke();
    }
  }, [paths, currentPathIndex, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw, canvasSize]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStroke([pos]);
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    setCurrentStroke(prev => {
      const updated = [...prev, pos];
      // Redraw on next frame
      requestAnimationFrame(redraw);
      return updated;
    });
  };

  const handleEnd = () => {
    if (!isDrawing || currentStroke.length < 2) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }
    setIsDrawing(false);

    // Append stroke to current path
    const updated = [...paths];
    if (updated[currentPathIndex]) {
      updated[currentPathIndex] = {
        ...updated[currentPathIndex],
        points: [...updated[currentPathIndex].points, ...currentStroke],
      };
    }
    onChange(updated);
    setCurrentStroke([]);
  };

  const addPath = () => {
    const newIndex = paths.length;
    const color = PATH_COLORS[newIndex % PATH_COLORS.length];
    onChange([...paths, { id: crypto.randomUUID(), label: `Path ${newIndex + 1}`, color, points: [] }]);
    setCurrentPathIndex(newIndex);
  };

  const undoLastStroke = () => {
    const updated = [...paths];
    const current = updated[currentPathIndex];
    if (!current || current.points.length === 0) return;
    // Remove last ~20 points (approx one stroke)
    const newPoints = current.points.slice(0, Math.max(0, current.points.length - 20));
    updated[currentPathIndex] = { ...current, points: newPoints };
    onChange(updated);
  };

  const clearCurrentPath = () => {
    const updated = [...paths];
    if (updated[currentPathIndex]) {
      updated[currentPathIndex] = { ...updated[currentPathIndex], points: [] };
    }
    onChange(updated);
  };

  const clearAll = () => {
    onChange([{ id: crypto.randomUUID(), label: 'Path 1', color: PATH_COLORS[0], points: [] }]);
    setCurrentPathIndex(0);
  };

  // Initialize with one empty path if none exist
  useEffect(() => {
    if (paths.length === 0) {
      onChange([{ id: crypto.randomUUID(), label: 'Path 1', color: PATH_COLORS[0], points: [] }]);
    }
  }, []);

  return (
    <div className="space-y-3">
      {/* Path selector tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {paths.map((path, idx) => (
          <button
            key={path.id}
            type="button"
            onClick={() => setCurrentPathIndex(idx)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-mono flex items-center gap-1.5 transition-all",
              "border touch-manipulation",
              idx === currentPathIndex
                ? "border-primary bg-primary/10 text-foreground shadow-sm"
                : "border-border bg-muted/50 text-muted-foreground"
            )}
          >
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: path.color }} />
            {path.label}
          </button>
        ))}
        {paths.length < 5 && (
          <Button type="button" variant="outline" size="sm" onClick={addPath} className="h-8 gap-1">
            <Plus className="w-3 h-3" /> Add
          </Button>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={undoLastStroke} className="gap-1 flex-1">
          <Undo2 className="w-4 h-4" /> Undo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clearCurrentPath} className="gap-1 flex-1">
          <Trash2 className="w-4 h-4" /> Clear Path
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={clearAll} className="gap-1 flex-1">
          <Trash2 className="w-4 h-4" /> Clear All
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Draw on the field to trace autonomous paths. Use multiple paths for different routines.
      </p>
    </div>
  );
}
