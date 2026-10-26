import { useLocation } from 'react-router-dom';

/**
 * Reads the `?focus=<id>` query param that notifications append to links.
 * Returns the id plus `location.key`, which changes on every navigation —
 * so clicking the same notification again (even on the same page)
 * re-triggers the effect that opens the record.
 */
export const useFocusParam = (): { focusId: string | null; navKey: string } => {
  const location = useLocation();
  const focusId = new URLSearchParams(location.search).get('focus');
  return { focusId, navKey: location.key };
};

export default useFocusParam;
