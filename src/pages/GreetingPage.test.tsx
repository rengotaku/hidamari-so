import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { GreetingPage } from "./GreetingPage";

const renderGreetingPage = (name: string) => {
  return render(
    <MemoryRouter initialEntries={[`/greeting/${name}`]}>
      <Routes>
        <Route path="/greeting/:name" element={<GreetingPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("GreetingPage", () => {
  it("displays greeting with name from URL", () => {
    renderGreetingPage("Takuya");
    expect(screen.getByRole("heading", { name: /Hello, Takuya!/i })).toBeInTheDocument();
  });

  it("displays visit count", () => {
    renderGreetingPage("Guest");
    expect(screen.getByText(/visitor #/i)).toBeInTheDocument();
  });

  it("renders back button", () => {
    renderGreetingPage("Test");
    expect(screen.getByRole("link", { name: /Try Another Name/i })).toBeInTheDocument();
  });

  it("handles URL-encoded names", () => {
    renderGreetingPage("John%20Doe");
    expect(
      screen.getByRole("heading", { name: /Hello, John Doe!/i })
    ).toBeInTheDocument();
  });
});
