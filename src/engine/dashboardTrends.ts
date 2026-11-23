import type {
  AuditEvent,
  DatasetRecord,
  ExperimentRecord,
  TextSample,
  WritingPattern,
} from './types';

export interface SparklinePoint {
  date: string; // YYYY-MM-DD
  shortDate: string; // e.g., Nov 12
  value: number;
  dailyDelta: number;
}

export interface DashboardTrends30d {
  windowStart: string;
  windowEnd: string;
  datasetsSeries: SparklinePoint[];
  samplesSeries: SparklinePoint[];
  verifiedSeries: SparklinePoint[];
  researchActivitySeries: SparklinePoint[];
}

function toDayKey(isoOrDate: string | undefined | null): string | null {
  if (!isoOrDate) return null;
  const trimmed = isoOrDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function buildDayWindow(endDayIso: string, days = 30): string[] {
  const end = new Date(`${endDayIso}T00:00:00Z`);
  const list: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end.getTime() - i * 86_400_000);
    list.push(d.toISOString().slice(0, 10));
  }
  return list;
}

function formatShortDate(dayIso: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = dayIso.split('-');
  if (parts.length !== 3) return dayIso;
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);
  return `${months[m] ?? parts[1]} ${d}`;
}

function buildCumulativeSeries(
  dayWindow: string[],
  datedItems: Array<{ day: string | null }>
): SparklinePoint[] {
  const windowStart = dayWindow[0];
  let baselineBeforeWindow = 0;
  const dailyCounts = new Map<string, number>();

  for (const item of datedItems) {
    if (!item.day) continue;
    if (item.day < windowStart) {
      baselineBeforeWindow += 1;
    } else if (item.day <= dayWindow[dayWindow.length - 1]) {
      dailyCounts.set(item.day, (dailyCounts.get(item.day) ?? 0) + 1);
    }
  }

  let running = baselineBeforeWindow;
  return dayWindow.map((day) => {
    const delta = dailyCounts.get(day) ?? 0;
    running += delta;
    return {
      date: day,
      shortDate: formatShortDate(day),
      value: running,
      dailyDelta: delta,
    };
  });
}

function buildDailyEventSeries(
  dayWindow: string[],
  datedEvents: Array<{ day: string | null }>
): SparklinePoint[] {
  const windowStart = dayWindow[0];
  const windowEnd = dayWindow[dayWindow.length - 1];
  let baseline = 0;
  const dailyCounts = new Map<string, number>();

  for (const ev of datedEvents) {
    if (!ev.day) continue;
    if (ev.day < windowStart) {
      baseline += 1;
    } else if (ev.day <= windowEnd) {
      dailyCounts.set(ev.day, (dailyCounts.get(ev.day) ?? 0) + 1);
    }
  }

  let running = baseline;
  return dayWindow.map((day) => {
    const delta = dailyCounts.get(day) ?? 0;
    running += delta;
    return {
      date: day,
      shortDate: formatShortDate(day),
      value: running,
      dailyDelta: delta,
    };
  });
}

export function buildDashboard30DayTrends(params: {
  datasets: DatasetRecord[];
  samples: TextSample[];
  patterns: WritingPattern[];
  experiments: ExperimentRecord[];
  auditLogs: AuditEvent[];
  referenceDate?: string;
}): DashboardTrends30d {
  // Determine end of 30-day window from referenceDate or latest corpus timestamp/today
  const candidateDays: string[] = [];
  if (params.referenceDate) {
    const d = toDayKey(params.referenceDate);
    if (d) candidateDays.push(d);
  } else {
    candidateDays.push(new Date().toISOString().slice(0, 10));
    for (const ds of params.datasets) {
      const d = toDayKey(ds.updated_at || ds.created_at);
      if (d) candidateDays.push(d);
    }
    for (const s of params.samples) {
      const d = toDayKey(s.provenance.collection_date);
      if (d) candidateDays.push(d);
    }
    for (const exp of params.experiments) {
      const d = toDayKey(exp.created_at);
      if (d) candidateDays.push(d);
    }
    for (const log of params.auditLogs) {
      const d = toDayKey(log.timestamp);
      if (d) candidateDays.push(d);
    }
  }

  const endDay = candidateDays.sort().pop() ?? new Date().toISOString().slice(0, 10);
  const dayWindow = buildDayWindow(endDay, 30);

  const datasetsSeries = buildCumulativeSeries(
    dayWindow,
    params.datasets.map((d) => ({ day: toDayKey(d.created_at) ?? endDay }))
  );

  const samplesSeries = buildCumulativeSeries(
    dayWindow,
    params.samples.map((s) => ({ day: toDayKey(s.provenance.collection_date) ?? endDay }))
  );

  // Verified samples trend: count verified records by their collection or latest validation date
  const verifiedSeries = buildCumulativeSeries(
    dayWindow,
    params.samples
      .filter((s) => s.validation.verified)
      .map((s) => ({ day: toDayKey(s.provenance.collection_date) ?? endDay }))
  );

  // Research & Evaluation Events: experiments + patterns + audit actions over 30 days
  const activityEvents: Array<{ day: string | null }> = [
    ...params.experiments.map((e) => ({ day: toDayKey(e.created_at) ?? endDay })),
    ...params.patterns.map((p) => ({
      day:
        toDayKey(
          params.samples.find((s) => p.supporting_samples.includes(s.sample_id))?.provenance
            .collection_date
        ) ?? endDay,
    })),
    ...params.auditLogs.map((a) => ({ day: toDayKey(a.timestamp) ?? endDay })),
  ];
  const researchActivitySeries = buildDailyEventSeries(dayWindow, activityEvents);

  return {
    windowStart: dayWindow[0],
    windowEnd: endDay,
    datasetsSeries,
    samplesSeries,
    verifiedSeries,
    researchActivitySeries,
  };
}
