import type { LabelData, LabelSchema, Modality, SampleContent, SampleMeta, ToolKind } from "@/lib/types";
import type { BBox, KeyPoint, MaskObj, PolyObj, RelationObj, SegmentObj, SpanObj, TrackObj } from "@/components/labeling/schema";
import { decodeRle } from "@/components/labeling/rle";

/**
 * Bài tập hướng dẫn công cụ (như màn hướng dẫn trong game): mỗi loại công cụ một bài với DỮ LIỆU TẬP có sẵn ở
 * public/huong-dan (không phải dữ liệu dự án, không gọi backend, không lưu, không tính điểm). Tour chỉ vào đúng chỗ,
 * chờ người dùng làm xong mới đi tiếp, cuối bài chấm theo đáp án và nhận xét.
 * Toạ độ đáp án khớp file tạo mẫu (ảnh 800×500, video 640×360 quả bóng x = 80 + 80t, tiếng bíp 2–3,5 s và 5–6 s).
 */

export type TourCtx = { value: LabelData; checked: boolean };

/**
 * target: bộ chọn CSS trong khung bài tập (nhiều bộ chọn = lỗ bao tất cả, cho bước cần thao tác ở hai chỗ); null = thẻ
 * giữa màn hình. done: điều kiện để tự sang bước sau.
 */
export type GuideStep = { target: string | string[] | null; title: string; body: string; done?: (c: TourCtx) => boolean };

export type CheckResult = { ok: boolean; notes: string[] };

export type Lesson = {
  kind: ToolKind;
  title: string;
  intro: string;
  schema: LabelSchema;
  modality: Modality;
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
  initial?: LabelData;
  steps: GuideStep[];
  check: (v: LabelData) => CheckResult;
};

const ANH = "/huong-dan/canh.png";
const ANH_META: SampleMeta = { width: 800, height: 500 };

const congCu = (ten: string, phan?: string) => `[data-tool="${ten}"]` + (phan ? ` [data-tour="${phan}"]` : "");
const mau = (phan?: string) => `[data-tour="mau"]` + (phan ? ` [data-tour="${phan}"]` : "");
export const NUT_CHAM = `[data-tour="cham-bai-tap"]`;

const buocCham: GuideStep = {
  target: NUT_CHAM,
  title: "Chấm bài tập",
  body: "Xong rồi! Bấm “Chấm bài tập” để xem bạn làm đúng chưa. Bài tập không tính điểm, làm lại bao nhiêu lần cũng được.",
  done: (c) => c.checked,
};

const ds = <T,>(v: LabelData, ten: string) => ((v[ten] as T[] | undefined) ?? []);
const pt = (x: number) => `${Math.round(x * 100)}%`;

function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const giao = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const hop = a.w * a.h + b.w * b.h - giao;
  return hop > 0 ? giao / hop : 0;
}

function trongDaGiac(x: number, y: number, p: [number, number][]): boolean {
  let trong = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) trong = !trong;
  }
  return trong;
}

/** IoU hai vùng tính bằng lấy mẫu lưới 2 px trên khung ảnh. */
function iouVung(a: (x: number, y: number) => boolean, b: (x: number, y: number) => boolean, w: number, h: number): number {
  let giao = 0;
  let hop = 0;
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      const ia = a(x, y);
      const ib = b(x, y);
      if (ia && ib) giao++;
      if (ia || ib) hop++;
    }
  return hop ? giao / hop : 0;
}

function khoangCachDoan(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const chuanHoa = (s: string) => s.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function giongChu(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let truoc = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const nay = [i];
    for (let j = 1; j <= n; j++) nay[j] = Math.min(truoc[j] + 1, nay[j - 1] + 1, truoc[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    truoc = nay;
  }
  return 1 - truoc[n] / Math.max(m, n);
}

/* ================================================================ từng bài ================================================================ */

const CAM_XUC = "Món phở ở đây ngon tuyệt, nhân viên phục vụ rất nhanh và thân thiện!";

const PHAN_LOAI: Lesson = {
  kind: "classification",
  title: "Phân loại",
  intro: "Chọn một (hoặc vài) lớp mô tả đúng nhất cả mẫu.",
  modality: "text",
  fileUrl: null,
  content: { text: CAM_XUC },
  metadata: {},
  schema: { modality: "text", tools: [{ name: "Cảm xúc", kind: "classification", classes: ["Tích cực", "Tiêu cực", "Trung tính"], question: "Câu nhận xét này mang cảm xúc gì?" }] },
  steps: [
    { target: mau(), title: "Đọc mẫu", body: "Đây là mẫu cần gán nhãn. Đọc kỹ trước khi trả lời." },
    { target: congCu("Cảm xúc"), title: "Đọc câu hỏi, chọn lớp", body: "Câu hỏi của công cụ nằm trong khung xanh. Bấm vào lớp đúng nhất để chọn.", done: (c) => ((c.value["Cảm xúc"] as { labelIds?: string[] } | undefined)?.labelIds?.length ?? 0) > 0 },
    buocCham,
  ],
  check: (v) => {
    const chon = (v["Cảm xúc"] as { labelIds?: string[] } | undefined)?.labelIds ?? [];
    if (chon[0] === "Tích cực") return { ok: true, notes: ["Chính xác: lời khen “ngon tuyệt”, “nhanh và thân thiện” là cảm xúc tích cực."] };
    return { ok: false, notes: [`Bạn chọn “${chon[0] ?? "—"}”. Câu này khen món ăn và cách phục vụ nên đáp án là “Tích cực”.`] };
  },
};

const DOAN_TOM_TAT = "Sáng nay, một trận mưa lớn kéo dài hai giờ khiến nhiều tuyến phố ở trung tâm thành phố bị ngập. Giao thông ùn tắc, nhiều học sinh đến trường muộn.";

const TRA_LOI_MO: Lesson = {
  kind: "freeText",
  title: "Câu trả lời mở",
  intro: "Tự gõ câu trả lời theo yêu cầu của câu hỏi.",
  modality: "text",
  fileUrl: null,
  content: { text: DOAN_TOM_TAT },
  metadata: {},
  schema: { modality: "text", tools: [{ name: "Tóm tắt", kind: "freeText", maxLength: 200, question: "Tóm tắt đoạn văn trong một câu." }] },
  steps: [
    { target: mau(), title: "Đọc đoạn văn", body: "Đọc để nắm ý chính." },
    { target: congCu("Tóm tắt"), title: "Gõ câu trả lời", body: "Gõ một câu tóm tắt vào ô. Số bên dưới là số ký tự đã dùng / tối đa.", done: (c) => ((c.value["Tóm tắt"] as { text?: string } | undefined)?.text ?? "").trim().length >= 10 },
    buocCham,
  ],
  check: (v) => {
    const t = chuanHoa((v["Tóm tắt"] as { text?: string } | undefined)?.text ?? "");
    const coY = t.includes("mưa") && (t.includes("ngập") || t.includes("tắc"));
    if (t.length >= 15 && coY) return { ok: true, notes: ["Tốt: câu tóm tắt có đủ ý chính (mưa lớn gây ngập, tắc đường)."] };
    return { ok: false, notes: ["Câu tóm tắt nên nêu ý chính: mưa lớn làm ngập phố, gây tắc đường. Ví dụ: “Mưa lớn làm nhiều tuyến phố ngập và ùn tắc.”"] };
  },
};

const SO: Lesson = {
  kind: "number",
  title: "Số / thang điểm",
  intro: "Nhập một con số (hoặc bấm số sao) theo yêu cầu.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Số bông hoa", kind: "number", integer: true, min: 0, max: 20, question: "Trong ảnh có bao nhiêu bông hoa?" }] },
  steps: [
    { target: mau(), title: "Quan sát ảnh", body: "Đếm số bông hoa màu hồng trong ảnh." },
    { target: congCu("Số bông hoa"), title: "Nhập số", body: "Gõ con số vào ô. Dòng chữ nhỏ bên cạnh cho biết giới hạn cho phép.", done: (c) => typeof (c.value["Số bông hoa"] as { value?: number } | undefined)?.value === "number" },
    buocCham,
  ],
  check: (v) => {
    const n = (v["Số bông hoa"] as { value?: number } | undefined)?.value;
    if (n === 3) return { ok: true, notes: ["Chính xác: có 3 bông hoa ở bên phải, cạnh hồ nước."] };
    return { ok: false, notes: [`Bạn nhập ${n ?? "—"}. Ảnh có 3 bông hoa (bên phải, phía trên hồ nước).`] };
  },
};

const CAU_DOC = "good morning today is a sunny day";

const CHEP_LOI: Lesson = {
  kind: "transcription",
  title: "Chép lại nội dung",
  intro: "Nghe (hoặc nhìn) rồi chép lại đúng từng chữ.",
  modality: "audio",
  fileUrl: "/huong-dan/chep-loi.wav",
  content: null,
  metadata: {},
  schema: { modality: "audio", tools: [{ name: "Lời nói", kind: "transcription", maxLength: 200, question: "Chép lại đúng câu tiếng Anh bạn nghe được." }] },
  steps: [
    { target: mau('dieu-khien-phat'), title: "Nghe đoạn âm thanh", body: "Bấm “Phát” để nghe. Nút ◀ / ▶ lùi / tới 1 giây; bấm vào thanh thời gian để nghe lại từ chỗ bất kỳ." },
    { target: [mau("dieu-khien-phat"), congCu("Lời nói")], title: "Chép lại", body: "Gõ đúng những gì bạn nghe được vào ô bên phải. Nghe lại bao nhiêu lần cũng được.", done: (c) => ((c.value["Lời nói"] as { text?: string } | undefined)?.text ?? "").trim().length >= 5 },
    buocCham,
  ],
  check: (v) => {
    const t = chuanHoa((v["Lời nói"] as { text?: string } | undefined)?.text ?? "");
    const g = giongChu(t, CAU_DOC);
    if (g >= 0.85) return { ok: true, notes: [`Rất tốt: giống ${pt(g)} câu gốc “Good morning. Today is a sunny day.”`] };
    return { ok: false, notes: [`Mới giống ${pt(g)}. Câu gốc: “Good morning. Today is a sunny day.” Nghe lại và sửa những từ còn sai.`] };
  },
};

const BIP: [number, number][] = [
  [2, 3.5],
  [5, 6],
];

const DOAN_THOI_GIAN: Lesson = {
  kind: "temporalSegment",
  title: "Đoạn thời gian",
  intro: "Đánh dấu khoảng thời gian (từ giây nào tới giây nào) có sự kiện cần tìm.",
  modality: "audio",
  fileUrl: "/huong-dan/tieng-bip.wav",
  content: null,
  metadata: {},
  schema: { modality: "audio", tools: [{ name: "Tiếng bíp", kind: "temporalSegment", classes: ["bíp"], question: "Đánh dấu mọi đoạn có tiếng bíp." }] },
  steps: [
    { target: mau("dieu-khien-phat"), title: "Nghe cả đoạn", body: "Bấm “Phát” và nghe hết 8 giây. Có hai lần tiếng bíp. Vạch đỏ trên thanh thời gian là vị trí đang phát." },
    { target: mau("dong-thoi-gian"), title: "Cách 1: kéo trên thanh thời gian", body: "Nhấn giữ chuột ở chỗ tiếng bíp thứ nhất bắt đầu, kéo tới chỗ nó kết thúc rồi thả.", done: (c) => ds<SegmentObj>(c.value, "Tiếng bíp").length >= 1 },
    { target: [mau("dieu-khien-phat"), mau("dong-thoi-gian")], title: "Cách 2: bấm khi đang nghe", body: "Khi đang phát: bấm “Bắt đầu tại…” lúc tiếng bíp vang lên, bấm “Kết thúc tại…” lúc nó tắt. Thử với tiếng bíp thứ hai (cách 1 cũng được).", done: (c) => ds<SegmentObj>(c.value, "Tiếng bíp").length >= 2 },
    { target: congCu("Tiếng bíp"), title: "Chỉnh cho khít", body: "Bấm một đoạn trong danh sách để mở ô nhập giây bắt đầu / kết thúc chính xác, hoặc xoá đoạn sai bằng thùng rác." },
    buocCham,
  ],
  check: (v) => {
    const segs = ds<SegmentObj>(v, "Tiếng bíp");
    const notes: string[] = [];
    let ok = true;
    BIP.forEach(([a, b], i) => {
      let tot = 0;
      for (const s of segs) tot = Math.max(tot, Math.max(0, Math.min(b, s.end) - Math.max(a, s.start)) / (Math.max(b, s.end) - Math.min(a, s.start)));
      if (tot >= 0.6) notes.push(`Tiếng bíp ${i + 1} (${a}–${b} giây): khớp ${pt(tot)}.`);
      else {
        ok = false;
        notes.push(`Tiếng bíp ${i + 1} kéo dài từ giây ${a} tới ${b}${tot > 0 ? ` — đoạn của bạn mới khớp ${pt(tot)}` : " — bạn chưa đánh dấu đoạn này"}.`);
      }
    });
    if (segs.length > BIP.length) notes.push(`Bạn có ${segs.length} đoạn, nhiều hơn số tiếng bíp — xoá đoạn thừa.`);
    return { ok: ok && segs.length <= BIP.length, notes };
  },
};

const bongLuc = (t: number) => ({ x: 80 + 80 * t - 30, y: 150, w: 60, h: 60 });

const THEO_DOI: Lesson = {
  kind: "track",
  title: "Theo dõi đối tượng",
  intro: "Khoanh một vật qua nhiều khung hình của video. Chỉ cần vẽ ở vài thời điểm (keyframe), giữa chúng khung tự nội suy.",
  modality: "video",
  fileUrl: "/huong-dan/qua-bong.mp4",
  content: null,
  metadata: { width: 640, height: 360 },
  schema: { modality: "video", tools: [{ name: "Quả bóng", kind: "track", classes: ["bóng"], question: "Khoanh quả bóng trong suốt video." }] },
  steps: [
    { target: mau("dieu-khien-phat"), title: "Xem video", body: "Bấm “Phát” để xem: quả bóng xanh lăn từ trái sang phải trong 6 giây. Xem xong thì dừng." },
    { target: mau("dong-thoi-gian"), title: "Về đầu video", body: "Bấm vào đầu bên trái thanh thời gian để về giây 0 (vạch đỏ ở đầu)." },
    { target: mau("khung-video"), title: "Keyframe đầu tiên", body: "Kéo chuột trên video để vẽ khung quanh quả bóng. Một chuỗi mới được tạo, có 1 keyframe.", done: (c) => ds<TrackObj>(c.value, "Quả bóng").some((t) => t.keyframes.length >= 1) },
    { target: mau("dong-thoi-gian"), title: "Tới cuối video", body: "Bấm vào đầu bên phải thanh thời gian để tới giây cuối, quả bóng lúc này ở bên phải." },
    { target: mau("khung-video"), title: "Keyframe thứ hai", body: "Chuỗi vừa tạo đang được chọn: vẽ khung quanh quả bóng ở vị trí mới. Khung này thành keyframe thứ hai của CÙNG chuỗi.", done: (c) => ds<TrackObj>(c.value, "Quả bóng").some((t) => t.keyframes.length >= 2) },
    { target: mau("dong-thoi-gian"), title: "Xem khung nội suy", body: "Bấm vào giữa thanh thời gian: khung nét đứt được tính tự động giữa hai keyframe. Lệch thì vẽ lại khung ở đó để thêm keyframe." },
    buocCham,
  ],
  check: (v) => {
    const tracks = ds<TrackObj>(v, "Quả bóng");
    const tr = tracks.slice().sort((a, b) => b.keyframes.length - a.keyframes.length)[0];
    if (!tr || tr.keyframes.length < 2) return { ok: false, notes: ["Cần một chuỗi có ít nhất 2 keyframe (đầu và cuối video)."] };
    const notes: string[] = [];
    let ok = true;
    for (const k of tr.keyframes) {
      const s = iou(k, bongLuc(k.t));
      if (s < 0.5) ok = false;
      notes.push(`Keyframe ở giây ${k.t.toFixed(1)}: khớp quả bóng ${pt(s)}${s < 0.5 ? " — chưa khít, vẽ lại khung sát quả bóng" : ""}.`);
    }
    const ts = tr.keyframes.map((k) => k.t);
    if (Math.min(...ts) > 1.5 || Math.max(...ts) < 4.5) {
      ok = false;
      notes.push("Chuỗi nên kéo dài gần hết video: một keyframe gần giây 0 và một keyframe gần giây 6.");
    }
    if (tracks.length > 1) notes.push(`Bạn có ${tracks.length} chuỗi. Một quả bóng chỉ cần một chuỗi — bỏ chọn chuỗi rồi vẽ mới là tạo chuỗi khác.`);
    return { ok, notes };
  },
};

const O_TO = { x: 80, y: 295, w: 200, h: 132 };

const KHUNG: Lesson = {
  kind: "bbox",
  title: "Khung chữ nhật",
  intro: "Vẽ khung chữ nhật sát quanh vật thể.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Phương tiện", kind: "bbox", classes: ["ô tô", "xe máy"], question: "Vẽ khung quanh chiếc ô tô." }] },
  steps: [
    { target: mau("vung-ve"), title: "Vùng vẽ", body: "Ảnh hiển thị ở đây. Lăn chuột để phóng to / thu nhỏ, giữ phím Space rồi kéo để di chuyển ảnh." },
    { target: congCu("Phương tiện", "chon-lop"), title: "Chọn lớp trước khi vẽ", body: "Đối tượng mới vẽ sẽ mang lớp đang chọn ở đây. Chọn “ô tô”." },
    { target: mau("vung-ve"), title: "Vẽ khung", body: "Nhấn giữ chuột ở góc trên bên trái chiếc ô tô (tính cả nóc xe), kéo tới góc dưới bên phải (tính cả bánh xe) rồi thả.", done: (c) => ds<BBox>(c.value, "Phương tiện").length >= 1 },
    { target: [mau("vung-ve"), congCu("Phương tiện")], title: "Chỉnh khung", body: "Bấm khung trong danh sách (hoặc trên ảnh) để chọn: kéo khung để dời, kéo các nút ở mép để đổi cỡ cho khít. Delete để xoá." },
    buocCham,
  ],
  check: (v) => {
    const list = ds<BBox>(v, "Phương tiện");
    if (list.length === 0) return { ok: false, notes: ["Chưa có khung nào."] };
    const tot = list.map((b) => ({ b, s: iou(b, O_TO) })).sort((a, b) => b.s - a.s)[0];
    const notes = [`Khung khớp chiếc ô tô ${pt(tot.s)}${tot.s >= 0.75 ? " — rất khít." : tot.s >= 0.5 ? " — tạm được, thử kéo mép cho sát hơn (gồm cả nóc xe và bánh xe)." : " — còn lệch nhiều."}`];
    if (tot.b.labelId !== "ô tô") notes.push(`Khung đang mang lớp “${tot.b.labelId}”, phải là “ô tô”: chọn khung rồi đổi lớp ở ô “Lớp”.`);
    if (list.length > 1) notes.push(`Có ${list.length} khung — ảnh chỉ có một ô tô, xoá khung thừa.`);
    return { ok: tot.s >= 0.5 && tot.b.labelId === "ô tô" && list.length === 1, notes };
  },
};

const MAI: [number, number][] = [
  [340, 230],
  [440, 150],
  [540, 230],
];

const DA_GIAC: Lesson = {
  kind: "polygon",
  title: "Đa giác",
  intro: "Khoanh vùng có hình dạng bất kỳ bằng cách bấm từng đỉnh.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Mái nhà", kind: "polygon", classes: ["mái nhà"], question: "Khoanh vùng mái nhà." }] },
  steps: [
    { target: mau("vung-ve"), title: "Bấm từng đỉnh", body: "Mái nhà là hình tam giác màu nâu. Bấm lần lượt vào 3 góc của mái, rồi bấm lại vào đỉnh đầu tiên (hoặc nhấp đúp / Enter) để khép hình. Backspace xoá đỉnh vừa bấm, Esc huỷ.", done: (c) => ds<PolyObj>(c.value, "Mái nhà").some((p) => p.points.length >= 3) },
    { target: [mau("vung-ve"), congCu("Mái nhà")], title: "Chỉnh đỉnh", body: "Chọn đa giác để hiện các đỉnh, kéo từng đỉnh cho khớp góc mái." },
    buocCham,
  ],
  check: (v) => {
    const list = ds<PolyObj>(v, "Mái nhà").filter((p) => p.points.length >= 3);
    if (list.length === 0) return { ok: false, notes: ["Chưa có đa giác nào (cần ít nhất 3 đỉnh)."] };
    const s = Math.max(...list.map((p) => iouVung((x, y) => trongDaGiac(x, y, p.points as [number, number][]), (x, y) => trongDaGiac(x, y, MAI), 800, 500)));
    return { ok: s >= 0.6, notes: [`Đa giác khớp mái nhà ${pt(s)}${s >= 0.8 ? " — rất khít." : s >= 0.6 ? " — được, kéo đỉnh sát góc mái hơn nữa nhé." : " — còn lệch: đặt đỉnh đúng 3 góc của mái."}`] };
  },
};

const HOA: [number, number][] = [
  [585, 330],
  [690, 345],
  [770, 325],
];

const DIEM: Lesson = {
  kind: "keypoint",
  title: "Điểm mốc",
  intro: "Đặt điểm đúng vào vị trí cần đánh dấu.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Bông hoa", kind: "keypoint", classes: ["hoa"], question: "Đặt một điểm vào nhụy (chấm vàng) của mỗi bông hoa." }] },
  steps: [
    { target: mau("vung-ve"), title: "Đặt điểm", body: "Có 3 bông hoa hồng ở bên phải ảnh. Bấm đúng vào chấm vàng ở giữa từng bông. Đặt lệch thì kéo điểm để chỉnh.", done: (c) => ds<KeyPoint>(c.value, "Bông hoa").length >= 3 },
    buocCham,
  ],
  check: (v) => {
    const list = ds<KeyPoint>(v, "Bông hoa");
    const notes: string[] = [];
    let trung = 0;
    HOA.forEach(([x, y], i) => {
      const d = Math.min(...list.map((k) => Math.hypot(k.x - x, k.y - y)), Infinity);
      if (d <= 12) trung++;
      notes.push(`Bông hoa ${i + 1}: ${d === Infinity ? "chưa có điểm" : d <= 12 ? `lệch ${Math.round(d)} px — tốt` : `lệch ${Math.round(d)} px — đặt sát chấm vàng hơn`}.`);
    });
    if (list.length > HOA.length) notes.push(`Có ${list.length} điểm, nhiều hơn số hoa — xoá điểm thừa.`);
    return { ok: trung === HOA.length && list.length === HOA.length, notes };
  },
};

const DUONG_MON: [number, number][] = [
  [300, 500],
  [330, 440],
  [420, 400],
  [520, 380],
];

const DUONG: Lesson = {
  kind: "polyline",
  title: "Đường gấp khúc",
  intro: "Vẽ một đường đi qua nhiều điểm (không khép kín), ví dụ làn đường, dây điện.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Đường mòn", kind: "polyline", classes: ["đường"], question: "Vẽ theo giữa con đường mòn màu nâu." }] },
  steps: [
    { target: mau("vung-ve"), title: "Vẽ theo đường", body: "Bấm điểm đầu ở mép dưới ảnh, rồi bấm từng chỗ đường đổi hướng, đến cuối đường thì nhấp đúp (hoặc Enter) để kết thúc.", done: (c) => ds<PolyObj>(c.value, "Đường mòn").some((p) => p.points.length >= 2) },
    buocCham,
  ],
  check: (v) => {
    const list = ds<PolyObj>(v, "Đường mòn").filter((p) => p.points.length >= 2);
    if (list.length === 0) return { ok: false, notes: ["Chưa có đường nào (cần ít nhất 2 điểm)."] };
    const p = list[0].points as [number, number][];
    const lech = Math.max(...p.map(([x, y]) => Math.min(...DUONG_MON.slice(1).map((b, i) => khoangCachDoan(x, y, DUONG_MON[i], b)))));
    const dau = Math.min(Math.hypot(p[0][0] - 300, p[0][1] - 500), Math.hypot(p[p.length - 1][0] - 300, p[p.length - 1][1] - 500));
    const cuoi = Math.min(Math.hypot(p[0][0] - 520, p[0][1] - 380), Math.hypot(p[p.length - 1][0] - 520, p[p.length - 1][1] - 380));
    const notes = [`Điểm xa con đường nhất lệch ${Math.round(lech)} px${lech <= 15 ? " — bám đường tốt." : " — đặt điểm ngay trên con đường."}`];
    if (dau > 40 || cuoi > 40) notes.push("Đường nên đi từ mép dưới ảnh tới chỗ con đường kết thúc (gần nhà).");
    return { ok: lech <= 15 && dau <= 40 && cuoi <= 40, notes };
  },
};

const trongHo = (x: number, y: number) => ((x - 660) / 110) ** 2 + ((y - 420) / 45) ** 2 <= 1;

const MAT_NA: Lesson = {
  kind: "mask",
  title: "Mặt nạ (cọ tô)",
  intro: "Tô kín vùng cần đánh dấu bằng cọ, sửa bằng tẩy — dùng cho vùng có viền phức tạp.",
  modality: "image",
  fileUrl: ANH,
  content: null,
  metadata: ANH_META,
  schema: { modality: "image", tools: [{ name: "Hồ nước", kind: "mask", classes: ["hồ"], question: "Tô kín mặt hồ nước." }] },
  steps: [
    { target: mau("co-tay"), title: "Cọ, tẩy và cỡ cọ", body: "“Cọ” để tô, “Tẩy” để xoá phần tô thừa. Kéo thanh trượt để đổi cỡ cọ: cọ to tô nhanh phần giữa, cọ nhỏ tô sát mép." },
    { target: [mau("co-tay"), mau("vung-ve")], title: "Tô mặt hồ", body: "Chọn “Cọ” rồi nhấn giữ chuột tô kín hình elip màu xanh dương (hồ nước) ở góc dưới bên phải.", done: (c) => ds<MaskObj>(c.value, "Hồ nước").length >= 1 },
    { target: [mau("co-tay"), mau("vung-ve"), congCu("Hồ nước")], title: "Sửa mép", body: "Chọn mặt nạ trong danh sách để tô / tẩy tiếp trên chính nó. Tô lấn ra cỏ thì chuyển sang “Tẩy” và xoá phần đó." },
    buocCham,
  ],
  check: (v) => {
    const list = ds<MaskObj>(v, "Hồ nước");
    if (list.length === 0) return { ok: false, notes: ["Chưa tô mặt nạ nào."] };
    const notes: string[] = [];
    let tot = 0;
    for (const m of list) {
      const [h, w] = m.rle.size;
      const px = decodeRle(m.rle);
      const sx = w / 800;
      const sy = h / 500;
      const s = iouVung((x, y) => px[Math.floor(y * sy) * w + Math.floor(x * sx)] === 1, trongHo, 800, 500);
      tot = Math.max(tot, s);
    }
    notes.push(`Mặt nạ khớp mặt hồ ${pt(tot)}${tot >= 0.8 ? " — rất kín." : tot >= 0.6 ? " — được, tô kín mép và tẩy phần lấn ra cỏ." : " — còn thiếu nhiều hoặc tô lấn ra ngoài."}`);
    if (list.length > 1) notes.push(`Có ${list.length} mặt nạ — một hồ chỉ cần một mặt nạ: chọn mặt nạ có sẵn rồi tô tiếp thay vì tạo mới.`);
    return { ok: tot >= 0.6, notes };
  },
};

const CAU_NER = "Chị Nguyễn Thị Lan chuyển đến Đà Nẵng vào năm 2021.";
const NER_DUNG: { text: string; labelId: string }[] = [
  { text: "Nguyễn Thị Lan", labelId: "Người" },
  { text: "Đà Nẵng", labelId: "Địa điểm" },
  { text: "năm 2021", labelId: "Thời gian" },
];
const coLop = (v: LabelData, lop: string) => ds<SpanObj>(v, "Thực thể").some((s) => s.labelId === lop);

function chamDoan(text: string, spans: SpanObj[], dung: { text: string; labelId: string }[]): CheckResult {
  const notes: string[] = [];
  let ok = true;
  for (const d of dung) {
    const a = text.indexOf(d.text);
    const b = a + d.text.length;
    const hit = spans
      .map((s) => ({ s, k: Math.max(0, Math.min(b, s.end) - Math.max(a, s.start)) / (Math.max(b, s.end) - Math.min(a, s.start)) }))
      .sort((x, y) => y.k - x.k)[0];
    if (!hit || hit.k < 0.6) {
      ok = false;
      notes.push(`Thiếu “${d.text}” (${d.labelId}).`);
    } else if (hit.s.labelId !== d.labelId) {
      ok = false;
      notes.push(`“${text.slice(hit.s.start, hit.s.end)}” phải là ${d.labelId}, bạn gán ${hit.s.labelId}.`);
    } else notes.push(`“${text.slice(hit.s.start, hit.s.end)}” → ${d.labelId}: đúng${hit.k < 1 ? ` (bôi đen lệch một chút, nên đúng “${d.text}”)` : ""}.`);
  }
  if (spans.length > dung.length) notes.push(`Có ${spans.length} đoạn, nhiều hơn đáp án — xoá đoạn thừa.`);
  return { ok: ok && spans.length <= dung.length, notes };
}

const DOAN_VAN_BAN: Lesson = {
  kind: "span",
  title: "Đoạn văn bản (NER)",
  intro: "Bôi đen một cụm từ trong văn bản và gán lớp cho nó.",
  modality: "text",
  fileUrl: null,
  content: { text: CAU_NER },
  metadata: {},
  schema: { modality: "text", tools: [{ name: "Thực thể", kind: "span", classes: ["Người", "Địa điểm", "Thời gian"], question: "Đánh dấu tên người, địa điểm và thời gian." }] },
  steps: [
    { target: congCu("Thực thể", "chon-lop"), title: "Chọn lớp", body: "Chọn lớp trước, rồi mới bôi đen. Bắt đầu với “Người”." },
    { target: [mau("van-ban"), congCu("Thực thể", "chon-lop")], title: "Bôi đen tên người", body: "Nhấn giữ chuột kéo qua cụm “Nguyễn Thị Lan” (không lấy chữ “Chị”) rồi thả. Đoạn được tô màu của lớp.", done: (c) => coLop(c.value, "Người") },
    { target: [mau("van-ban"), congCu("Thực thể", "chon-lop")], title: "Đổi lớp, đánh dấu tiếp", body: "Chọn lớp “Địa điểm” rồi bôi đen “Đà Nẵng” trong văn bản.", done: (c) => coLop(c.value, "Địa điểm") },
    { target: [mau("van-ban"), congCu("Thực thể", "chon-lop")], title: "Tự làm nốt", body: "Tự đánh dấu cụm chỉ thời gian với lớp “Thời gian”.", done: (c) => coLop(c.value, "Thời gian") },
    { target: [mau("van-ban"), congCu("Thực thể")], title: "Sửa sai", body: "Bấm một mục để đổi lớp, hoặc xoá bằng thùng rác rồi bôi lại cho đúng." },
    buocCham,
  ],
  check: (v) => chamDoan(CAU_NER, ds<SpanObj>(v, "Thực thể"), NER_DUNG),
};

const CAU_QH = "Anh Minh làm việc tại Hà Nội nhưng sống ở Bắc Ninh.";
const doanQh = (t: string, labelId: string): SpanObj => ({ labelId, start: CAU_QH.indexOf(t), end: CAU_QH.indexOf(t) + t.length });
const MINH = doanQh("Minh", "Người");
const HN = doanQh("Hà Nội", "Địa điểm");
const BN = doanQh("Bắc Ninh", "Địa điểm");
const coQh = (v: LabelData, lop: string, toi: SpanObj) =>
  ds<RelationObj>(v, "Quan hệ").some((r) => r.labelId === lop && r.from.start === MINH.start && r.to.start === toi.start);

const QUAN_HE: Lesson = {
  kind: "relation",
  title: "Quan hệ giữa đoạn",
  intro: "Nối hai đoạn đã đánh dấu bằng một mũi tên có tên (từ đoạn → loại quan hệ → tới đoạn).",
  modality: "text",
  fileUrl: null,
  content: { text: CAU_QH },
  metadata: {},
  initial: { "Thực thể": [MINH, HN, BN] },
  schema: {
    modality: "text",
    tools: [
      { name: "Thực thể", kind: "span", classes: ["Người", "Địa điểm"], required: false, question: "Các thực thể (đã đánh dấu sẵn)." },
      { name: "Quan hệ", kind: "relation", spanTool: "Thực thể", classes: ["làm việc tại", "sống ở"], question: "Nối người với nơi làm việc và nơi sống." },
    ],
  },
  steps: [
    { target: mau("van-ban"), title: "Các đoạn đã có", body: "Ba đoạn “Minh”, “Hà Nội”, “Bắc Ninh” đã được đánh dấu sẵn. Quan hệ luôn nối giữa các đoạn như vậy." },
    { target: congCu("Quan hệ", "them-quan-he"), title: "Thêm quan hệ đầu tiên", body: "Chọn “Từ đoạn” = Minh, loại = “làm việc tại”, “Tới đoạn” = Hà Nội, rồi bấm “Thêm quan hệ”.", done: (c) => coQh(c.value, "làm việc tại", HN) },
    { target: congCu("Quan hệ", "them-quan-he"), title: "Tự thêm quan hệ thứ hai", body: "Theo câu văn, Minh sống ở đâu? Thêm quan hệ “sống ở” cho đúng.", done: (c) => coQh(c.value, "sống ở", BN) },
    buocCham,
  ],
  check: (v) => {
    const list = ds<RelationObj>(v, "Quan hệ");
    const a = coQh(v, "làm việc tại", HN);
    const b = coQh(v, "sống ở", BN);
    const notes = [a ? "Minh → làm việc tại → Hà Nội: đúng." : "Thiếu: Minh → làm việc tại → Hà Nội.", b ? "Minh → sống ở → Bắc Ninh: đúng." : "Thiếu: Minh → sống ở → Bắc Ninh."];
    if (list.length > 2) notes.push(`Có ${list.length} quan hệ — xoá quan hệ thừa / sai hướng.`);
    return { ok: a && b && list.length === 2, notes };
  },
};

const SO_SANH: Lesson = {
  kind: "pairwise",
  title: "So sánh cặp",
  intro: "Đọc hai phương án rồi chọn bên tốt hơn (hoặc ngang nhau). Trái / phải được xáo ngẫu nhiên để tránh thiên vị.",
  modality: "pair",
  fileUrl: null,
  content: { a: "Hôm nay trời rất đẹp, chúng tôi đi dạo công viên.", b: "Hôm nay chời rất đẹp, chúng tôi đi rạo công viên." },
  metadata: {},
  schema: { modality: "pair", tools: [{ name: "So sánh", kind: "pairwise", allowTie: true, question: "Câu nào viết đúng chính tả hơn?" }] },
  steps: [
    { target: mau(), title: "Đọc hai bên", body: "So từng chữ của câu bên trái và bên phải." },
    { target: congCu("So sánh"), title: "Chọn bên tốt hơn", body: "Bấm “Bên trái tốt hơn”, “Ngang nhau” hoặc “Bên phải tốt hơn”.", done: (c) => Boolean((c.value["So sánh"] as { choice?: string } | undefined)?.choice) },
    buocCham,
  ],
  check: (v) => {
    const c = (v["So sánh"] as { choice?: string } | undefined)?.choice;
    if (c === "a") return { ok: true, notes: ["Chính xác: câu kia viết sai “chời” (trời) và “rạo” (dạo)."] };
    return { ok: false, notes: ["Chưa đúng: câu có “chời” và “rạo” là câu sai chính tả, nên chọn câu còn lại."] };
  },
};

const MOC = ["1 năm", "1 giờ", "1 tuần", "1 ngày"];
const MOC_DUNG = [1, 3, 2, 0];

const XEP_HANG: Lesson = {
  kind: "ranking",
  title: "Xếp hạng",
  intro: "Kéo các mục để sắp thứ tự. Mục số 1 ở trên cùng.",
  modality: "list",
  fileUrl: null,
  content: { items: MOC },
  metadata: { itemCount: MOC.length },
  schema: { modality: "list", tools: [{ name: "Thứ tự", kind: "ranking", question: "Xếp các khoảng thời gian từ NGẮN nhất (số 1) đến DÀI nhất." }] },
  steps: [
    { target: congCu("Thứ tự", "xep-hang"), title: "Kéo để sắp xếp", body: "Nhấn giữ biểu tượng ⋮⋮ bên trái mỗi mục rồi kéo lên / xuống. Thứ tự đã đúng sẵn thì bấm “Giữ nguyên thứ tự này”.", done: (c) => ((c.value["Thứ tự"] as { order?: number[] } | undefined)?.order?.length ?? 0) > 0 },
    buocCham,
  ],
  check: (v) => {
    const o = (v["Thứ tự"] as { order?: number[] } | undefined)?.order ?? [];
    if (o.join() === MOC_DUNG.join()) return { ok: true, notes: ["Chính xác: 1 giờ < 1 ngày < 1 tuần < 1 năm."] };
    return { ok: false, notes: [`Bạn xếp: ${o.map((i) => MOC[i]).join(" → ") || "—"}. Đúng là: 1 giờ → 1 ngày → 1 tuần → 1 năm.`] };
  },
};

export const LESSONS: Record<ToolKind, Lesson> = {
  classification: PHAN_LOAI,
  freeText: TRA_LOI_MO,
  number: SO,
  transcription: CHEP_LOI,
  temporalSegment: DOAN_THOI_GIAN,
  track: THEO_DOI,
  bbox: KHUNG,
  polygon: DA_GIAC,
  keypoint: DIEM,
  polyline: DUONG,
  mask: MAT_NA,
  span: DOAN_VAN_BAN,
  relation: QUAN_HE,
  pairwise: SO_SANH,
  ranking: XEP_HANG,
};

/** Các bài cho những loại công cụ có trong tập nhãn (theo thứ tự xuất hiện; quan hệ cần học đoạn văn bản trước). */
export function lessonsFor(schema: LabelSchema | null | undefined): Lesson[] {
  const kinds: ToolKind[] = [];
  for (const t of schema?.tools ?? []) {
    if (t.kind === "relation" && !kinds.includes("span")) kinds.push("span");
    if (!kinds.includes(t.kind)) kinds.push(t.kind);
  }
  return kinds.map((k) => LESSONS[k]).filter(Boolean);
}
