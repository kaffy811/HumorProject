"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useFeedViewer } from "@/components/feed/FeedCacheProvider";
import { getProfile } from "@/lib/profiles";
import { ProfileHeader } from "./ProfileHeader";
import { ProfilePostStream } from "./ProfilePostStream";
import { EditProfilePanel } from "./EditProfilePanel";
function Content({ id }: { id: string }) {
  const viewer = useFeedViewer(),
    params = useSearchParams(),
    own = id === viewer,
    tab = own && params.get("tab") === "saved" ? "saved" : "posts",
    [editing, setEditing] = useState(false),
    { data, error, mutate } = useSWR(
      JSON.stringify(["profile", viewer, id]),
      () => getProfile(id),
    );
  return (
    <section className="feed-page member-profile-page">
      {!data && !error && (
        <div
          className="profile-header-skeleton"
          role="status"
          aria-label="Loading profile"
        >
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )}
      {error && (
        <div className="feed-status" role="alert">
          <p>{error.message}</p>
          <button className="comic-button" onClick={() => void mutate()}>
            Retry
          </button>
        </div>
      )}
      {data && (
        <ProfileHeader
          profile={data}
          own={own}
          onEdit={() => setEditing(true)}
        />
      )}
      <div className="feed-sort" aria-label="Profile posts">
        {(own ? ["posts", "saved"] : ["posts"]).map((value) => (
          <button
            key={value}
            className={`style-option ${tab === value ? "is-selected" : ""}`}
            aria-pressed={tab === value}
            onClick={() => {
              const q = new URLSearchParams(params.toString());
              q.set("tab", value);
              window.history.replaceState(
                null,
                "",
                `${own ? "/me" : `/u/${id}`}?${q}`,
              );
            }}
          >
            {value === "saved" ? "Saved" : own ? "My posts" : "Posts"}
          </button>
        ))}
      </div>
      {data && (
        <ProfilePostStream key={`${id}:${tab}`} id={id} tab={tab} own={own} />
      )}{" "}
      {own && (editing || params.get("edit") === "1") && data && (
        <EditProfilePanel
          profile={data}
          onClose={() => {
            setEditing(false);
            const q = new URLSearchParams(params.toString());
            q.delete("edit");
            window.history.replaceState(
              null,
              "",
              `/me${q.size ? `?${q}` : ""}`,
            );
          }}
        />
      )}
    </section>
  );
}
export function ProfilePage({ id }: { id: string }) {
  return (
    <Suspense fallback={<div role="status">Loading profile…</div>}>
      <Content id={id} />
    </Suspense>
  );
}
