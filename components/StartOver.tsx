"use client";

import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { startOver } from "@/app/actions.ts";

/**
 * "Start over" with a confirmation dialog. Clears the saved input (cookie) and goes to /edit.
 * Inside another form (the input form) its confirm button submits that form with this action;
 * `standalone` wraps it in its own form, for use outside one (the results page).
 * `onConfirm` runs just before, e.g. to clear what's typed but not saved.
 */
export default function StartOver({ standalone = false, onConfirm }: { standalone?: boolean; onConfirm?: () => void }) {
  const t = useTranslations("startOver");
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const confirm = async () => {
    dialog.current?.close();
    onConfirm?.();
    await startOver();
  };

  const body = (
    <>
      <button type="button" className="ghost" onClick={() => dialog.current?.showModal()}>{t("button")}</button>
      <dialog ref={dialog} className="confirm" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <h2 id={`${id}-t`}>{t("title")}</h2>
        <p id={`${id}-d`}>{t("body")}</p>
        <div className="confirm-actions">
          <button type="button" className="ghost" autoFocus onClick={() => dialog.current?.close()}>{t("cancel")}</button>
          <button type="submit" className="danger" formAction={confirm} formNoValidate>{t("confirm")}</button>
        </div>
      </dialog>
    </>
  );
  return standalone ? <form action={confirm}>{body}</form> : body;
}
