"use client";

import { useState } from "react";
import styles from "./HouseScene.module.css";

type SceneReveal = { clue: string; props: { sprite: string; room: string }[] };
type HouseSceneProps = {
  layout: string;
  clues: string[];
  onClue: (id: string) => void;
  disabled: boolean;
  reveals?: SceneReveal[];
};
const rooms = [
  { id: "kidsRoom", name: "Kids’ room", position: "kids" },
  { id: "kitchen", name: "Kitchen", position: "kitchen" },
  { id: "garage", name: "Garage", position: "garage" },
  { id: "entry", name: "Entry", position: "entry" },
  { id: "mailbox", name: "Mailbox", position: "mailbox" },
];
const sprites = new Set([
  "plant",
  "lamp",
  "home-office",
  "kid-infant",
  "kid-toddler",
  "kid-preschool",
  "kid-schoolAge",
  "adult-coat",
  "kid-shoes",
  "car-none",
  "car-economy",
  "car-mid",
  "car-luxury",
  "takeout-0-1",
  "takeout-2-3",
  "takeout-4-6",
  "takeout-7-plus",
  "tier-cheap",
  "tier-mid",
  "tier-expensive",
  "tier-suburb",
]);
const layoutNames: Record<string, string> = {
  studio: "Studio",
  "1bed": "One bedroom",
  "2bed": "Two bedrooms",
  "3bed": "Three bedrooms",
  "4bed": "Four bedrooms",
};

/** Presentational cutaway. Only server-revealed props may enter the rooms. */
export function HouseScene({
  layout,
  clues,
  onClue,
  disabled,
  reveals = [],
}: HouseSceneProps) {
  const [focused, setFocused] = useState<string | null>(null);
  const room = rooms.find((item) => item.id === focused);
  const propsFor = (id: string) =>
    clues.includes(id)
      ? (reveals.find((reveal) => reveal.clue === id)?.props ?? []).filter(
          (prop) => prop.room === id && sprites.has(prop.sprite),
        )
      : [];
  const open = (id: string) => {
    setFocused(id);
    if (!clues.includes(id) && !disabled) onClue(id);
  };
  return (
    <section
      className={styles.scene}
      aria-label="Explore the home"
      onKeyDown={(event) => {
        if (event.key === "Escape") setFocused(null);
      }}
    >
      <div className={styles.caption}>
        <span>{layoutNames[layout] ?? "Home"} · explore the rooms</span>
        <span className={styles.placeholder}>Placeholder illustration</span>
      </div>
      <div className={styles.building}>
        <svg
          className={styles.structure}
          viewBox="0 0 720 440"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M34 117 360 18l326 99" />
          <path d="M45 118h630v298H45z" />
          <path d="M45 261h630M270 118v298M495 118v298" />
          <path className={styles.ground} d="M18 425h684" />
        </svg>
        <div className={styles.rooms}>
          <div className={styles.living} aria-label="Neutral living room decor">
            <div className={styles.window}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.decor}>
              <img src="/scene/plant.svg" alt="Plant" />
              <img src="/scene/lamp.svg" alt="Lamp" />
            </div>
            <small>Living room</small>
          </div>
          {rooms.map((item) => (
            <button
              type="button"
              className={`${styles.room} ${styles[item.position]} ${clues.includes(item.id) ? styles.revealed : ""}`}
              key={item.id}
              aria-label={`${item.name}: ${clues.includes(item.id) ? "view opened clue" : "reveal clue"}`}
              disabled={disabled && !clues.includes(item.id)}
              onClick={() => open(item.id)}
            >
              <span className={styles.roomLabel}>{item.name}</span>
              <span className={styles.contents} aria-hidden="true">
                {clues.includes(item.id) ? (
                  propsFor(item.id).map((prop, index) => (
                    <img
                      key={`${prop.sprite}-${index}`}
                      src={`/scene/${prop.sprite}.svg`}
                      alt=""
                    />
                  ))
                ) : (
                  <span className={styles.closed}>?</span>
                )}
              </span>
              <small>
                {clues.includes(item.id) ? "Look closer" : "Tap to reveal"}
              </small>
            </button>
          ))}
        </div>
        {room && (
          <div
            className={styles.focused}
            role="region"
            aria-label={`${room.name} close-up`}
          >
            <button
              type="button"
              className={styles.back}
              onClick={() => setFocused(null)}
              aria-label="Return to full house"
            >
              ← Full house
            </button>
            <h3>{room.name}</h3>
            <div className={styles.focusedProps}>
              {propsFor(room.id).map((prop, index) => (
                <img
                  key={`${prop.sprite}-${index}`}
                  src={`/scene/${prop.sprite}.svg`}
                  alt={prop.sprite.replaceAll("-", " ")}
                />
              ))}
            </div>
            <p aria-live="polite">
              {clues.includes(room.id)
                ? "Clue opened. The details are shown below the house."
                : "Opening this room…"}
            </p>
          </div>
        )}
      </div>
      <small>
        Rooms stay closed until you reveal a clue. Each new clue reduces your
        possible score.
      </small>
    </section>
  );
}
