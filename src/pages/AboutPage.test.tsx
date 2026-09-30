import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { AboutPage } from "./AboutPage";

describe("AboutPage", () => {
  it("renders about heading", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });

  it("renders description text", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/React SPA boilerplate/i)).toBeInTheDocument();
  });

  it("renders back to home button", () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: "Back to Home" })).toBeInTheDocument();
  });
});
