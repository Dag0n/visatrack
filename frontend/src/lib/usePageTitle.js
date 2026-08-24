import { useEffect } from "react";

const BASE_TITLE = "VisaTrack UK";

// Sets the browser-tab title for a page ("Countries · VisaTrack UK") and
// restores the base title when the page unmounts.
export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
