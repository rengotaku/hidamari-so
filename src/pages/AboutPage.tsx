import { Link as RouterLink } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function AboutPage() {
  return (
    <div>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">About</h1>

      <p className="mb-4 text-sm leading-relaxed">
        This is a React SPA boilerplate designed for deployment on Cloudflare Pages. It
        includes a modern tech stack with TypeScript, Tailwind CSS, shadcn/ui, and a
        comprehensive testing setup.
      </p>

      <h2 className="mb-2 mt-6 text-xl font-semibold">SPA Routing</h2>

      <p className="mb-6 text-sm leading-relaxed">
        This page demonstrates client-side routing. You can access this page directly via
        URL or by navigating from the home page. The Cloudflare Pages configuration
        ensures proper fallback routing for SPA navigation.
      </p>

      <Button asChild>
        <RouterLink to="/">Back to Home</RouterLink>
      </Button>
    </div>
  );
}
