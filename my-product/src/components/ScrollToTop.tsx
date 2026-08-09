import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router's client-side navigation keeps whatever scroll offset the
// browser was already at — unlike a normal full-page navigation, it never
// resets to the top on its own. Mounted once at the app root so every route
// change scrolls back to the top without each page having to handle it.
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
