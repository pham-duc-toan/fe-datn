"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Medal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/common/page-header";
import { QueryState } from "@/components/common/states";
import { useAuth } from "@/components/providers/auth-provider";
import { api } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import type { LevelInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Entry = { rank: number; userId: string; displayName: string; avatarUrl: string | null; level: number; approvedCount: number };

export default function LevelPage() {
  const { me } = useAuth();
  const level = useQuery({ queryKey: ["level"], queryFn: () => api<LevelInfo>("/me/level") });
  const [period, setPeriod] = useState("month");
  const board = useQuery({ queryKey: ["leaderboard", period], queryFn: () => api<Entry[]>("/users/leaderboard", { query: { period, limit: 50 } }) });

  return (
    <>
      <PageHeader title="Cấp độ & bảng xếp hạng" description="Cấp tính từ số câu trong các bài đạt (kênh chuyên nghiệp) và điểm uy tín; uy tín giảm có thể xuống cấp." />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <QueryState query={level}>
          {(lv) => (
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">Cấp {lv.level}</CardTitle>
                <CardDescription>
                  {formatNumber(lv.approvedCount)} câu trong bài đạt · uy tín {lv.reputation ?? "chưa có"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {lv.nextLevel ? (
                  <div className="space-y-3 text-sm">
                    <p className="font-medium">Tới cấp {lv.nextLevel.level}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Nhãn được duyệt</span>
                        <span>
                          {lv.approvedCount}/{lv.nextLevel.minApproved}
                        </span>
                      </div>
                      <Progress value={Math.min(100, (lv.approvedCount / lv.nextLevel.minApproved) * 100)} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Uy tín</span>
                        <span>
                          {lv.reputation ?? 0}/{lv.nextLevel.minReputation}
                        </span>
                      </div>
                      <Progress value={Math.min(100, ((lv.reputation ?? 0) / lv.nextLevel.minReputation) * 100)} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-emerald-700">Bạn đã ở cấp cao nhất.</p>
                )}
                <div>
                  <p className="mb-2 text-sm font-medium">Huy hiệu</p>
                  {lv.badges.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có huy hiệu.</p>
                  ) : (
                    <div className="space-y-2">
                      {lv.badges.map((b) => (
                        <div key={b.code} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <Award className="size-5 text-amber-500" />
                          <span className="flex-1">{b.name}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(b.awardedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </QueryState>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Bảng xếp hạng</CardTitle>
            <Tabs value={period} onValueChange={setPeriod}>
              <TabsList>
                <TabsTrigger value="week">7 ngày</TabsTrigger>
                <TabsTrigger value="month">30 ngày</TabsTrigger>
                <TabsTrigger value="all">Mọi lúc</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <QueryState query={board} empty={(d) => d.length === 0}>
              {(d) => (
                <ol className="divide-y">
                  {d.map((e) => (
                    <li key={e.userId} className={cn("flex items-center gap-3 py-2", e.userId === me?.userId && "bg-primary/5")}>
                      <span className="w-8 text-center font-semibold tabular-nums">{e.rank <= 3 ? <Medal className={cn("mx-auto size-5", e.rank === 1 ? "text-amber-500" : e.rank === 2 ? "text-slate-400" : "text-orange-600")} /> : e.rank}</span>
                      <Avatar className="size-8">
                        {e.avatarUrl && <AvatarImage src={e.avatarUrl} alt="" />}
                        <AvatarFallback className="text-xs">{e.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate font-medium">{e.displayName}</span>
                      <span className="text-xs text-muted-foreground">cấp {e.level}</span>
                      <span className="w-20 text-right tabular-nums">{formatNumber(e.approvedCount)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </QueryState>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
