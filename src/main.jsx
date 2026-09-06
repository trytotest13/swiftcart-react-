import React from "react";
import ReactDOM from "react-dom/client";
import LegacyPage from "./pages/LegacyPage.jsx";
import { css } from "./content/storefrontStyle.js";
import { bodyHtml } from "./content/storefrontBody.js";
import { scriptSrc } from "./content/storefrontScript.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LegacyPage css={css} bodyHtml={bodyHtml} scriptSrc={scriptSrc} />
  </React.StrictMode>
);
