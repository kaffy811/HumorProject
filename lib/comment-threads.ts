import { orderComments, type Comment, type CommentSort } from "./comment-contracts";
export interface CommentThread {
  comment: Comment;
  replies: CommentThread[];
}
// Sort conversations, not individual replies. A fresh reply can move its
// conversation up while always remaining beneath the comment it answers.
export function commentThreads(rows: Comment[], sort: CommentSort, highlighted: Set<string>) {
  const nodes = new Map<string, CommentThread>();
  for (const comment of rows)
    nodes.set(comment.id, { comment, replies: [] });
  const roots: CommentThread[] = [];
  for (const node of nodes.values()) {
    const parent = node.comment.replyTo && nodes.get(node.comment.replyTo.id);
    let cyclic = false;
    const seen = new Set([node.comment.id]);
    let ancestor = parent;
    while (ancestor) {
      if (seen.has(ancestor.comment.id)) {
        cyclic = true;
        break;
      }
      seen.add(ancestor.comment.id);
      ancestor = nodes.get(ancestor.comment.replyTo?.id || "");
    }
    if (parent && parent.comment.postId === node.comment.postId && !cyclic)
      parent.replies.push(node);
    else
      roots.push(node);
  }
  const promoted = new Set<string>();
  function arrange(node: CommentThread): boolean {
    node.replies.sort((a, b) => Date.parse(a.comment.createdAt) - Date.parse(b.comment.createdAt) || a.comment.id.localeCompare(b.comment.id));
    const childHighlights = node.replies.map(arrange);
    const active = highlighted.has(node.comment.id) || childHighlights.some(Boolean);
    if (active)
      promoted.add(node.comment.id);
    return active;
  }
  roots.forEach(arrange);
  return orderComments(roots.map(n => n.comment), sort, promoted).map(c => nodes.get(c.id)!);
}
// Parents can live on another Top/New page. Fetch only missing ancestors from
// the existing authenticated, same-post endpoint; never follow a cross-post ID.
export async function commentAncestors(rows: Comment[], postId: string, fetchParent: (id: string) => Promise<Comment | null>) {
  const known = new Map(rows.map(c => [c.id, c]));
  const queue = rows.map(c => c.replyTo).filter(r => r && r.authorName !== "deleted").map(r => r!.id);
  const visited = new Set<string>();
  const parents: Comment[] = [];
  while (queue.length && visited.size < 80) {
    const id = queue.shift()!;
    if (known.has(id) || visited.has(id))
      continue;
    visited.add(id);
    const parent = await fetchParent(id);
    if (!parent || parent.postId !== postId)
      continue;
    known.set(id, parent);
    parents.push(parent);
    if (parent.replyTo && parent.replyTo.authorName !== "deleted")
      queue.push(parent.replyTo.id);
  }
  return parents;
}
