import type { ReactNode } from "react";
import "./style.css";
import Shell from "../components/shell";

/**
 * Root Next.js layout for all web routes.
 * Receives route content as `children` and supplies the English document shell and global styles.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script>{`try{document.documentElement.dataset.theme=localStorage.getItem("theme")||"system"}catch{}`}</script>
      </head>
      <body>
        <Shell />
        {children}
      </body>
    </html>
  );
}
