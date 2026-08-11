import { useEffect, useState } from 'react';
import { DB_CONNECTION_EVENT, DB_DATA_EVENT } from '../utils/dbDataStore';

export function useDbDataRevision() {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision(value => value + 1);
    window.addEventListener(DB_DATA_EVENT, update);
    window.addEventListener(DB_CONNECTION_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(DB_DATA_EVENT, update);
      window.removeEventListener(DB_CONNECTION_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  return revision;
}
