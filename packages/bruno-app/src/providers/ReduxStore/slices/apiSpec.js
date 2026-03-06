import { createSlice } from '@reduxjs/toolkit';
import { find } from 'lodash';
import toast from 'react-hot-toast';
import { storage } from 'utils/storage';

const initialState = {
  apiSpecs: [],
  activeApiSpecUid: null
};

export const apiSpecSlice = createSlice({
  name: 'apiSpec',
  initialState,
  reducers: {
    apiSpecAddFileEvent: (state, action) => {
      const { name, raw, uid, filename, pathname, json } = action?.payload?.data || {};
      if (!uid) {
        toast.error('Error adding API spec');
      }
      const apiSpec = findApiSpecByUid(state.apiSpecs, uid);
      if (apiSpec) {
        apiSpec.raw = raw;
        apiSpec.name = name;
        apiSpec.filename = filename;
        apiSpec.pathname = pathname;
        apiSpec.json = json;
      } else {
        const newApiSpec = {
          name,
          raw,
          uid,
          filename,
          pathname,
          json
        };
        state.apiSpecs.push(newApiSpec);
      }
      state.activeApiSpecUid = uid;
    },
    apiSpecChangeFileEvent: (state, action) => {
      const { name, raw, uid, filename, pathname, json } = action?.payload?.data || {};
      if (!uid) return;

      const apiSpec = findApiSpecByUid(state.apiSpecs, uid);
      if (apiSpec) {
        apiSpec.raw = raw;
        apiSpec.name = name;
        apiSpec.filename = filename;
        apiSpec.pathname = pathname;
        apiSpec.json = json;
      }
    },
    saveApiSpec: (state, action) => {
      const { content, uid } = action.payload;
      const apiSpec = findApiSpecByUid(state.apiSpecs, uid);
      if (apiSpec) {
        apiSpec.raw = content;
      }
    },
    setActiveApiSpecUid: (state, action) => {
      state.activeApiSpecUid = action.payload.uid;
    },
    removeApiSpec: (state, action) => {
      const { uid } = action.payload;
      let apiSpecIndex = state.apiSpecs.findIndex((c) => c.uid == uid);
      state.apiSpecs = state.apiSpecs.filter((c) => c.uid !== uid);
      let shiftedApiSpec = state.apiSpecs.at(apiSpecIndex);
      let lastApiSpec = state.apiSpecs.at(-1);
      state.activeApiSpecUid = shiftedApiSpec?.uid || lastApiSpec?.uid || null;
    }
  }
});

export const { apiSpecAddFileEvent, apiSpecChangeFileEvent, saveApiSpec, removeApiSpec, setActiveApiSpecUid } = apiSpecSlice.actions;

export default apiSpecSlice.reducer;

const findApiSpecByUid = (apiSpecs, uid) => {
  return find(apiSpecs, (apiSpec) => apiSpec.uid === uid);
};

export const openApiSpec = (workspaceUid = null) => async (dispatch, getState) => {
  const state = getState();
  const activeWorkspaceUid = workspaceUid || state.workspaces.activeWorkspaceUid;
  const spec = await storage.openApiSpec(activeWorkspaceUid);
  if (spec) {
    dispatch(apiSpecAddFileEvent({ data: spec }));
  }
};

export const saveApiSpecToFile = ({ uid, content }) => async (dispatch, getState) => {
  const state = getState();
  const apiSpec = findApiSpecByUid(state.apiSpec.apiSpecs, uid);
  if (!apiSpec) throw new Error('API spec not found');
  await storage.saveApiSpec(apiSpec.uid, content);
  dispatch(saveApiSpec({ content, uid }));
  toast.success('Saved API spec successfully!');
};

export const createApiSpecFile = (apiSpecName, apiSpecLocation, content, workspaceUid = null) => async (dispatch, getState) => {
  const state = getState();
  const activeWorkspaceUid = workspaceUid || state.workspaces.activeWorkspaceUid;
  const spec = await storage.createApiSpec(apiSpecName, apiSpecLocation, content, activeWorkspaceUid);
  dispatch(apiSpecAddFileEvent({ data: spec }));
  return spec;
};

export const closeApiSpecFile = ({ uid }) => async (dispatch, getState) => {
  const state = getState();
  const apiSpec = findApiSpecByUid(state.apiSpec.apiSpecs, uid);
  if (!apiSpec) throw new Error('API Spec not found');
  await storage.removeApiSpec(apiSpec.uid);
  dispatch(removeApiSpec({ uid }));
  const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === state.workspaces.activeWorkspaceUid);
  if (activeWorkspace) {
    const { loadWorkspaceApiSpecs } = require('./workspaces/actions');
    await dispatch(loadWorkspaceApiSpecs(activeWorkspace.uid));
  }
};
