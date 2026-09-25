declare module "react-native-qrcode-styled" {
  import type { ComponentType } from "react";
  const QRCode: ComponentType<{ data: string; pieceSize?: number;
    version?: number;
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    padding?: number }>;
  export default QRCode;
}
