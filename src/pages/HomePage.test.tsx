import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("renders the title", () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(
      screen.getByRole("heading", { name: "React SPA Boilerplate" })
    ).toBeInTheDocument();
  });

  it("renders features section", () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(screen.getByRole("heading", { name: "Features" })).toBeInTheDocument();
  });

  it("renders navigation link to about page", () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    const link = screen.getByRole("link", { name: "About" });
    expect(link).toHaveAttribute("href", "/about");
  });
});
