import { useEffect, useRef } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useGreetingStore } from "@/hooks/useGreetingStore";

export function GreetingPage() {
  const { name } = useParams<{ name: string }>();
  const { visitCount, incrementVisit } = useGreetingStore();
  const hasIncremented = useRef(false);

  useEffect(() => {
    if (name && !hasIncremented.current) {
      hasIncremented.current = true;
      incrementVisit(name);
    }
  }, [name, incrementVisit]);

  const decodedName = name ? decodeURIComponent(name) : "Guest";

  return (
    <div className="text-center">
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Hello, {decodedName}!</h1>

      <Card className="mx-auto my-8 max-w-sm">
        <CardContent className="p-6">
          <p className="text-lg font-medium text-muted-foreground">
            You are visitor #{visitCount}
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="outline" size="lg">
        <RouterLink to="/greeting">Try Another Name</RouterLink>
      </Button>
    </div>
  );
}
