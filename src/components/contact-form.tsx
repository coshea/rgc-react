import React from "react";
import {
  Form,
  Input,
  Textarea,
  Button,
  Alert,
  Card,
  CardBody,
  Image,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import emailjs from "@emailjs/browser";
import { EMAILJS_CONFIG, isEmailJSConfigured } from "@/config/emailjs";
import golfBallHoleImage from "@/assets/golf_ball_hole.jpg";

export const ContactForm = () => {
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEmailJSConfigured()) {
      setError(
        "Email service is not configured. Please contact the administrator."
      );
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Send email using EmailJS
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        {
          from_name: formData.name,
          from_email: formData.email,
          message: formData.message,
          to_name: "RGC Admin", // You can customize this
        },
        EMAILJS_CONFIG.publicKey
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
        "Failed to send message. Please try again later or contact us directly."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="hidden md:block relative h-[500px] overflow-hidden rounded-2xl">
            <Image
              src={golfBallHoleImage}
              alt="Contact Us"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full">
            <Card>
              <CardBody className="p-6 space-y-4">
                <div className="text-center">
                  <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
                    Contact Us
                  </h1>
                  <p className="text-sm sm:text-base text-default-500 mt-2">
                    Let us know if you have any questions!
                  </p>
                </div>

                {submitted && (
                  <Alert className="mb-4" color="success">
                    Thanks for reaching out! We'll get back to you soon.
                  </Alert>
                )}

                {error && (
                  <Alert className="mb-4" color="danger">
                    {error}
                  </Alert>
                )}

                <Form
                  className="space-y-3 sm:space-y-4"
                  onSubmit={handleSubmit}
                >
                  <Input
                    isRequired
                    label="Name"
                    placeholder="Enter your name"
                    startContent={
                      <Icon icon="lucide:user" className="text-default-400" />
                    }
                    value={formData.name}
                    onValueChange={(value) =>
                      setFormData({ ...formData, name: value })
                    }
                  />

                  <Input
                    isRequired
                    type="email"
                    label="Email"
                    placeholder="Enter your email"
                    startContent={
                      <Icon icon="lucide:mail" className="text-default-400" />
                    }
                    value={formData.email}
                    onValueChange={(value) =>
                      setFormData({ ...formData, email: value })
                    }
                  />

                  <Textarea
                    isRequired
                    label="Message"
                    placeholder="Enter your message"
                    minRows={4}
                    value={formData.message}
                    onValueChange={(value) =>
                      setFormData({ ...formData, message: value })
                    }
                  />

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    size="md"
                    isLoading={sending}
                    isDisabled={sending}
                  >
                    {sending ? "Sending..." : "Send Message"}
                    {!sending && <Icon icon="lucide:send" className="ml-2" />}
                  </Button>
                </Form>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
