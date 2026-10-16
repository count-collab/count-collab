import type { HandleClientError } from "@sveltejs/kit";
import posthog from "posthog-js";
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from "$env/static/public";
import { sanitizeCaptureResult } from "$lib/utils/redact";

export async function init() {
  posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    cookieless_mode: "always",
    capture_exceptions: true,
    before_send: sanitizeCaptureResult,
  });
}

export const handleError: HandleClientError = async ({
  error,
  message,
  status,
}) => {
  posthog.capture("client_error", {
    error_name: error instanceof Error ? error.name : "UnknownError",
    status,
    ...(status >= 400 && status < 500 ? { message } : {}),
  });
  return { message, status };
};
