import { createFileRoute } from "@tanstack/react-router";
import { Desk } from "@/components/desk/Desk";

export const Route = createFileRoute("/studio")({
  component: function Studio() {
    return <Desk studio />;
  },
});
