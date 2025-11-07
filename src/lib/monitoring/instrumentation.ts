import { performance } from "perf_hooks";

interface MetricLog {
  service: "question-service";
  metric: string;
  type: "latency" | "success" | "error";
  value?: number;
  meta?: Record<string, unknown>;
  timestamp: string;
}

const SERVICE = "question-service";

function logMetric(entry: MetricLog): void {
  // Structured logs make it easier to ship metrics to an aggregator later.
  console.log(JSON.stringify(entry));
}

export async function instrument<T>(metric: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const latency = performance.now() - start;
    logMetric({
      service: SERVICE,
      metric,
      type: "latency",
      value: Number(latency.toFixed(2)),
      timestamp: new Date().toISOString(),
    });
    logMetric({
      service: SERVICE,
      metric,
      type: "success",
      timestamp: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const latency = performance.now() - start;
    logMetric({
      service: SERVICE,
      metric,
      type: "error",
      value: Number(latency.toFixed(2)),
      meta: {
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : { message: "unknown error" },
      },
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
