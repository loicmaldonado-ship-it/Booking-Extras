import NextImage, { type ImageProps } from "next/image";
import { isPrivateStorageImage } from "@/lib/media/private-image";

// Même interface que next/image : seuls les médias privés contournent son
// cache public. Les images publiques conservent leur optimisation.
export default function Image(props: ImageProps) {
  return <NextImage {...props} unoptimized={isPrivateStorageImage(props.src) || props.unoptimized} />;
}
