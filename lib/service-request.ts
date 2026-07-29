import { API_BASE_URL } from "./api";

export type AttachmentPayload = {
  name: string;
  mimeType: string | null;
  base64: string;
};

export type ServiceRequestPayload = {
  requestType: string;
  category: string;
  subject: string;
  description: string;
  impact: string;
  urgency: string;
  priority: string;
  requesterName: string;
  requesterEmail: string;
  attachments: AttachmentPayload[];
};

export type ServiceRequestResult = {
  ticketNumber: string;
  sysId: string;
  attachmentError?: string;
  emailError?: string;
};

export async function submitServiceRequest(
  accessToken: string,
  payload: ServiceRequestPayload,
): Promise<ServiceRequestResult> {
  const res = await fetch(
    `${API_BASE_URL}/submit-service-request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? "Submission failed. Please try again.",
    );
  }

  return data as ServiceRequestResult;
}
