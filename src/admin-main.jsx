import React from "react";
import ReactDOM from "react-dom/client";
import LegacyPage from "./pages/LegacyPage.jsx";
import { css } from "./content/adminStyle.js";
import { bodyHtml } from "./content/adminBody.js";
import { scriptSrc } from "./content/adminScript.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LegacyPage css={css} bodyHtml={bodyHtml} scriptSrc={scriptSrc} />
  </React.StrictMode>
);
