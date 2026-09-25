# Loading states

While a screen's first load is pending it shows a placeholder that has the same geometry as the content it stands in for, so nothing shifts when data arrives. Placeholders are grey blocks and circles that pulse together (one shared opacity animation between 45% and 95%).

- Lists use SkeletonRows, sized to AssetRow (plain or card variant).
- Home tiles use SkeletonTiles at the tile width; the balance shows a block until the portfolio loads.
- The token page uses a full-page skeleton (header, price and headline figure, chart area, two cards); the chart alone shows a chart-sized block while candles load.
- The profile uses a header, stats, tabs and rows skeleton. Dividends shows a block in place of the "Received" figure.

LoadState accepts a skeleton prop for these layout-specific placeholders and falls back to rows.
