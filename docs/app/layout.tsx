import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { ChromeFrame } from "@/components/chrome-frame"
import { SITE } from "@/lib/site"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} docs`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  metadataBase: new URL("https://github.com/CryptoZephyr/elenchos"),
  icons: { icon: "/favicon.svg" },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans antialiased">
      <body>
        <ThemeProvider defaultTheme="light" enableSystem={false}>
          <ChromeFrame>{children}</ChromeFrame>
        </ThemeProvider>
      </body>
    </html>
  )
}
