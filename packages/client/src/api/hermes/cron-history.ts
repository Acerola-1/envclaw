import { request } from '../client'

export interface RunEntry {
  jobId: string
  fileName: string
  runTime: string
  size: number
  status?: string       // 'ok' | 'error' | 'running'
  error?: string        // last error message
  runCount?: number     // cumulative run count (from scheduler metadata)
  hasOutput?: boolean
  synthetic?: boolean
}

export interface RunDetail {
  jobId: string
  fileName: string
  runTime: string
  content: string
}

export async function listCronRuns(jobId?: string): Promise<RunEntry[]> {
  const params = new URLSearchParams()
  if (jobId) params.set('jobId', jobId)
  const qs = params.toString()
  const res = await request<{ runs: RunEntry[] }>(`/api/cron-history${qs ? `?${qs}` : ''}`)
  return res.runs
}

export async function readCronRun(jobId: string, fileName: string): Promise<RunDetail> {
  return request<RunDetail>(`/api/cron-history/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`)
}
