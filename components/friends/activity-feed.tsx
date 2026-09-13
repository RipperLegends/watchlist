import Link from "next/link";
import { Clock, Film, Star, PlayCircle, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export type Activity = {
  id: number;
  status: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    name: string;
    avatarUrl?: string;
  };
  entry: {
    id: number;
    title: string;
    type: string;
    posterUrl?: string;
  };
};

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  planned: { label: "в планах", icon: <Clock className="size-4" />, color: "text-blue-500" },
  watching: { label: "дивиться", icon: <PlayCircle className="size-4" />, color: "text-amber-500" },
  completed: { label: "переглянуто", icon: <CheckCircle2 className="size-4" />, color: "text-emerald-500" },
  dropped: { label: "покинуто", icon: <Film className="size-4" />, color: "text-destructive" },
};

function formatRelativeTime(date: Date) {
  const rtf = new Intl.RelativeTimeFormat("uk", { numeric: "auto" });
  const diffInDays = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffInDays === 0) {
    const diffInHours = Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60));
    if (diffInHours === 0) {
      const diffInMinutes = Math.round((date.getTime() - Date.now()) / (1000 * 60));
      return rtf.format(diffInMinutes, "minute");
    }
    return rtf.format(diffInHours, "hour");
  }
  return rtf.format(diffInDays, "day");
}

export function FriendActivityFeed({ activities }: { activities: Activity[] }) {
  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Стрічка активності</CardTitle>
          <CardDescription>Тут будуть відображатися останні перегляди ваших друзів.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState title="Поки що тихо" description="Ваші друзі ще не додавали нових фільмів." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Стрічка активності друзів</CardTitle>
        <CardDescription>Що нового додали ваші друзі до своїх списків.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activities.map((activity) => {
          const conf = statusConfig[activity.status] || { label: activity.status, icon: <Film className="size-4" />, color: "text-muted-foreground" };
          const timeAgo = formatRelativeTime(new Date(activity.updatedAt));

          return (
            <div key={activity.id} className="flex gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
              <Link href={`/profile/${activity.user.id}`} className="shrink-0">
                <Avatar className="size-10">
                  <AvatarImage src={activity.user.avatarUrl || ""} alt={activity.user.name} />
                  <AvatarFallback>{activity.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
              
              <div className="flex flex-1 flex-col gap-1">
                <div className="text-sm">
                  <Link href={`/profile/${activity.user.id}`} className="font-bold hover:underline">
                    {activity.user.name}
                  </Link>
                  {" "}
                  <span className="text-muted-foreground">додав(ла) фільм</span>
                  {" "}
                  <Link href={`/catalog/${activity.entry.id}`} className="font-semibold text-primary hover:underline">
                    {activity.entry.title}
                  </Link>
                </div>
                
                <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground mt-1">
                  <div className={`flex items-center gap-1 ${conf.color}`}>
                    {conf.icon}
                    <span>{conf.label}</span>
                  </div>
                  <span>•</span>
                  <span>{timeAgo}</span>
                </div>
              </div>

              {activity.entry.posterUrl && activity.entry.posterUrl.trim() && (
                <Link href={`/catalog/${activity.entry.id}`} className="shrink-0">
                  <div className="h-16 w-12 overflow-hidden rounded border bg-muted">
                    <img src={activity.entry.posterUrl} alt={activity.entry.title} className="h-full w-full object-cover" />
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
