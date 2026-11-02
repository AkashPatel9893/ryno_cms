import { configureStore } from "@reduxjs/toolkit";
import { sessionReducer } from "@/lib/store/session-slice";
import { workspaceReducer } from "@/lib/store/workspace-slice";

export const makeStore = () =>
  configureStore({
    reducer: { workspace: workspaceReducer, session: sessionReducer },
  });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
