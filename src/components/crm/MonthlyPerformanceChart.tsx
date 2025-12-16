import React from 'react';
import { MonthlyMetrics } from '@/types';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

interface MonthlyPerformanceChartProps {
  data: MonthlyMetrics[];
}

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  occupancy: {
    label: "Occupancy",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

export function MonthlyPerformanceChart({ data }: MonthlyPerformanceChartProps) {
  // Format data for chart - convert occupancy to percentage for display
  const chartData = data.map((m) => ({
    date: m.date,
    month: m.date.split('-')[1], // Extract just the month number
    revenue: Math.round(m.revenue),
    occupancy: m.occupancy, // Keep as decimal for right Y-axis (0-1)
    occupancyPercent: Math.round(m.occupancy * 100),
    adr: Math.round(m.averageDailyRate),
  }));

  // Format month label
  const formatMonth = (dateStr: string) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNum = parseInt(dateStr.split('-')[1], 10) - 1;
    return months[monthNum] || dateStr;
  };

  return (
    <ChartContainer config={chartConfig} className="h-[200px] w-full">
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="date" 
          tickFormatter={formatMonth}
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <YAxis 
          yAxisId="left" 
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          className="text-muted-foreground"
        />
        <YAxis 
          yAxisId="right" 
          orientation="right" 
          domain={[0, 1]}
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => `${Math.round(value * 100)}%`}
          className="text-muted-foreground"
        />
        <ChartTooltip 
          content={
            <ChartTooltipContent 
              formatter={(value, name) => {
                if (name === 'revenue') return [`$${Number(value).toLocaleString()}`, 'Revenue'];
                if (name === 'occupancy') return [`${Math.round(Number(value) * 100)}%`, 'Occupancy'];
                return [value, name];
              }}
            />
          }
        />
        <Bar 
          yAxisId="left" 
          dataKey="revenue" 
          fill="var(--color-revenue)" 
          radius={[4, 4, 0, 0]}
          name="revenue"
        />
        <Line 
          yAxisId="right" 
          type="monotone" 
          dataKey="occupancy" 
          stroke="var(--color-occupancy)" 
          strokeWidth={2}
          dot={{ fill: "var(--color-occupancy)", r: 3 }}
          name="occupancy"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

export default MonthlyPerformanceChart;
