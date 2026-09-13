import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
  icon?: React.ReactNode;
};

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <Card className="border-dashed shadow-none bg-muted/20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
        {icon ? icon : <Inbox className="size-10 text-muted-foreground/30 mb-2" />}
        <p className="font-semibold text-foreground">{title}</p>
        <p className="max-w-[400px] text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
