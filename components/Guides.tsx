// Short "where do I find this" guides for the form, based on island.is/en/kilometer-fee
// and skatturinn.is/kilometragjald. Menu names are given in Icelandic too, as they appear on Ísland.is.

import type { ReactNode } from "react";

const MY_VEHICLES = "https://island.is/minarsidur/eignir/okutaeki/min-okutaeki";
const REGISTER = "https://island.is/minarsidur/eignir/okutaeki/skra-kilometrastodu";
const MAILBOX = "https://island.is/minarsidur/postholf";

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
);

export function ReadingsGuide() {
  return (
    <details className="howto">
      <summary>How to find your readings on Ísland.is</summary>
      <ol>
        <li>
          Log in to <Ext href={MY_VEHICLES}>My vehicles on Ísland.is</Ext> (<span lang="is" className="is">Mínar síður → Eignir → Ökutæki</span>).
        </li>
        <li>Open your vehicle. Its odometer history (<span lang="is" className="is">kílómetrastaða</span>) lists every reading with its date and km.</li>
        <li>
          Enter the two latest readings you registered. Readings taken at repair shops, for insurance claims or in police
          checks don&apos;t count toward your average, so skip those.
        </li>
      </ol>
      <p className="help">
        <strong>No new reading yet?</strong> Register one at <Ext href={REGISTER}>Register odometer reading</Ext>
        {" "}(<span lang="is" className="is">Skrá kílómetrastöðu</span>) or in the Ísland.is app. Enter the km shown on your dashboard. You can
        register once every 30 days; a wrong entry can be fixed the same day, until midnight.
      </p>
    </details>
  );
}

export function BillsGuide() {
  return (
    <details className="howto">
      <summary>Where to find your monthly bills</summary>
      <ul>
        <li>The payment slip (<span lang="is" className="is">greiðsluseðill</span>) for each month is in your online bank.</li>
        <li>
          The statement is also in your <Ext href={MAILBOX}>Ísland.is mailbox</Ext> (<span lang="is" className="is">Pósthólf</span>).
          If you own more than one vehicle, one statement covers them all; use the amount for this vehicle.
        </li>
      </ul>
    </details>
  );
}
