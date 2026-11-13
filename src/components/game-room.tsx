"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { Avatar } from "./avatar";
import { PlayingCard } from "./playing-card";
import { BidVisual } from "./bid-visual";
import { ThemeToggle } from "./theme-toggle";
import { Rules } from "./rules";
import { request } from "@/lib/client";
import {
  availableBids,
  combinationLabel,
  KINDS,
  KIND_NAMES,
  rankLabel,
  RANKS,
} from "@/lib/rules";
import type { Combination, Kind } from "@/lib/rules";
import type { Action, RoomView } from "@/lib/game";

export function GameRoom({ code }: { code: string }) {
  const router = useRouter();
  const [view, setView] = useState<RoomView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [rules, setRules] = useState(false);
  const [leave, setLeave] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const latest = useRef<RoomView | null>(null);
  const offset = useRef(0);

  const adopt = useCallback((next: RoomView) => {
    if (latest.current && next.version < latest.current.version) return;
    offset.current = next.serverTime - Date.now();
    latest.current = next;
    setView(next);
    setNow(Date.now() + offset.current);
    setLoadError("");
  }, []);

  useEffect(() => {
    setName(localStorage.getItem("bluff:name") ?? "");
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const next = await request<RoomView>(
          `/api/rooms/${code}`,
          undefined,
          controller.signal,
        );
        if (!stopped) adopt(next);
      } catch (reason) {
        if (!stopped)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "Reconnecting to your table…",
          );
      }
      if (!stopped)
        timer = setTimeout(
          poll,
          document.hidden
            ? 5000
            : latest.current?.phase === "playing"
              ? 1200
              : 2200,
        );
    }
    void poll();
    const clock = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [adopt, code]);

  async function act(action: Action) {
    if (busy) return;
    setBusy(action.type);
    setError("");
    try {
      const next = await request<RoomView>(`/api/rooms/${code}/action`, action);
      adopt(next);
      if (action.type === "leave") router.push("/");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Your move didn’t reach the table. Try again.",
      );
      try {
        adopt(await request<RoomView>(`/api/rooms/${code}`));
      } catch {
        /* The connection indicator handles retries. */
      }
    } finally {
      setBusy("");
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setBusy("join");
    setError("");
    try {
      await request(`/api/rooms/${code}/join`, { name });
      localStorage.setItem("bluff:name", name.trim());
      adopt(await request<RoomView>(`/api/rooms/${code}`));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Couldn’t join. Try again.",
      );
    } finally {
      setBusy("");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/room/${code}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Your table code is ${code}. Share it with your friends.`);
    }
  }

  const you = view?.players.find((player) => player.id === view.you);
  const seated = view?.players.filter((player) => !player.left) ?? [];
  const active = seated.filter((player) => player.cards > 0);
  const yourTurn = view?.phase === "playing" && view.turnPlayerId === view.you;
  const turnName = view?.players.find(
    (player) => player.id === view.turnPlayerId,
  )?.name;

  return (
    <main className="room-page">
      <header className="room-header">
        <a
          href="/"
          className="wordmark"
          onClick={(event) => {
            if (view?.you) {
              event.preventDefault();
              setLeave(true);
            }
          }}
        >
          <span className="brand-symbol">✳</span>BLUFF
          <span className="brand-dot">.</span>
        </a>
        <div className="room-header-center">
          <span
            className={`connection-dot ${loadError ? "connection-offline" : ""}`}
          />
          <span>{loadError ? "Reconnecting" : "Your private table"}</span>
          <span className="header-code">{code}</span>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <button
            className="text-button"
            onClick={() => setRules(true)}
            aria-label="How to play"
          >
            <Icon name="help" size={18} />
            <span>Rules</span>
          </button>
          {view?.you && (
            <button
              className="icon-button"
              onClick={() => setLeave(true)}
              aria-label="Leave table"
            >
              <Icon name="exit" size={18} />
            </button>
          )}
        </div>
      </header>

      {!view ? (
        <section className="room-loading">
          <span className="brand-symbol">✳</span>
          <h1>
            {loadError ? "Can’t find your table." : "Pulling up a chair…"}
          </h1>
          <p>{loadError || "Your poker face can wait a second."}</p>
          {loadError && (
            <a href="/" className="button button-dark">
              Back to the tables
              <Icon name="arrow" />
            </a>
          )}
        </section>
      ) : !view.you ? (
        <section className="invite-page">
          <div className="invite-art" aria-hidden="true">
            <PlayingCard rank={14} suit={0} />
            <PlayingCard rank={14} suit={1} />
          </div>
          <span className="eyebrow">A SEAT WITH YOUR NAME ON IT</span>
          <h1>
            You’re invited
            <br />
            <em>to the table.</em>
          </h1>
          <p>
            {seated.length} {seated.length === 1 ? "friend is" : "friends are"}{" "}
            at table <strong>{code}</strong>.
          </p>
          {view.phase === "lobby" ? (
            <form onSubmit={join} className="invite-form">
              <label className="field-label" htmlFor="invite-name">
                YOUR TABLE NAME
              </label>
              <input
                id="invite-name"
                placeholder="What should we call you?"
                minLength={2}
                maxLength={20}
                autoComplete="nickname"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="button button-dark button-full"
                disabled={!!busy}
              >
                {busy ? "Taking your seat…" : "I’m in"}
                <Icon name="arrow" />
              </button>
            </form>
          ) : (
            <div className="invite-form">
              <p>
                This match has already started. Reconnect from the browser you
                used to join, or ask your friends for the next game.
              </p>
              <a className="button button-dark button-full" href="/">
                Back home
                <Icon name="arrow" />
              </a>
            </div>
          )}
        </section>
      ) : (
        <>
          {loadError && (
            <div className="connection-banner" role="status">
              Your connection dropped. We’ll keep trying; your seat is saved.
            </div>
          )}
          <div className="room-layout">
            <section className="room-main">
              <div className="room-section-heading">
                <div>
                  <span className="eyebrow">
                    {view.phase === "lobby"
                      ? "THE NIGHT IS YOUNG"
                      : view.phase === "finished"
                        ? "THAT’S A WRAP"
                        : `ROUND ${String(view.round).padStart(2, "0")}`}
                  </span>
                  <h1>
                    {view.phase === "lobby"
                      ? "The usual suspects."
                      : view.phase === "finished"
                        ? "A face you can’t trust."
                        : yourTurn
                          ? "Your move. Make it count."
                          : "Keep a straight face."}
                  </h1>
                </div>
                <button
                  className="button button-outline invite-button"
                  onClick={copyInvite}
                >
                  <Icon name={copied ? "check" : "link"} size={16} />
                  {copied ? "Copied!" : "Invite friends"}
                </button>
              </div>

              {view.phase === "lobby" ? (
                <>
                  <div className="lobby-felt">
                    <div className="felt-label">
                      <span>PRIVATE TABLE</span>
                      <span>{seated.length} / 13 SEATS</span>
                    </div>
                    <div className="lobby-center">
                      <span className="felt-star">✳</span>
                      <span className="eyebrow">GOOD COMPANY REQUIRED</span>
                      <h2>
                        Cards on the table.
                        <br />
                        <em>Friends on the way.</em>
                      </h2>
                      <p>
                        Share the code. Gather your people.
                        <br />
                        The game starts when everyone is ready.
                      </p>
                      <button
                        className="big-room-code"
                        onClick={copyInvite}
                        title="Copy invite link"
                      >
                        {code}
                        <Icon name={copied ? "check" : "copy"} size={18} />
                      </button>
                    </div>
                    <div className="lobby-seats">
                      {seated.map((player, index) => (
                        <div
                          className={`lobby-seat ${player.ready ? "seat-ready" : ""}`}
                          key={player.id}
                        >
                          <Avatar name={player.name} index={index} />
                          <span className="seat-name">
                            {player.name}
                            {player.id === view.you && <small>you</small>}
                          </span>
                          <span className="seat-status">
                            {player.ready ? (
                              <>
                                <Icon name="check" size={12} /> Ready
                              </>
                            ) : (
                              "Getting settled"
                            )}
                          </span>
                        </div>
                      ))}
                      {Array.from(
                        { length: Math.max(0, 4 - seated.length) },
                        (_, i) => (
                          <div
                            className="lobby-seat empty-seat"
                            key={`empty-${i}`}
                          >
                            <span className="empty-avatar">+</span>
                            <span className="seat-name">Open seat</span>
                            <span className="seat-status">
                              A friend belongs here
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                    <p className="felt-bottom-note">
                      <Icon name="shield" size={12} /> Only people with your
                      code can join.
                    </p>
                  </div>
                  <div className="lobby-bottom">
                    <div>
                      <span className="eyebrow">
                        {seated.filter((player) => player.ready).length} OF{" "}
                        {seated.length} READY
                      </span>
                      <p>
                        {seated.length < 2
                          ? "You’ll need at least one partner in crime."
                          : you?.ready
                            ? "Looking good. Waiting for the rest of the table."
                            : "All here? Let the questionable claims begin."}
                      </p>
                    </div>
                    <button
                      className={`button ${you?.ready ? "button-outline" : "button-dark"}`}
                      disabled={!!busy}
                      onClick={() => act({ type: "ready" })}
                    >
                      {you?.ready ? (
                        <>
                          <Icon name="check" size={17} /> Ready — undo
                        </>
                      ) : (
                        <>
                          Start game
                          <Icon name="arrow" size={18} />
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="game-felt">
                    <div className="felt-label">
                      <span>{active.length} STILL STANDING</span>
                      <span>
                        {view.phase === "playing"
                          ? active.reduce(
                              (sum, player) => sum + player.cards,
                              0,
                            )
                          : (view.result?.hands.reduce(
                              (sum, hand) => sum + hand.cards.length,
                              0,
                            ) ?? 0)}{" "}
                        CARDS IN THE POOL
                      </span>
                    </div>
                    {view.phase === "playing" ? (
                      <>
                        <div className="opponents">
                          {active
                            .filter((player) => player.id !== view.you)
                            .map((player) => (
                              <div
                                className={`opponent ${player.id === view.turnPlayerId ? "opponent-turn" : ""}`}
                                key={player.id}
                              >
                                <div className="opponent-cards">
                                  {Array.from(
                                    { length: player.cards },
                                    (_, i) => (
                                      <PlayingCard
                                        hidden
                                        small
                                        key={i}
                                        style={{
                                          transform: `translateX(${i * 13}px) rotate(${(i - (player.cards - 1) / 2) * 8}deg)`,
                                        }}
                                      />
                                    ),
                                  )}
                                </div>
                                <span className="opponent-label">
                                  <span className="opponent-dot" />
                                  {player.name}
                                </span>
                                <small>
                                  {player.id === view.turnPlayerId
                                    ? "Thinking…"
                                    : `${player.cards} ${player.cards === 1 ? "card" : "cards"}`}
                                </small>
                                {view.lastBids?.[player.id] ? (
                                  <div
                                    className="seat-last-bid"
                                    role="group"
                                    aria-label={`${player.name}’s latest bid`}
                                  >
                                    <span className="seat-bid-label">
                                      LAST BID
                                    </span>
                                    <BidVisual
                                      combination={
                                        view.lastBids[player.id].combination
                                      }
                                      size="seat"
                                    />
                                  </div>
                                ) : (
                                  <span className="seat-no-bid">
                                    No bid yet
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                        <div
                          className={`current-bid ${view.bid ? "has-bid" : ""}`}
                          key={view.bid?.id ?? `round-${view.round}`}
                        >
                          <span className="eyebrow">
                            {view.bid
                              ? `${view.players.find((player) => player.id === view.bid?.playerId)?.name.toUpperCase()} SAYS`
                              : "A FRESH ROUND"}
                          </span>
                          {view.bid ? (
                            <>
                              <BidVisual combination={view.bid.combination} />
                              <p>
                                Somewhere in{" "}
                                {active.reduce(
                                  (sum, player) => sum + player.cards,
                                  0,
                                )}{" "}
                                cards. Believe it?
                              </p>
                            </>
                          ) : (
                            <>
                              <span
                                className="table-center-star"
                                aria-hidden="true"
                              >
                                ✳
                              </span>
                              <h2>
                                The floor is{" "}
                                {yourTurn ? "yours" : `${turnName}’s`}.
                              </h2>
                              <p>
                                {yourTurn
                                  ? "Open with a claim. Confidence is optional."
                                  : "Waiting for the first claim."}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="your-hand">
                          <div className="hand-heading">
                            <span className="eyebrow">
                              {you?.cards
                                ? "YOUR HAND. YOUR SECRET."
                                : "YOU’RE IN THE AUDIENCE NOW"}
                            </span>
                            {yourTurn && (
                              <span className="your-turn-badge">Your turn</span>
                            )}
                          </div>
                          {you?.cards ? (
                            <div className="hand-cards">
                              {you.hand?.map((card, index) => (
                                <PlayingCard
                                  key={`${view.round}-${card.rank}-${card.suit}`}
                                  {...card}
                                  className="dealt-card"
                                  style={{
                                    animationDelay: `${index * 75}ms`,
                                    transform: `rotate(${(index - (you.hand!.length - 1) / 2) * 3}deg)`,
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="spectator-note">
                              <Icon name="eye" size={17} /> Out of cards. Still
                              in on the drama.
                            </p>
                          )}
                          {view.lastBids?.[view.you!] && (
                            <div
                              className="your-last-bid"
                              role="group"
                              aria-label="Your latest bid"
                            >
                              <span className="eyebrow">YOUR LAST BID</span>
                              <BidVisual
                                combination={
                                  view.lastBids[view.you!].combination
                                }
                                size="seat"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <RoundReveal view={view} />
                    )}
                  </div>

                  {view.phase === "playing" ? (
                    <div className="action-panel">
                      {!!you?.cards && (
                        <div className="challenge-row">
                          <button
                            className="challenge-button challenge-bluff"
                            disabled={
                              !!busy ||
                              !view.bid ||
                              view.bid.playerId === view.you
                            }
                            onClick={() =>
                              view.bid &&
                              act({
                                type: "challenge",
                                challenge: "bluff",
                                bidId: view.bid.id,
                                round: view.round,
                              })
                            }
                          >
                            <span>
                              Call bluff
                              <Icon name="eye" size={18} />
                            </span>
                            <small>“That combination doesn’t exist.”</small>
                          </button>
                          <button
                            className="challenge-button challenge-high"
                            disabled={
                              !!busy ||
                              !view.bid ||
                              view.bid.playerId === view.you
                            }
                            onClick={() =>
                              view.bid &&
                              act({
                                type: "challenge",
                                challenge: "high-card",
                                bidId: view.bid.id,
                                round: view.round,
                              })
                            }
                          >
                            <span>
                              High Card
                              <Icon name="crown" size={18} />
                            </span>
                            <small>“That’s the highest combination.”</small>
                          </button>
                        </div>
                      )}
                      {yourTurn ? (
                        <BidComposer
                          key={`${view.round}-${view.bid?.id ?? "first"}`}
                          previous={view.bid?.combination ?? null}
                          disabled={!!busy}
                          onBid={(combination) =>
                            act({
                              type: "bid",
                              combination,
                              round: view.round,
                              expectedBidId: view.bid?.id ?? null,
                            })
                          }
                        />
                      ) : (
                        <p className="waiting-note">
                          {you?.cards ? (
                            <>
                              <span className="thinking-dots">
                                <i />
                                <i />
                                <i />
                              </span>
                              {turnName} has the floor.
                              {view.bid &&
                                view.bid.playerId !== view.you &&
                                " You can still challenge."}
                            </>
                          ) : (
                            <>
                              <Icon name="eye" size={15} /> You’re spectating.
                              Hands are revealed after a challenge.
                            </>
                          )}
                        </p>
                      )}
                      {!view.bid && !!you?.cards && (
                        <p className="action-hint">
                          Bluff and High Card open after the first bid.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="lobby-bottom reveal-bottom">
                      <div>
                        <span className="eyebrow">
                          {view.phase === "finished"
                            ? "ONE MORE?"
                            : "FRESH CARDS ON THE WAY"}
                        </span>
                        <p>
                          {view.phase === "finished"
                            ? `${seated.filter((player) => player.ready).length} of ${seated.length} ready for a rematch.`
                            : `Next deal in ${Math.max(0, Math.ceil(((view.result?.nextRoundAt ?? now) - now) / 1000))}s${you?.ready ? " · You’re ready" : " — or sooner if everyone is ready."}`}
                        </p>
                      </div>
                      {view.phase === "finished" ? (
                        <button
                          className={`button ${you?.ready ? "button-outline" : "button-dark"}`}
                          disabled={!!busy || seated.length < 2}
                          onClick={() => act({ type: "rematch" })}
                        >
                          <Icon
                            name={you?.ready ? "check" : "refresh"}
                            size={16}
                          />
                          {you?.ready ? "Rematch ready — undo" : "Play again"}
                        </button>
                      ) : (
                        !!you?.cards && (
                          <button
                            className="button button-dark"
                            disabled={!!busy || you.ready}
                            onClick={() => act({ type: "continue" })}
                          >
                            {you.ready ? (
                              <>
                                <Icon name="check" size={16} /> Ready
                              </>
                            ) : (
                              <>
                                Next round
                                <Icon name="arrow" size={17} />
                              </>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              )}
              {error && (
                <div className="game-error" role="alert">
                  <span>{error}</span>
                  <button
                    className="icon-button"
                    onClick={() => setError("")}
                    aria-label="Dismiss message"
                  >
                    <Icon name="close" size={15} />
                  </button>
                </div>
              )}
            </section>

            <aside className="room-sidebar">
              <div className="sidebar-heading">
                <span className="eyebrow">AT THE TABLE</span>
                <span>{seated.length}</span>
              </div>
              <div className="player-list">
                {seated.map((player, index) => (
                  <div
                    key={player.id}
                    className={`player-row ${view.phase === "playing" && player.id === view.turnPlayerId ? "player-row-turn" : ""}`}
                  >
                    <Avatar name={player.name} index={index} small />
                    <div className="player-info">
                      <b>
                        {player.name}
                        <small>{player.id === view.you ? "you" : ""}</small>
                      </b>
                      <span>
                        {view.phase === "lobby"
                          ? player.ready
                            ? "Ready to play"
                            : "Getting settled"
                          : !player.cards
                            ? "Spectator"
                            : view.phase === "playing" &&
                                player.id === view.turnPlayerId
                              ? "Has the floor"
                              : `${player.cards} ${player.cards === 1 ? "card" : "cards"} left`}
                      </span>
                      {view.phase !== "lobby" && view.lastBids?.[player.id] && (
                        <BidVisual
                          combination={view.lastBids[player.id].combination}
                          size="sidebar"
                        />
                      )}
                    </div>
                    {view.phase === "lobby" ? (
                      player.ready && <Icon name="check" size={15} />
                    ) : player.cards ? (
                      <span className="card-count">
                        {Array.from({ length: player.cards }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    ) : (
                      <Icon name="eye" size={15} />
                    )}
                  </div>
                ))}
              </div>
              <div className="sidebar-rule">
                <span className="mini-star">✳</span>
                <p>
                  It’s not the cards you hold.
                  <br />
                  It’s the story you sell.
                </p>
              </div>
              <details className="table-activity" open>
                <summary className="eyebrow">
                  TABLE TALK<span>{view.events.length}</span>
                </summary>
                <div
                  className="activity-list"
                  aria-live="polite"
                  aria-relevant="additions"
                >
                  {[...view.events]
                    .reverse()
                    .slice(0, 9)
                    .map((event) => (
                      <div
                        key={event.id}
                        className={`activity-item activity-${event.tone}`}
                      >
                        <span className="activity-dot" />
                        <p>{event.text}</p>
                      </div>
                    ))}
                </div>
              </details>
              <button
                className="text-button sidebar-help"
                onClick={() => setRules(true)}
              >
                <Icon name="help" size={15} /> A quick rules refresher
              </button>
            </aside>
          </div>
          <footer className="room-footer">
            <span>
              <Icon name="shield" size={12} /> Your cards stay private until the
              reveal.
            </span>
            <span>NO MONEY. JUST BRAGGING RIGHTS.</span>
          </footer>
        </>
      )}
      {rules && <Rules onClose={() => setRules(false)} />}
      {leave && (
        <LeaveDialog
          inMatch={
            view?.phase !== "lobby" &&
            view?.phase !== "finished" &&
            !!you?.cards
          }
          onClose={() => setLeave(false)}
          onLeave={() => {
            setLeave(false);
            void act({ type: "leave" });
          }}
        />
      )}
    </main>
  );
}

function BidComposer({
  previous,
  disabled,
  onBid,
}: {
  previous: Combination | null;
  disabled: boolean;
  onBid: (combination: Combination) => void;
}) {
  const choices = availableBids(previous);
  const [selected, setSelected] = useState<Combination>(
    choices[0] ?? { kind: "single", rank: 2 },
  );
  if (!choices.length)
    return (
      <p className="waiting-note">
        Top of the ladder. Call Bluff or High Card to settle it.
      </p>
    );
  const chooseKind = (kind: Kind) =>
    setSelected(
      choices.find(
        (choice) => choice.kind === kind && choice.rank === selected.rank,
      ) ?? choices.find((choice) => choice.kind === kind)!,
    );
  return (
    <div className="bid-composer">
      <div className="composer-heading">
        <span className="eyebrow">
          {previous ? "RAISE THE CLAIM" : "MAKE THE FIRST CLAIM"}
        </span>
        <span>{combinationLabel(selected)}</span>
      </div>
      <div className="kind-options">
        {KINDS.map((kind) => (
          <button
            key={kind}
            disabled={
              disabled || !choices.some((choice) => choice.kind === kind)
            }
            className={selected.kind === kind ? "selected" : ""}
            aria-pressed={selected.kind === kind}
            onClick={() => chooseKind(kind)}
          >
            {KIND_NAMES[kind]}
          </button>
        ))}
      </div>
      <div
        className="rank-options"
        role="group"
        aria-label={
          selected.kind === "full-house" ? "Triple rank" : "Card rank"
        }
      >
        {RANKS.map((rank) => (
          <button
            key={rank}
            className={rank === selected.rank ? "selected" : ""}
            disabled={
              disabled ||
              !choices.some(
                (choice) =>
                  choice.kind === selected.kind && choice.rank === rank,
              )
            }
            aria-label={`${rankLabel(rank)}${selected.kind === "full-house" ? " as the triple" : ""}`}
            aria-pressed={rank === selected.rank}
            onClick={() =>
              setSelected(
                choices.find(
                  (choice) =>
                    choice.kind === selected.kind &&
                    choice.rank === rank &&
                    choice.pairRank === selected.pairRank,
                ) ??
                  choices.find(
                    (choice) =>
                      choice.kind === selected.kind && choice.rank === rank,
                  )!,
              )
            }
          >
            {rankLabel(rank)}
          </button>
        ))}
      </div>
      {selected.kind === "full-house" && (
        <div className="pair-rank-row">
          <span className="eyebrow">PLUS A PAIR OF</span>
          <div className="rank-options" role="group" aria-label="Pair rank">
            {RANKS.map((rank) => (
              <button
                key={rank}
                disabled={
                  disabled ||
                  !choices.some(
                    (choice) =>
                      choice.kind === "full-house" &&
                      choice.rank === selected.rank &&
                      choice.pairRank === rank,
                  )
                }
                className={rank === selected.pairRank ? "selected" : ""}
                aria-label={`${rankLabel(rank)} as the pair`}
                aria-pressed={rank === selected.pairRank}
                onClick={() => setSelected({ ...selected, pairRank: rank })}
              >
                {rankLabel(rank)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div
        className="bid-preview"
        role="status"
        aria-label="Your bid preview"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="eyebrow">YOUR BID PREVIEW</span>
        <BidVisual combination={selected} size="preview" />
      </div>
      <button
        className="button button-dark button-full place-bid"
        disabled={disabled}
        onClick={() => onBid(selected)}
      >
        {previous ? "Raise" : "Bid"} — {combinationLabel(selected)}
        <Icon name="arrow" size={17} />
      </button>
    </div>
  );
}

function RoundReveal({ view }: { view: RoomView }) {
  const result = view.result;
  const winner = view.players.find((player) => player.id === view.winnerId);
  const loser = view.players.find((player) => player.id === result?.loserId);
  const challenger = view.players.find(
    (player) => player.id === result?.challengerId,
  );
  let reason = "";
  if (result?.challenge === "departure")
    reason = `${loser?.name} left the match. A fresh deal keeps the table fair.`;
  else if (result?.challenge === "bluff")
    reason = result.correct
      ? "The claimed combination wasn’t in the pool."
      : "The claimed combination was in the pool.";
  else if (result)
    reason = result.correct
      ? "The bid was the highest combination in the pool."
      : result.exists
        ? "The bid existed, but a higher combination was in the pool."
        : "The bid wasn’t in the pool, so it couldn’t be the highest.";
  return (
    <div className="round-reveal">
      <div className="reveal-intro">
        <span className="reveal-symbol">
          {view.phase === "finished" ? (
            <Icon name="crown" size={32} />
          ) : result?.challenge === "departure" ? (
            <Icon name="exit" size={27} />
          ) : result?.correct ? (
            <Icon name="check" size={30} />
          ) : (
            <Icon name="close" size={30} />
          )}
        </span>
        <span className="eyebrow">
          {view.phase === "finished"
            ? "LAST ONE STANDING"
            : result?.challenge === "departure"
              ? "A CHANGE AT THE TABLE"
              : `${challenger?.name.toUpperCase()} CALLED ${result?.challenge === "bluff" ? "BLUFF" : "HIGH CARD"}`}
        </span>
        <h2>
          {view.phase === "finished"
            ? winner
              ? `${winner.name} takes the table.`
              : "The table has cleared."
            : result?.challenge === "departure"
              ? "A seat opens up."
              : result?.correct
                ? "A very good read."
                : "Called it wrong."}
        </h2>
        <p>{reason}</p>
        {result?.challenge !== "departure" && (
          <span className="loser-note">
            {loser?.id === view.you ? "You lose" : `${loser?.name} loses`} a
            card.
            {loser?.cards === 0
              ? " Out of cards, into the audience."
              : ` ${loser?.cards} left.`}
          </span>
        )}
      </div>
      <div className="reveal-facts">
        {result?.bid && (
          <div>
            <span>THE CLAIM</span>
            <b>{combinationLabel(result.bid)}</b>
          </div>
        )}
        {result?.highest && (
          <div>
            <span>HIGHEST IN THE POOL</span>
            <b>{combinationLabel(result.highest)}</b>
          </div>
        )}
      </div>
      <div className="revealed-hands">
        {result?.hands.map((hand, index) => (
          <div
            className={`revealed-player ${hand.id === result.loserId ? "revealed-loser" : ""}`}
            key={hand.id}
          >
            <div className="revealed-player-name">
              <Avatar name={hand.name} index={index} small />
              <span>
                {hand.name}
                {hand.id === view.you && <small>you</small>}
              </span>
              {hand.id === result.loserId && (
                <span className="minus-card">−1</span>
              )}
            </div>
            <div className="reveal-card-row">
              {hand.cards.map((card) => (
                <PlayingCard
                  key={`${card.rank}-${card.suit}`}
                  {...card}
                  className={
                    card.rank === result.highest?.rank ||
                    card.rank === result.highest?.pairRank
                      ? "card-matched"
                      : ""
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeaveDialog({
  inMatch,
  onClose,
  onLeave,
}: {
  inMatch: boolean;
  onClose: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="rules-dialog leave-dialog" onCancel={onClose}>
      <div className="rules-content">
        <span className="eyebrow">HEADING OUT?</span>
        <h2>Leaving so soon?</h2>
        <p>
          {inMatch
            ? "Leaving retires all your remaining cards and ends this round. Closing this dialog lets you keep your seat."
            : "You’ll leave this table and return home."}
        </p>
        <div className="leave-actions">
          <button className="button button-outline" onClick={onClose}>
            Keep my seat
          </button>
          <button className="button button-dark" onClick={onLeave}>
            Leave table
            <Icon name="exit" size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
