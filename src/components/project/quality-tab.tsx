"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/common/misc";
import { ToneBadge } from "@/components/common/status-badge";
import { QueryState } from "@/components/common/states";
import { UserName } from "@/components/common/user-name";
import { api } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { FINISH_REASON } from "@/lib/labels";
import type { Project } from "@/lib/types";

type Summary = {
  labelCount: number;
  attemptsSubmitted: number;
  attemptsGraded: number;
  attemptsPassed: number;
  attemptsFailed: number;
  collectionReason: string | null;
  collectionFinishedAt: string | null;
  gradedAt: string | null;
  majorityUsed: boolean | null;
  samplesEvaluated: number;
  agreed: number;
  disputed: number;
  notApplicable: number;
  goldAnswers: number;
  goldAccuracyPercent: number | null;
  tools: { tool: string; krippendorffAlpha: number | null; fleissKappa: number | null; alphaMetric: string | null; itemCount: number; labelCount: number; computedAt: string | null }[];
  archivedAt: string | null;
};
type LabelerQ = {
  labelerId: string;
  attemptId: string;
  labelCount: number;
  questionCount: number;
  submittedAt: string;
  agreementPercent: number | null;
  agreementSampleCount: number | null;
  matchedCount: number | null;
  passed: boolean | null;
  goldAnswers: number;
  goldAccuracyPercent: number | null;
  dawidSkeneSkill: Record<string, number>;
  reputation: number | null;
  stapleMask?: Record<string, { sensitivity: number; specificity: number; sampleCount: number }>;
};

const METRIC: Record<string, string> = { nominal: "danh nghĩa", interval: "khoảng", cer: "CER", kendall: "Kendall", set_f1: "1 − F1 tập đối tượng" };

export function QualityTab({ project: p }: { project: Project }) {
  const sum = useQuery({ queryKey: ["quality", p.id], queryFn: () => api<Summary>(`/quality/projects/${p.id}/summary`) });
  const lab = useQuery({ queryKey: ["quality-labelers", p.id], queryFn: () => api<LabelerQ[]>(`/quality/projects/${p.id}/labelers`) });
  return (
    <div className="space-y-6">
      <QueryState query={sum}>
        {(s) => (
          <>
            {s.archivedAt && <p className="text-xs text-muted-foreground">Số liệu chốt ngày {formatDateTime(s.archivedAt)}.</p>}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Bài đã chấm"
                value={s.gradedAt ? `${s.attemptsGraded}` : "Chưa chấm"}
                hint={s.gradedAt ? `chấm ${formatDateTime(s.gradedAt)}${s.collectionReason ? ` · đóng vì ${FINISH_REASON[s.collectionReason] ?? s.collectionReason}` : ""}` : `${s.attemptsSubmitted} bài đã nộp`}
              />
              <StatCard label="Đạt / chưa đạt" value={`${s.attemptsPassed} / ${s.attemptsFailed}`} hint={s.majorityUsed === false ? "ít hơn 3 bài: chỉ xét câu kiểm tra" : undefined} />
              <StatCard label="Câu có đa số / hoà phiếu" value={`${s.agreed} / ${s.disputed}`} hint={`${s.samplesEvaluated} câu được so · ${s.labelCount} câu trả lời`} />
              <StatCard label="Đúng câu kiểm tra" value={s.goldAccuracyPercent !== null ? `${s.goldAccuracyPercent}%` : "—"} hint={`${s.goldAnswers} lượt trả lời`} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Mức đồng thuận theo công cụ</CardTitle>
                <CardDescription>Krippendorff alpha: 1 = nhất trí hoàn toàn, ≤ 0 = như đoán bừa. Cập nhật theo lô.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Công cụ</TableHead>
                      <TableHead>Alpha</TableHead>
                      <TableHead>Fleiss&apos; kappa</TableHead>
                      <TableHead>Thang đo</TableHead>
                      <TableHead>Mẫu / nhãn</TableHead>
                      <TableHead>Tính lúc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.tools.map((t) => (
                      <TableRow key={t.tool}>
                        <TableCell className="font-medium">{t.tool}</TableCell>
                        <TableCell>{formatNumber(t.krippendorffAlpha, 3)}</TableCell>
                        <TableCell>{formatNumber(t.fleissKappa, 3)}</TableCell>
                        <TableCell>{t.alphaMetric ? METRIC[t.alphaMetric] ?? t.alphaMetric : "—"}</TableCell>
                        <TableCell>
                          {t.itemCount} / {t.labelCount}
                        </TableCell>
                        <TableCell>{formatDateTime(t.computedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>
      <Card>
        <CardHeader>
          <CardTitle>Từng bài làm</CardTitle>
          <CardDescription>
            Giống đa số = số câu khớp kết quả gộp / số câu so được (câu bỏ trống tính là không khớp). Kỹ năng Dawid–Skene (0–1) cần ≥ 5 nhãn; STAPLE chỉ để tham khảo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QueryState query={lab} empty={(d) => d.length === 0}>
            {(d) => (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Người làm</TableHead>
                    <TableHead>Đã trả lời</TableHead>
                    <TableHead>Giống đa số</TableHead>
                    <TableHead>Câu kiểm tra</TableHead>
                    <TableHead>Kết quả</TableHead>
                    <TableHead>Dawid–Skene</TableHead>
                    <TableHead>STAPLE (nhạy / đặc hiệu)</TableHead>
                    <TableHead>Uy tín</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((l) => (
                    <TableRow key={l.attemptId}>
                      <TableCell>
                        <UserName id={l.labelerId} withAvatar />
                        <div className="text-xs text-muted-foreground">nộp {formatDateTime(l.submittedAt)}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {l.labelCount}/{l.questionCount}
                      </TableCell>
                      <TableCell>{l.agreementPercent !== null ? `${l.agreementPercent}% (${l.matchedCount}/${l.agreementSampleCount})` : "—"}</TableCell>
                      <TableCell>{l.goldAccuracyPercent !== null ? `${l.goldAccuracyPercent}% (${l.goldAnswers})` : "—"}</TableCell>
                      <TableCell>{l.passed === null ? <ToneBadge tone="muted">Chờ chấm</ToneBadge> : <ToneBadge tone={l.passed ? "success" : "danger"}>{l.passed ? "Đạt" : "Chưa đạt"}</ToneBadge>}</TableCell>
                      <TableCell className="text-xs">
                        {Object.entries(l.dawidSkeneSkill).map(([k, v]) => (
                          <div key={k}>
                            {k}: {formatNumber(v, 2)}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="text-xs">
                        {Object.entries(l.stapleMask ?? {}).map(([k, v]) => (
                          <div key={k}>
                            {k}: {formatNumber(v.sensitivity, 2)} / {formatNumber(v.specificity, 2)}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>{l.reputation ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
