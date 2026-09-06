import LegacyPage from "./LegacyPage.jsx";
import { css } from "../content/storefrontStyle.js";
import { bodyHtml } from "../content/storefrontBody.js";
import { scriptSrc } from "../content/storefrontScript.js";

export default function StorefrontPage() {
  return <LegacyPage css={css} bodyHtml={bodyHtml} scriptSrc={scriptSrc} />;
}
