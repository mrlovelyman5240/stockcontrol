import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

// Auth state now comes from /auth/me (HttpOnly cookie); reject means no session.
vi.mock("../lib/api", () => ({
  authApi: {
    me: vi.fn(() => Promise.reject(new Error("not authenticated"))),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  },
}));

const Probe = () => {
  const auth = useAuth();
  return (
    <div data-testid="probe">
      {JSON.stringify({
        isAuthenticated: auth.isAuthenticated,
        loading: auth.loading,
        isBoss: auth.isBoss,
      })}
    </div>
  );
};

describe("AuthContext", () => {
  it("useAuth throws outside an AuthProvider", () => {
    // Suppress React's noisy error boundary log
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      /useAuth must be used within an AuthProvider/,
    );
    errSpy.mockRestore();
  });

  it("starts unauthenticated when /auth/me rejects (no cookie)", async () => {
    const { findByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    const node = await findByTestId("probe");
    // verifyAuth runs once; with no stored token it sets loading=false immediately.
    // We poll until the JSON reflects the settled state.
    await vi.waitFor(() => {
      const state = JSON.parse(node.textContent);
      expect(state.loading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isBoss).toBe(false);
    });
  });
});
