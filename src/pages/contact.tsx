import { ContactForm } from "@/components/contact-form";
import { usePageTracking } from "@/hooks/usePageTracking";

export default function ContactPage() {
  usePageTracking("Contact Us");
  return <ContactForm />;
}
