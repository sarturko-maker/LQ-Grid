import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  /** Current width in pixels */
  width: number;
  /** Min width */
  min?: number;
  /** Max width */
  max?: number;
  /** Called when width changes */
  onResize: (width: number) => void;
  /** Which side the handle is on */
  side?: 'left' | 'right';
}

/**
 * A vertical drag handle that resizes a sidebar.
 * Place on the edge of the panel that faces the grid.
 */
export function ResizeHandle({
  width,
  min = 320,
  max = 900,
  onResize,
  side = 'left',
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startX.current = e.clientX;
      startWidth.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = side === 'left'
        ? startX.current - e.clientX
        : e.clientX - startX.current;
      const newWidth = Math.min(max, Math.max(min, startWidth.current + delta));
      onResize(newWidth);
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onResize, side]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`absolute top-0 bottom-0 w-1.5 z-30 cursor-col-resize
        group/resize transition-colors duration-150
        ${side === 'left' ? 'left-0' : 'right-0'}
        ${isDragging ? 'bg-indigo-400' : 'hover:bg-indigo-300 bg-transparent'}`}
    >
      {/* Visual indicator dots */}
      <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col gap-0.5
        ${side === 'left' ? 'left-0' : 'right-0'}
        opacity-0 group-hover/resize:opacity-100 transition-opacity duration-150
        ${isDragging ? '!opacity-100' : ''}`}>
        <div className="w-1 h-1 rounded-full bg-indigo-400" />
        <div className="w-1 h-1 rounded-full bg-indigo-400" />
        <div className="w-1 h-1 rounded-full bg-indigo-400" />
      </div>
    </div>
  );
}
