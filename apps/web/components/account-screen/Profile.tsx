"use client";
import uiStyles from "./../../styles/ui.module.css";

import { Field } from "../ui";

import type { ScreenContext } from "./context";
/** Profile section preserves its existing controls and state. */
export function Profile(context: ScreenContext) {
  const { account, act, avatarError, setAvatarError } = context;
  return (
    <>
      <form
        className={uiStyles.card}
        onSubmit={(e) => {
          e.preventDefault();
          void act({
            action: "save_profile",
            username: new FormData(e.currentTarget).get("username"),
          });
        }}
      >
        <h2>Your profile</h2>
        <Field label="Username">
          <input
            required
            name="username"
            minLength={3}
            maxLength={32}
            pattern="[A-Za-z0-9_-]+"
            defaultValue={account.username}
          />
        </Field>
        <button type="submit" className={uiStyles.button}>
          Save username
        </button>
        <Field label="Profile picture">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setAvatarError("");
              if (
                file.size > 250000 ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                setAvatarError("Choose a JPG, PNG or WebP image under 250 KB.");
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                void act({ action: "set_avatar", avatar: reader.result });
              };

              reader.readAsDataURL(file);
            }}
          />
        </Field>
        {avatarError && <p role="alert">{avatarError}</p>}
        <button
          type="button"
          className={`${uiStyles.button} ${uiStyles.secondary}`}
          onClick={() => void act({ action: "set_avatar", avatar: null })}
        >
          Remove picture
        </button>
      </form>{" "}
    </>
  );
}
