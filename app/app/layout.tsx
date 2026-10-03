export const metadata = { title: "Setlo", description: "Conditional multi-party booking settlement in USDG" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
