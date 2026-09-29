import { profileUpdateSchema } from "./profileValidation";
import { updateUserProfile } from "../../services/users/userService";

export async function saveProfile(userId, values) {
  const validatedValues = profileUpdateSchema.parse(values);

  return updateUserProfile(userId, validatedValues);
}
