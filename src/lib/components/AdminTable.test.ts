import { cleanup, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import AdminTableTestWrapper from "./AdminTableTestWrapper.svelte";

const defaultColumns = [
  { key: "title", label: "Title", sortable: true },
  { key: "count", label: "Count", sortable: true, align: "right" as const },
  { key: "actions", label: "Actions" },
];

describe("AdminTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders all column headers with correct labels", () => {
    render(AdminTableTestWrapper, {
      props: { columns: defaultColumns, baseUrl: "/admin/counters" } as never,
    });

    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Count")).toBeTruthy();
    expect(screen.getByText("Actions")).toBeTruthy();
  });

  it("renders sortable columns as links and non-sortable as plain text", () => {
    render(AdminTableTestWrapper, {
      props: { columns: defaultColumns, baseUrl: "/admin/counters" } as never,
    });

    const headerRow = screen.getAllByRole("columnheader");

    // "Title" and "Count" are sortable — should contain <a> links
    const titleLink = within(headerRow[0]).getByRole("link");
    expect(titleLink).toBeTruthy();

    const countLink = within(headerRow[1]).getByRole("link");
    expect(countLink).toBeTruthy();

    // "Actions" is not sortable — should not contain a link
    const actionsLink = within(headerRow[2]).queryByRole("link");
    expect(actionsLink).toBeNull();
  });

  it("sort link for an unsorted column points to ?sort=colKey&order=asc", () => {
    render(AdminTableTestWrapper, {
      props: { columns: defaultColumns, baseUrl: "/admin/counters" } as never,
    });

    const titleLink = screen.getByRole("link", { name: /Title/ });
    expect(titleLink.getAttribute("href")).toBe(
      "/admin/counters?sort=title&order=asc",
    );
  });

  it("sort link for the currently sorted ASC column toggles to desc", () => {
    render(AdminTableTestWrapper, {
      props: {
        columns: defaultColumns,
        baseUrl: "/admin/counters",
        currentSort: "title",
        currentOrder: "asc",
      } as never,
    });

    const titleLink = screen.getByRole("link", { name: /Title/ });
    expect(titleLink.getAttribute("href")).toBe(
      "/admin/counters?sort=title&order=desc",
    );
  });

  it("sort link for the currently sorted DESC column toggles to asc", () => {
    render(AdminTableTestWrapper, {
      props: {
        columns: defaultColumns,
        baseUrl: "/admin/counters",
        currentSort: "title",
        currentOrder: "desc",
      } as never,
    });

    const titleLink = screen.getByRole("link", { name: /Title/ });
    expect(titleLink.getAttribute("href")).toBe(
      "/admin/counters?sort=title&order=asc",
    );
  });

  it("shows ▲ indicator for active ASC sort column", () => {
    render(AdminTableTestWrapper, {
      props: {
        columns: defaultColumns,
        baseUrl: "/admin/counters",
        currentSort: "title",
        currentOrder: "asc",
      } as never,
    });

    const titleHeader = screen.getAllByRole("columnheader")[0];
    expect(titleHeader.textContent).toContain("▲");
  });

  it("shows ▼ indicator for active DESC sort column", () => {
    render(AdminTableTestWrapper, {
      props: {
        columns: defaultColumns,
        baseUrl: "/admin/counters",
        currentSort: "title",
        currentOrder: "desc",
      } as never,
    });

    const titleHeader = screen.getAllByRole("columnheader")[0];
    expect(titleHeader.textContent).toContain("▼");
  });

  it("preserves extraParams in sort links", () => {
    render(AdminTableTestWrapper, {
      props: {
        columns: defaultColumns,
        baseUrl: "/admin/counters",
        extraParams: { q: "test" },
      } as never,
    });

    const titleLink = screen.getByRole("link", { name: /Title/ });
    const href = titleLink.getAttribute("href") ?? "";
    expect(href).toContain("q=test");
    expect(href).toContain("sort=title");
    expect(href).toContain("order=asc");
  });

  it("right-aligned columns get text-right class on the <th>", () => {
    render(AdminTableTestWrapper, {
      props: { columns: defaultColumns, baseUrl: "/admin/counters" } as never,
    });

    const headers = screen.getAllByRole("columnheader");

    // "Count" column has align: "right"
    expect(headers[1].className).toContain("text-right");

    // "Title" column has default left alignment
    expect(headers[0].className).toContain("text-left");
  });

  it("renders the rows snippet content inside tbody", () => {
    render(AdminTableTestWrapper, {
      props: { columns: defaultColumns, baseUrl: "/admin/counters" } as never,
    });

    expect(screen.getByText("Row 1")).toBeTruthy();
    expect(screen.getByText("Row 2")).toBeTruthy();

    // Verify rows are inside the table
    const table = screen.getByRole("table");
    expect(within(table).getByText("Row 1")).toBeTruthy();
    expect(within(table).getByText("Row 2")).toBeTruthy();
  });
});
