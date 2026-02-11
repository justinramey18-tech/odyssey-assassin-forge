import { useMemo } from 'react';
import { type SpellTemplate, type GridSize, type SpellColorId, getSpellTemplateCells, getSpellColorById } from './types';

interface SpellTemplateOverlayProps {
  templates: SpellTemplate[];
  gridSize: GridSize;
  cellSize: number;
  onDeleteTemplate?: (id: string) => void;
}

export function SpellTemplateOverlay({ templates, gridSize, cellSize, onDeleteTemplate }: SpellTemplateOverlayProps) {
  const renderedTemplates = useMemo(() => {
    return templates.map(template => {
      const cells = getSpellTemplateCells(template, gridSize);
      const colorInfo = getSpellColorById(template.color as SpellColorId);
      return { template, cells, colorInfo };
    });
  }, [templates, gridSize]);

  if (templates.length === 0) return null;

  return (
    <>
      {renderedTemplates.map(({ template, cells, colorInfo }) => (
        <div key={template.id} className="contents">
          {cells.map(({ x, y }) => (
            <div
              key={`${template.id}-${x}-${y}`}
              className="absolute pointer-events-none rounded-sm"
              style={{
                left: x * cellSize,
                top: y * cellSize,
                width: cellSize,
                height: cellSize,
                backgroundColor: colorInfo.fill,
                border: `1.5px solid ${colorInfo.stroke}`,
                zIndex: 15,
              }}
            />
          ))}
          {/* Origin marker — clickable to delete */}
          <button
            className="absolute z-20 flex items-center justify-center group cursor-pointer"
            style={{
              left: template.originX * cellSize,
              top: template.originY * cellSize,
              width: cellSize,
              height: cellSize,
            }}
            title="Click to remove this spell template"
            onClick={() => onDeleteTemplate?.(template.id)}
          >
            <div
              className="rounded-full border-2 border-white/80 transition-transform group-hover:scale-125 group-hover:border-destructive"
              style={{
                width: cellSize * 0.35,
                height: cellSize * 0.35,
                backgroundColor: colorInfo.color,
                boxShadow: `0 0 6px ${colorInfo.color}`,
              }}
            />
          </button>
          {/* Direction indicator line */}
          <svg
            className="absolute inset-0 pointer-events-none z-20"
            style={{ overflow: 'visible' }}
          >
            <line
              x1={template.originX * cellSize + cellSize / 2}
              y1={template.originY * cellSize + cellSize / 2}
              x2={template.directionX * cellSize + cellSize / 2}
              y2={template.directionY * cellSize + cellSize / 2}
              stroke={colorInfo.stroke}
              strokeWidth={2}
              strokeDasharray="4 2"
              opacity={0.8}
            />
          </svg>
        </div>
      ))}
    </>
  );
}
