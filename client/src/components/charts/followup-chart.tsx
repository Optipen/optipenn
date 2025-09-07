import { useEffect, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, BarController } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, BarController);

interface FollowupChartProps {
  data?: { [key: string]: number };
}

export default function FollowupChart({ data = {} }: FollowupChartProps) {
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
      type: "bar",
      data: {
        labels: ["1ère relance", "2ème relance", "3ème relance", "4ème relance+"],
        datasets: [
          {
            label: "Taux de conversion (%)",
            data: [
              data["1ère relance"] || 0,
              data["2ème relance"] || 0,
              data["3ème relance"] || 0,
              data["4ème relance+"] || 0,
            ],
            backgroundColor: [
              "rgba(34, 197, 94, 0.8)",
              "rgba(245, 158, 11, 0.8)",
              "rgba(249, 115, 22, 0.8)",
              "rgba(239, 68, 68, 0.8)",
            ],
            borderColor: [
              "rgb(34, 197, 94)",
              "rgb(245, 158, 11)",
              "rgb(249, 115, 22)",
              "rgb(239, 68, 68)",
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 50,
            ticks: {
              callback: function (value) {
                return value + "%";
              },
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

  return <canvas ref={canvasRef} data-testid="followup-chart-canvas" />;
}
