import { postsContext } from "@/lib/posts-server";
import { StudioError } from "@/lib/studio-server";
import { mockLeaderboard } from "@/lib/mock-leaderboard";
import { rankingWindow } from "@/lib/leaderboard-contracts";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const value = new URL(request.url).searchParams.get("window") || "week";
    if (!["week", "month", "all"].includes(value))
      throw new StudioError("Invalid ranking window.");
    const ctx = await postsContext(),
      window = rankingWindow(value);
    if (ctx.mock)
      return Response.json(mockLeaderboard(ctx.user.id, window), {
        headers: { "Cache-Control": "private, no-store" },
      });
    const { data, error } = await ctx.admin.rpc("humor_leaderboard", {
      period: window,
      viewer: ctx.user.id,
    });
    if (error) throw error;
    data.people = await Promise.all(
      data.people.map(async (person: { user: { id: string } }) => {
        const author = await ctx.admin.rpc("humor_author", {
          author_id: person.user.id,
        });
        if (author.error) throw author.error;
        return { ...person, user: author.data };
      }),
    );
    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof StudioError
            ? e.message
            : "The board lost count. Try again.",
      },
      { status: e instanceof StudioError ? e.status : 503 },
    );
  }
}
