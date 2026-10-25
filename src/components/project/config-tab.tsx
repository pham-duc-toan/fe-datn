"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Field, Markdown } from "@/components/common/misc";
import { api, put } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatVnd } from "@/lib/format";
import { VISIBILITY_LABEL } from "@/lib/labels";
import type { Guideline, LabelSchema, Project, Readiness, Visibility } from "@/lib/types";
import { SchemaEditor } from "./schema-editor";
import { useSetProject } from "./use-project";

/** Công cụ dùng được trên cổng link — mặc định của setting gate.allowed_tools (mục 17.5). */
const GATE_TOOLS = ["classification", "pairwise", "number", "bbox", "keypoint", "span"];

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SaveCard({ title, description, children, onSave, disabled, note }: { title: string; description?: ReactNode; children: ReactNode; onSave: () => Promise<unknown>; disabled?: boolean; note?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {note}
        <Button
          disabled={busy || disabled}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave();
              toast.success("Đã lưu");
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Save />} Lưu
        </Button>
      </CardContent>
    </Card>
  );
}

export function ConfigTab({ project: p }: { project: Project }) {
  const setProject = useSetProject(p.id);
  const qc = useQueryClient();
  const draft = p.status === "draft";
  const save = async (path: string, body: unknown) => {
    const r = await put<Project>(`/projects/${p.id}${path}`, body);
    setProject(r);
    return r;
  };

  const [name, setName] = useState(p.name);
  const [desc, setDesc] = useState(p.description);
  const [vis, setVis] = useState<Visibility>(p.visibility);
  const [schema, setSchema] = useState<LabelSchema>(p.labelSchema ?? { modality: p.modality, tools: [] });
  const [guide, setGuide] = useState<Guideline>(p.guideline ?? { markdown: "", examples: [] });
  // Giới hạn x, y (ngưỡng đạt), số suất, thưởng tối thiểu, % phí — admin đặt trong setting, đọc qua checklist.
  const rdy = useQuery({ queryKey: ["readiness", p.id], queryFn: () => api<Readiness>(`/projects/${p.id}/readiness`) });
  const lim = rdy.data?.limits;
  const [price, setPrice] = useState({
    rewardVnd: String(p.rewardVnd || ""),
    slots: String(p.slots || ""),
    passThresholdPercent: p.passThresholdPercent || 0,
    deadline: toLocal(p.deadline),
  });
  const [ch, setCh] = useState({ allowProfessional: p.allowProfessional, allowLinkGateway: p.allowLinkGateway, allowCollaborative: p.allowCollaborative });
  const [gate, setGate] = useState({ unit: p.gateUnitPriceVnd ? String(p.gateUnitPriceVnd) : "", budget: p.gateBudgetVnd ? String(p.gateBudgetVnd) : "" });
  const [el, setEl] = useState({ minLevel: p.minLevel?.toString() ?? "", minReputation: p.minReputation?.toString() ?? "", requireEntranceTest: p.requireEntranceTest, entranceQuestionCount: String(p.entranceQuestionCount), entrancePassPercent: String(p.entrancePassPercent) });
  const [prot, setProt] = useState({ sensitiveContent: p.sensitiveContent, contentWarning: p.contentWarning ?? "", ndaRequired: p.ndaRequired, ndaText: "", requireVerifiedIdentity: p.requireVerifiedIdentity });
  const [tags, setTags] = useState({ domains: p.domains.join(", "), languages: p.languages.join(", ") });
  const [retention, setRetention] = useState(p.deleteFilesAfterClose);

  const nonGate = schema.tools.filter((t) => !GATE_TOOLS.includes(t.kind) || (t.kind === "classification" && t.allowMultiple));
  const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const reward = Number(price.rewardVnd) || 0;
  const slots = Number(price.slots) || 0;
  const feePct = rdy.data?.platformFeePercent ?? p.platformFeePercent ?? 0;
  const feePerPass = Math.round((reward * feePct) / 100);
  const gateBudget = ch.allowLinkGateway ? Number(gate.budget) || 0 : 0;
  const tMin = lim?.passThresholdMin ?? 60;
  const tMax = lim?.passThresholdMax ?? 95;
  const t = price.passThresholdPercent || Math.round((tMin + tMax) / 2);

  return (
    <div className="space-y-6">
      {!draft && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>Dự án đã publish: tập nhãn, tiền thưởng, số suất, ngưỡng đạt, dữ liệu, câu vàng, điều kiện không sửa được nữa.</AlertDescription>
        </Alert>
      )}
      <SaveCard title="Thông tin dự án" onSave={() => save("", { name, description: desc, visibility: vis })}>
        <Field label="Tên">
          <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label="Chế độ tham gia" hint={draft ? undefined : "Chỉ đổi được khi còn nháp"}>
          <RadioGroup value={vis} onValueChange={(v) => setVis(v as Visibility)} className="flex flex-wrap gap-3" disabled={!draft}>
            {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={v} /> {VISIBILITY_LABEL[v]}
              </label>
            ))}
          </RadioGroup>
        </Field>
      </SaveCard>

      <SaveCard title="Tập nhãn" description="Mỗi công cụ là một câu hỏi trên màn hình gán nhãn, theo đúng thứ tự." onSave={() => save("/label-schema", { ...schema, modality: p.modality })} disabled={!draft}>
        <SchemaEditor modality={p.modality} value={schema} onChange={setSchema} projectName={name} />
      </SaveCard>

      <SaveCard title="Hướng dẫn gán nhãn" description="Markdown; hiển thị cho labeler trước khi làm. Ví dụ đúng / sai giúp labeler hiểu nhanh." onSave={() => save("/guideline", guide)} disabled={!draft}>
        <Tabs defaultValue="sua">
          <TabsList>
            <TabsTrigger value="sua">Soạn</TabsTrigger>
            <TabsTrigger value="xem">Xem trước</TabsTrigger>
          </TabsList>
          <TabsContent value="sua">
            <Textarea rows={10} className="font-mono text-sm" value={guide.markdown} onChange={(e) => setGuide({ ...guide, markdown: e.target.value })} placeholder="# Hướng dẫn&#10;- Chọn lớp đúng nhất cho ảnh…" />
          </TabsContent>
          <TabsContent value="xem">
            <div className="min-h-32 rounded-md border p-3">{guide.markdown ? <Markdown>{guide.markdown}</Markdown> : <p className="text-sm text-muted-foreground">Chưa có nội dung.</p>}</div>
          </TabsContent>
        </Tabs>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ví dụ minh hoạ</span>
            <Button type="button" size="xs" variant="outline" onClick={() => setGuide({ ...guide, examples: guide.examples.concat([{ sampleId: null, label: "", isCorrect: true, explanation: "" }]) })}>
              <Plus /> Thêm ví dụ
            </Button>
          </div>
          {guide.examples.map((ex, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Input placeholder="sampleId (tuỳ chọn)" value={ex.sampleId ?? ""} onChange={(e) => setGuide({ ...guide, examples: guide.examples.map((x, k) => (k === i ? { ...x, sampleId: e.target.value || null } : x)) })} />
              <Input placeholder="Nhãn" value={ex.label ?? ""} onChange={(e) => setGuide({ ...guide, examples: guide.examples.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox checked={ex.isCorrect} onCheckedChange={(c) => setGuide({ ...guide, examples: guide.examples.map((x, k) => (k === i ? { ...x, isCorrect: c === true } : x)) })} /> Đúng
              </label>
              <Button type="button" size="icon-sm" variant="ghost" onClick={() => setGuide({ ...guide, examples: guide.examples.filter((_, k) => k !== i) })}>
                <Trash2 />
              </Button>
              <Input className="sm:col-span-4" placeholder="Giải thích" value={ex.explanation ?? ""} onChange={(e) => setGuide({ ...guide, examples: guide.examples.map((x, k) => (k === i ? { ...x, explanation: e.target.value } : x)) })} />
            </div>
          ))}
        </div>
      </SaveCard>

      <SaveCard
        title="Tiền thưởng, số suất, ngưỡng đạt"
        description="Tiền tính cho CẢ DỰ ÁN: mỗi labeler làm hết các câu rồi nộp một bài. Bài đạt = giống đa số từ ngưỡng t trở lên và không sai câu kiểm tra. Mỗi suất thưởng trao cho một bài đạt, theo thứ tự nộp sớm nhất; số người được làm nhiều hơn số suất để đa số chắc hơn."
        disabled={!draft}
        onSave={() =>
          save("/pricing", {
            rewardVnd: reward,
            slots,
            passThresholdPercent: t,
            deadline: price.deadline ? new Date(price.deadline).toISOString() : null,
          })
        }
        note={
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p>
              Phí nền tảng {feePct}% mỗi bài đạt: <b>{formatVnd(feePerPass)}</b>. Ký quỹ = {slots || "…"} suất × ({formatVnd(reward)} + {formatVnd(feePerPass)})
              {gateBudget > 0 && <> + ngân sách cổng link {formatVnd(gateBudget)}</>} = <b>{formatVnd(slots * (reward + feePerPass) + gateBudget)}</b>.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ký quỹ chỉ tính theo số suất thưởng — người làm thêm không tốn tiền. Suất không có bài đạt được hoàn về ví khi dự án kết thúc. Số câu hiện tại: {rdy.data?.questionCount ?? p.questionCount} câu.
            </p>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tiền thưởng mỗi suất (đ)" hint={lim ? `Tối thiểu ${formatVnd(lim.minRewardVnd)} — cho cả bài, không theo câu` : "Cho cả bài, không theo câu"}>
            <Input type="number" min={0} value={price.rewardVnd} onChange={(e) => setPrice({ ...price, rewardVnd: e.target.value })} />
          </Field>
          <Field
            label="Số suất thưởng"
            hint={
              lim
                ? `${lim.minSlots}–${lim.maxSlots} người được thưởng (n bài đạt nộp sớm nhất). Tối đa ${slots ? slots * lim.participantMultiplier : `n × ${lim.participantMultiplier}`} người được làm bài.`
                : "Số bài đạt nộp sớm nhất được thưởng"
            }
          >
            <Input type="number" min={lim?.minSlots ?? 1} max={lim?.maxSlots ?? 50} value={price.slots} onChange={(e) => setPrice({ ...price, slots: e.target.value })} />
          </Field>
          <Field label="Hạn chót">
            <Input type="datetime-local" value={price.deadline} onChange={(e) => setPrice({ ...price, deadline: e.target.value })} />
          </Field>
        </div>
        <Field label={`Ngưỡng đạt t = ${t}%`} hint={`Tỉ lệ câu của bài giống đa số tối thiểu để được thưởng. Quản trị viên cho phép trong khoảng ${tMin}%–${tMax}%.`}>
          <Slider
            min={tMin}
            max={tMax}
            step={1}
            value={[Math.min(Math.max(t, tMin), tMax)]}
            onValueChange={(v) => setPrice({ ...price, passThresholdPercent: v[0] })}
            disabled={!draft}
            className="max-w-md py-2"
          />
        </Field>
      </SaveCard>

      <SaveCard
        title="Kênh thu thập"
        disabled={!draft}
        onSave={() =>
          save("/channels", {
            ...ch,
            gateUnitPriceVnd: ch.allowLinkGateway ? Number(gate.unit) || 0 : null,
            gateBudgetVnd: ch.allowLinkGateway ? Number(gate.budget) || 0 : null,
          })
        }
        note={
          ch.allowLinkGateway && nonGate.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                Cổng link chỉ nhận công cụ làm nhanh ({GATE_TOOLS.join(", ")}). Công cụ không hợp: {nonGate.map((t) => t.name).join(", ")} — publish sẽ bị chặn. Cổng còn cần câu vàng kiểm tra chất lượng.
              </AlertDescription>
            </Alert>
          ) : ch.allowLinkGateway ? (
            <p className="text-xs text-muted-foreground">Cổng link trả theo từng lượt khách gán (đơn giá riêng), tiêu trong ngân sách cổng — không đụng vào tiền thưởng của labeler. Cần câu vàng mục đích “kiểm tra chất lượng”.</p>
          ) : null
        }
      >
        {ch.allowLinkGateway && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đơn giá cổng link / nhãn khách gán (đ)">
              <Input type="number" min={0} value={gate.unit} onChange={(e) => setGate({ ...gate, unit: e.target.value })} />
            </Field>
            <Field label="Ngân sách cổng link (đ)" hint="Cộng vào ký quỹ">
              <Input type="number" min={0} value={gate.budget} onChange={(e) => setGate({ ...gate, budget: e.target.value })} />
            </Field>
          </div>
        )}
        {(
          [
            ["allowProfessional", "Kênh chuyên nghiệp", "Labeler trong chợ dự án làm bài (cả dự án)"],
            ["allowLinkGateway", "Cổng vượt link", "Khách vãng lai giải 1–3 câu khi mở link rút gọn"],
            ["allowCollaborative", "Gán nhãn cộng tác", "Nhiều người cùng làm (chưa mở ở bản này)"],
          ] as const
        ).map(([k, label, hint]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span>
              <span className="text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <Switch checked={ch[k]} onCheckedChange={(v) => setCh({ ...ch, [k]: v })} />
          </label>
        ))}
      </SaveCard>

      <SaveCard
        title="Điều kiện tham gia"
        disabled={!draft}
        onSave={() =>
          save("/eligibility", {
            minLevel: el.minLevel ? Number(el.minLevel) : null,
            minReputation: el.minReputation ? Number(el.minReputation) : null,
            requireEntranceTest: el.requireEntranceTest,
            entranceQuestionCount: Number(el.entranceQuestionCount) || 10,
            entrancePassPercent: Number(el.entrancePassPercent) || 80,
          })
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cấp độ tối thiểu" hint="Trống = không yêu cầu">
            <Input type="number" min={1} max={5} value={el.minLevel} onChange={(e) => setEl({ ...el, minLevel: e.target.value })} />
          </Field>
          <Field label="Uy tín tối thiểu (0–100)">
            <Input type="number" min={0} max={100} value={el.minReputation} onChange={(e) => setEl({ ...el, minReputation: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={el.requireEntranceTest} onCheckedChange={(v) => setEl({ ...el, requireEntranceTest: v })} /> Yêu cầu bài test đầu vào (cần câu vàng mục đích “bài test”)
        </label>
        {el.requireEntranceTest && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Số câu mỗi bài">
              <Input type="number" value={el.entranceQuestionCount} onChange={(e) => setEl({ ...el, entranceQuestionCount: e.target.value })} />
            </Field>
            <Field label="Điểm đạt (%)">
              <Input type="number" value={el.entrancePassPercent} onChange={(e) => setEl({ ...el, entrancePassPercent: e.target.value })} />
            </Field>
          </div>
        )}
      </SaveCard>

      <SaveCard
        title="Bảo vệ nội dung & NDA"
        description="Dự án nhạy cảm chỉ nhận người đã xác minh danh tính và đủ tuổi, phải đồng ý cảnh báo trước; mẫu được che cho tới khi bấm hiện."
        disabled={!draft}
        onSave={async () => {
          // /protection trả về điều khoản (không phải dự án) — tải lại dự án thay vì ghi đè.
          await put(`/projects/${p.id}/protection`, { ...prot, contentWarning: prot.contentWarning || null, ndaText: prot.ndaRequired ? prot.ndaText || null : null });
          await qc.invalidateQueries({ queryKey: ["project", p.id] });
          void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
          void qc.invalidateQueries({ queryKey: ["terms", p.id] });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.sensitiveContent} onCheckedChange={(v) => setProt({ ...prot, sensitiveContent: v })} /> Nội dung nhạy cảm
        </label>
        {prot.sensitiveContent && (
          <Field label="Cảnh báo nội dung">
            <Textarea rows={2} value={prot.contentWarning} onChange={(e) => setProt({ ...prot, contentWarning: e.target.value })} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.ndaRequired} onCheckedChange={(v) => setProt({ ...prot, ndaRequired: v })} /> Yêu cầu ký thoả thuận bảo mật (NDA)
        </label>
        {prot.ndaRequired && (
          <Field label="Văn bản NDA" hint={p.ndaVersion ? `Phiên bản hiện tại: ${p.ndaVersion}. Nhập lại văn bản để lưu.` : undefined}>
            <Textarea rows={5} value={prot.ndaText} onChange={(e) => setProt({ ...prot, ndaText: e.target.value })} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.requireVerifiedIdentity} onCheckedChange={(v) => setProt({ ...prot, requireVerifiedIdentity: v })} /> Chỉ nhận người đã xác minh danh tính
        </label>
      </SaveCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SaveCard title="Chủ đề (để gợi ý labeler)" onSave={() => save("/tags", { domains: split(tags.domains), languages: split(tags.languages) })}>
          <Field label="Lĩnh vực" hint="Ngăn cách bằng dấu phẩy">
            <Input value={tags.domains} onChange={(e) => setTags({ ...tags, domains: e.target.value })} />
          </Field>
          <Field label="Ngôn ngữ" hint="vd: vi, en">
            <Input value={tags.languages} onChange={(e) => setTags({ ...tags, languages: e.target.value })} />
          </Field>
        </SaveCard>
        <SaveCard title="Lưu trữ file" description="Đồng ý để hệ thống xoá file gốc khi dự án đóng quá hạn giữ." onSave={() => save("/retention", { deleteFilesAfterClose: retention })}>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={retention} onCheckedChange={setRetention} /> Xoá file gốc sau khi đóng
          </label>
          {p.filesPurgedAt && <p className="text-xs text-muted-foreground">File đã được xoá.</p>}
        </SaveCard>
      </div>
    </div>
  );
}
