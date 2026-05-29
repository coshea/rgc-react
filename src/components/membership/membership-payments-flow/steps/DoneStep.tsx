import { Button, Card, Separator } from "@heroui/react";

export function DoneStep(props: {
  title: string;
  description: string;
  onStartOver: () => void;
  onBackToOptions: () => void;
}) {
  const { title, description, onStartOver, onBackToOptions } = props;

  return (
    <Card className="w-full max-w-3xl">
      <Card.Header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Step 5: Complete</h2>
        <Button variant="ghost" onPress={onStartOver}>
          Start over
        </Button>
      </Card.Header>
      <Separator />
      <Card.Content className="space-y-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-foreground">{description}</p>
      </Card.Content>
      <Separator />
      <Card.Footer className="flex justify-end">
        <Button onPress={onBackToOptions}>Back to options</Button>
      </Card.Footer>
    </Card>
  );
}
