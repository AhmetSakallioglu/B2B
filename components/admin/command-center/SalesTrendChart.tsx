"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CommandCenterTrendMonth } from "@/types/admin-command-center";
import { formatPrice } from "@/lib/order-display";

type SalesTrendChartProps = {
  data: CommandCenterTrendMonth[];
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-700/50 dark:bg-navy">
      <p className="mb-1.5 font-semibold text-slate-900 dark:text-cream">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-slate-600 dark:text-cream/75" style={{ color: entry.color }}>
          {entry.name}: {formatPrice(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const chartData = data.map((month) => ({
    name: month.monthLabel,
    "Order revenue": month.completedOrderRevenue,
    "Client quotes": month.clientQuoteRevenue,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="quotesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) =>
              value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
            }
            width={48}
          />
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
            iconType="circle"
          />
          <Area
            type="monotone"
            dataKey="Order revenue"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#ordersGradient)"
          />
          <Area
            type="monotone"
            dataKey="Client quotes"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#quotesGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
