import React, { useRef, useEffect, useCallback, useState } from 'react';
import decodeFieldImg from '@/assets/decode-field.png';
import { type DrawnPath, getStrokes, isEmptyPath } from '@/lib/autoPaths';

interface AutoPathsViewerProps {
  paths: DrawnPath[];
}

/** Read-only renderer for saved auto paths (stroke-aware, hi-DPI). */
export function AutoPathsViewer({ paths }: AutoPathsViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(400);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgReady, setImgReady] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = decodeFieldImg;
    img.onload = () => {
      imgRef.current = img;
      setImgReady(true);
    };
  }, []);

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

    paths.forEach((path) => {
      const strokes = getStrokes(path);
      ctx.strokeStyle = path.color;
      ctx.fillStyle = path.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      strokes.forEach((s) => {
        if (s.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(s[0].x * size, s[0].y * size);
        for (let i = 1; i < s.length; i++) ctx.lineTo(s[i].x * size, s[i].y * size);
        ctx.stroke();
      });
      const first = strokes[0]?.[0];
      if (first) {
        ctx.beginPath();
        ctx.arc(first.x * size, first.y * size, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [paths, size]);

  useEffect(() => {
    redraw();
  }, [redraw, imgReady]);

  const nonEmptyPaths = paths.filter((p) => !isEmptyPath(p));
  if (nonEmptyPaths.length === 0) return null;

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {nonEmptyPaths.map((path) => (
          <span key={path.id} className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: path.color }} />
            {path.label}
          </span>
        ))}
      </div>
      <div
        ref={containerRef}
        className="relative w-full max-w-md rounded-lg overflow-hidden border border-border"
        style={{ aspectRatio: '1 / 1' }}
      >
        <canvas
          ref={canvasRef}
          width={size * dpr}
          height={size * dpr}
          style={{ width: size, height: size }}
          className="block w-full h-full"
        />
      </div>
    </div>
  );
}
