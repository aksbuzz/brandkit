import { useLayoutEffect } from 'react';

export const useDocumentTitle = (title: string) => {
  useLayoutEffect(() => {
    if (title.trim().length > 0) {
      document.title = title;
    }
  }, [title]);
};
