import type { BodyZone, ZoneId } from "@/types/health";

/**
 * Technical-drawing SVG fallback used when WebGL is unavailable or the
 * context is lost. Zones remain selectable via plain buttons overlaid.
 */
export function FallbackFigure({
  zones,
  selectedZoneId,
  onSelect,
}: {
  zones: BodyZone[];
  selectedZoneId?: ZoneId | null;
  onSelect?: (z: BodyZone) => void;
}) {
  const zoneAt = (id: ZoneId) => zones.find((z) => z.id === id);
  const marker = (
    id: ZoneId,
    x: number,
    y: number,
    label: string,
  ) => {
    const zone = zoneAt(id);
    return (
      <g key={id}>
        <line x1={x} y1={y} x2={x + 34} y2={y - 10} stroke="var(--dim)" strokeDasharray="3 3" />
        <circle cx={x} cy={y} r="3" fill="none" stroke="var(--accent)" />
        <text x={x + 38} y={y - 14} fill="var(--muted)" fontSize="7" fontFamily="var(--font-mono)" letterSpacing="1.2">
          {label}
        </text>
        {zone && onSelect && (
          <circle
            cx={x}
            cy={y}
            r="10"
            fill="transparent"
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(zone)}
          >
            <title>{zone.name}</title>
          </circle>
        )}
      </g>
    );
  };

  return (
    <div className="fallback-figure" role="img" aria-label="Astronaut zones (2D fallback)">
      <div style={{ textAlign: "center" }}>
        <svg width="240" height="300" viewBox="0 0 240 300">
          {/* dimension lines */}
          <line x1="30" y1="20" x2="30" y2="280" stroke="var(--line)" />
          <line x1="26" y1="20" x2="34" y2="20" stroke="var(--line)" />
          <line x1="26" y1="280" x2="34" y2="280" stroke="var(--line)" />
          {/* figure */}
          <circle cx="140" cy="46" r="24" fill="none" stroke="var(--dim)" />
          <ellipse cx="140" cy="120" rx="34" ry="52" fill="none" stroke="var(--dim)" />
          <line x1="140" y1="70" x2="140" y2="168" stroke="var(--dim)" strokeDasharray="4 3" />
          <line x1="106" y1="92" x2="82" y2="160" stroke="var(--dim)" />
          <line x1="174" y1="92" x2="198" y2="160" stroke="var(--dim)" />
          <line x1="128" y1="172" x2="122" y2="250" stroke="var(--dim)" />
          <line x1="152" y1="172" x2="158" y2="250" stroke="var(--dim)" />
          <rect x="172" y="90" width="22" height="40" fill="none" stroke="var(--dim)" transform="skewY(-4)" />
          {/* zone markers */}
          {marker("head", 140, 46, "HEAD/NEURO")}
          {marker("chest", 140, 104, "CHEST/CARDIO")}
          {marker("spine", 140, 140, "SPINE/SKEL")}
          {marker("gut", 140, 158, "GUT/MICRO")}
          {marker("limbs", 198, 160, "LIMBS/MSK")}
          {marker("skin", 186, 96, "SUIT/SKIN")}
        </svg>
        <div className="micro-8" style={{ marginTop: 8 }}>
          WEBGL UNAVAILABLE — 2D TECHNICAL VIEW {selectedZoneId ? `· ${selectedZoneId}` : ""}
        </div>
      </div>
    </div>
  );
}
