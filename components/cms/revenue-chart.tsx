"use client";

import { useMemo } from "react";
import {
  Chart as ReactChart,
  type AxisOptions,
  type ChartOptions,
} from "react-charts";
import { useTheme } from "next-themes";
import { rupees, type Point } from "@/lib/cms/client";

type RevenueDatum = { date: Date; amount: number };
const colors = ["#ff5722"];
const tooltip: ChartOptions<RevenueDatum>["tooltip"] = {
  render: ({ focusedDatum }) =>
    focusedDatum ? (
      <div className="revenue-tooltip">
        <strong>{dateFormatter.format(focusedDatum.originalDatum.date)}</strong>
        <span>{rupees(focusedDatum.originalDatum.amount)}</span>
      </div>
    ) : null,
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function Chart({ points }: { points: Point[] }) {
  const { resolvedTheme } = useTheme();
  const data = useMemo(
    () => [
      {
        label: "Delivered fare revenue",
        data: points.map((point) => ({
          date: new Date(point.date),
          amount: Number(point.amount) || 0,
        })),
      },
    ],
    [points],
  );
  const primaryAxis = useMemo<AxisOptions<RevenueDatum>>(
    () => ({
      getValue: (datum) => datum.date,
      scaleType: "time",
      showGrid: false,
      formatters: {
        scale: (date) => dateFormatter.format(date).replace(/ \d{4}$/, ""),
      },
    }),
    [],
  );
  const secondaryAxes = useMemo<AxisOptions<RevenueDatum>[]>(
    () => [
      {
        getValue: (datum) => datum.amount,
        scaleType: "linear",
        elementType: "line",
        showDatumElements: true,
        min: 0,
        tickCount: 3,
        formatters: { scale: (value) => rupees(value) },
      },
    ],
    [],
  );
  const total = data[0].data.reduce((sum, point) => sum + point.amount, 0);
  const unavailable = points.some(
    (point) => point.amount == null || !Number.isFinite(Number(point.amount)),
  );

  if (unavailable) {
    return <p className="chart-note">Revenue data is unavailable.</p>;
  }

  return (
    <>
      <div className="legend">
        <span>● Delivered fare revenue</span>
        <span>Selected period · INR</span>
      </div>
      {points.length > 0 ? (
        <>
          <div
            className="revenue-chart"
            role="img"
            aria-label={`Delivered fare revenue: ${rupees(total)} in the selected period`}
          >
            <ReactChart
              options={{
                data,
                primaryAxis,
                secondaryAxes,
                dark: resolvedTheme === "dark",
                defaultColors: colors,
                tooltip,
              }}
            />
          </div>
          <details className="revenue-chart-details">
            <summary>View revenue by date</summary>
            <ul>
              {data[0].data.map((point) => (
                <li key={point.date.toISOString()}>
                  <span>{dateFormatter.format(point.date)}</span>
                  <strong>{rupees(point.amount)}</strong>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="chart-note">No revenue data for this period.</p>
      )}
      {points.length > 0 && (
        <p className="chart-note">Selected-period total: {rupees(total)}</p>
      )}
    </>
  );
}
