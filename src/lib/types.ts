/* Kiểu dữ liệu theo DTO của backend (camelCase, enum là chuỗi camelCase). */

export type Role = "business" | "labeler" | "sharer" | "admin";
export type Modality = "image" | "text" | "audio" | "video" | "pair" | "list";
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Json = Record<string, unknown>;

export type Me = { userId: string; email: string | null; roles: Role[]; name: string | null };

export type Profile = {
  userId: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  roles: Role[];
  skills: { domains: string[] | null; languages: string[] | null; modalities: string[] | null };
  createdAt: string;
};

export type Badge = { code: string; name: string; awardedAt: string };
export type LevelInfo = {
  level: number;
  approvedCount: number;
  reputation: number | null;
  nextLevel: { level: number; minApproved: number; minReputation: number } | null;
  badges: Badge[];
};
export type PublicProfile = { userId: string; displayName: string; avatarUrl: string | null; level: number; badges: Badge[] };

export type TokenResponse = { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
export type TwoFactorChallenge = { twoFactorRequired: true; challengeToken: string; expiresIn: number };

/* ---------- Tập nhãn ---------- */

export type ToolKind =
  | "classification" | "freeText" | "number" | "bbox" | "polygon" | "keypoint" | "polyline" | "mask"
  | "span" | "relation" | "transcription" | "temporalSegment" | "track" | "pairwise" | "ranking";

export type AttributeDef = {
  name: string;
  type: "choice" | "boolean" | "text" | "number";
  required?: boolean;
  options?: string[];
  maxLength?: number;
};

export type Tool = {
  name: string;
  kind: ToolKind;
  classes?: string[];
  allowMultiple?: boolean;
  required?: boolean;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  allowTie?: boolean;
  matchThreshold?: number | null;
  attributes?: AttributeDef[];
  spanTool?: string;
  min?: number | null;
  max?: number | null;
  integer?: boolean;
  tolerance?: number;
  rotatable?: boolean;
};

export type LabelSchema = { modality: Modality; segmentSeconds?: number | null; tools: Tool[] };

/** Dữ liệu nhãn: khoá = tên công cụ. */
export type LabelData = Record<string, unknown>;
export type LabelPayload = { taskType: string; schemaVersion: number; data: LabelData };

export type SampleMeta = {
  width?: number;
  height?: number;
  durationSec?: number;
  segmentStart?: number;
  segmentEnd?: number;
  sourceDurationSec?: number;
  length?: number;
  itemCount?: number;
  fps?: number;
};

export type SampleContent = { text?: string; prompt?: string; a?: string; b?: string; items?: string[] };

/* ---------- Dự án ---------- */

export type ProjectStatus = "draft" | "pendingEscrow" | "pendingApproval" | "running" | "paused" | "grading" | "completed" | "cancelled";
export type Visibility = "public" | "approval" | "private";

export type Guideline = {
  markdown: string;
  examples: { sampleId: string | null; label: string | null; isCorrect: boolean; explanation: string | null }[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  modality: Modality;
  status: ProjectStatus;
  visibility: Visibility;
  labelSchema: LabelSchema | null;
  guideline: Guideline | null;
  /** Tiền thưởng cho MỘT bài đạt (dự án làm trung tâm — không tính theo nhãn). */
  rewardVnd: number;
  /** Số suất: tối đa bao nhiêu bài đạt được thưởng. */
  slots: number;
  /** Ngưỡng t (%): tỉ lệ câu giống đa số tối thiểu để đạt. */
  passThresholdPercent: number;
  /** Số câu thật (không tính câu vàng). */
  questionCount: number;
  toolKinds: ToolKind[];
  gateUnitPriceVnd: number;
  gateBudgetVnd: number;
  finishRequestedAt: string | null;
  gradingStartedAt: string | null;
  closedAt: string | null;
  deadline: string | null;
  allowProfessional: boolean;
  allowLinkGateway: boolean;
  allowCollaborative: boolean;
  minLevel: number | null;
  minReputation: number | null;
  requireEntranceTest: boolean;
  entranceQuestionCount: number;
  entrancePassPercent: number;
  publishedAt: string | null;
  sensitiveContent: boolean;
  contentWarning: string | null;
  ndaRequired: boolean;
  ndaVersion: number;
  requireVerifiedIdentity: boolean;
  consentRequired: boolean;
  domains: string[];
  languages: string[];
  deleteFilesAfterClose: boolean;
  filesPurgedAt: string | null;
  isOwner: boolean;
  ownerId: string | null;
  escrowVnd: number | null;
  platformFeePercent: number | null;
  statusReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ProjectListItem = {
  id: string;
  name: string;
  modality: Modality;
  status: ProjectStatus;
  visibility: Visibility;
  rewardVnd: number;
  slots: number;
  passThresholdPercent: number;
  questionCount: number;
  toolKinds: ToolKind[];
  deadline: string | null;
  requireEntranceTest: boolean;
  isOwner: boolean;
  sensitiveContent: boolean;
  consentRequired: boolean;
  requireVerifiedIdentity: boolean;
  domains: string[];
  languages: string[];
};

export type ProjectLimits = {
  passThresholdMin: number;
  passThresholdMax: number;
  minSlots: number;
  maxSlots: number;
  maxQuestions: number;
  minRewardVnd: number;
};

export type Readiness = {
  ready: boolean;
  missing: string[];
  warnings: string[];
  sampleCount: number;
  questionCount: number;
  qualityGoldCount: number;
  entranceGoldCount: number;
  platformFeePercent: number;
  platformFeePerPassVnd: number;
  estimatedCostVnd: number;
  limits: ProjectLimits;
};

export type Dataset = {
  id: string;
  name: string;
  status: "pending" | "ingesting" | "ready" | "failed";
  sampleCount: number;
  skippedCount: number;
  errorSummary: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type Sample = {
  id: string;
  datasetId: string;
  modality: Modality;
  originalName: string;
  sizeBytes: number | null;
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
};

export type GoldItem = { id: string; sampleId: string; expectedPayload: LabelPayload; purpose: "entranceTest" | "qualityCheck" };

export type Member = { userId: string; role: "owner" | "labeler" | "reviewer"; state: "active" | "blocked"; joinedAt: string };

export type InviteCode = {
  id: string;
  projectId: string;
  code: string;
  note: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  status: "active" | "expired" | "exhausted" | "revoked";
};

export type JoinRequest = {
  id: string;
  projectId: string;
  projectName: string | null;
  userId: string;
  displayName: string | null;
  level: number | null;
  reputation: number | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  entranceAttemptId: string | null;
  scorePercent: number | null;
  createdAt: string;
  decidedAt: string | null;
  rejectReason: string | null;
  canRequestAgainAt: string | null;
};

export type Invitation = {
  invitationId: string;
  projectId: string;
  projectName: string;
  email: string | null;
  userId: string | null;
  byEmail: boolean;
  role: "labeler" | "reviewer";
  status: "pending" | "accepted" | "declined" | "revoked" | "expired";
  requiresConsent: boolean;
  createdAt: string;
  expiresAt: string;
};

export type Terms = {
  projectId: string;
  sensitiveContent: boolean;
  contentWarning: string | null;
  ndaRequired: boolean;
  ndaText: string | null;
  ndaVersion: number;
  requireVerifiedIdentity: boolean;
  consentRequired: boolean;
  myConsentValid: boolean;
  myNdaSignedAt: string | null;
  myContentWarningAcceptedAt: string | null;
};

/* ---------- Bài làm (cả dự án) / nhãn ---------- */

export type AttemptQuestion = {
  index: number;
  sampleId: string;
  modality: Modality;
  fileUrl: string | null;
  content: SampleContent | null;
  metadata: SampleMeta;
  answer: LabelData | null;
  answeredAt: string | null;
};

export type AttemptState = "inProgress" | "submitted" | "expired" | "cancelled";
export type AppealState = "none" | "open" | "accepted" | "rejected";

/** Bài làm đang mở để làm (GET /tasks/attempts/{id}). */
export type Attempt = {
  attemptId: string;
  projectId: string;
  state: AttemptState;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  labelSchema: LabelSchema;
  schemaVersion: number;
  rewardVnd: number;
  passThresholdPercent: number;
  sensitiveContent: boolean;
  questionCount: number;
  answeredCount: number;
  questions: AttemptQuestion[];
};

export type SaveAnswerResponse = { attemptId: string; sampleId: string; answered: boolean; answeredCount: number; savedAt: string | null };
export type InvalidAnswer = { index: number; sampleId: string; code: string; message: string };
export type SubmitAttemptResponse = { attemptId: string; submittedAt: string; questionCount: number; answeredCount: number; collectionFinished: boolean };

/** Tóm tắt bài làm (danh sách của tôi / của dự án / hàng đợi khiếu nại). */
export type AttemptSummary = {
  attemptId: string;
  projectId: string;
  labelerId: string;
  state: AttemptState;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  endedAt: string | null;
  questionCount: number;
  answeredCount: number;
  rewardVnd: number;
  passThresholdPercent: number;
  comparableCount: number | null;
  matchedCount: number | null;
  agreementPercent: number | null;
  goldTotal: number | null;
  goldCorrect: number | null;
  passed: boolean | null;
  finalPassed: boolean | null;
  gradedAt: string | null;
  appealState: AppealState;
  appealMessage: string | null;
  appealedAt: string | null;
  appealNote: string | null;
  appealResolvedAt: string | null;
  appealDeadline: string | null;
  canAppeal: boolean;
};

/** open: đang nhận bài · finished: đã đóng thu bài, chờ chấm · graded: đã chấm, đang trong hạn khiếu nại · settled: đã chốt. */
export type ProjectPhase = "open" | "finished" | "graded" | "settled";

export type Slots = {
  projectId: string;
  slots: number;
  inProgress: number;
  submitted: number;
  available: number;
  questionCount: number;
  rewardVnd: number;
  passThresholdPercent: number;
  deadline: string | null;
  phase: ProjectPhase;
  collectionFinishedAt: string | null;
  gradedAt: string | null;
  appealDeadline: string | null;
  /** Bài của chính người xem trong dự án (nếu có). */
  mine: AttemptSummary | null;
};

export type AnnotationStatus = "submitted" | "accepted" | "excluded";

export type Annotation = {
  id: string;
  projectId: string;
  taskId: string | null;
  sampleId: string;
  source: "professional" | "linkGateway";
  fileUrl: string | null;
  sampleContent: SampleContent | null;
  sampleMetadata: SampleMeta;
  labelerId: string | null;
  payload: LabelPayload;
  status: AnnotationStatus;
  submittedAt: string;
  attemptId: string;
  decidedAt: string | null;
};

export type Progress = {
  projectId: string;
  slots: number;
  questionCount: number;
  inProgress: number;
  submitted: number;
  expired: number;
  cancelled: number;
  phase: ProjectPhase;
  finishReason: "du_suat" | "het_han" | "ket_thuc_som" | null;
  deadline: string | null;
  collectionFinishedAt: string | null;
  gradedAt: string | null;
  appealDeadline: string | null;
  settledAt: string | null;
  passedCount: number | null;
  openAppeals: number;
  estimatedCompletionAt: string | null;
  frozenAt: string | null;
};

export type TaskReport = {
  id: string;
  taskId: string;
  sampleId: string;
  labelerId: string;
  reason: "broken" | "inappropriate" | "unclear" | "other";
  note: string | null;
  state: "open" | "dismissed" | "excluded";
  createdAt: string;
  resolvedAt: string | null;
  reportsOnTask: number;
};

/* ---------- Tiền ---------- */

export type Balance = { businessAvailableVnd: number; escrowVnd: number; pendingVnd: number; availableVnd: number };
export type Transaction = { seq: number; type: string; reference: string; description: string; accountCode: string; amountVnd: number; at: string };
export type WithdrawalState = "pendingApproval" | "requested" | "completed" | "failed" | "rejected";
export type Withdrawal = {
  id: string;
  amountVnd: number;
  taxVnd: number;
  netVnd: number;
  state: WithdrawalState;
  createdAt: string;
  failureReason: string | null;
  reviewedAt: string | null;
  labelerId?: string;
  bankAccount?: string;
  reviewedBy?: string | null;
};
export type DepositStatus = "pending" | "awaitingApproval" | "succeeded" | "failed" | "rejected" | "expired";
export type Deposit = {
  intentId: string;
  businessId: string;
  amountVnd: number;
  provider: string;
  status: DepositStatus;
  checkoutUrl: string | null;
  transferCode: string | null;
  bankInfo: string | null;
  transferredAt: string | null;
  rejectReason: string | null;
  failureCode: string | null;
  createdAt: string;
  completedAt: string | null;
};
/* ---------- Link ---------- */

export type LinkStatus = "pendingScan" | "active" | "blocked" | "disabled";
export type ShortLink = {
  id: string;
  code: string;
  shortUrl: string;
  destinationUrl: string;
  domain: string;
  status: LinkStatus;
  statusReason: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  campaignId: string | null;
  createdAt: string;
};

/* ---------- Thông báo ---------- */

export type Notification = { id: string; type: string; title: string; body: string; link: string | null; createdAt: string; readAt: string | null };

export type KybProfile = {
  businessId: string;
  status: "draft" | "submitted" | "verified" | "rejected";
  companyName: string;
  taxCode: string;
  address: string;
  hasLicense: boolean;
  licenseFileName: string | null;
  rejectReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type IdentityVerification = {
  userId: string;
  status: "draft" | "submitted" | "verified" | "rejected";
  fullName: string;
  dateOfBirth: string | null;
  idNumberLast4: string | null;
  hasFront: boolean;
  hasBack: boolean;
  adult: boolean;
  rejectReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export type Template = {
  id: string;
  code: string;
  name: string;
  description: string;
  modality: Modality;
  labelSchema: LabelSchema | null;
  guidelineMarkdown: string;
  suggestedUnitPriceVnd: number | null;
  suggestedRedundancy: number | null;
  active: boolean;
  version: number;
  updatedAt: string;
};
