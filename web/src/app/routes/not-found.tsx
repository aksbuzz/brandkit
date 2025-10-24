import { useDocumentTitle } from '../../hooks';

const NotFound = () => {
  useDocumentTitle('Flippr - 404');

  return (
    <div className="mt-52 flex flex-col items-center font-semibold">
      <h1 className="text-error text-4xl">404</h1>
      <p className="text-dark my-2">We cannot find this page</p>
    </div>
  );
};

export default NotFound;
