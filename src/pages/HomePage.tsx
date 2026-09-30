import { Link as RouterLink } from "react-router-dom";
import { CheckCircle } from "lucide-react";

import { TailwindDemo } from "@/components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const FEATURES = [
  "Vite 8 + TypeScript 5.9",
  "React 19 + React Router",
  "Tailwind CSS v4 + shadcn/ui",
  "Zustand (state management)",
  "React Hook Form + Zod (forms)",
  "Vitest + Testing Library",
  "Cloudflare Pages deployment",
];

export function HomePage() {
  return (
    <div>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">React SPA Boilerplate</h1>

      <p className="mb-6 text-muted-foreground">
        A standalone SPA boilerplate optimized for Cloudflare Pages deployment.
      </p>

      <Card className="mb-6 max-w-md">
        <CardHeader>
          <h2 className="text-lg font-semibold leading-none tracking-tight">Features</h2>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <CheckCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <RouterLink to="/about">About</RouterLink>
        </Button>
        <Button asChild variant="outline">
          <RouterLink to="/greeting">Greeting Demo</RouterLink>
        </Button>
      </div>

      <TailwindDemo />
    </div>
  );
}
