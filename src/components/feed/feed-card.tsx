"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  AudioLines, CalendarClock, CircleHelp, Clock, Columns2, Compass, EyeOff, FileCheck2, FileText, Heart, Image as ImageIcon,
  ImageOff, Info, ListOrdered, Lock, ScrollText, ShieldAlert, Sparkles, Trophy, UserCheck, Video, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { ToneBadge } from "@/components/common/status-badge";
import { useTags } from "@/hooks/use-tags";
import { formatDate, formatVnd } from "@/lib/format";
import { FEED_REASON_LABEL, MODALITY_LABEL, TOOL_LABEL, toolKindsText } from "@/lib/labels";
import { ghiMoThe } from "@/lib/reco-events";
import type { FeedCard as Card, FeedTool, Modality } from "@/lib/types";
import { cn } from "@/lib/utils";
import { laTheChu, PreviewMedia } from "./preview-media";

type Props = {
  p: Card;
  requestId: string | null;
  sessionId: string | null;
  /** Thẻ đang ở giữa màn (video tự phát, ra khỏi màn thì dừng). */
  active?: boolean;
  onNotInterested?: () => void;
  /** Đã thích / bỏ thích xong (trang "Dự án đã thích" bỏ thẻ khỏi danh sách). */
  onLikedChange?: (liked: boolean) => void;
  /** Bản xem trước cho doanh nghiệp — không ghi lượt mở, nút không bấm được. */
  preview?: boolean;
};

const MODALITY_ICON: Record<Modality, LucideIcon> = {
  image: ImageIcon,
  text: FileText,
  audio: AudioLines,
  video: Video,
  pair: Columns2,
  list: ListOrdered,
};

/**
 * Một dự án = một màn (F3 kiểu TikTok, kiến trúc 3.39). Lấp đầy khung cha, bố cục theo bề rộng KHUNG (container query):
 * hẹp → khung xem trước (1 mẫu + toàn bộ câu hỏi, công cụ) ở trên, hàng nút dọc bên phải, thông tin chính ở dưới,
 * "Chi tiết" mở bảng đầy đủ; rộng → khung xem trước bên trái, toàn bộ thông tin bên phải. KHÔNG có số người đang làm.
 * Lượt hiện do trang feed ghi (thẻ ra giữa màn).
 */
export function FeedCard({ p, requestId, sessionId, active = true, onNotInterested, onLikedChange, preview }: Props) {
  const [chiTiet, setChiTiet] = useState(false);
  const [thich, setThich] = useState(p.liked);
  const [dangThich, setDangThich] = useState(false);
  const moDuAn = () => ghiMoThe(p.id, p.position, requestId, sessionId);

  // Thích để làm sau (3.40): đổi ngay trên giao diện, lỗi thì trả lại.
  const doiThich = async () => {
    if (preview || dangThich) return;
    const moi = !thich;
    setThich(moi);
    setDangThich(true);
    try {
      await api(`/reco/likes/${p.id}`, { method: moi ? "PUT" : "DELETE", query: { sessionId: sessionId ?? undefined } });
      if (moi) toast.success("Đã thích — xem lại ở mục Dự án đã thích.");
      onLikedChange?.(moi);
    } catch (e) {
      setThich(!moi);
      toast.error(errorMessage(e));
    } finally {
      setDangThich(false);
    }
  };

  return (
    <article className="@container h-full">
      <div className="grid h-full grid-rows-[minmax(12rem,1fr)_auto] gap-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] @3xl:grid-rows-1 @3xl:gap-5">
        <KhungXemTruoc p={p} active={active}>
          {/* Hàng nút dọc kiểu TikTok — chỉ khung hẹp; khung rộng có nút ở cột thông tin. */}
          <div className="absolute right-2 bottom-2 z-10 flex flex-col items-center gap-2.5 @3xl:hidden">
            <NutTron icon={Heart} label={thich ? "Đã thích" : "Thích"} onClick={() => void doiThich()} disabled={preview} dang={thich} />
            {onNotInterested && <NutTron icon={EyeOff} label="Bỏ qua" onClick={onNotInterested} disabled={preview} />}
            <NutTron icon={Info} label="Chi tiết" onClick={() => setChiTiet(true)} />
          </div>
        </KhungXemTruoc>

        {/* Khung hẹp: thông tin gọn. */}
        <div className="flex min-h-0 flex-col gap-2.5 @3xl:hidden">
          <TieuDe p={p} />
          <LyDo p={p} />
          <ChiSo p={p} gon />
          {p.description && (
            <button type="button" className="text-left text-sm text-muted-foreground" onClick={() => setChiTiet(true)}>
              <span className="line-clamp-1">{p.description}</span>
            </button>
          )}
          <DieuKien p={p} motDong />
          <NutXem p={p} preview={preview} onOpen={moDuAn} className="w-full" />
        </div>

        {/* Khung rộng: toàn bộ thông tin. */}
        <div className="hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border bg-card p-5 @3xl:flex">
          <ThongTinDayDu p={p} />
          <div className="mt-auto flex gap-2 pt-2">
            <NutXem p={p} preview={preview} onOpen={moDuAn} className="flex-1" />
            <Button
              variant="outline"
              size="lg"
              onClick={() => void doiThich()}
              disabled={preview || dangThich}
              aria-pressed={thich}
              title={thich ? "Bỏ thích" : "Thích — lưu lại để làm sau"}
            >
              <Heart className={cn(thich && "fill-rose-500 text-rose-500")} /> {thich ? "Đã thích" : "Thích"}
            </Button>
            {onNotInterested && (
              <Button variant="outline" size="icon-lg" onClick={onNotInterested} disabled={preview} title="Không quan tâm — ẩn dự án này, gợi ý sau ít loại này hơn" aria-label="Không quan tâm">
                <EyeOff />
              </Button>
            )}
          </div>
        </div>
      </div>

      <Sheet open={chiTiet} onOpenChange={setChiTiet}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-0">
            <SheetTitle className="sr-only">{p.name}</SheetTitle>
            <SheetDescription className="sr-only">Thông tin đầy đủ của dự án</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pt-6 pb-4">
            <ThongTinDayDu p={p} kemCauHoi />
            <NutXem p={p} preview={preview} onOpen={moDuAn} className="w-full" />
          </div>
        </SheetContent>
      </Sheet>
    </article>
  );
}

/** Khung sáng: 1 mẫu thật hệ thống tự lấy (hoặc ô trống khi doanh nghiệp tắt) + toàn bộ câu hỏi và công cụ của bài. */
function KhungXemTruoc({ p, active, children }: { p: Card; active: boolean; children: ReactNode }) {
  const Icon = MODALITY_ICON[p.modality];
  const mau = p.previews[0];

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-1.5 px-3 pt-3 text-xs">
        <ToneBadge tone="muted">
          <Icon className="size-3" /> {MODALITY_LABEL[p.modality]}
        </ToneBadge>
        {p.explore && (
          <ToneBadge tone="info">
            <Compass className="size-3" /> Thử loại mới
          </ToneBadge>
        )}
        {p.isNew && !p.explore && <ToneBadge tone="success">Mới mở</ToneBadge>}
        <span className="ml-auto text-muted-foreground">{mau ? "Mẫu trong bài" : "Không có mẫu xem trước"}</span>
      </div>

      <div className="relative mx-3 mt-2 flex min-h-[7rem] flex-1 flex-col overflow-hidden rounded-xl bg-muted/40">
        {/* relative: thẻ chữ phủ kín (absolute inset-0) khung này. */}
        <div className={cn("relative flex min-h-0 flex-1 items-center justify-center", !(mau && laTheChu(mau)) && "p-2")}>
          {mau ? (
            <PreviewMedia p={mau} active={active} />
          ) : (
            <div className="flex flex-col items-center gap-2 px-14 text-center text-muted-foreground">
              <ImageOff className="size-8 opacity-60" />
              <p className="text-xs">Doanh nghiệp không cho xem trước mẫu — mở dự án để xem bài.</p>
            </div>
          )}
        </div>
        {mau?.question && (
          <p className="line-clamp-2 border-t bg-background/80 px-3 py-1.5 pr-16 text-xs text-muted-foreground @3xl:pr-3">Ngữ cảnh: {mau.question}</p>
        )}
        {children}
      </div>

      <div className="max-h-[45%] shrink-0 overflow-y-auto px-3 pt-2 pb-3">
        <CauHoiTrongBai tools={p.tools} gon />
      </div>
    </div>
  );
}

/** Toàn bộ câu hỏi + công cụ của bài (mỗi công cụ một câu hỏi — kiến trúc 3.35). */
function CauHoiTrongBai({ tools, gon }: { tools: FeedTool[]; gon?: boolean }) {
  if (tools.length === 0) return <p className="text-xs text-muted-foreground">Chưa có câu hỏi.</p>;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{tools.length === 1 ? "Câu hỏi trong bài" : `${tools.length} câu hỏi mỗi mẫu`}</p>
      <ol className="space-y-2">
        {tools.map((t, i) => (
          <li key={t.name} className="flex items-start gap-2">
            <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0 space-y-1">
              <p className={cn("text-sm font-medium leading-snug", gon && "line-clamp-2")}>{t.question ?? `Công cụ ${i + 1}`}</p>
              <div className="flex flex-wrap items-center gap-1">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{TOOL_LABEL[t.kind] ?? t.kind}</span>
                {t.classes.slice(0, gon ? 6 : 50).map((c) => (
                  <span key={c} className="rounded-full border px-2 py-0.5 text-[11px]">
                    {c}
                  </span>
                ))}
                {gon && t.classes.length > 6 && <span className="text-[11px] text-muted-foreground">+{t.classes.length - 6}</span>}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function NutTron({ icon: Icon, label, onClick, disabled, dang }: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; dang?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-foreground disabled:opacity-50"
    >
      <span className="flex size-10 items-center justify-center rounded-full border bg-background/95 shadow-sm transition-colors hover:bg-muted">
        <Icon className={cn("size-[18px]", dang && "fill-rose-500 text-rose-500")} />
      </span>
      <span className="rounded bg-background/80 px-1">{label}</span>
    </button>
  );
}

function TieuDe({ p, lon }: { p: Card; lon?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className={cn("font-semibold leading-snug", lon ? "text-xl" : "line-clamp-2 text-base")}>{p.name}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {MODALITY_LABEL[p.modality]}
          {p.toolKinds.length > 0 && ` · ${toolKindsText(p.toolKinds)}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn("font-bold text-primary", lon ? "text-3xl" : "text-2xl")}>{formatVnd(p.rewardVnd)}</div>
        <p className="text-[11px] text-muted-foreground">nếu bài đạt</p>
      </div>
    </div>
  );
}

function LyDo({ p }: { p: Card }) {
  const ds = p.reasons.filter((r) => r !== "kham_pha");
  if (ds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ds.map((r) => (
        <ToneBadge key={r} tone={r === "kiem_tot" ? "success" : "muted"}>
          {r === "kiem_tot" && <Sparkles className="size-3" />} {FEED_REASON_LABEL[r] ?? r}
        </ToneBadge>
      ))}
    </div>
  );
}

function ChiSo({ p, gon }: { p: Card; gon?: boolean }) {
  const o: { icon: LucideIcon; v: string; l: string; t: string }[] = [
    { icon: Trophy, v: String(p.slots), l: "suất thưởng", t: "Các bài đạt giống đa số nhất được thưởng" },
    { icon: Clock, v: `~${p.estimatedMinutes}`, l: "phút", t: "Thời gian ước tính làm hết bài" },
    { icon: ListOrdered, v: String(p.questionCount), l: "câu", t: "Số câu của bài" },
    { icon: CalendarClock, v: p.deadline ? formatDate(p.deadline) : "Không", l: "hạn chót", t: "Dự án nhận bài tới hạn chót" },
  ];
  return (
    <div className={cn("grid gap-2", gon ? "grid-cols-4" : "grid-cols-2")}>
      {o.map((x) => (
        <div key={x.l} title={x.t} className={cn("rounded-lg bg-muted/60 text-center", gon ? "px-1 py-1.5" : "flex items-center gap-2.5 px-3 py-2 text-left")}>
          <x.icon className={cn("text-muted-foreground", gon ? "mx-auto mb-0.5 size-3.5" : "size-4 shrink-0")} />
          <div className="min-w-0">
            <div className={cn("truncate font-semibold", gon ? "text-xs" : "text-sm")}>{x.v}</div>
            <div className="truncate text-[11px] text-muted-foreground">{x.l}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

type MucDieuKien = { icon: LucideIcon; text: string; tone: "warning" | "danger" | "default" | "info"; giaiThich: string };

function dieuKienCua(p: Card): MucDieuKien[] {
  const ds: MucDieuKien[] = [];
  if (p.requireEntranceTest) ds.push({ icon: FileCheck2, text: "Bài test đầu vào", tone: "warning", giaiThich: "Làm đạt bài test ngắn trước khi nhận bài." });
  if (p.requireVerifiedIdentity) ds.push({ icon: UserCheck, text: "Cần xác minh", tone: "default", giaiThich: "Chỉ tài khoản đã xác minh danh tính mới làm được." });
  if (p.consentRequired) ds.push({ icon: ScrollText, text: "Đồng ý điều khoản", tone: "info", giaiThich: "Đọc và đồng ý điều khoản (có thể kèm NDA) trước khi làm." });
  if (p.sensitiveContent) ds.push({ icon: ShieldAlert, text: "Nội dung nhạy cảm", tone: "danger", giaiThich: "Dữ liệu có thể gây khó chịu; chỉ người đủ tuổi thấy dự án này." });
  if (p.isPrivate) ds.push({ icon: Lock, text: "Riêng tư", tone: "default", giaiThich: "Dự án riêng tư — bạn thấy vì đã được mời." });
  return ds;
}

function DieuKien({ p, motDong }: { p: Card; motDong?: boolean }) {
  const { name } = useTags();
  const ds = dieuKienCua(p);
  const the = p.domains.map((c) => name("domain", c)).concat(p.languages.map((c) => name("language", c)));
  if (ds.length === 0 && the.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", motDong && "max-h-6 overflow-hidden")}>
      {ds.map((d) => (
        <ToneBadge key={d.text} tone={d.tone}>
          <d.icon className="size-3" /> {d.text}
        </ToneBadge>
      ))}
      {the.map((t) => (
        <span key={t} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {t}
        </span>
      ))}
    </div>
  );
}

/** Toàn bộ thông tin — cột phải ở khung rộng, bảng "Chi tiết" ở khung hẹp (kèm câu hỏi). */
function ThongTinDayDu({ p, kemCauHoi }: { p: Card; kemCauHoi?: boolean }) {
  const { name } = useTags();
  const ds = dieuKienCua(p);
  return (
    <>
      <TieuDe p={p} lon />
      <LyDo p={p} />
      <ChiSo p={p} />
      <p className="text-xs text-muted-foreground">
        Thưởng trả cho {p.slots} bài đạt giống đa số nhất. Không giới hạn người làm — dự án nhận bài tới hạn chót.
      </p>
      {kemCauHoi && <CauHoiTrongBai tools={p.tools} />}
      {p.description && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Mô tả</h3>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{p.description}</p>
        </div>
      )}
      {ds.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Điều kiện</h3>
          <ul className="space-y-1.5">
            {ds.map((d) => (
              <li key={d.text} className="flex gap-2 text-sm">
                <d.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{d.text}.</span> <span className="text-muted-foreground">{d.giaiThich}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(p.domains.length > 0 || p.languages.length > 0) && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium">Lĩnh vực và ngôn ngữ</h3>
          <div className="flex flex-wrap gap-1.5">
            {p.domains.map((c) => (
              <span key={`d-${c}`} className="rounded-full border px-2 py-0.5 text-xs">
                {name("domain", c)}
              </span>
            ))}
            {p.languages.map((c) => (
              <span key={`l-${c}`} className="rounded-full border px-2 py-0.5 text-xs">
                {name("language", c)}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function NutXem({ p, preview, onOpen, className }: { p: Card; preview?: boolean; onOpen: () => void; className?: string }) {
  if (preview) {
    return (
      <Button size="lg" className={className} disabled>
        Xem dự án và nhận bài
      </Button>
    );
  }
  return (
    <Button asChild size="lg" className={className}>
      <Link href={`/cho/${p.id}`} onClick={onOpen}>
        Xem dự án và nhận bài
      </Link>
    </Button>
  );
}
