"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { UsernamePicker } from "./username-picker";

export type ActionField = {
  name: string;
  label: string;
  /** "username": ô nhập có gợi ý username labeler khi gõ. */
  type?: "text" | "textarea" | "number" | "checkbox" | "select" | "password" | "datetime" | "username";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
  hint?: string;
};

type Values = Record<string, string | boolean>;

/** Hộp xác nhận một thao tác, có thể kèm ô nhập (lý do, ghi chú...). */
export function ActionDialog({
  trigger,
  title,
  description,
  fields = [],
  confirmLabel = "Xác nhận",
  destructive,
  onConfirm,
  successMessage,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  fields?: ActionField[];
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (values: Values) => Promise<unknown>;
  successMessage?: string;
  children?: ReactNode;
}) {
  const init = (): Values => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue === undefined ? (f.type === "checkbox" ? false : "") : typeof f.defaultValue === "boolean" ? f.defaultValue : String(f.defaultValue)]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(init);
  const [busy, setBusy] = useState(false);

  const missing = fields.some((f) => f.required && f.type !== "checkbox" && !String(values[f.name] ?? "").trim());

  async function submit() {
    setBusy(true);
    try {
      await onConfirm(values);
      if (successMessage) toast.success(successMessage);
      setOpen(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValues(init());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {fields.length > 0 && (
          <div className="space-y-3">
            {fields.map((f) => (
              <div key={f.name} className="space-y-1.5">
                {f.type === "checkbox" ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={Boolean(values[f.name])} onCheckedChange={(c) => setValues((v) => ({ ...v, [f.name]: c === true }))} />
                    {f.label}
                  </label>
                ) : (
                  <>
                    <Label htmlFor={`af-${f.name}`}>
                      {f.label} {f.required && <span className="text-destructive">*</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea id={`af-${f.name}`} rows={3} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                    ) : f.type === "username" ? (
                      <UsernamePicker id={`af-${f.name}`} placeholder={f.placeholder} value={values[f.name] ? [String(values[f.name])] : []} onChange={(x) => setValues((v) => ({ ...v, [f.name]: x[0] ?? "" }))} />
                    ) : f.type === "select" ? (
                      <Select value={String(values[f.name] ?? "")} onValueChange={(x) => setValues((v) => ({ ...v, [f.name]: x }))}>
                        <SelectTrigger id={`af-${f.name}`} className="w-full">
                          <SelectValue placeholder={f.placeholder ?? "Chọn"} />
                        </SelectTrigger>
                        <SelectContent>
                          {f.options?.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`af-${f.name}`}
                        type={f.type === "number" ? "number" : f.type === "password" ? "password" : f.type === "datetime" ? "datetime-local" : "text"}
                        placeholder={f.placeholder}
                        value={String(values[f.name] ?? "")}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    )}
                  </>
                )}
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={() => void submit()} disabled={busy || missing}>
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
