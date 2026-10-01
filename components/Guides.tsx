"use client";

// Short "where do I find this" guides for the form, based on island.is/en/kilometer-fee
// and skatturinn.is/kilometragjald. Menu names are also given in Icelandic, as they appear on Ísland.is.

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

const MY_VEHICLES = "https://island.is/minarsidur/eignir/okutaeki/min-okutaeki";
const REGISTER = "https://island.is/minarsidur/eignir/okutaeki/skra-kilometrastodu";
const MAILBOX = "https://island.is/minarsidur/postholf";

const ext = (href: string) => (chunks: ReactNode) => <a href={href} target="_blank" rel="noopener noreferrer">{chunks}</a>;
const is = (chunks: ReactNode) => <span lang="is" className="is">{chunks}</span>;
const b = (chunks: ReactNode) => <strong>{chunks}</strong>;

export function ReadingsGuide() {
  const t = useTranslations("guides");
  return (
    <details className="howto">
      <summary>{t("readingsTitle")}</summary>
      <ol>
        <li>{t.rich("readings1", { link: ext(MY_VEHICLES), is })}</li>
        <li>{t.rich("readings2", { is })}</li>
        <li>{t("readings3")}</li>
      </ol>
      <p className="help">{t.rich("register", { link: ext(REGISTER), is, b })}</p>
    </details>
  );
}

export function BillsGuide() {
  const t = useTranslations("guides");
  return (
    <details className="howto">
      <summary>{t("billsTitle")}</summary>
      <ul>
        <li>{t.rich("bills1", { is })}</li>
        <li>{t.rich("bills2", { link: ext(MAILBOX), is })}</li>
      </ul>
    </details>
  );
}
