import React from "react";

export function useRenderCount(name: string) {
  const count = React.useRef(0);

  count.current++;

  console.log(
    `${name} rendered ${count.current} times`
  );
}