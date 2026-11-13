"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { PlayingCard } from "./playing-card";
import { Rules } from "./rules";
import { request } from "@/lib/client";

export function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rules, setRules] = useState(false);
  useEffect(() => {
    setName(localStorage.getItem("bluff:name") ?? "");
  }, []);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request<{ code: string }>(
        tab === "create"
          ? "/api/rooms"
          : `/api/rooms/${code.toUpperCase()}/join`,
        { name: name.trim() },
      );
      localStorage.setItem("bluff:name", name.trim());
      router.push(`/room/${result.code}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn’t reach the table. Try again.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="home-page">
      <header className="site-header">
        <a href="/" className="wordmark" aria-label="BLUFF home">
          <span className="brand-symbol">✳</span>BLUFF
          <span className="brand-dot">.</span>
        </a>
        <button
          className="text-button header-rules"
          onClick={() => setRules(true)}
        >
          <Icon name="help" size={18} /> How to play
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" /> GOOD FRIENDS. QUESTIONABLE CLAIMS.
          </span>
          <h1>
            Read the room.
            <br />
            <em>Play your hand.</em>
          </h1>
          <p className="hero-description">
            You know your cards.
            <br /> But how well do you know your friends?
          </p>
          <p className="hero-detail">
            The social card game where a convincing lie can beat a perfect hand.
            Grab your people. Pull up a chair.
          </p>
          <div className="hero-proof">
            <span>
              <Icon name="users" size={17} /> 2+ players
            </span>
            <span className="proof-divider" />
            <span>Zero sign-ups</span>
            <span className="proof-divider" />
            <span>All nerve</span>
          </div>
        </div>

        <div className="hero-table">
          <div className="table-top-note">
            <span className="mini-star">✳</span>
            <span>
              THERE’S ALWAYS ROOM
              <br />
              FOR ONE MORE BLUFF.
            </span>
          </div>
          <div className="decorative-hand" aria-hidden="true">
            <PlayingCard
              rank={13}
              suit={0}
              className="hero-card hero-card-one"
            />
            <PlayingCard
              rank={13}
              suit={1}
              className="hero-card hero-card-two"
            />
            <PlayingCard
              rank={14}
              suit={0}
              className="hero-card hero-card-three"
            />
          </div>
          <span className="table-scribble" aria-hidden="true">
            Trust no one.
            <svg viewBox="0 0 92 28">
              <path d="M3 12C20 1 55 1 85 15M77 7l9 9-13 5" />
            </svg>
          </span>

          <div className="entry-panel">
            <div
              className="entry-tabs"
              role="tablist"
              aria-label="Enter a game"
            >
              <button
                type="button"
                id="create-tab"
                role="tab"
                aria-selected={tab === "create"}
                aria-controls="entry-form"
                className={tab === "create" ? "selected" : ""}
                onClick={() => {
                  setTab("create");
                  setError("");
                }}
              >
                Create a table
              </button>
              <button
                type="button"
                id="join-tab"
                role="tab"
                aria-selected={tab === "join"}
                aria-controls="entry-form"
                className={tab === "join" ? "selected" : ""}
                onClick={() => {
                  setTab("join");
                  setError("");
                }}
              >
                Join friends
              </button>
            </div>
            <form
              id="entry-form"
              role="tabpanel"
              aria-labelledby={`${tab}-tab`}
              onSubmit={enter}
            >
              <label className="field-label" htmlFor="nickname">
                WHAT SHOULD WE CALL YOU?
              </label>
              <input
                id="nickname"
                name="nickname"
                placeholder="Your table name"
                autoComplete="nickname"
                minLength={2}
                maxLength={20}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              {tab === "join" && (
                <div className="join-code-field">
                  <label className="field-label" htmlFor="room-code">
                    TABLE CODE
                  </label>
                  <input
                    id="room-code"
                    name="code"
                    className="code-input"
                    placeholder="ABC123"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    minLength={6}
                    maxLength={6}
                    value={code}
                    onChange={(event) =>
                      setCode(
                        event.target.value
                          .replace(/[^a-z0-9]/gi, "")
                          .toUpperCase(),
                      )
                    }
                    required
                  />
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-dark button-full"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span className="spinner" /> Finding your seat…
                  </>
                ) : (
                  <>
                    {tab === "create"
                      ? "Let’s make some trouble"
                      : "Take your seat"}
                    <Icon name="arrow" />
                  </>
                )}
              </button>
              <p className="entry-note">
                <Icon name="shield" size={13} /> A private table. Just you and
                your people.
              </p>
            </form>
          </div>
        </div>
      </section>

      <section className="how-strip" aria-label="The game in three steps">
        <div className="strip-intro">
          <span className="eyebrow">SIMPLE RULES.</span>
          <span>Complicated friends.</span>
        </div>
        <div className="strip-step">
          <span className="step-number">01</span>
          <div>
            <b>Deal it.</b>
            <p>Four cards. For your eyes only.</p>
          </div>
        </div>
        <div className="strip-step">
          <span className="step-number">02</span>
          <div>
            <b>Sell it.</b>
            <p>Make a claim. Keep a straight face.</p>
          </div>
        </div>
        <div className="strip-step">
          <span className="step-number">03</span>
          <div>
            <b>Call it.</b>
            <p>Bluff or High Card. Someone pays.</p>
          </div>
        </div>
      </section>
      <footer className="home-footer">
        <span>Less scrolling. More calling bluffs.</span>
        <span>
          MADE FOR THE GROUP CHAT. <span aria-hidden="true">↗</span>
        </span>
      </footer>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}
