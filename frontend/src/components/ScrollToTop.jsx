import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Client-side navigation keeps the previous scroll position, which strands
// users mid-page when they follow a link from the bottom of a long table.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
