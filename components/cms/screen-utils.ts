import type { Actions, Period } from "@/lib/cms/types";
export type ScreenProps = {
  period: Period;
  actions: Actions;
};
export async function attempt(actions: Actions, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    actions.notify(
      error instanceof Error ? error.message : "Request failed. Try again.",
    );
  }
}
