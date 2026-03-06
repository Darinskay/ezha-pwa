import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

const MAX_DIMENSION = 1400;
const JPEG_QUALITY = 0.75;

const readImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image"));
    };
    image.src = url;
  });

const resizeImage = async (file: Blob): Promise<Blob> => {
  const image = await readImage(file);
  const maxSide = Math.max(image.width, image.height);

  if (maxSide <= MAX_DIMENSION) {
    return file;
  }

  const scale = MAX_DIMENSION / maxSide;
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image");
  }

  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to convert image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
};

export const storageService = {
  async uploadFoodImage(file: Blob, userId: string, entryId: string): Promise<string> {
    const processed = await resizeImage(file);
    const path = `${userId}/${entryId}.jpg`;
    const { error } = await supabase.storage
      .from(env.storageBucket)
      .upload(path, processed, { contentType: "image/jpeg", upsert: false });

    if (error) {
      throw new Error(error.message);
    }

    return path;
  }
};
