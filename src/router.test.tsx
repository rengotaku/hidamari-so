import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { AppRouter } from "./router";

describe("AppRouter", () => {
  it("renders home page on root path", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: "React SPA Boilerplate" })
    ).toBeInTheDocument();
  });

  it("renders about page on /about path", () => {
    render(
      <MemoryRouter initialEntries={["/about"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
  });

  it("renders greeting form on /greeting path", () => {
    render(
      <MemoryRouter initialEntries={["/greeting"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Greeting Demo/i })).toBeInTheDocument();
  });

  it("renders greeting page with name parameter", () => {
    render(
      <MemoryRouter initialEntries={["/greeting/TestUser"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /Hello, TestUser!/i })
    ).toBeInTheDocument();
  });

  it("renders 404 page on unknown path", () => {
    render(
      <MemoryRouter initialEntries={["/unknown-path"]}>
        <AppRouter />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});
