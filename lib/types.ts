export type Role = "owner" | "manager" | "employee";
export type Status =
  "todo" | "doing" | "review" | "changes" | "done" | "paused";
export type Publication = "draft" | "approved" | "delivered" | "published";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  passwordHash: string;
};
export type SafeUser = Omit<User, "passwordHash">;
export type MediaKind = "images" | "videos";
export type MediaItem = {
  id: string;
  year: number;
  month: number; // 1..12
  kind: MediaKind;
  name: string;
  contentType: string;
  sizeBytes: number;
  chunkCount: number;
  uploadedBy: string;
  uploadedById: string;
  uploadedAt: string;
  note?: string;
  taskId?: string | null;
};
export type Task = {
  id: string;
  title: string;
  description: string;
  channel: string;
  priority: "high" | "normal" | "low";
  status: Status;
  publication: Publication;
  assignee: string | null;
  dueDate: string | null;
  progress: number;
  publishedUrl: string;
  publishedAt: string | null;
  updatedAt: string;
  version: number;
  archived: boolean;
  comments: { id: string; author: string; body: string; at: string }[];
  history?: string[];
  week?: string;
  assignedWeek?: string | null;
  platform?: string;
  assets?: { label: string; url: string }[];
  proofImage?: { url: string; name: string; uploadedAt: string } | null;
  mediaFolder?: { year: number; month: number } | null;
};
export type Audit = {
  id: string;
  actor: string;
  message: string;
  at: string;
  taskId?: string;
};
export type State = {
  schemaVersion: 1;
  users: User[];
  tasks: Task[];
  mediaItems?: MediaItem[];
  sessions: { hash: string; userId: string; expires: number }[];
  attempts: Record<string, { count: number; until: number }>;
  audit: Audit[];
  readNotifications: Record<string, string[]>;
  settings: { reminderTime: string; timezone: string };
};
export type BuildStep = {
  id: string;
  title: string;
  detail: string;
  status: "done" | "doing" | "pending";
  updatedAt: string;
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  taskId?: string;
  read: boolean;
};
export type Snapshot = {
  user: SafeUser;
  users: SafeUser[];
  tasks: Task[];
  mediaItems: MediaItem[];
  audit: Audit[];
  notifications: Notification[];
  today: string;
  week: string;
  platforms: { name: string; url: string; note?: string }[];
  rotation: string[];
  socialCompleted: number;
  socialTarget: number;
  build: BuildStep[];
  settings: State["settings"];
  storage: "local" | "postgres";
  localTest: boolean;
  gmailConfigured: boolean;
  gmailSender: string;
};
