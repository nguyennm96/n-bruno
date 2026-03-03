import { useDispatch } from 'react-redux';
import { startLoading, updateProgress, completeLoading } from 'providers/ReduxStore/slices/globalLoading';
import { v4 as uuidv4 } from 'uuid';

/**
 * Hook for manually controlling global loading state
 *
 * Usage:
 *   const loading = useGlobalLoading();
 *
 *   // Start loading
 *   const id = loading.start('Uploading file...');
 *
 *   // Update progress (optional)
 *   loading.update(id, { progress: 0.5, message: 'Uploading... 50%' });
 *
 *   // Complete loading
 *   loading.complete(id);
 */
export const useGlobalLoading = () => {
  const dispatch = useDispatch();

  /**
   * Start a loading operation
   * @param {string} message - Message to display
   * @param {number} progress - Initial progress (0 to 1), null for indeterminate
   * @returns {string} - Operation ID (use to update/complete)
   */
  const start = (message, progress = null) => {
    const id = uuidv4();

    dispatch(
      startLoading({
        id,
        message,
        progress
      })
    );

    return id;
  };

  /**
   * Update an operation's progress or message
   * @param {string} id - Operation ID
   * @param {object} options - { progress, message }
   */
  const update = (id, { progress, message }) => {
    dispatch(
      updateProgress({
        id,
        progress,
        message
      })
    );
  };

  /**
   * Complete a loading operation
   * @param {string} id - Operation ID
   */
  const complete = (id) => {
    dispatch(completeLoading({ id }));
  };

  /**
   * Async wrapper - automatically track async function
   * @param {string} message - Loading message
   * @param {function} asyncFn - Async function to execute
   */
  const wrap = async (message, asyncFn) => {
    const id = start(message);

    try {
      const result = await asyncFn((progress) => {
        // Allow async function to report progress
        update(id, { progress });
      });

      complete(id);
      return result;
    } catch (error) {
      complete(id);
      throw error;
    }
  };

  return {
    start,
    update,
    complete,
    wrap
  };
};

export default useGlobalLoading;
