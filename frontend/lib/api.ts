/**
 * API client for Art Protocol OS backend.
 * All calls go through Next.js rewrites (/api/backend/*) in dev,
 * or directly to NEXT_PUBLIC_API_URL in production server components.
 */

import { Client, OutputFile, KnowledgeFile, AnyBrief, JobStatus } from "./types";

const API_KEY = process.env.BACKEND_API_KEY || process.env.NEXT_PUBLIC_API_KEY || "";

function getBaseUrl() {
  // In browser: use relative path (goes through Next.js rewrite)
  if (typeof window !== "undefined") return "/api/backend";
  // In server: call directly
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const key = apiKey || API_KEY;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
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

export async function getClients(apiKey?: string): Promise<Client[]> {
  return apiFetch<Client[]>("/clients", {}, apiKey);
}

export async function createClient(
  name: string,
  brief: string,
  apiKey?: string
): Promise<{ name: string; path: string }> {
  return apiFetch("/clients", {
    method: "POST",
    body: JSON.stringify({ name, brief }),
  }, apiKey);
}

export async function getBrief(
  clientName: string,
  apiKey?: string
): Promise<{ content: string }> {
  return apiFetch(`/client/${clientName}/brief`, {}, apiKey);
}

export async function saveBrief(
  clientName: string,
  content: string,
  apiKey?: string
): Promise<{ saved: boolean }> {
  return apiFetch(`/client/${clientName}/brief`, {
    method: "POST",
    body: JSON.stringify({ content }),
  }, apiKey);
}

export async function getOutputs(
  clientName: string,
  apiKey?: string
): Promise<OutputFile[]> {
  return apiFetch<OutputFile[]>(`/client/${clientName}/outputs`, {}, apiKey);
}

export async function getClientCredentials(
  clientName: string,
  apiKey?: string
): Promise<{ username: string; password: string }> {
  return apiFetch(`/client/${clientName}/credentials`, {}, apiKey);
}

export async function setClientCredentials(
  clientName: string,
  username: string,
  password: string,
  apiKey?: string
): Promise<{ saved: boolean }> {
  return apiFetch(`/client/${clientName}/credentials`, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  }, apiKey);
}

// ─── OUTPUTS ─────────────────────────────────────────────────────────────────

export async function getOutput(
  path: string,
  apiKey?: string
): Promise<{ content: string; path: string }> {
  return apiFetch(`/output/${path}`, {}, apiKey);
}

export async function saveOutputVersion(
  path: string,
  content: string,
  apiKey?: string
): Promise<{ saved: boolean; version: number; path: string }> {
  return apiFetch(`/output/${path}/save`, {
    method: "POST",
    body: JSON.stringify({ content }),
  }, apiKey);
}

export function getPdfUrl(path: string): string {
  return `${getBaseUrl()}/output/${path}/pdf`;
}

// ─── CREW RUNNER ─────────────────────────────────────────────────────────────

export async function runCrew(
  clientName: string,
  crewName: string,
  brief: AnyBrief,
  brandDocPath?: string,
  apiKey?: string
): Promise<{ job_id: string }> {
  return apiFetch("/run-crew", {
    method: "POST",
    body: JSON.stringify({
      client_name:    clientName,
      crew_name:      crewName,
      brief,
      brand_doc_path: brandDocPath,
    }),
  }, apiKey);
}

export async function getJobStatus(
  jobId: string,
  apiKey?: string
): Promise<JobStatus> {
  return apiFetch(`/job/${jobId}`, {}, apiKey);
}

// SSE stream URL (used directly in browser)
export function getStreamUrl(jobId: string, apiKey: string): string {
  return `/api/backend/stream/${jobId}?x-api-key=${encodeURIComponent(apiKey)}`;
}

// ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

export async function getKnowledge(apiKey?: string): Promise<KnowledgeFile[]> {
  return apiFetch<KnowledgeFile[]>("/knowledge", {}, apiKey);
}

export async function uploadKnowledge(
  file: File,
  tags: string,
  apiKey?: string
): Promise<{ uploaded: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("tags", tags);

  const url = `${getBaseUrl()}/knowledge/upload`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": apiKey || API_KEY },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

export async function deleteKnowledge(
  filename: string,
  apiKey?: string
): Promise<{ deleted: string }> {
  return apiFetch(`/knowledge/${filename}`, { method: "DELETE" }, apiKey);
}

// ─── CHAT ─────────────────────────────────────────────────────────────────────

export function getChatStreamUrl(): string {
  return `${getBaseUrl()}/chat`;
}
