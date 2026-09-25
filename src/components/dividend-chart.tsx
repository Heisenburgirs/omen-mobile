import React, { useMemo, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { tradingColors as colors } from "../theme";
import { m } from "./market-ui";
export type DividendPoint = { time: number; usd: number };
/**
 * Dividends paid over time: the price chart's line, drawn from a zero
 * baseline with a soft fill beneath, so a quiet day reads as a dip rather
 * than a gap. Scrubbing reports the bucket under the finger.
 */
export function DividendChart({
  points,
  loading = false,
  onSelect,
  onScrubStart,
  onScrubEnd,
}: {
  points: DividendPoint[];
  /** The first series is on its way: keep the space, say nothing yet. */
  loading?: boolean;
  onSelect: (p: DividendPoint | null) => void;
  onScrubStart?: () => void;
  onScrubEnd?: () => void;
}) {
  const [width, setWidth] = useState(320),
    [selected, setSelected] = useState<number | null>(null);
  const c = useMemo(
    () =>
      [...points]
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.usd))
        .sort((a, b) => a.time - b.time),
    [points],
  );
  const h = 180,
    pad = 10;
  const max = c.length ? Math.max(...c.map((p) => p.usd), 0) : 1;
  const y = (v: number) => pad + (1 - v / (max || 1)) * (h - 2 * pad);
  const x = (i: number) =>
    pad + (c.length > 1 ? i / (c.length - 1) : 0.5) * (width - 2 * pad);
  const select = (pos: number) => {
    if (!c.length) return;
    const i = c.reduce(
      (best, _, j) => (Math.abs(x(j) - pos) < Math.abs(x(best) - pos) ? j : best),
      0,
    );
    setSelected(i);
    onSelect(c[i]);
  };
  // The same rounded curve as the price chart, closed down to the baseline
  // for the fill.
  const pts = c.map((p, i) => [x(i), y(p.usd)] as const);
  let line = "";
  if (pts.length) {
    line = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[i + 2] ?? p2;
      // A smoothed curve overshoots next to a spike: on the short windows
      // (mostly empty buckets, then one payout) it swung below the zero line
      // and out of the drawing, which showed as the chart being cut off.
      // Each control point stays within the heights of the two points it
      // joins, so the line can never leave the band between them.
      const lo = Math.min(p1[1], p2[1]),
        hi = Math.max(p1[1], p2[1]);
      const within = (v: number) => Math.min(hi, Math.max(lo, v));
      line += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${within(p1[1] + (p2[1] - p0[1]) / 6)} ${
        p2[0] - (p3[0] - p1[0]) / 6
      } ${within(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
    }
  }
  const area = pts.length
    ? line + ` L${pts[pts.length - 1][0]} ${y(0)} L${pts[0][0]} ${y(0)} Z`
    : "";
  const clear = () => {
    setSelected(null);
    onSelect(null);
    onScrubEnd?.();
  };
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View
        accessibilityLabel="Dividends chart"
        onStartShouldSetResponder={() => c.length > 0}
        onMoveShouldSetResponder={() => c.length > 0}
        onStartShouldSetResponderCapture={() => c.length > 0}
        onMoveShouldSetResponderCapture={() => c.length > 0}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          onScrubStart?.();
          select(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => select(e.nativeEvent.locationX)}
        onResponderRelease={clear}
        onResponderTerminate={clear}
        style={{ height: h, justifyContent: "center" }}
      >
        {!c.length ? (
          loading ? null : (
            <Text style={[m.muted, { textAlign: "center" }]}>No dividends yet</Text>
          )
        ) : (
          <Svg width={width} height={h}>
            <Path d={area} fill={colors.success} fillOpacity={0.12} />
            <Line
              x1={pad}
              x2={width - pad}
              y1={y(0)}
              y2={y(0)}
              stroke={colors.line}
              strokeWidth={1}
            />
            <Path
              d={line}
              fill="none"
              stroke={colors.success}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {selected !== null && c[selected] ? (
              <>
                <Line
                  x1={x(selected)}
                  x2={x(selected)}
                  y1={0}
                  y2={h}
                  stroke={colors.muted}
                  strokeDasharray="3 4"
                />
                <Circle
                  cx={x(selected)}
                  cy={y(c[selected].usd)}
                  r={4}
                  fill={colors.ice}
                />
              </>
            ) : null}
          </Svg>
        )}
      </View>
    </View>
  );
}
