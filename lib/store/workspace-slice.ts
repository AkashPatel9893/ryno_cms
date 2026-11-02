import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Period } from "@/lib/cms/types";

type WorkspaceState = {
  mobileNavigationOpen: boolean;
  period: Period | null;
  signedIn: boolean;
  revision: number;
};
const initialState: WorkspaceState = {
  mobileNavigationOpen: false,
  period: null,
  signedIn: false,
  revision: 0,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setMobileNavigationOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavigationOpen = action.payload;
    },
    setReportingPeriod(state, action: PayloadAction<Period>) {
      state.period = action.payload;
    },
    initializeReportingPeriod(state, action: PayloadAction<Period>) {
      state.period ??= action.payload;
    },
    setSignedIn(state, action: PayloadAction<boolean>) {
      state.signedIn = action.payload;
      if (!action.payload) state.mobileNavigationOpen = false;
    },
    refreshWorkspace(state) {
      state.revision += 1;
    },
  },
});
export const {
  setMobileNavigationOpen,
  setReportingPeriod,
  initializeReportingPeriod,
  setSignedIn,
  refreshWorkspace,
} = workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;
