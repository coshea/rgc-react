import { useState } from "react";
import "./App.css";
import { Button } from "@material-tailwind/react";
import CounterButton from "@/components/CounterButton.tsx";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <h1>Vite + React</h1>
      <div className="TestButton">
        <Button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </Button>
      </div>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <CounterButton></CounterButton>


    </>
  );
}

export default App;
