import React, { useRef, useEffect, useCallback, useState } from 'react';
import decodeFieldImg from '@/assets/decode-field.png';
import type { DrawnPath } from '@/components/pit-scout/DrawableFieldMap';

interface AutoPathsViewerProps {
  paths: DrawnPath[];
}

export function AutoPathsViewer({ paths }: AutoPathsViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 400, height: 400 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = decodeFieldImg;
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
  }, []);

  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setCanvasSize({ width: w, height: w });
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

    if (imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    paths.forEach((path) => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x * canvas.width, path.points[0].y * canvas.height);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x * canvas.width, path.points[i].y * canvas.height);
      }
      ctx.stroke();

      // Start dot
      ctx.beginPath();
      ctx.fillStyle = path.color;
      ctx.arc(path.points[0].x * canvas.width, path.points[0].y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }, [paths, canvasSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const nonEmptyPaths = paths.filter(p => p.points.length >= 2);
  if (nonEmptyPaths.length === 0) return null;

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
      <div ref={containerRef} className="relative w-full max-w-md rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full"
        />
      </div>
    </div>
  );
}
