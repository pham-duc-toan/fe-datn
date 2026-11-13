"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, GraduationCap, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Field } from "@/components/common/misc";
import { SpotlightTour } from "@/components/tutorial/spotlight-tour";
import { markCreatorTourDone, readTutorial } from "@/components/tutorial/tutorial-store";
import { TagPicker } from "@/components/common/tag-picker";
import { api, patch } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatVnd } from "@/lib/format";
import { TOOL_LABEL, VISIBILITY_LABEL } from "@/lib/labels";
import type { LabelSchema, Project, Readiness, ToolKind, Visibility } from "@/lib/types";
import { CREATOR_TOUR } from "./creator-tour";
import { LabelerPreview } from "./labeler-preview";
import { HelpTip, type ParamKey } from "./param-help";
import { SchemaEditor } from "./schema-editor";
import { useSetProject } from "./use-project";

/** Nhãn của một ô kèm biểu tượng ⓘ (tác dụng + chỗ labeler thấy). */
function L({ children, k }: { children: ReactNode; k: ParamKey }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children} <HelpTip k={k} />
    </span>
  );
}

/** Công cụ dùng được trên cổng link — mặc định của setting gate.allowed_tools (mục 17.5). */
const GATE_TOOLS = ["classification", "pairwise", "number", "bbox", "keypoint", "span"];

/** Văn bản điền sẵn khi bật cảnh báo nội dung / NDA — doanh nghiệp sửa lại cho đúng dự án. */
const DEFAULT_CONTENT_WARNING =
  "Dự án có thể chứa hình ảnh / nội dung nhạy cảm (bạo lực, máu me, nội dung người lớn hoặc gây khó chịu). Chỉ tham gia nếu bạn đủ tuổi và chấp nhận xem các nội dung này; bạn có thể rời dự án bất kỳ lúc nào.";

function defaultNda(projectName: string): string {
  return [
    `THOẢ THUẬN BẢO MẬT — DỰ ÁN “${projectName.trim() || "…"}”`,
    "",
    "1. Toàn bộ dữ liệu, tài liệu hướng dẫn và kết quả gán nhãn của dự án là thông tin bảo mật thuộc sở hữu của chủ dự án.",
    "2. Tôi chỉ dùng dữ liệu để thực hiện công việc gán nhãn trên nền tảng; không sao chép, chụp, tải về, chia sẻ hay công bố dưới bất kỳ hình thức nào.",
    "3. Tôi không tìm cách nhận diện cá nhân hay tổ chức xuất hiện trong dữ liệu.",
    "4. Nghĩa vụ bảo mật vẫn còn hiệu lực sau khi dự án kết thúc hoặc khi tôi rời dự án.",
    "5. Vi phạm thoả thuận có thể dẫn tới việc bị khoá tài khoản, không được trả thưởng và chịu trách nhiệm theo quy định pháp luật.",
  ].join("\n");
}

function toLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SaveCard({ title, description, children, onSave, disabled, note, tour }: { title: ReactNode; description?: ReactNode; children: ReactNode; onSave: () => Promise<unknown>; disabled?: boolean; note?: ReactNode; tour?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Card data-tour={tour}>
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

type ProjectPatchGroup = "info" | "labelSchema" | "pricing" | "channels" | "eligibility" | "protection" | "tags" | "retention";

export function ConfigTab({ project: p }: { project: Project }) {
  const setProject = useSetProject(p.id);
  const qc = useQueryClient();
  const draft = p.status === "draft";
  // PATCH /projects/{id} theo NHÓM: mỗi thẻ gửi đúng một nhóm (đủ trường của nhóm đó).
  const save = async (group: ProjectPatchGroup, body: unknown) => {
    const r = await patch<Project>(`/projects/${p.id}`, { [group]: body });
    setProject(r);
    return r;
  };

  const [name, setName] = useState(p.name);
  const [desc, setDesc] = useState(p.description);
  const [vis, setVis] = useState<Visibility>(p.visibility);
  const [schema, setSchema] = useState<LabelSchema>(p.labelSchema ?? { modality: p.modality, tools: [] });
  // Tour kiểu game cho người tạo dự án: tự mở lần đầu (dự án nháp), xem lại bằng nút "Xem lại hướng dẫn".
  const [tour, setTour] = useState(false);
  useEffect(() => {
    if (!draft || readTutorial().creatorTourDone) return;
    // Mở sau khi trang dựng xong (tour đo vị trí các vùng data-tour).
    const h = setTimeout(() => setTour(true), 300);
    return () => clearTimeout(h);
  }, [draft]);
  // Giới hạn x, y (ngưỡng đạt), số suất, thưởng tối thiểu, % phí — admin đặt trong setting, đọc qua checklist.
  const rdy = useQuery({ queryKey: ["readiness", p.id], queryFn: () => api<Readiness>(`/projects/${p.id}/readiness`) });
  const lim = rdy.data?.limits;
  const [price, setPrice] = useState({
    rewardVnd: String(p.rewardVnd || ""),
    slots: String(p.slots || ""),
    passThresholdPercent: p.passThresholdPercent || 0,
    fill: p.fillSlotsMinPercent != null,
    fillMin: p.fillSlotsMinPercent ?? 50,
    deadline: toLocal(p.deadline),
  });
  const [ch, setCh] = useState({ allowProfessional: p.allowProfessional, allowLinkGateway: p.allowLinkGateway, allowCollaborative: p.allowCollaborative });
  const [gate, setGate] = useState({ budget: p.gateBudgetVnd ? String(p.gateBudgetVnd) : "" });
  // Đơn giá nhãn khách vãng lai do admin đặt (setting) — chỉ hiển thị.
  const gateUnit = rdy.data?.gateUnitPriceVnd ?? p.gateUnitPriceVnd;
  const [el, setEl] = useState({ minLevel: p.minLevel?.toString() ?? "", minReputation: p.minReputation?.toString() ?? "", requireEntranceTest: p.requireEntranceTest, entranceQuestionCount: String(p.entranceQuestionCount), entrancePassPercent: String(p.entrancePassPercent) });
  const [prot, setProt] = useState({ sensitiveContent: p.sensitiveContent, contentWarning: p.contentWarning ?? "", ndaRequired: p.ndaRequired, ndaText: "", requireVerifiedIdentity: p.requireVerifiedIdentity });
  const [tags, setTags] = useState({ domains: p.domains, languages: p.languages });
  const [retention, setRetention] = useState(p.deleteFilesAfterClose);

  const nonGate = schema.tools.filter((t) => !GATE_TOOLS.includes(t.kind) || (t.kind === "classification" && t.allowMultiple));
  const reward = Number(price.rewardVnd) || 0;
  const slots = Number(price.slots) || 0;
  const feePct = rdy.data?.platformFeePercent ?? p.platformFeePercent ?? 0;
  const feePerPass = Math.round((reward * feePct) / 100);
  const gateBudget = ch.allowLinkGateway ? Number(gate.budget) || 0 : 0;
  const tMin = lim?.passThresholdMin ?? 60;
  const tMax = lim?.passThresholdMax ?? 95;
  const t = price.passThresholdPercent || Math.round((tMin + tMax) / 2);
  const fillMin = Math.min(price.fillMin, t);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <LabelerPreview
          project={p}
          draft={{
            name,
            description: desc,
            visibility: vis,
            schema: { ...schema, modality: p.modality },
            rewardVnd: reward,
            slots,
            passThresholdPercent: t,
            deadline: price.deadline ? new Date(price.deadline).toISOString() : null,
            allowProfessional: ch.allowProfessional,
            requireEntranceTest: el.requireEntranceTest,
            sensitiveContent: prot.sensitiveContent,
            requireVerifiedIdentity: prot.requireVerifiedIdentity,
            ndaRequired: prot.ndaRequired,
            domains: tags.domains,
            languages: tags.languages,
            escrowVnd: slots * (reward + feePerPass) + gateBudget,
          }}
        />
        <Button type="button" variant="ghost" onClick={() => setTour(true)} title="Xem lại tour giới thiệu trang cấu hình">
          <GraduationCap /> Xem lại hướng dẫn
        </Button>
        <span className="text-xs text-muted-foreground">Bấm biểu tượng ⓘ cạnh mỗi ô để xem nó làm gì với dự án và labeler thấy ở đâu.</span>
      </div>
      {tour && (
        <SpotlightTour
          steps={CREATOR_TOUR}
          finishLabel="Bắt đầu cấu hình"
          onClose={() => {
            markCreatorTourDone();
            setTour(false);
          }}
        />
      )}
      {!draft && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>Dự án đã publish: tập nhãn, tiền thưởng, số suất, ngưỡng đạt, dữ liệu, câu vàng, điều kiện không sửa được nữa.</AlertDescription>
        </Alert>
      )}
      <SaveCard title="Thông tin dự án" tour="cfg-thong-tin" onSave={() => save("info", { name, description: desc, visibility: vis })}>
        <Field label={<L k="name">Tên</L>}>
          <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={<L k="description">Mô tả</L>}>
          <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <Field label={<L k="visibility">Chế độ tham gia</L>} hint={draft ? undefined : "Chỉ đổi được khi còn nháp"}>
          <RadioGroup value={vis} onValueChange={(v) => setVis(v as Visibility)} className="flex flex-wrap gap-3" disabled={!draft}>
            {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <RadioGroupItem value={v} /> {VISIBILITY_LABEL[v]}
              </label>
            ))}
          </RadioGroup>
        </Field>
      </SaveCard>

      <SaveCard
        title="Câu hỏi và công cụ gán nhãn"
        description="Câu hỏi chung cho labeler biết phải trả lời gì về mỗi mẫu; công cụ là cách trả lời. Labeler học từng loại công cụ ở màn luyện tập trước khi làm bài — không cần viết hướng dẫn riêng."
        onSave={() => save("labelSchema", { ...schema, modality: p.modality })}
        disabled={!draft}
      >
        <SchemaEditor modality={p.modality} value={schema} onChange={setSchema} projectName={name} thresholds={lim?.matchThresholds} />
      </SaveCard>

      <SaveCard
        title="Tiền thưởng, số suất, ngưỡng đạt"
        tour="cfg-gia"
        description="Tiền tính cho CẢ DỰ ÁN: mỗi labeler làm hết các câu rồi nộp một bài. Bài đạt = giống đa số từ ngưỡng t trở lên và không sai câu kiểm tra. Mỗi suất thưởng trao cho một bài đạt, theo thứ tự nộp sớm nhất; số người được làm nhiều hơn số suất để đa số chắc hơn."
        disabled={!draft}
        onSave={() =>
          save("pricing", {
            rewardVnd: reward,
            slots,
            passThresholdPercent: t,
            fillSlotsMinPercent: price.fill ? fillMin : null,
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
          <Field label={<L k="reward">Tiền thưởng mỗi suất (đ)</L>} hint={lim ? `Tối thiểu ${formatVnd(lim.minRewardVnd)} — cho cả bài, không theo câu` : "Cho cả bài, không theo câu"}>
            <Input type="number" min={0} value={price.rewardVnd} onChange={(e) => setPrice({ ...price, rewardVnd: e.target.value })} />
          </Field>
          <Field
            label={<L k="slots">Số suất thưởng</L>}
            hint={
              lim
                ? `${lim.minSlots}–${lim.maxSlots} người được thưởng (n bài đạt nộp sớm nhất). Tối đa ${slots ? slots * lim.participantMultiplier : `n × ${lim.participantMultiplier}`} người được làm bài.`
                : "Số bài đạt nộp sớm nhất được thưởng"
            }
          >
            <Input type="number" min={lim?.minSlots ?? 1} max={lim?.maxSlots ?? 50} value={price.slots} onChange={(e) => setPrice({ ...price, slots: e.target.value })} />
          </Field>
          <Field label={<L k="deadline">Hạn chót</L>}>
            <Input type="datetime-local" value={price.deadline} onChange={(e) => setPrice({ ...price, deadline: e.target.value })} />
          </Field>
        </div>
        <Field label={<L k="passThreshold">{`Ngưỡng đạt t = ${t}%`}</L>} hint={`Tỉ lệ câu của bài giống đa số tối thiểu để được thưởng. Quản trị viên cho phép trong khoảng ${tMin}%–${tMax}%.`}>
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
        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={price.fill} onCheckedChange={(v) => setPrice({ ...price, fill: v })} disabled={!draft} /> Lấp suất còn trống <HelpTip k="fillSlots" />
          </label>
          <p className="text-xs text-muted-foreground">
            Khi số bài đạt ít hơn số suất, các suất còn lại được trao cho những bài giống đa số nhiều nhất (cùng tỉ lệ thì bài nộp sớm hơn được trước). Bài vẫn phải đúng hết câu kiểm tra.
          </p>
          {price.fill && (
            <Field label={`Giống đa số tối thiểu để được lấp suất: ${fillMin}%`} hint={`Từ 0% đến ngưỡng đạt (${t}%). Bài dưới mức này không được thưởng dù còn suất.`}>
              <Slider min={0} max={t} step={1} value={[fillMin]} onValueChange={(v) => setPrice({ ...price, fillMin: v[0] })} disabled={!draft} className="max-w-md py-2" />
            </Field>
          )}
        </div>
      </SaveCard>

      <SaveCard
        title="Kênh thu thập"
        tour="cfg-kenh"
        disabled={!draft}
        onSave={() =>
          save("channels", {
            ...ch,
            gateBudgetVnd: ch.allowLinkGateway ? Number(gate.budget) || 0 : null,
          })
        }
        note={
          ch.allowLinkGateway && nonGate.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                Cổng link chỉ nhận công cụ làm nhanh ({GATE_TOOLS.map((k) => TOOL_LABEL[k as ToolKind]).join(", ")}). Công cụ không hợp: {nonGate.map((t) => (t.kind === "classification" ? `${TOOL_LABEL[t.kind]} chọn nhiều lớp` : TOOL_LABEL[t.kind])).join(", ")} — publish sẽ bị chặn. Cổng còn cần câu vàng kiểm tra chất lượng.
              </AlertDescription>
            </Alert>
          ) : ch.allowLinkGateway ? (
            <p className="text-xs text-muted-foreground">Cổng link trả theo từng nhãn khách vãng lai gán, với đơn giá do hệ thống quy định; tiêu trong ngân sách cổng — không đụng vào tiền thưởng của labeler. Cần câu vàng mục đích “kiểm tra chất lượng”.</p>
          ) : null
        }
      >
        {ch.allowLinkGateway && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Đơn giá mỗi nhãn khách vãng lai" hint="Do hệ thống quy định, doanh nghiệp không đổi được. Chốt vào dự án lúc publish.">
              <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm font-medium tabular-nums">{formatVnd(gateUnit)} / nhãn</div>
            </Field>
            <Field label={<L k="gateBudget">Ngân sách cổng link (đ)</L>} hint="Cộng vào ký quỹ">
              <Input type="number" min={0} value={gate.budget} onChange={(e) => setGate({ ...gate, budget: e.target.value })} />
            </Field>
          </div>
        )}
        {(
          [
            ["allowProfessional", "Kênh chuyên nghiệp", "Labeler trong chợ dự án làm bài (cả dự án)", "professional"],
            ["allowLinkGateway", "Cổng vượt link", "Khách vãng lai giải 1–3 câu khi mở link rút gọn", "linkGateway"],
            ["allowCollaborative", "Gán nhãn cộng tác", "Nhiều người cùng làm (chưa mở ở bản này)", null],
          ] as const
        ).map(([k, label, hint, help]) => (
          <label key={k} className="flex items-center justify-between gap-3 rounded-md border p-3">
            <span>
              <span className="text-sm font-medium">{label}</span> {help && <HelpTip k={help} />}
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
            <Switch checked={ch[k]} onCheckedChange={(v) => setCh({ ...ch, [k]: v })} />
          </label>
        ))}
      </SaveCard>

      <SaveCard
        title="Điều kiện tham gia"
        tour="cfg-dieu-kien"
        disabled={!draft}
        onSave={() =>
          save("eligibility", {
            minLevel: el.minLevel ? Number(el.minLevel) : null,
            minReputation: el.minReputation ? Number(el.minReputation) : null,
            requireEntranceTest: el.requireEntranceTest,
            entranceQuestionCount: Number(el.entranceQuestionCount) || 10,
            entrancePassPercent: Number(el.entrancePassPercent) || 80,
          })
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={<L k="minLevel">Cấp độ tối thiểu</L>} hint="Trống = không yêu cầu">
            <Input type="number" min={1} max={5} value={el.minLevel} onChange={(e) => setEl({ ...el, minLevel: e.target.value })} />
          </Field>
          <Field label={<L k="minReputation">Uy tín tối thiểu (0–100)</L>}>
            <Input type="number" min={0} max={100} value={el.minReputation} onChange={(e) => setEl({ ...el, minReputation: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={el.requireEntranceTest} onCheckedChange={(v) => setEl({ ...el, requireEntranceTest: v })} /> Yêu cầu bài test đầu vào (cần câu vàng mục đích “bài test”) <HelpTip k="entranceTest" />
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
        tour="cfg-bao-ve"
        description="Dự án nhạy cảm chỉ nhận người đã xác minh danh tính và đủ tuổi, phải đồng ý cảnh báo trước; mẫu được che cho tới khi bấm hiện."
        disabled={!draft}
        onSave={async () => {
          await save("protection", { ...prot, contentWarning: prot.contentWarning || null, ndaText: prot.ndaRequired ? prot.ndaText || null : null });
          void qc.invalidateQueries({ queryKey: ["readiness", p.id] });
          void qc.invalidateQueries({ queryKey: ["terms", p.id] });
        }}
      >
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.sensitiveContent} onCheckedChange={(v) => setProt({ ...prot, sensitiveContent: v, contentWarning: v && !prot.contentWarning.trim() ? DEFAULT_CONTENT_WARNING : prot.contentWarning })} /> Nội dung nhạy cảm <HelpTip k="sensitive" />
        </label>
        {prot.sensitiveContent && (
          <Field label="Cảnh báo nội dung">
            <Textarea rows={2} value={prot.contentWarning} onChange={(e) => setProt({ ...prot, contentWarning: e.target.value })} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.ndaRequired} onCheckedChange={(v) => setProt({ ...prot, ndaRequired: v, ndaText: v && !prot.ndaText.trim() ? defaultNda(name) : prot.ndaText })} /> Yêu cầu ký thoả thuận bảo mật (NDA) <HelpTip k="nda" />
        </label>
        {prot.ndaRequired && (
          <Field label="Văn bản NDA" hint={p.ndaVersion ? `Phiên bản hiện tại: ${p.ndaVersion}. Nhập lại văn bản để lưu.` : "Labeler phải đọc và đồng ý trước khi vào dự án."}>
            <Textarea rows={8} value={prot.ndaText} onChange={(e) => setProt({ ...prot, ndaText: e.target.value })} />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={prot.requireVerifiedIdentity} onCheckedChange={(v) => setProt({ ...prot, requireVerifiedIdentity: v })} /> Chỉ nhận người đã xác minh danh tính <HelpTip k="verifiedIdentity" />
        </label>
      </SaveCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SaveCard
          title={<L k="tags">Chủ đề (để gợi ý labeler)</L>}
          description="Labeler có thẻ trùng với dự án sẽ thấy dự án trong mục gợi ý."
          onSave={() => save("tags", { domains: tags.domains, languages: tags.languages })}
        >
          <Field label="Lĩnh vực">
            <TagPicker kind="domain" value={tags.domains} onChange={(v) => setTags({ ...tags, domains: v })} />
          </Field>
          <Field label="Ngôn ngữ">
            <TagPicker kind="language" value={tags.languages} onChange={(v) => setTags({ ...tags, languages: v })} />
          </Field>
        </SaveCard>
        <SaveCard title={<L k="retention">Lưu trữ file</L>} description="Đồng ý để hệ thống xoá file gốc khi dự án đóng quá hạn giữ." onSave={() => save("retention", { deleteFilesAfterClose: retention })}>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={retention} onCheckedChange={setRetention} /> Xoá file gốc sau khi đóng
          </label>
          {p.filesPurgedAt && <p className="text-xs text-muted-foreground">File đã được xoá.</p>}
        </SaveCard>
      </div>
    </div>
  );
}
