import { request } from '../client'

export async function getJobs(): Promise<{ data: any[] }> {
  try {
    const res = await request<{ jobs: any[] }>('/api/hermes/jobs?include_disabled=true')
    return { data: res.jobs ?? [] }
  } catch {
    return { data: [] }
  }
}

export interface CreateJobPayload {
  name: string
  capabilities: string[]
  schedule: string
  pushChannels: string[]
  prompt?: string
  skills?: string[]
  mcps?: string[]
}

export function createJob(payload: CreateJobPayload) {
  return request('/api/hermes/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getJobRuns(jobId: string) {
  return request(`/api/hermes/jobs/${jobId}/runs`)
}

export function runJob(jobId: string) {
  return request(`/api/hermes/jobs/${jobId}/run`, { method: 'POST' })
}

export function toggleJob(jobId: string, action: 'pause' | 'resume') {
  return request(`/api/hermes/jobs/${jobId}/${action}`, { method: 'POST' })
}

export function deleteJob(jobId: string) {
  return request(`/api/hermes/jobs/${jobId}`, { method: 'DELETE' })
}
