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
import golfBallHoleImage from "@/assets/golf_ball_hole.jpg";

export const ContactForm = () => {
  const [submitted, setSubmitted] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);

    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 3000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-8 md:items-stretch">
      <div className="hidden md:block relative h-[600px]">
        <Image
          src={golfBallHoleImage}
          alt="Contact Us"
          className="w-full h-full object-cover rounded-2xl"
        />
      </div>

      <Card className="p-2 md:h-full flex flex-col">
        <CardBody className="space-y-6 grow overflow-y-auto">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Contact Us
            </h1>
            <p className="text-default-500 mt-2">
              Let us know if you have any questions!
            </p>
          </div>

          {submitted && (
            <Alert className="mb-4" color="success">
              Thanks for reaching out! We'll get back to you soon.
            </Alert>
          )}

          <Form className="space-y-4" onSubmit={handleSubmit}>
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

            <Input
              isRequired
              label="Subject"
              placeholder="Enter subject"
              startContent={
                <Icon
                  icon="lucide:message-circle"
                  className="text-default-400"
                />
              }
              value={formData.subject}
              onValueChange={(value) =>
                setFormData({ ...formData, subject: value })
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

            <Button type="submit" color="primary" className="w-full" size="lg">
              Send Message
              <Icon icon="lucide:send" className="ml-2" />
            </Button>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
};
