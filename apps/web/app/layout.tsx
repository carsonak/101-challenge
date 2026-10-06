import type { ReactNode } from "react";
import "./style.css";

/**
 * Root Next.js layout for all web routes.
 * Receives route content as `children` and supplies the English document shell and global styles.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
