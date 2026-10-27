import { z } from "zod";

/** What a captain fills in on the registration page. */
export const registrationSchema = z.object({
  teamName: z.string().trim().min(2, "Team name must be at least 2 characters").max(60),
  captainName: z.string().trim().min(1, "Your name is required").max(100),
  captainEmail: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
