"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ServiceCheck {
  key: string;
  status: "ok" | "error";
}

export interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: "online" | "offline" | "degraded" | "unknown";
  instances: number;
  memory: number | null;
  cpu: number | null;
  uptime: number | null;
  checks: ServiceCheck[];
}

export interface AgentStatus {
  id: string;
  name: string;
  description: string;
  role: string;
  status: "online" | "stopped" | "errored" | "unknown";
  memory: number | null;
  cpu: number | null;
  uptime: number | null;
  restarts: number;
  lastEvent: string | null;
}

export interface FailedTest {
  suite: string;
  name: string;
  error: string;
}

export interface TestCategory {
  passed: number;
  failed: number;
  total: number;
  failedTests: FailedTest[];
}

export interface LoadScenario {
  maxOkUsers:   number;
  maxWarnUsers: number;
  topRps:       number;
  topP99:       number;
  ok:           boolean;
}

export interface TestResults {
  lastRun: string | null;
  passed: boolean | null;
  numTests: number;
  numPassed: number;
  numFailed: number;
  duration: number;
  failedSuites: { name: string; message: string }[];
  failedTests: FailedTest[];
  categories: {
    unit:      TestCategory;
    integrity: TestCategory;
    http:      TestCategory;
  } | null;
  load: {
    ran: boolean;
    lastRun: string | null;
    scenarios: Record<string, LoadScenario>;
  } | null;
  running: boolean;
}

export interface SystemStatusResponse {
  generatedAt: string;
  services: ServiceStatus[];
  agents: AgentStatus[];
  tests: TestResults;
  telegram: { configured: boolean };
  monitor: {
    backend: { up: boolean; failures: number; restarts: number; lastCheck: string };
    frontend: { up: boolean; failures: number; restarts: number; lastCheck: string };
    updatedAt: string;
  } | null;
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system", "status"],
    queryFn: () => api.get<SystemStatusResponse>("/system/status"),
    refetchInterval: (query) => {
      const d = query.state.data as SystemStatusResponse | undefined;
      return d?.tests?.running ? 3_000 : 30_000;
    },
    refetchIntervalInBackground: false,
    staleTime: 10_000,
  });
}

export function useRunTests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ queued: boolean }>("/system/run-tests", {}),
    onSuccess: () => {
      // Immediate refetch to pick up running:true from state file
      setTimeout(() => qc.invalidateQueries({ queryKey: ["system", "status"] }), 800);
    },
  });
}
