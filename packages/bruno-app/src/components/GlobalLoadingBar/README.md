# Global Loading Indicator

A global loading bar that shows at the top of the application, tracking all async operations.

## Features

- ✅ **Auto-tracking**: Automatically tracks all `createAsyncThunk` actions
- ✅ **Top bar**: Linear progress bar (YouTube/GitHub style)
- ✅ **Bottom notification**: Optional message showing current operation
- ✅ **Multiple operations**: Handles simultaneous operations gracefully
- ✅ **Progress tracking**: Shows determinate or indeterminate progress
- ✅ **Manual control**: Can manually track custom operations

## Architecture

```
┌─────────────────────────────────────────┐
│     Global Loading Bar (Top)            │  ← Fixed at top
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
└─────────────────────────────────────────┘

                  ...app content...

┌─────────────────────────────────────────┐
│  [⟳] Loading collections... (2 ops)     │  ← Bottom-right notification
└─────────────────────────────────────────┘
```

## How It Works

### 1. Automatic Tracking (Recommended)

All `createAsyncThunk` actions are **automatically tracked**:

```javascript
// Redux thunk
export const fetchWorkspaces = createAsyncThunk(
  'workspaces/fetch',
  async () => {
    const response = await api.workspaces.getAll();
    return response.data;
  }
);

// When dispatched:
dispatch(fetchWorkspaces());
// ✅ Loading bar automatically appears with message "Loading workspaces..."
```

The middleware automatically:
1. Detects `pending` action → Start loading
2. Shows user-friendly message (defined in middleware)
3. Detects `fulfilled`/`rejected` → Complete loading

### 2. Manual Tracking

For non-thunk operations, use the `useGlobalLoading` hook:

```javascript
import useGlobalLoading from 'hooks/useGlobalLoading';

function MyComponent() {
  const loading = useGlobalLoading();

  const handleUpload = async (file) => {
    // Start loading
    const id = loading.start('Uploading file...');

    try {
      // Upload logic
      await uploadFile(file);

      // Complete loading
      loading.complete(id);
    } catch (error) {
      loading.complete(id);
      throw error;
    }
  };

  return <button onClick={handleUpload}>Upload</button>;
}
```

### 3. With Progress Tracking

For operations with progress (e.g., file upload):

```javascript
const handleUploadWithProgress = async (file) => {
  const id = loading.start('Uploading file...', 0);

  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const progress = e.loaded / e.total;
      loading.update(id, {
        progress,
        message: `Uploading file... ${Math.round(progress * 100)}%`
      });
    }
  });

  xhr.addEventListener('load', () => {
    loading.complete(id);
  });

  // ... upload logic
};
```

### 4. Using `wrap` Helper

Simplest way to track async functions:

```javascript
const result = await loading.wrap('Processing data...', async (reportProgress) => {
  // Do some work
  reportProgress(0.33);

  // More work
  reportProgress(0.66);

  // Final work
  reportProgress(1);

  return result;
});
```

## Customizing Messages

Edit the message map in `middlewares/globalLoading/middleware.js`:

```javascript
const ACTION_MESSAGES = {
  'auth/login': 'Signing in...',
  'workspaces/fetch': 'Loading workspaces...',
  'sync/push': 'Syncing to cloud...',
  // Add your custom messages here
};
```

## Excluding Actions

Some actions shouldn't show loading (e.g., silent background tasks):

```javascript
const EXCLUDED_ACTIONS = [
  'auth/refresh', // Silent token refresh
  'analytics/track', // Silent tracking
];
```

## Styling

The loading bar uses the app's theme. Customize in `StyledWrapper.js`:

```javascript
.progress-bar {
  height: 3px; // Bar thickness
  background: linear-gradient(90deg, #3b82f6, #8b5cf6); // Gradient colors
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); // Glow effect
}
```

## Examples

### Example 1: Login Flow

```javascript
// User clicks "Login" button
dispatch(login({ email, password }));

// Loading bar automatically shows:
// Top: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░
// Bottom: [⟳] Signing in...

// On success/error, automatically hides
```

### Example 2: Multiple Simultaneous Operations

```javascript
// Fetch workspaces and collections in parallel
dispatch(fetchWorkspaces());
dispatch(fetchCollections());

// Loading bar shows:
// Top: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░
// Bottom: [⟳] Loading collections... (2 operations)
```

### Example 3: Custom File Upload

```javascript
const handleFileUpload = async (file) => {
  const id = loading.start('Uploading...', 0);

  try {
    await uploadFile(file, (progress) => {
      loading.update(id, {
        progress,
        message: `Uploading... ${Math.round(progress * 100)}%`
      });
    });

    loading.complete(id);
    toast.success('Upload complete!');
  } catch (error) {
    loading.complete(id);
    toast.error('Upload failed');
  }
};
```

## Redux State

```javascript
{
  globalLoading: {
    isLoading: true,
    currentMessage: 'Loading collections...',
    operations: {
      'abc-123': {
        id: 'abc-123',
        message: 'Loading collections...',
        progress: null,  // null = indeterminate
        startedAt: 1234567890
      },
      'def-456': {
        id: 'def-456',
        message: 'Syncing to cloud...',
        progress: 0.75,  // 75% complete
        startedAt: 1234567891
      }
    }
  }
}
```

## API Reference

### `useGlobalLoading()`

```typescript
interface GlobalLoading {
  // Start a loading operation
  start(message: string, progress?: number | null): string;

  // Update operation progress or message
  update(id: string, options: { progress?: number; message?: string }): void;

  // Complete a loading operation
  complete(id: string): void;

  // Wrapper for async functions
  wrap<T>(message: string, asyncFn: (reportProgress: (p: number) => void) => Promise<T>): Promise<T>;
}
```

### Redux Actions

```javascript
import {
  startLoading,
  updateProgress,
  completeLoading,
  clearAllLoading
} from 'providers/ReduxStore/slices/globalLoading';

// Start loading
dispatch(startLoading({ id: 'unique-id', message: 'Loading...', progress: 0.5 }));

// Update progress
dispatch(updateProgress({ id: 'unique-id', progress: 0.75, message: 'Almost done...' }));

// Complete
dispatch(completeLoading({ id: 'unique-id' }));

// Clear all (useful on logout)
dispatch(clearAllLoading());
```

## Best Practices

1. **Use auto-tracking when possible**: Prefer `createAsyncThunk` for async operations
2. **Descriptive messages**: Use clear, user-friendly messages
3. **Report progress**: When available, report progress (0 to 1)
4. **Always complete**: Ensure `complete()` is called in both success and error cases
5. **Don't over-track**: Exclude frequent/silent operations from global loading

## Troubleshoading

**Loading bar never completes:**
- Check that `complete(id)` is called in all code paths (success, error, finally)
- Verify the ID passed to `complete()` matches the one from `start()`

**Loading bar doesn't appear:**
- Check if action is in `EXCLUDED_ACTIONS`
- Verify middleware is registered in Redux store
- Check browser console for errors

**Multiple bars appear:**
- This is normal for simultaneous operations
- The UI shows count: "(2 operations)"
- Each completes independently
