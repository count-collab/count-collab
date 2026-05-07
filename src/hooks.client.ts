import type { HandleClientError } from "@sveltejs/kit";
import posthog from "posthog-js";
import { PUBLIC_POSTHOG_PROJECT_TOKEN } from "$env/static/public";

export async function init() {
  posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
  });
}

export const handleError: HandleClientError = async ({
  error,
  message,
  status,
}) => {
  posthog.captureException(error);
  return { message, status };
};
