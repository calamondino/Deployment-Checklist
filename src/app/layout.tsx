import type { Metadata } from "next";
import { ActorProvider } from "@/components/WhoAmI";
import { EditorBadge } from "@/components/EditorBadge";
import "./globals.css"; // behold hvis du har global css

export const metadata: Metadata = {
  title: "Deploy Checklists",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body className="bg-black text-white">
        <ActorProvider>
          {children}
          {/* Global redigerer-badge for alle sider */}
          <EditorBadge />
        </ActorProvider>
      </body>
    </html>
  );
}
