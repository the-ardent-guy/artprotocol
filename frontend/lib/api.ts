/**
 * API client for Art Protocol OS backend.
 * All calls go through the Next.js proxy at /api/backend/*
 * which injects the BACKEND_API_KEY server-side.
 * Client components never need or send an API key directly.
 */

import { Client, OutputFile, KnowledgeFile, AnyBrief, JobStatus } from "./types";

const BASE = "/api/backend";

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  return apiFetch<Client[]>("/clients");
}

export async function createClient(
  name: string,
  brief: string
): Promise<{ name: string; path: string }> {
  return apiFetch("/clients", {
    method: "POST",
    body: JSON.stringify({ name, brief }),
  });
}

export async function getBrief(clientName: string): Promise<{ content: string }> {
  return apiFetch(`/client/${clientName}/brief`);
}

export async function saveBrief(
  clientName: string,
  content: string
): Promise<{ saved: boolean }> {
  return apiFetch(`/client/${clientName}/brief`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function getOutputs(clientName: string): Promise<OutputFile[]> {
  return apiFetch<OutputFile[]>(`/client/${clientName}/outputs`);
}

export async function getClientCredentials(
  clientName: string
): Promise<{ username: string; password: string }> {
  return apiFetch(`/client/${clientName}/credentials`);
}

export async function setClientCredentials(
  clientName: string,
  username: string,
  password: string
): Promise<{ saved: boolean }> {
  return apiFetch(`/client/${clientName}/credentials`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

// ─── OUTPUTS ─────────────────────────────────────────────────────────────────

export async function getOutput(path: string): Promise<{ content: string; path: string }> {
  return apiFetch(`/output/${path}`);
}

export async function saveOutputVersion(
  path: string,
  content: string
): Promise<{ saved: boolean; version: number; path: string }> {
  return apiFetch(`/output/${path}/save`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function getPdfUrl(path: string): string {
  return `${BASE}/output/${path}/pdf`;
}

// ─── CREW RUNNER ─────────────────────────────────────────────────────────────

export async function runCrew(
  clientName: string,
  crewName: string,
  brief: AnyBrief,
  brandDocPath?: string
): Promise<{ job_id: string }> {
  return apiFetch("/run-crew", {
    method: "POST",
    body: JSON.stringify({
      client_name:    clientName,
      crew_name:      crewName,
      brief,
      brand_doc_path: brandDocPath,
    }),
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  return apiFetch(`/job/${jobId}`);
}

// SSE stream URL — proxy handles auth via server-side BACKEND_API_KEY
export function getStreamUrl(jobId: string): string {
  return `/api/backend/stream/${jobId}`;
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

export async function getKnowledge(): Promise<KnowledgeFile[]> {
  return apiFetch<KnowledgeFile[]>("/knowledge");
}

export async function uploadKnowledge(
  file: File,
  tags: string
): Promise<{ uploaded: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tags", tags);

  const res = await fetch(`${BASE}/knowledge/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function deleteKnowledge(filename: string): Promise<{ deleted: string }> {
  return apiFetch(`/knowledge/${filename}`, { method: "DELETE" });
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

export function getChatStreamUrl(): string {
  return `${BASE}/chat`;
}
