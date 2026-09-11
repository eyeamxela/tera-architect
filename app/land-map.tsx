'use client';
import { useState } from 'react';
import {
  Compass,
  Plus,
  Ruler,
  Waves,
  Sprout,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Undo2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Feature, Point, plantingPoints } from './data';
type Props = {
  parcelRings?: Point[][];
  imageLabel?: string;
  features: Feature[];
  selected: string;
  onSelect: (id: string) => void;
  boundary: boolean;
  planting: boolean;
  scale: number;
  spacing: number;
  onMeasure?: () => void;
  onDraw?: (points: Point[]) => void;
  image?: string;
  imageHeight?: number;
  interactive?: boolean;
  revision?: number;
};
export default function LandMap({
  features,
  parcelRings,
  imageLabel,
  selected,
  onSelect,
  boundary,
  planting,
  scale,
  spacing,
  onMeasure,
  onDraw,
  image = '/property-aerial.png',
  imageHeight = 800,
  interactive = true,
  revision = 3,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [vertices, setVertices] = useState<Point[]>([]);
  const choose = (id: string) => {
    if (!drawing) onSelect(id);
  };
  return (
    <div className={`map-panel ${drawing ? 'drawing' : ''}`}>
      <div className="map-top-label">
        <i /> PROPERTY PLAN{' '}
        <span>REV. {String(revision).padStart(2, '0')}</span>
      </div>
      <div className="north">
        <Compass size={24} />
        <span>N</span>
      </div>
      <svg
        viewBox={`0 0 1200 ${imageHeight}`}
        preserveAspectRatio="xMidYMid slice"
        className="aerial-canvas"
        aria-label="Interactive property plan"
        onClick={(e) => {
          if (!drawing) return;
          const svg = e.currentTarget;
          const p = svg.createSVGPoint();
          p.x = e.clientX;
          p.y = e.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const q = p.matrixTransform(m.inverse());
          const x = 600 + (q.x - 600) / zoom,
            y = imageHeight / 2 + (q.y - imageHeight / 2) / zoom;
          if (x >= 0 && x <= 1200 && y >= 0 && y <= imageHeight)
            setVertices((v) => [...v, [x, y]]);
        }}
      >
        <g
          transform={`translate(600 ${imageHeight / 2}) scale(${zoom}) translate(-600 ${-imageHeight / 2})`}
        >
          <image
            href={image}
            x="0"
            y="0"
            width="1200"
            height={imageHeight}
            preserveAspectRatio="none"
            className="aerial-photo"
          />
          {boundary && parcelRings && (
            <path
              d={parcelRings
                .map((r) => 'M ' + r.map((p) => p.join(',')).join(' L ') + ' Z')
                .join(' ')}
              fill="none"
              stroke="#d8f4ad"
              strokeWidth="2"
              strokeDasharray="9 7"
            />
          )}
          {boundary && image === '/property-aerial.png' && (
            <polygon
              points="170,85 950,65 1040,590 390,735 175,590"
              fill="none"
              stroke="#c0d9ad"
              strokeWidth="1.8"
              strokeDasharray="9 7"
            />
          )}
          {features.map((f, index) => {
            const tree = f.kind === 'trees',
              path = f.kind === 'path';
            if (tree && !planting) return null;
            const color = tree
              ? '#e0ce92'
              : path
                ? '#d7b990'
                : f.kind === 'area'
                  ? '#c7e3a5'
                  : '#9bdae0';
            return (
              <g
                key={f.id}
                onClick={() => choose(f.id)}
                className="map-feature"
                tabIndex={interactive ? 0 : -1}
                role="button"
                aria-label={`Select ${f.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(f.id);
                  }
                }}
              >
                {path ? (
                  <polyline
                    points={f.points.map((p) => p.join(',')).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={selected === f.id ? 7 : 5}
                    strokeDasharray="8 5"
                  />
                ) : (
                  <polygon
                    points={f.points.map((p) => p.join(',')).join(' ')}
                    fill={color + (selected === f.id ? '28' : '0d')}
                    stroke={color}
                    strokeWidth={selected === f.id ? 3 : 1.5}
                    strokeDasharray={tree ? '6 5' : undefined}
                  />
                )}
                {tree &&
                  plantingPoints(f.points, scale, spacing).map(([x, y], i) => (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r="4.2"
                        fill={color}
                        stroke="#18251c"
                        strokeWidth="1.5"
                      />
                      <path
                        d={`M${x - 2} ${y}h4M${x} ${y - 2}v4`}
                        stroke="#23351f"
                        strokeWidth=".7"
                      />
                    </g>
                  ))}
                {selected === f.id &&
                  !path &&
                  !tree &&
                  f.points
                    .filter((_, i) => i % 3 === 0)
                    .map(([x, y], i) => (
                      <rect
                        key={i}
                        x={x - 3}
                        y={y - 3}
                        width="6"
                        height="6"
                        fill={color}
                        stroke="#13291f"
                        strokeWidth="1"
                      />
                    ))}
                <g
                  transform={`translate(${Math.max(15, Math.min(990, Math.min(...f.points.map((p) => p[0]))))} ${Math.max(35, Math.min(imageHeight - 30, Math.min(...f.points.map((p) => p[1])) - 15))})`}
                >
                  <rect
                    x="0"
                    y="-22"
                    width={f.name.length * 7 + 55}
                    height="35"
                    rx="2"
                    fill="#101b15ed"
                    stroke={color}
                    strokeWidth=".8"
                  />
                  <circle cx="16" cy="-4" r="3" fill={color} />
                  <text
                    x="28"
                    y="0"
                    fill="#e5edde"
                    fontSize="12"
                    fontFamily="Arial,sans-serif"
                  >
                    {String(index + 1).padStart(2, '0')} {f.name}
                  </text>
                </g>
              </g>
            );
          })}
          {vertices.length > 0 && (
            <>
              <polyline
                points={vertices.map((p) => p.join(',')).join(' ')}
                fill="#c7e3a525"
                stroke="#d4f0b2"
                strokeWidth="2"
              />
              {vertices.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="4" fill="#d4f0b2" />
              ))}
            </>
          )}
        </g>
      </svg>
      {interactive && (
        <div className="map-tool-strip">
          {drawing ? (
            <>
              <span className="draw-help">{vertices.length} points</span>
              <Button
                variant="ghost"
                aria-label="Undo point"
                onClick={() => setVertices((v) => v.slice(0, -1))}
              >
                <Undo2 size={16} />
              </Button>
              <Button
                variant="ghost"
                disabled={vertices.length < 3}
                onClick={() => {
                  onDraw?.(vertices);
                  setVertices([]);
                  setDrawing(false);
                }}
              >
                <Check size={16} /> Save area
              </Button>
              <Button
                variant="ghost"
                aria-label="Cancel drawing"
                onClick={() => {
                  setDrawing(false);
                  setVertices([]);
                }}
              >
                <X size={16} />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                aria-label="Zoom in"
                disabled={zoom >= 2}
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
              >
                <ZoomIn size={17} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Zoom out"
                disabled={zoom <= 1}
                onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
              >
                <ZoomOut size={17} />
              </Button>
              <span />
              <Button variant="ghost" onClick={onMeasure}>
                <Ruler size={16} /> Scale
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDrawing(true);
                  setVertices([]);
                }}
              >
                <Plus size={16} /> Draw area
              </Button>
            </>
          )}
        </div>
      )}
      {drawing && (
        <div className="map-drawing-tip">
          <MousePointer2 size={14} /> Click the corners of your work area
        </div>
      )}
      <div className="map-bottom">
        <span>
          {imageLabel ||
            (image.startsWith('blob:') || image.startsWith('data:')
              ? 'Your image · Session only'
              : 'Illustrative aerial · Sample geometry')}
        </span>
        <span className="scale-bar">
          {scale ? `${Math.round(100 * scale)} ft / 100 px` : 'Scale required'}
        </span>
      </div>
    </div>
  );
}
