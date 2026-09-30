import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import type { ReactNode, ReactElement } from "react";

interface WrapperProps {
  children: ReactNode;
}

export function TestWrapper({ children }: WrapperProps) {
  return <BrowserRouter>{children}</BrowserRouter>;
}

function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return rtlRender(ui, { wrapper: TestWrapper, ...options });
}

export * from "@testing-library/react";
export { render };
