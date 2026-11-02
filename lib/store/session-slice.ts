import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type SessionState = { signedIn: boolean; checked: boolean };
const initialState: SessionState = { signedIn: false, checked: false };

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    setSignedIn(state, action: PayloadAction<boolean>) {
      state.signedIn = action.payload;
      state.checked = true;
    },
  },
});

export const { setSignedIn } = sessionSlice.actions;
export const sessionReducer = sessionSlice.reducer;
