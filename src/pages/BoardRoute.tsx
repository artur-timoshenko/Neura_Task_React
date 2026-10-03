import { useParams } from "react-router-dom";
import Index from "./Index";
import NotFound from "./NotFound";
import { useBoards } from "@/hooks/useBoards";

export default function BoardRoute() {
  const { boardSlug } = useParams<{ boardSlug?: string }>();
  const { boards, isLoading } = useBoards();

  const slug = boardSlug || boards[0]?.slug || "motion";
  const exists = boards.some((b) => b.slug === slug);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!exists) return <NotFound />;

  return <Index board={slug} />;
}
