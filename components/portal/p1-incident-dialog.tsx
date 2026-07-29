import { useState, type FormEvent } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  addFiles,
  formatFileSize,
  MAX_ATTACHMENT_BYTES_PER_FILE,
  MAX_ATTACHMENT_TOTAL_BYTES,
  toAttachmentPayloads,
  validateAttachments,
} from "@/lib/attachments";
import { PortalIcon } from "@/components/portal/portal-ui";
import { API_BASE_URL } from "@/lib/api";

type P1Step = "idle" | "confirm" | "form" | "submitting" | "success" | "error";

const criticalButtonClass =
  "bg-rose-800 text-white hover:bg-rose-700 focus-visible:ring-rose-800";

export function P1IncidentButton() {
  const { user, getAccessTokenSilently } = useAuth0();

  const [step, setStep] = useState<P1Step>("idle");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [errors, setErrors] = useState<{
    subject?: string;
    description?: string;
    attachment?: string;
  }>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  function reset() {
    setStep("idle");
    setSubject("");
    setDescription("");
    setFiles([]);
    setFileInputKey((k) => k + 1);
    setErrors({});
    setErrorMsg("");
    setTicketNumber(null);
    setAttachmentError(null);
    setEmailError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!subject.trim()) errs.subject = "Subject is required.";
    if (!description.trim()) errs.description = "Description is required.";
    const attachmentErr = validateAttachments(files);
    if (attachmentErr) errs.attachment = attachmentErr;
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setStep("submitting");
    try {
      const token = await getAccessTokenSilently();
      const attachments = await toAttachmentPayloads(files);
      const resp = await fetch(`${API_BASE_URL}/submit-p1-incident`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim(),
          requesterName: user?.name ?? user?.email ?? "Unknown",
          requesterEmail: user?.email ?? "",
          attachments,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error((data as { error?: string }).error ?? "Submission failed.");
      }
      const result = data as {
        ticketNumber?: string;
        attachmentError?: string;
        emailError?: string;
      };
      setTicketNumber(result.ticketNumber ?? null);
      setAttachmentError(result.attachmentError ?? null);
      setEmailError(result.emailError ?? null);
      setStep("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Submission failed. Please try again.");
      setStep("error");
    }
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setStep("confirm")}
        variant="destructive"
        className={criticalButtonClass}
      >
        <PortalIcon name="alert" className="h-4 w-4" data-icon="inline-start" />
        Submit P1 Ticket
      </Button>

      {/* Confirm */}
      <Dialog open={step === "confirm"} onOpenChange={(open) => { if (!open) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-700">Submit a P1 Critical Incident?</DialogTitle>
            <DialogDescription className="mt-2 text-muted-foreground">
              This will create a{" "}
              <strong className="text-foreground">P1 (production down) ticket</strong>. Our on-call
              team will be notified immediately.
              <br />
              <br />
              Only use this for active production outages. Misuse may affect your company's
              escalation path.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={reset}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => setStep("form")}
              variant="destructive"
              className={criticalButtonClass}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Form */}
      <Dialog
        open={step === "form" || step === "submitting"}
        onOpenChange={(open) => { if (!open) reset(); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>P1 Critical Incident</DialogTitle>
            <DialogDescription>
              Briefly describe the production outage. Keep it short - our team will follow up
              immediately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="field-label mb-2 block">Subject</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. ERP system unreachable for all users"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  if (errors.subject) setErrors((fe) => ({ ...fe, subject: undefined }));
                }}
                disabled={step === "submitting"}
                autoFocus
              />
              {errors.subject && <p className="mt-1 text-xs text-rose-600">{errors.subject}</p>}
            </div>
            <div>
              <label className="field-label mb-2 block">Description</label>
              <textarea
                className="field-input min-h-30"
                rows={4}
                placeholder="What is down? Who is affected? When did it start?"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (errors.description) setErrors((fe) => ({ ...fe, description: undefined }));
                }}
                disabled={step === "submitting"}
              />
              {errors.description && (
                <p className="mt-1 text-xs text-rose-600">{errors.description}</p>
              )}
            </div>
            <div>
              <label className="field-label mb-2 block">Attach files</label>
              <input
                key={fileInputKey}
                type="file"
                multiple
                className="field-input file:mr-4 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-secondary"
                onChange={(e) => {
                  const { files: next, error } = addFiles(files, Array.from(e.target.files ?? []));
                  setFiles(next);
                  setFileInputKey((k) => k + 1);
                  setErrors((fe) => ({ ...fe, attachment: error ?? undefined }));
                }}
                disabled={step === "submitting"}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Optional - up to {MAX_ATTACHMENT_BYTES_PER_FILE / (1024 * 1024)} MB per file,{" "}
                {MAX_ATTACHMENT_TOTAL_BYTES / (1024 * 1024)} MB total
              </p>
              {files.length > 0 && (
                <ul className="mt-1 space-y-1">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span className="truncate">
                        {file.name} ({formatFileSize(file.size)})
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 text-muted-foreground hover:text-rose-600"
                        aria-label={`Remove ${file.name}`}
                      >
                        x
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {errors.attachment && (
                <p className="mt-1 text-xs text-rose-600">{errors.attachment}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                onClick={reset}
                disabled={step === "submitting"}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={step === "submitting"}
                variant="destructive"
                className={criticalButtonClass}
              >
                {step === "submitting" ? "Submitting..." : "Submit P1 Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={step === "success"} onOpenChange={(open) => { if (!open) reset(); }}>
        <DialogContent className="max-w-md text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <PortalIcon name="check" className="h-7 w-7" />
            </span>
            <div>
              <h2 className="font-display text-2xl text-foreground">P1 Ticket Submitted</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {ticketNumber ? (
                  <>
                    <strong className="text-foreground">{ticketNumber}</strong> has been created and
                  </>
                ) : (
                  "Your P1 ticket has been submitted and"
                )}{" "}
                our team has been notified and will respond as soon as possible. If you do not hear
                from us shortly, call the{" "}
                <strong className="text-foreground">24/7 support line</strong>.
              </p>
              {attachmentError && (
                <p className="mt-3 text-sm text-rose-700">
                  Note: the attachment failed to upload - {attachmentError}
                </p>
              )}
              {emailError && (
                <p className="mt-3 text-sm text-rose-700">
                  Note: the confirmation email could not be sent - {emailError}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={reset}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Error */}
      <Dialog open={step === "error"} onOpenChange={(open) => { if (!open) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-700">Submission Failed</DialogTitle>
            <DialogDescription>{errorMsg}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setStep("form")}
              variant="outline"
            >
              Try Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
