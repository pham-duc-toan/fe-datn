"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useProject } from "@/components/project/use-project";
import { describeLabel } from "@/lib/describe";
import type { Annotation } from "@/lib/types";

const Workspace = dynamic(() => import("./workspace").then((m) => m.Workspace), { ssr: false, loading: () => <Loader2 className="m-6 animate-spin text-muted-foreground" /> });

/**
 * Xem lại MỘT nhãn đã nộp bằng chữ + vẽ trên mẫu (workspace chỉ xem) — thay cho JSON.
 * Dùng cho labeler (lịch sử nhãn): tập nhãn lấy từ dự án của nhãn.
 */
export function LabelView({ a }: { a: Annotation }) {
  const project = useProject(a.projectId);
  const p = project.data;
  if (project.isPending) return <Loader2 className="m-4 animate-spin text-muted-foreground" />;
  if (!p?.labelSchema) return <p className="text-sm text-muted-foreground">Không tải được dự án của nhãn này.</p>;
  const lines = describeLabel(p.labelSchema, a.payload.data, a.sampleContent);
  const coMau = a.fileUrl !== null || a.sampleContent !== null;
  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">{p.name}</div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {lines.map((l) => (
          <div key={l.tool} className="contents">
            <dt className="text-muted-foreground">{l.tool}</dt>
            <dd className="font-medium">{l.text}</dd>
          </div>
        ))}
      </dl>
      {coMau && (
        <Workspace
          schema={p.labelSchema}
          modality={p.modality}
          fileUrl={a.fileUrl}
          content={a.sampleContent}
          metadata={a.sampleMetadata}
          value={a.payload.data}
          readOnly
          seed={a.sampleId}
          stacked
        />
      )}
    </div>
  );
}

/** Tên dự án (đã cache bởi useProject) — cho cột "Dự án" của lịch sử nhãn. */
export function ProjectName({ id }: { id: string }) {
  const q = useProject(id);
  return <>{q.data?.name ?? "…"}</>;
}
