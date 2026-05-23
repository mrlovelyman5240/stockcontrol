import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// vi.mock factories are hoisted to top — capture their dependencies via vi.hoisted
const { loginFn, toastError } = vi.hoisted(() => ({
  loginFn: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    login: loginFn,
    isAuthenticated: false,
    user: null,
  }),
}));

vi.mock("../contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

import Login from "./Login";

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

describe("Login", () => {
  it("renders username, password fields and submit button", () => {
    renderLogin();
    expect(screen.getByTestId("login-username")).toBeInTheDocument();
    expect(screen.getByTestId("login-password")).toBeInTheDocument();
    expect(screen.getByTestId("login-submit")).toBeInTheDocument();
  });

  it("blocks submit when fields are empty and shows inline errors", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByTestId("login-submit"));
    expect(screen.getByText("Username is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
    expect(loginFn).not.toHaveBeenCalled();
  });

  it("calls login() with entered credentials on submit", async () => {
    loginFn.mockResolvedValueOnce({ success: false, error: "bad creds" });
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByTestId("login-username"), "alice");
    await user.type(screen.getByTestId("login-password"), "secret");
    await user.click(screen.getByTestId("login-submit"));
    expect(loginFn).toHaveBeenCalledWith("alice", "secret");
  });
});
