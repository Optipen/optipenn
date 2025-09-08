export interface PerformanceMetrics {
  totalRequests: number;
  requestsByStatus: Record<number, number>;
  averageResponseTime: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: string;
  }>;
  dbConnectionPool: {
    active: number;
    idle: number;
    total: number;
  };
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  uptime: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private requestCounts: Map<number, number> = new Map();
  private responseTimes: number[] = [];
  private slowQueries: Array<{ query: string; duration: number; timestamp: string }> = [];
  private startTime: number = Date.now();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordRequest(status: number, responseTime: number): void {
    // Update request counts by status
    this.requestCounts.set(status, (this.requestCounts.get(status) || 0) + 1);

    // Track response times (keep only last 1000 for memory efficiency)
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  recordSlowQuery(query: string, duration: number): void {
    // Only track queries slower than 100ms
    if (duration > 100) {
      this.slowQueries.push({
        query: query.length > 100 ? query.substring(0, 97) + "..." : query,
        duration,
        timestamp: new Date().toISOString(),
      });

      // Keep only last 50 slow queries
      if (this.slowQueries.length > 50) {
        this.slowQueries = this.slowQueries.slice(-50);
      }
    }
  }

  getMetrics(): PerformanceMetrics {
    const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
    const requestsByStatus: Record<number, number> = {};
    this.requestCounts.forEach((count, status) => {
      requestsByStatus[status] = count;
    });

    const averageResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
      : 0;

    const memoryUsage = process.memoryUsage();

    return {
      totalRequests,
      requestsByStatus,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100, // Round to 2 decimals
      slowQueries: [...this.slowQueries],
      dbConnectionPool: {
        active: 0, // Would be actual pool stats in real implementation
        idle: 0,
        total: 0,
      },
      memoryUsage: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100, // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
        external: Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100, // MB
      },
      uptime: Math.round((Date.now() - this.startTime) / 1000), // seconds
    };
  }

  reset(): void {
    this.requestCounts.clear();
    this.responseTimes = [];
    this.slowQueries = [];
    this.startTime = Date.now();
  }
}

export const metrics = MetricsCollector.getInstance();