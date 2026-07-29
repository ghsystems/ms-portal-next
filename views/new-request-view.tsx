import { usePortal } from "@/components/portal/use-portal";
import { P1IncidentButton } from "@/components/portal/p1-incident-dialog";
import {
  ServiceRequestForm,
  type SubmittedRequest,
} from "@/components/portal/service-request-form";
import type { ServiceRequestResult } from "@/lib/service-request";
import { toast } from "sonner";

export default function NewRequestView() {
  const { profile, addTicket } = usePortal();
  const isP1Authorized = profile?.p1_authorized === true;

  function handleSuccess(
    result: ServiceRequestResult,
    request: SubmittedRequest,
  ) {
    const createdTicket = addTicket({
      id: result.ticketNumber,
      sysId: result.sysId,
      subject: request.subject,
      description: request.description,
      requestType: request.requestType,
      category: "General",
      impact: request.impact,
      urgency: request.urgency,
      attachmentName: request.attachmentName,
    });

    const warnings = [
      result.attachmentError
        ? `the attachment failed to upload (${result.attachmentError})`
        : null,
      result.emailError
        ? `the confirmation email could not be sent (${result.emailError})`
        : null,
    ].filter((warning): warning is string => warning !== null);

    if (warnings.length > 0) {
      toast.warning(`${createdTicket.id} created, but ${warnings.join(" and ")}.`);
    } else {
      toast.success(`${createdTicket.id} created successfully.`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel px-6 py-6 lg:px-8 lg:py-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-4xl text-foreground font-light">
              New Service Request
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Complete the form below and submit. GHS will receive your request
              and a confirmation email with your ticket number will follow
              shortly.
            </p>
          </div>
          {isP1Authorized ? <P1IncidentButton /> : null}
        </div>

        <ServiceRequestForm onSuccess={handleSuccess} />
      </section>
    </div>
  );
}
