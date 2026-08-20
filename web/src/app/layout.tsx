import type { Metadata, Viewport } from "next";
import { Inter, Sora, DM_Serif_Display } from "next/font/google";
import "./globals.css";

/* Las fuentes se descargan en el build y se sirven desde nuestro dominio.
   El prototipo las pedía a Google en cada carga: más lento y un tercero
   menos del que depender. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--fuente-inter",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--fuente-sora",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--fuente-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nora — Tu hogar, en control",
  description:
    "Pedí un servicio para tu casa y seguí todo desde el celular. Precio claro y equipo propio de confianza.",
  applicationName: "Nora",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nora",
    statusBarStyle: "default",
  },
  openGraph: {
    title: "Nora — Tu hogar, en control",
    description:
      "Pedí un servicio para tu casa y seguí todo desde el celular. Precio claro y equipo propio de confianza.",
    type: "website",
    locale: "es_AR",
  },
};

/* themeColor va en viewport, no en metadata (Next 16).
   Ojo: NO ponemos maximumScale ni userScalable:false. El prototipo
   bloqueaba el zoom, lo que impide agrandar el texto a quien lo necesita. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e5c54",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body
        className={`${inter.variable} ${sora.variable} ${dmSerif.variable} font-sans min-h-dvh`}
      >
        {children}
      </body>
    </html>
  );
}
