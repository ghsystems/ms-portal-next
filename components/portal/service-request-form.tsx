import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth0 } from "@auth0/auth0-react";
import { toast } from "sonner";

import {
  calculatePriority,
  impactOptions,
  requestTypes,
  urgencyOptions,
  type Impact,
  type RequestType,
  type Urgency,
} from "@/components/portal/portal-data";
import { PriorityBadge } from "@/components/portal/portal-ui";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  addFiles,
  formatFileSize,
  MAX_ATTACHMENT_BYTES_PER_FILE,
  MAX_ATTACHMENT_TOTAL_BYTES,
  toAttachmentPayloads,
  validateAttachments,
} from "@/lib/attachments";
import {
  submitServiceRequest,
  type ServiceRequestPayload,
  type ServiceRequestResult,
} from "@/lib/service-request";

const MIN_DESCRIPTION_LENGTH = 50;

const schema = z.object({
  requestType: z.string().min(1, "Select a request type."),
  subject: z.string().trim().min(1, "Add a concise subject."),
  description: z
    .string()
    .refine(
      (value) => value.trim().length > 0,
      "Describe the request so support can act quickly.",
    )
    .refine(
      (value) => value.trim().length >= MIN_DESCRIPTION_LENGTH,
      `Add at least ${MIN_DESCRIPTION_LENGTH} characters.`,
    ),
  impact: z.string().min(1, "Select business impact."),
  urgency: z.string().min(1, "Select urgency."),
});

type FormValues = z.infer<typeof schema>;

export type SubmittedRequest = {
  subject: string;
  description: string;
  requestType: RequestType;
  impact: Impact;
  urgency: Urgency;
  attachmentName: string | null;
};

export function ServiceRequestForm({
  defaultImpact = "",
  defaultUrgency = "",
  onSuccess,
}: {
  /** Dashboard defaults these to "Medium"; New Request leaves them empty. */
  defaultImpact?: Impact | "";
  defaultUrgency?: Urgency | "";
  onSuccess?: (result: ServiceRequestResult, request: SubmittedRequest) => void;
}) {
  const { user, getAccessTokenSilently } = useAuth0();

  const [files, setFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      requestType: "Service Request",
      subject: "",
      description: "",
      impact: defaultImpact,
      urgency: defaultUrgency,
    },
  });

  const [description, impact, urgency] = useWatch({
    control: form.control,
    name: ["description", "impact", "urgency"],
  });
  const descriptionLength = description.trim().length;
  const priority =
    impact && urgency
      ? calculatePriority(impact as Impact, urgency as Urgency)
      : null;

  const onSubmit = async (values: FormValues) => {
    const validationError = validateAttachments(files);
    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    try {
      const token = await getAccessTokenSilently();
      const attachments = await toAttachmentPayloads(files);
      const attachmentName =
        files.length > 0 ? files.map((file) => file.name).join(", ") : null;

      const payload: ServiceRequestPayload = {
        requestType: values.requestType,
        category: "General",
        subject: values.subject.trim(),
        description: values.description.trim(),
        impact: values.impact,
        urgency: values.urgency,
        priority:
          calculatePriority(values.impact as Impact, values.urgency as Urgency),
        requesterName: user?.name ?? "Portal User",
        requesterEmail: user?.email ?? "",
        attachments,
      };

      const result = await submitServiceRequest(token, payload);

      if (onSuccess) {
        onSuccess(result, {
          subject: payload.subject,
          description: payload.description,
          requestType: values.requestType as RequestType,
          impact: values.impact as Impact,
          urgency: values.urgency as Urgency,
          attachmentName,
        });
      } else {
        toast.success(
          "Your request has been submitted. You'll receive a confirmation email shortly with your ticket number.",
        );
      }

      form.reset({
        requestType: "Service Request",
        subject: "",
        description: "",
        impact: defaultImpact,
        urgency: defaultUrgency,
      });
      setFiles([]);
      setAttachmentError(null);
      setFileInputKey((key) => key + 1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Submission failed. Please try again.",
      );
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <form
      className="mt-6 space-y-5"
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Controller
          name="requestType"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sr-request-type">Request type</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="sr-request-type"
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {requestTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="subject"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sr-subject">
                Subject <span className="text-destructive">*</span>
              </FieldLabel>
              <Input
                {...field}
                id="sr-subject"
                aria-invalid={fieldState.invalid}
                placeholder="Brief summary of the request"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </div>

      <Controller
        name="description"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="sr-description">
              Description <span className="text-destructive">*</span>
            </FieldLabel>
            <Textarea
              {...field}
              id="sr-description"
              rows={6}
              aria-invalid={fieldState.invalid}
              className="min-h-[160px]"
              placeholder="Describe the issue or request in detail. Include affected users, systems, symptoms, and any steps already taken."
            />
            <div className="flex items-center justify-between gap-3">
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                <span />
              )}
              <span className="text-muted-foreground shrink-0 text-xs">
                {descriptionLength}/{MIN_DESCRIPTION_LENGTH} minimum
              </span>
            </div>
          </Field>
        )}
      />

      <div className="grid gap-5 pt-3 lg:grid-cols-[1fr_1fr_1.2fr]">
        <Controller
          name="impact"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sr-impact">
                Impact <span className="text-destructive">*</span>
              </FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="sr-impact"
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue placeholder="Select impact..." />
                </SelectTrigger>
                <SelectContent>
                  {impactOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="urgency"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="sr-urgency">
                Urgency <span className="text-destructive">*</span>
              </FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="sr-urgency"
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                >
                  <SelectValue placeholder="Select urgency..." />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex flex-col items-center gap-2 pt-1">
          <span className="text-sm font-medium">Calculated priority</span>
          <div className="flex h-[46px] items-center">
            {priority ? (
              <PriorityBadge value={priority} />
            ) : (
              <p className="text-muted-foreground text-sm">-</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <Field className="w-full lg:max-w-md">
          <FieldLabel htmlFor="sr-attachments">Attach files</FieldLabel>
          <Input
            key={fileInputKey}
            id="sr-attachments"
            type="file"
            multiple
            className="h-auto py-1.5 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
            onChange={(event) => {
              const { files: next, error } = addFiles(
                files,
                Array.from(event.target.files ?? []),
              );
              setFiles(next);
              setAttachmentError(error);
              setFileInputKey((key) => key + 1);
            }}
          />
          <FieldDescription>
            Up to {MAX_ATTACHMENT_BYTES_PER_FILE / (1024 * 1024)} MB per file,{" "}
            {MAX_ATTACHMENT_TOTAL_BYTES / (1024 * 1024)} MB total
          </FieldDescription>
          {files.length > 0 ? (
            <ul className="space-y-1">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate">
                    {file.name} ({formatFileSize(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles((prev) => prev.filter((_, i) => i !== index));
                      setAttachmentError(null);
                    }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {attachmentError ? <FieldError>{attachmentError}</FieldError> : null}
        </Field>

        <Button
          type="submit"
          disabled={!form.formState.isValid || isSubmitting}
          size="lg"
        >
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}
