import React, { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import Svg, { Path, Line, Rect, Circle } from "react-native-svg";
import type { Candle } from "../domain/models";
import { assetPrice, cleanCandles } from "../domain/market";
import { tradingColors as colors } from "../theme";
import { m } from "./market-ui";
export function PriceChart({
  candles,
  candlestick,
  onSelect,
  onScrubStart,
  onScrubEnd,
}: {
  candles: Candle[];
  candlestick: boolean;
  onSelect: (c: Candle | null) => void;
  /** A finger landed on the chart: the page should stop scrolling. */
  onScrubStart?: () => void;
  /** The finger left the chart, or the gesture was taken away. */
  onScrubEnd?: () => void;
}) {
  const [width, setWidth] = useState(320),
    [selected, setSelected] = useState<number | null>(null);
  const c = useMemo(() => cleanCandles(candles), [candles]);
  const h = 220,
    pad = 10;
  const min = c.length ? Math.min(...c.map((x) => x.low)) : 0,
    max = c.length ? Math.max(...c.map((x) => x.high)) : 1;
  const y = (v: number) =>
    pad + (1 - (v - min) / (max - min || max * 0.01 || 1)) * (h - 2 * pad);
  const x = (i: number) =>
    pad +
    (((c[i]?.time ?? 0) - (c[0]?.time ?? 0)) /
      Math.max(1, (c.at(-1)?.time ?? 1) - (c[0]?.time ?? 0))) *
      (width - 2 * pad);
  const select = (pos: number) => {
    const i = c.reduce(
      (best, _, j) =>
        Math.abs(x(j) - pos) < Math.abs(x(best) - pos) ? j : best,
      0,
    );
    setSelected(i);
    onSelect(c[i]);
  };
  // One continuous, rounded line (Catmull-Rom through the closes, drawn as
  // cubic curves) so the price reads as a curve rather than a row of peaks.
  // Bars with no trades are simply absent; the line carries across them.
  const segments: string[] = [];
  const pts = c.map((b, i) => [x(i), y(b.close)] as const);
  if (pts.length) {
    let path = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i],
        p1 = pts[i],
        p2 = pts[i + 1],
        p3 = pts[i + 2] ?? p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6,
        c1y = p1[1] + (p2[1] - p0[1]) / 6,
        c2x = p2[0] - (p3[0] - p1[0]) / 6,
        c2y = p2[1] - (p3[1] - p1[1]) / 6;
      path += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
    }
    segments.push(path);
  }
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View
        accessibilityLabel="Price chart. Use previous and next buttons to inspect values."
        onStartShouldSetResponder={() => c.length > 0}
        onMoveShouldSetResponder={() => c.length > 0}
        onStartShouldSetResponderCapture={() => c.length > 0}
        onMoveShouldSetResponderCapture={() => c.length > 0}
        // A finger on the chart is scrubbing; the page must not scroll under it.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          onScrubStart?.();
          select(e.nativeEvent.locationX);
        }}
        onResponderMove={(e) => select(e.nativeEvent.locationX)}
        onResponderRelease={() => {
          setSelected(null);
          onSelect(null);
          onScrubEnd?.();
        }}
        onResponderTerminate={() => {
          setSelected(null);
          onSelect(null);
          onScrubEnd?.();
        }}
        style={{ height: h, justifyContent: "center" }}
      >
        {!c.length ? (
          <Text style={[m.muted, { textAlign: "center" }]}>
            No chart history available
          </Text>
        ) : (
          <Svg width={width} height={h}>
            {candlestick
              ? c.map((b, i) => {
                  const color =
                    b.close >= b.open ? colors.success : colors.error;
                  return (
                    <React.Fragment key={b.time}>
                      <Line
                        x1={x(i)}
                        x2={x(i)}
                        y1={y(b.high)}
                        y2={y(b.low)}
                        stroke={color}
                      />
                      <Rect
                        x={x(i) - Math.max(1, (width / c.length) * 0.3)}
                        y={Math.min(y(b.open), y(b.close))}
                        width={Math.max(1, (width / c.length) * 0.6)}
                        height={Math.max(1, Math.abs(y(b.open) - y(b.close)))}
                        fill={color}
                      />
                    </React.Fragment>
                  );
                })
              : segments.map((d, i) => (
                  <Path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={colors.focus}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
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
                  cy={y(c[selected].close)}
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
