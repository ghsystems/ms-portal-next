import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn-style Sonner wrapper. The app has no next-themes provider, so this
// keeps the default light theme and turns on richColors (green/red styling)
// and a close button. Mounted once at the app root.
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        style: { borderRadius: "12px" },
      }}
      {...props}
    />
  );
}
