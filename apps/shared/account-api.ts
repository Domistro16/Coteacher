import type { SchoolService } from "../../delivery/school-store";
export type AccountSnapshot = Awaited<ReturnType<SchoolService["snapshot"]>> & {
  mfaRequired?: boolean;
};
export interface AccountConfig {
  managed: boolean;
  simulated: boolean;
  connectedTutor: boolean;
  liveVoice: boolean;
  connectedSpeech?: boolean;
  textProvider?: string;
  schoolUrl: string;
  teacherUrl: string;
  studentUrl: string;
}
export async function accountApi(path: string, data?: unknown) {
  const response = await fetch("/api/v1/" + path, {
    cache: "no-store",
    ...(data !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? "Please try again.");
  return value;
}
export const defaultConfig: AccountConfig = {
  managed: false,
  simulated: true,
  connectedTutor: false,
  liveVoice: false,
  schoolUrl: "http://127.0.0.1:5175",
  teacherUrl: "http://127.0.0.1:5174",
  studentUrl: "http://127.0.0.1:5173",
};
