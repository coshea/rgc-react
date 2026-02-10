import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Divider,
} from "@heroui/react";

export function DoneStep(props: {
  title: string;
  description: string;
  onStartOver: () => void;
  onBackToOptions: () => void;
}) {
  const { title, description, onStartOver, onBackToOptions } = props;

  return (
    <Card className="w-full max-w-3xl" shadow="sm">
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 5: Complete</h2>
        <Button variant="light" onPress={onStartOver}>
          Start over
        </Button>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-default-600">{description}</p>
      </CardBody>
      <Divider />
      <CardFooter className="flex justify-end">
        <Button color="primary" onPress={onBackToOptions}>
          Back to options
        </Button>
      </CardFooter>
    </Card>
  );
}
