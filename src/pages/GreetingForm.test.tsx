import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { GreetingForm } from "./GreetingForm";

const renderGreetingForm = () => {
  return render(
    <BrowserRouter>
      <GreetingForm />
    </BrowserRouter>
  );
};

describe("GreetingForm", () => {
  it("renders the heading", () => {
    renderGreetingForm();
    expect(screen.getByRole("heading", { name: /Greeting Demo/i })).toBeInTheDocument();
  });

  it("renders name input field", () => {
    renderGreetingForm();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
  });

  it("renders submit button", () => {
    renderGreetingForm();
    expect(screen.getByRole("button", { name: /Say Hello/i })).toBeInTheDocument();
  });

  it("shows validation error for empty name", async () => {
    const user = userEvent.setup();
    renderGreetingForm();

    const submitButton = screen.getByRole("button", { name: /Say Hello/i });
    await user.click(submitButton);

    expect(await screen.findByText(/Name is required/i)).toBeInTheDocument();
  });
});
