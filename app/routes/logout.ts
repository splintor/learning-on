import { authenticator } from "~/auth.server";

export const action = async ({ request }: { request: Request }) => {
  await authenticator.logout(request, { redirectTo: "/" });
};