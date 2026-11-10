import { z } from "zod";

export const beaconEndpoint = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return false;
    }
    return (
      url.origin === "https://beacon-a5phantom.vercel.app" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/api\/v1\/projects\/[a-zA-Z0-9_-]+$/.test(url.pathname)
    );
  }, "Paste the project endpoint from hosted Beacon’s External app API panel.");

export const beaconSettingsInput = z
  .object({
    id: z.string().uuid().optional(),
    endpoint: beaconEndpoint,
    key: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => !value || /^bcn_[a-f0-9]{64}$/.test(value),
        "Enter a valid Beacon project API key.",
      ),
    allowedUserIds: z.array(z.string().uuid()).max(500),
  })
  .strict();

export const beaconConnectionId = z.union([z.string().uuid(), z.literal("legacy")]);
