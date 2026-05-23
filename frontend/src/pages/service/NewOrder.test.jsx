import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../lib/api", () => ({
  inventoryApi: {
    getAll: vi.fn(() =>
      Promise.resolve({
        data: [
          { id: "p1", name: "Plain Item", price: 10, stock: 100, variants: [] },
          {
            id: "p2",
            name: "Pack Item",
            price: 5,
            stock: 60,
            variants: [
              { name: "Single", price: 5, units_per: 1 },
              { name: "Pack of 6", price: 25, units_per: 6 },
            ],
          },
        ],
      }),
    ),
  },
  usersApi: {
    getDrivers: vi.fn(() =>
      Promise.resolve({ data: [{ id: "d1", username: "driver1" }] }),
    ),
  },
  ordersApi: { create: vi.fn() },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import NewOrder from "./NewOrder";

const renderPage = () =>
  render(
    <MemoryRouter>
      <NewOrder />
    </MemoryRouter>,
  );

describe("NewOrder happy path render", () => {
  it("loads inventory + drivers and shows the order page", async () => {
    renderPage();
    expect(await screen.findByTestId("new-order-page")).toBeInTheDocument();
    expect(screen.getByText("New Order")).toBeInTheDocument();
    expect(screen.getByTestId("search-products")).toBeInTheDocument();
  });

  it("renders products with stock indicators in base-stock units", async () => {
    renderPage();
    expect(await screen.findByTestId("product-p1")).toBeInTheDocument();
    expect(screen.getByTestId("product-p2")).toBeInTheDocument();
    // 'X left' shows base stock for the parent product (cart-aware getRemaining)
    expect(screen.getByText("100 left")).toBeInTheDocument();
    expect(screen.getByText("60 left")).toBeInTheDocument();
  });
});
