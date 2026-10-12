import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Desk } from "@/components/desk/Desk";
import "@/styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Desk />
    </StrictMode>,
  );
}
