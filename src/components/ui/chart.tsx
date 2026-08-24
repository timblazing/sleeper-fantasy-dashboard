"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

/**
 * The chart primitive every graph in the app draws through.
 *
 * Recharts wants literal color strings — it writes `fill`/`stroke` straight onto SVG nodes and
 * cannot read a Tailwind class. So a chart's palette is declared once here as a config, emitted as
 * CSS custom properties scoped to the container, and referenced by series as `var(--color-<key>)`.
 * That keeps every color in `globals.css` where the theme lives, instead of hardcoded per chart,
 * and lets a series flip between light and dark without the component knowing which is active.
 */

export type ChartConfig = Record<string, { label?: React.ReactNode; icon?: React.ComponentType; color?: string }>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

/**
 * Wraps a Recharts tree in a responsive box and publishes the config's colors as CSS variables.
 *
 * The `[&_.recharts-*]` selectors below are the reui look: axes and grid lines inherit the theme's
 * border token rather than Recharts' default hardcoded greys, so charts sit on the page like the
 * rest of the UI instead of like an embedded widget.
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  nativeResponsive = false,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  /** Let a Recharts 3 chart use its own responsive prop instead of ResponsiveContainer. */
  nativeResponsive?: boolean;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line]:stroke-border/60",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border",
          "[&_.recharts-radial-bar-background-sector]:fill-muted",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/50",
          "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
          "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-surface]:outline-hidden",
          className,
        )}
        data-chart={chartId}
        data-slot="chart"
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        {nativeResponsive ? children : (
          <RechartsPrimitive.ResponsiveContainer initialDimension={{ width: 1, height: 1 }} minWidth={0}>
            {children}
          </RechartsPrimitive.ResponsiveContainer>
        )}
      </div>
    </ChartContext.Provider>
  );
}

/** Emits `--color-<key>` for each configured series, scoped to this chart's container only. */
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorEntries = Object.entries(config).filter(([, item]) => item.color);
  if (!colorEntries.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {\n${colorEntries.map(([key, item]) => `  --color-${key}: ${item.color};`).join("\n")}\n}`,
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

/**
 * Recharts 3 stopped exporting the tooltip/legend payload shapes through its component props,
 * so the fields the content components actually read are declared here rather than inferred.
 */
type TooltipItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown> & { fill?: string };
};

type LegendItem = { value?: string; dataKey?: string | number; color?: string };

/**
 * The themed tooltip body.
 *
 * Recharts' default tooltip is a white box with a grey border that ignores dark mode entirely.
 * This one is a popover surface with a color swatch per series and monospaced figures, so numbers
 * line up column-wise when several series are stacked in one hover.
 */
function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<"div"> & {
  active?: boolean;
  payload?: TooltipItem[];
  label?: unknown;
  labelFormatter?: (label: unknown, payload: TooltipItem[]) => React.ReactNode;
  labelClassName?: string;
  formatter?: (value: unknown, name: string | number, item: TooltipItem, index: number, payload: unknown) => React.ReactNode;
  color?: string;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: "line" | "dot" | "dashed";
  nameKey?: string;
  labelKey?: string;
}) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) return null;
    const [item] = payload;
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
    const itemConfig = config[key];
    const value = !labelKey && typeof label === "string" ? (config[label]?.label ?? label) : itemConfig?.label;
    if (labelFormatter) return <div className={cn("font-medium", labelClassName)}>{labelFormatter(value, payload)}</div>;
    if (!value) return null;
    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [label, labelFormatter, payload, hideLabel, labelClassName, config, labelKey]);

  if (!active || !payload?.length) return null;

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-[9rem] items-start gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg",
        className,
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const itemConfig = config[key];
          const indicatorColor = color || item.payload?.fill || item.color;

          return (
            <div
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center",
              )}
              key={item.dataKey ?? index}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, item.payload)
              ) : (
                <>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : !hideIndicator ? (
                    <div
                      className={cn("shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)", {
                        "size-2.5": indicator === "dot",
                        "w-1": indicator === "line",
                        "w-0 border-[1.5px] border-dashed bg-transparent": indicator === "dashed",
                        "my-0.5": nestLabel && indicator === "dashed",
                      })}
                      style={{ "--color-bg": indicatorColor, "--color-border": indicatorColor } as React.CSSProperties}
                    />
                  ) : null}
                  <div className={cn("flex flex-1 justify-between leading-none", nestLabel ? "items-end" : "items-center")}>
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">{itemConfig?.label || item.name}</span>
                    </div>
                    {item.value !== undefined ? (
                      <span className="font-mono font-medium tabular-nums text-foreground">
                        {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: React.ComponentProps<"div"> & {
  payload?: LegendItem[];
  verticalAlign?: "top" | "bottom" | "middle";
  hideIcon?: boolean;
  nameKey?: string;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex items-center justify-center gap-4", verticalAlign === "top" ? "pb-3" : "pt-3", className)}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = config[key];
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground" key={item.value}>
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            )}
            {itemConfig?.label}
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
