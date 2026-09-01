import QRCode from "qrcode";
import { notFound } from "next/navigation";

export const metadata = {
  title: "QR - Conto FF",
};

export default async function QRPage() {
  const url = "https://conto-ff.vercel.app/login";

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: "#ffffff",
        light: "#000000",
      },
    });
  } catch {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="QR Code - Conto FF Login"
          width={400}
          height={400}
          className="rounded-lg"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black">Conto FF</h1>
          <p className="text-gray-600 mt-1">Escaneá para ingresar</p>
        </div>
      </div>
    </div>
  );
}
