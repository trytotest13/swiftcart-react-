import LegacyPage from "./LegacyPage.jsx";
import { css } from "../content/adminStyle.js";
import { bodyHtml } from "../content/adminBody.js";
import { scriptSrc } from "../content/adminScript.js";

export default function AdminPage() {
  return <LegacyPage css={css} bodyHtml={bodyHtml} scriptSrc={scriptSrc} />;
}
