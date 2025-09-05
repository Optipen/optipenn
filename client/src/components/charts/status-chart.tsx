import { useEffect, useRef } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface StatusChartProps {
  data: Record<string, number>;
}

export default function StatusChart({ data }: StatusChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    chartRef.current = new ChartJS(ctx, {
      type: "doughnut",
      data: {
        labels: ["Acceptés", "En attente", "Relancés", "Refusés", "Envoyés"],
        datasets: [
          {
            data: [
              data["Accepté"] || 0,
              data["En attente"] || 0,
              data["Relancé"] || 0,
              data["Refusé"] || 0,
              data["Envoyé"] || 0,
            ],
            backgroundColor: [
              "rgb(34, 197, 94)",
              "rgb(245, 158, 11)",
              "rgb(249, 115, 22)",
              "rgb(239, 68, 68)",
              "rgb(59, 130, 246)",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 20,
              usePointStyle: true,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data]);

  return <canvas ref={canvasRef} data-testid="status-chart-canvas" />;
}
