import React from "react";
import {
  Form,
  TextField,
  Label,
  InputGroup,
  TextArea,
  FieldError,
  Button,
  Alert,
  Card,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import emailjs from "@emailjs/browser";
import { EMAILJS_CONFIG, isEmailJSConfigured } from "@/config/emailjs";
import { siteConfig } from "@/config/site";
import golfBallHoleImage from "@/assets/golf_ball_hole.jpg";
import { executeRecaptcha } from "@/utils/recaptcha";

// Disable EmailJS's internal Web Storage usage to prevent SecurityError in
// browsers where storage access is blocked (Safari private mode / strict
// cross-site tracking prevention). Storage is only used for deduplication;
// disabling it has no effect on reliable delivery.
emailjs.init({ storageProvider: undefined });

export const ContactForm = () => {
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit: React.ComponentProps<typeof Form>["onSubmit"] = async (
    e,
  ) => {
    e.preventDefault();

    if (!isEmailJSConfigured()) {
      setError(
        "Email service is not configured. Please contact the administrator.",
      );
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Generate reCAPTCHA token before submission
      const token = await executeRecaptcha("contact_form");
      if (!token) {
        setError(
          "Security check failed. Please refresh the page and try again.",
        );
        return;
      }

      // Send email using EmailJS
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          from_name: formData.name,
          from_email: formData.email,
          subject: `Contact Form Message from ${formData.name}`,
          message: formData.message,
          to_name: "RGC Admin", // You can customize this
        },
        EMAILJS_CONFIG.publicKey,
      );

      setSubmitted(true);

      // Reset form after 3 seconds
      setTimeout(() => {
        setSubmitted(false);
        setFormData({ name: "", email: "", message: "" });
      }, 3000);
    } catch (err) {
      console.error("Failed to send email:", err);
      setError(
        "Failed to send message. Please try again later or contact us directly.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="hidden md:block relative h-125 overflow-hidden rounded-2xl">
            <img
              src={golfBallHoleImage}
              alt="Contact Us"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full">
            <Card>
              <Card.Content className="p-6 space-y-4">
                <div className="text-center">
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                    Contact Us
                  </h1>
                  <p className="text-sm sm:text-base text-muted mt-2">
                    Let us know if you have any questions!
                  </p>
                </div>

                {submitted && (
                  <Alert className="mb-4" status="success">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>
                        Thanks for reaching out! We'll get back to you soon.
                      </Alert.Title>
                    </Alert.Content>
                  </Alert>
                )}

                {error && (
                  <Alert className="mb-4" status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>Unable to send the message!</Alert.Title>
                      <Alert.Description>
                        Please try again later or email us directly at{" "}
                        <a
                          href={`mailto:${siteConfig.contactEmail}`}
                          className="text-primary underline"
                        >
                          {siteConfig.contactEmail}
                        </a>
                        .
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                )}

                <Form
                  className="space-y-3 sm:space-y-4"
                  onSubmit={handleSubmit}
                >
                  <TextField isRequired name="name" className="w-full">
                    <Label>Name</Label>
                    <InputGroup>
                      <InputGroup.Prefix>
                        <Icon icon="lucide:user" className="text-muted" />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="Enter your name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </InputGroup>
                    <FieldError />
                  </TextField>

                  <TextField
                    isRequired
                    name="email"
                    type="email"
                    className="w-full"
                  >
                    <Label>Email</Label>
                    <InputGroup>
                      <InputGroup.Prefix>
                        <Icon icon="lucide:mail" className="text-muted" />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        placeholder="Enter your email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </InputGroup>
                    <FieldError />
                  </TextField>

                  <TextField isRequired name="message" className="w-full">
                    <Label>Message</Label>
                    <TextArea
                      placeholder="Enter your message"
                      rows={4}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                    />
                    <FieldError />
                  </TextField>

                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    size="md"
                    isDisabled={sending}
                  >
                    {sending ? "Sending..." : "Send Message"}
                    {!sending && <Icon icon="lucide:send" className="ml-2" />}
                  </Button>
                </Form>
              </Card.Content>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
