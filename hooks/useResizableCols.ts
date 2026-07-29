import { useCallback, useEffect, useRef, useState } from "react";

type ColDef<T extends string> = { id: T; width: number; minWidth: number };

export function useResizableCols<T extends string>(defs: ColDef<T>[]) {
  const [colWidths, setColWidths] = useState<Record<T, number>>(
    () => Object.fromEntries(defs.map((d) => [d.id, d.width])) as Record<T, number>,
  );
  const colWidthsRef = useRef(colWidths);
  useEffect(() => {
    colWidthsRef.current = colWidths;
  }, [colWidths]);

  const startResize = useCallback(
    (id: T, e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = colWidthsRef.current[id];
      const minW = defs.find((d) => d.id === id)!.minWidth;
      const onMove = (ev: MouseEvent) =>
        setColWidths((prev) => ({ ...prev, [id]: Math.max(minW, startW + ev.clientX - startX) }));
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const gridTemplate = defs.map((d) => `${colWidths[d.id]}px`).join(" ");
  const totalWidth = defs.reduce((sum, d) => sum + colWidths[d.id], 0);

  return { colWidths, startResize, gridTemplate, totalWidth };
}
