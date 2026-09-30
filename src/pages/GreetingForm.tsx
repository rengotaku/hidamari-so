import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useGreetingStore } from "@/hooks/useGreetingStore";

const nameSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name is too long"),
});

type NameFormData = z.infer<typeof nameSchema>;

export function GreetingForm() {
  const navigate = useNavigate();
  const { visitCount, lastVisitor } = useGreetingStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameFormData>({
    resolver: zodResolver(nameSchema),
  });

  const onSubmit = (data: NameFormData) => {
    navigate(`/greeting/${encodeURIComponent(data.name)}`);
  };

  const nameErrorId = errors.name ? "name-error" : undefined;

  return (
    <div>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">Greeting Demo</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Enter your name to receive a personalized greeting.
      </p>

      {visitCount > 0 && (
        <Card className="mb-6 bg-primary text-primary-foreground">
          <CardContent className="p-4">
            <p className="text-sm">
              Total visits: {visitCount}
              {lastVisitor && ` | Last visitor: ${lastVisitor}`}
            </p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Your Name
          </label>
          <Input
            id="name"
            autoFocus
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={nameErrorId}
            {...register("name")}
          />
          {errors.name && (
            <p id={nameErrorId} className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <Button type="submit">Say Hello</Button>
      </form>
    </div>
  );
}
