import { render, waitFor } from "@testing-library/svelte";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { SparklinePoint } from "$lib/db/schema";
import Sparkline from "./Sparkline.svelte";

function mockSparklineResponse(data: SparklinePoint[], ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe("Sparkline", () => {
  beforeAll(() => {
    if (!Element.prototype.animate) {
      Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        value: vi.fn(() => {
          const animation = {
            onfinish: null,
            cancel: vi.fn(),
            play: vi.fn(),
          };
          return animation as unknown as Animation;
        }),
      });
    }
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches sparkline data from the counter endpoint on mount", async () => {
    const counterId = "counter-fetch-on-mount";
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValue(
      mockSparklineResponse([
        {
          value: 1,
          timestamp: "2026-01-01T10:00:00.000Z",
        },
      ]),
    );

    render(Sparkline, { props: { counterId } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/counters/${counterId}/sparkline`,
    );
  });

  it("renders an SVG with polyline and polygon when there are at least two points", async () => {
    const counterId = "counter-renders-svg";
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValue(
      mockSparklineResponse([
        {
          value: 3,
          timestamp: "2026-01-01T10:00:00.000Z",
        },
        {
          value: 8,
          timestamp: "2026-01-01T11:00:00.000Z",
        },
      ]),
    );

    const { container } = render(Sparkline, { props: { counterId } });

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeTruthy();
    });

    const svg = container.querySelector("svg");
    const polyline = container.querySelector("svg polyline");
    const polygon = container.querySelector("svg polygon");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 200 60");
    expect(polyline).toBeTruthy();
    expect(polyline?.getAttribute("points")).toBeTruthy();
    expect(polygon).toBeTruthy();
    expect(polygon?.getAttribute("points")).toBeTruthy();
  });

  it("does not render an SVG when the API returns one point", async () => {
    const counterId = "counter-one-point";
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValue(
      mockSparklineResponse([
        {
          value: 5,
          timestamp: "2026-01-01T10:00:00.000Z",
        },
      ]),
    );

    const { container } = render(Sparkline, { props: { counterId } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(container.querySelector("svg")).toBeNull();
  });

  it("does not render an SVG when the API returns zero points", async () => {
    const counterId = "counter-zero-points";
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValue(mockSparklineResponse([]));

    const { container } = render(Sparkline, { props: { counterId } });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(container.querySelector("svg")).toBeNull();
  });
});
