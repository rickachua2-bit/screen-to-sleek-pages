import { Button } from "@/components/ui/button";
import { COMPANY } from "@/components/marketing/company";

export function WhatsAppButton() {
  return (
    <Button asChild size="icon" className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 w-12 rounded-full border-2 border-success bg-cobalt text-primary-foreground shadow-cobalt hover:bg-cobalt-deep lg:bottom-6 lg:right-6" >
      <a
        href={`https://wa.me/${COMPANY.nigeria.tel.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with Slikcash on WhatsApp"
        title="Chat with Slikcash on WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="!h-6 !w-6">
          <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.47 0 .12 5.35.12 11.93c0 2.1.55 4.15 1.59 5.96L0 24l6.28-1.65a11.9 11.9 0 0 0 5.77 1.47h.01c6.58 0 11.93-5.35 11.94-11.93a11.86 11.86 0 0 0-3.48-8.41ZM12.05 21.8a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.73.98.99-3.64-.24-.37a9.86 9.86 0 0 1-1.52-5.25c0-5.47 4.45-9.92 9.92-9.92a9.85 9.85 0 0 1 7.02 2.91A9.85 9.85 0 0 1 22 11.9c0 5.47-4.45 9.9-9.95 9.9Zm5.44-7.42c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.09 4.49.71.31 1.27.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
        </svg>
      </a>
    </Button>
  );
}