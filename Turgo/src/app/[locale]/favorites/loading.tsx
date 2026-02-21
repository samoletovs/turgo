import { ListingGridSkeleton } from "@/components/ui/skeleton";

export default function FavoritesLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
      <div className="animate-pulse h-8 w-40 rounded bg-muted" />
      <ListingGridSkeleton count={4} />
    </div>
  );
}
