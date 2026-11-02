import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Period } from "@/lib/cms/types";

type WorkspaceState = {
  mobileNavigationOpen: boolean;
  period: Period | null;
};
const initialState: WorkspaceState = {
  mobileNavigationOpen: false,
  period: null,
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
  },
});
export const {
  setMobileNavigationOpen,
  setReportingPeriod,
  initializeReportingPeriod,
} = workspaceSlice.actions;
export const workspaceReducer = workspaceSlice.reducer;
