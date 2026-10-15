/* eslint-disable @next/next/no-img-element -- Private notification images. */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { useSWRConfig } from "swr";
import { listNotifications, openNotifications } from "@/lib/notifications";
import {
  notificationHref,
  notificationText,
  type NotificationItem,
  type NotificationPage,
} from "@/lib/notification-contracts";
import { relativeTime } from "@/lib/post-contracts";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { notificationSummaryKey } from "@/hooks/useNotifications";
import { usePublicAuthor } from "@/stores/author-store";
function Item({ item, clock }: { item: NotificationItem; clock: number }) {
  const actor = usePublicAuthor(item.actor),
    current = { ...item, actor };
  return (
    <li className={`notification-item ${item.wasUnread ? "is-unread" : ""}`}>
      <Link href={notificationHref(item)}>
        {actor.avatarUrl ? (
          <img
            className="notification-avatar"
            src={actor.avatarUrl}
            alt=""
            width={44}
            height={44}
          />
        ) : (
          <span
            className="notification-avatar avatar-letter"
            aria-hidden="true"
          >
            {actor.name.replace(/^@/, "").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="notification-copy">
          <p>{notificationText(current)}</p>
          <time dateTime={item.createdAt}>
            {relativeTime(item.createdAt, clock)}
          </time>
        </div>
        <img
          className="notification-thumb"
          src={item.thumbnailUrl}
          alt="Post thumbnail"
          width={64}
          height={64}
          loading="lazy"
        />
      </Link>
    </li>
  );
}
export function NotificationsPage() {
  const viewer = useFeedViewer(),
    { mutate } = useSWRConfig(),
    [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const swr = useSWRInfinite<NotificationPage>(
    (i, prev) =>
      prev && !prev.nextCursor
        ? null
        : JSON.stringify([
            "notifications",
            viewer,
            i,
            prev?.nextCursor || null,
          ]),
    async (key) => {
      const [, , , cursor] = JSON.parse(key);
      const page = cursor
        ? await listNotifications(cursor)
        : await openNotifications();
      await mutate(notificationSummaryKey(viewer), page.summary, {
        revalidate: false,
      });
      return page;
    },
    { revalidateFirstPage: false, revalidateOnMount: true },
  );
  const items = (swr.data || [])
      .flatMap((p) => p.items)
      .filter((n, i, all) => all.findIndex((x) => x.id === n.id) === i),
    last = swr.data?.at(-1);
  return (
    <section className="notifications-page">
      <header className="feed-heading">
        <h1>The reactions.</h1>
        <p>Evidence that somebody noticed.</p>
      </header>
      {swr.data?.[0]?.mode === "mock" && (
        <p className="comic-label">
          Preview data · Nothing is sent to real people
        </p>
      )}
      <ul className="notification-list">
        {items.map((item) => (
          <Item key={item.id} item={item} clock={clock} />
        ))}
      </ul>
      {!swr.data && !swr.error && (
        <div role="status" aria-label="Loading notifications">
          {[0, 1, 2, 3].map((i) => (
            <div className="leaderboard-row-skeleton" key={i}>
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      )}
      {swr.data && !items.length && !swr.error && (
        <p className="feed-status">
          No notifications. Nobody&apos;s laughing. Yet.
        </p>
      )}
      {swr.error && (
        <div className="feed-status" role="alert">
          <p>{swr.error.message}</p>
          <button className="comic-button" onClick={() => void swr.mutate()}>
            Retry
          </button>
        </div>
      )}
      {last?.nextCursor && (
        <button
          className="comic-button"
          disabled={swr.isValidating}
          onClick={() => void swr.setSize(swr.size + 1)}
        >
          {swr.isValidating ? "Loading…" : "Load more"}
        </button>
      )}
    </section>
  );
}
