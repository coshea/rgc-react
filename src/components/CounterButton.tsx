import { Button } from "@material-tailwind/react";
import { useState } from "react";

export default function CounterButton() {
  const [count, setCount] = useState(0);

  return (
    <Button onClick={() => setCount((count) => count + 1)}>
      Count is {count}
    </Button>
  );
}
